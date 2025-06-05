#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import matter from "gray-matter";
import path from "node:path";
import { resourceHandlers } from "./resources/gists.js";
import { StarredGistStore, YourGistStore } from "./store.js";
import { toolDefinitions, toolHandlers } from "./tools/index.js";
import { RequestContext } from "./types.js";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  throw new Error("GITHUB_TOKEN environment variable is required");
}

class GistpadServer {
  private server: Server;
  private axiosInstance;

  private gistStore: YourGistStore;
  private starredGistStore: StarredGistStore;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: "https://api.github.com/gists",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    this.server = new Server(
      {
        name: "gistpad",
        version: "0.4.3",
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
        instructions: `GistPad allows you to manage your personal knowledge and daily notes/todos/etc. using GitHub Gists.
To read gists, notes, and gist comments, prefer using the available resources vs. tools. And then use the available tools to create, update, delete, archive, star, etc. your gists.`,
      }
    );

    const markdownOnly = process.argv.includes("--markdown");
    const includeStarred = process.argv.includes("--starred");

    this.gistStore = new YourGistStore(
      this.axiosInstance,
      this.server,
      true,
      markdownOnly
    );

    this.starredGistStore = new StarredGistStore(
      this.axiosInstance,
      this.server,
      includeStarred,
      markdownOnly
    );

    this.setupResourceHandlers();
    this.setupSubscriptionHandlers();
    this.setupToolHandlers();
    this.setupPromptHandlers();

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private createRequestContext(): RequestContext {
    return {
      gistStore: this.gistStore,
      starredGistStore: this.starredGistStore,
      axiosInstance: this.axiosInstance,
      includeArchived: process.argv.includes("--archived"),
      includeStarred: process.argv.includes("--starred"),
      includeDaily: process.argv.includes("--daily"),
    };
  }

  private setupResourceHandlers() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const context = this.createRequestContext();
      return resourceHandlers.listResources(context);
    });

    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async ({ params: { uri } }) => {
        const context = this.createRequestContext();
        return resourceHandlers.readResource(uri, context);
      }
    );

    this.server.setRequestHandler(ListResourceTemplatesRequestSchema, () =>
      resourceHandlers.listResourceTemplates()
    );
  }

  private setupSubscriptionHandlers() {
    this.server.setRequestHandler(
      SubscribeRequestSchema,
      async ({ params: { uri } }) => {
        this.gistStore.subscribe(uri);
        return { success: true };
      }
    );

    this.server.setRequestHandler(
      UnsubscribeRequestSchema,
      async ({ params: { uri } }) => {
        this.gistStore.unsubscribe(uri);
        return { success: true };
      }
    );
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: toolDefinitions,
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const handler = toolHandlers[request.params.name];
        if (!handler) {
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
        }

        const args = request.params.arguments || {};
        const context = this.createRequestContext();

        const result = await handler(args, context);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        throw new McpError(
          ErrorCode.InternalError,
          `An error occurred while executing the requested tool: ${error.message}`
        );
      }
    });
  }

  private setupPromptHandlers() {
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
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
          let args =
            data.arguments &&
            Object.entries(data.arguments).map(([name, description]) => ({
              name,
              description,
              required: true,
            }));

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

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const promptsGist = await this.gistStore.getPrompts();
      if (!promptsGist) {
        throw new McpError(ErrorCode.InvalidRequest, "No prompts gist found");
      }

      const filename = `${request.params.name}.md`;
      const file = promptsGist.files[filename];
      if (!file) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Prompt "${request.params.name}" not found`
        );
      }

      const { content } = matter(file.content);
      let textContent = content.trim();

      Object.keys(request.params.arguments || {}).forEach((key) => {
        textContent = textContent.replace(
          new RegExp(`{{${key}}}`, "g"),
          request.params.arguments![key]
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
  console.error(
    "An error occurred while running the GistPad MCP server:",
    error
  );
  process.exit(1);
});
