#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ErrorCode,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  McpError,
  ReadResourceRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import matter from "gray-matter";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resourceHandlers } from "./resources/gists.js";
import { StarredGistStore, YourGistStore } from "./store.js";
import { registerTools } from "./tools/index.js";
import { RequestContext, ServerConfig } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8"),
);
const VERSION = packageJson.version;

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  throw new Error("GITHUB_TOKEN environment variable is required");
}

const GIST_CACHE_REFRESH_INTERVAL_MS = 1000 * 60 * 60; // 1 hour

class GistpadServer {
  private server: McpServer;
  private axiosInstance;

  private gistStore: YourGistStore;
  private starredGistStore: StarredGistStore;

  private readonly config: ServerConfig = {
    markdownOnly: process.argv.includes("--markdown"),
    includeStarred: process.argv.includes("--starred"),
    includeArchived: process.argv.includes("--archived"),
    includeDaily: process.argv.includes("--daily"),
    includePrompts: process.argv.includes("--prompts"),
  };

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: "https://api.github.com/gists",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    this.server = new McpServer(
      {
        name: "gistpad",
        version: VERSION,
      },
      {
        capabilities: {
          resources: {
            // If a client wants to subscribe to changes
            // to a specific gist, they can do that.
            subscribe: true,

            // This server will notify clients anytime that a gist
            // is added, deleted, renamed or duplicated.
            listChanged: true,
          },
          tools: {
            // This isn't applicable to this MCP server, since there
            // aren't any scenarios where tool availability is dynamic.
            listChanged: false,
          },
          prompts: {
            // When the user adds/deletes a prompt then we'll
            // notify the client, so they can update their list of prompts.
            listChanged: true,
          },
        },
        instructions: `GistPad allows you to manage your personal knowledge/daily notes/todos, and create re-usable prompts, using GitHub Gists.
To read gists, notes, and gist comments, prefer using the available resources vs. tools. And then use the available tools to create, update, delete, archive, star, etc. your gists.`,
      },
    );

    this.gistStore = new YourGistStore(
      this.axiosInstance,
      this.server,
      true,
      this.config.markdownOnly,
    );

    // Only trigger notifications for starred gists if they're included in the resource list
    this.starredGistStore = new StarredGistStore(
      this.axiosInstance,
      this.server,
      this.config.includeStarred,
      this.config.markdownOnly,
    );

    // Create shared context once for all handlers
    const context = this.createRequestContext();

    this.setupResourceHandlers(context);
    this.setupSubscriptionHandlers();

    if (this.config.includePrompts) {
      this.setupPromptHandlers();
    }

    registerTools(this.server, context, this.config);

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });

    // Schedule an hourly background refresh
    setInterval(async () => {
      console.error("Refreshing gist cache...");

      await Promise.all([this.gistStore.refresh(), this.starredGistStore.refresh()]);
    }, GIST_CACHE_REFRESH_INTERVAL_MS);
  }

  private createRequestContext(): RequestContext {
    return {
      server: this.server,
      gistStore: this.gistStore,
      starredGistStore: this.starredGistStore,
      axiosInstance: this.axiosInstance,
      includeArchived: this.config.includeArchived,
      includeStarred: this.config.includeStarred,
      includeDaily: this.config.includeDaily,
    };
  }

  private setupResourceHandlers(context: RequestContext) {
    // Use the underlying Server for low-level request handlers
    this.server.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return resourceHandlers.listResources(context);
    });

    this.server.server.setRequestHandler(ReadResourceRequestSchema, async ({ params: { uri } }) => {
      return resourceHandlers.readResource(uri, context);
    });

    this.server.server.setRequestHandler(ListResourceTemplatesRequestSchema, () =>
      resourceHandlers.listResourceTemplates(),
    );
  }

  private setupSubscriptionHandlers() {
    this.server.server.setRequestHandler(SubscribeRequestSchema, async ({ params: { uri } }) => {
      this.gistStore.subscribe(uri);
      return { success: true };
    });

    this.server.server.setRequestHandler(UnsubscribeRequestSchema, async ({ params: { uri } }) => {
      this.gistStore.unsubscribe(uri);
      return { success: true };
    });
  }

  private setupPromptHandlers() {
    this.server.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      const promptsGist = await this.gistStore.getPrompts();
      if (!promptsGist) {
        return {
          prompts: [],
        };
      }

      const prompts = Object.entries(promptsGist.files)
        .filter(([filename]) => path.extname(filename) === ".md")
        .map(([filename, file]) => {
          const name = path.basename(filename, ".md");
          const { data, content } = matter(file.content);
          let args = data.arguments
            ? Object.entries(data.arguments).map(([name, description]) => ({
                name,
                description: description as string,
                required: true,
              }))
            : undefined;

          // If no arguments defined in frontmatter, check content for placeholders
          if (!args) {
            const matches = [...content.matchAll(/{{([a-zA-Z_-]+)}}/g)];
            if (matches.length > 0) {
              // Extract unique argument names
              const uniqueArgs = new Set(matches.map((match) => match[1]));
              args = [...uniqueArgs].map((name) => ({
                name,
                description: "",
                required: true,
              }));
            }
          }

          return {
            name,
            description: data.description || "",
            arguments: args,
          };
        });

      return { prompts };
    });

    this.server.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const promptsGist = await this.gistStore.getPrompts();
      if (!promptsGist) {
        throw new McpError(ErrorCode.InvalidRequest, "No prompts gist found");
      }

      const filename = `${request.params.name}.md`;
      const file = promptsGist.files[filename];
      if (!file) {
        throw new McpError(ErrorCode.InvalidRequest, `Prompt "${request.params.name}" not found`);
      }

      const { content } = matter(file.content);
      let textContent = content.trim();

      Object.keys(request.params.arguments || {}).forEach((key) => {
        textContent = textContent.replace(
          new RegExp(`{{${key}}}`, "g"),
          request.params.arguments![key],
        );
      });

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: textContent,
            },
          },
        ],
      };
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("GistPad MCP server running on stdio");
  }
}

const server = new GistpadServer();
server.run().catch((error) => {
  console.error("An error occurred while running the GistPad MCP server:", error);
  process.exit(1);
});
