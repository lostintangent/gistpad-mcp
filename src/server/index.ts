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
import matter from "gray-matter";
import path from "node:path";
import { resourceHandlers } from "../resources/gists.js";
import type { RequestContext, ServerConfig } from "#types";
import { createFetchClient, type FetchClient } from "./fetch.js";
import { StarredGistStore, YourGistStore } from "./store.js";
import { registerTools } from "../tools/index.js";

const GIST_CACHE_REFRESH_INTERVAL_MS = 1_000 * 60 * 60; // 1 hour

export class GistpadServer {
  #server: McpServer;
  #fetchClient: FetchClient;
  #gistStore: YourGistStore;
  #starredGistStore: StarredGistStore;
  readonly #config: ServerConfig;

  constructor(config: ServerConfig) {
    this.#config = config;
    this.#fetchClient = createFetchClient({
      baseURL: "https://api.github.com/gists",
      headers: {
        Authorization: `Bearer ${config.githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    this.#server = new McpServer(
      {
        name: "gistpad",
        version: config.version,
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

    this.#gistStore = new YourGistStore(
      this.#fetchClient,
      this.#server,
      true,
      this.#config.markdownOnly,
    );

    // Only trigger notifications for starred gists if they're included in the resource list
    this.#starredGistStore = new StarredGistStore(
      this.#fetchClient,
      this.#server,
      this.#config.includeStarred,
      this.#config.markdownOnly,
    );

    // Create shared context once for all handlers
    const context = this.#createRequestContext();

    this.#setupResourceHandlers(context);
    this.#setupSubscriptionHandlers();

    if (this.#config.includePrompts) {
      this.#setupPromptHandlers();
    }

    registerTools(this.#server, context, this.#config);

    process.on("SIGINT", async () => {
      await this.#server.close();
      process.exit(0);
    });

    // Schedule an hourly background refresh
    setInterval(async () => {
      console.error("Refreshing gist cache...");

      await Promise.all([this.#gistStore.refresh(), this.#starredGistStore.refresh()]);
    }, GIST_CACHE_REFRESH_INTERVAL_MS);
  }

  #createRequestContext(): RequestContext {
    return {
      server: this.#server,
      gistStore: this.#gistStore,
      starredGistStore: this.#starredGistStore,
      fetchClient: this.#fetchClient,
      includeArchived: this.#config.includeArchived,
      includeStarred: this.#config.includeStarred,
      includeDaily: this.#config.includeDaily,
    };
  }

  #setupResourceHandlers(context: RequestContext) {
    // Use the underlying Server for low-level request handlers
    this.#server.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return resourceHandlers.listResources(context);
    });

    this.#server.server.setRequestHandler(
      ReadResourceRequestSchema,
      async ({ params: { uri } }) => {
        return resourceHandlers.readResource(uri, context);
      },
    );

    this.#server.server.setRequestHandler(ListResourceTemplatesRequestSchema, () =>
      resourceHandlers.listResourceTemplates(),
    );
  }

  #setupSubscriptionHandlers() {
    this.#server.server.setRequestHandler(SubscribeRequestSchema, async ({ params: { uri } }) => {
      this.#gistStore.subscribe(uri);
      return { success: true };
    });

    this.#server.server.setRequestHandler(UnsubscribeRequestSchema, async ({ params: { uri } }) => {
      this.#gistStore.unsubscribe(uri);
      return { success: true };
    });
  }

  #setupPromptHandlers() {
    this.#server.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      const promptsGist = await this.#gistStore.getPrompts();
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
          let args = data["arguments"]
            ? Object.entries(data["arguments"]).map(([name, description]) => ({
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
              const uniqueArgs = new Set(
                matches
                  .map((match) => match[1])
                  .filter((name): name is string => name !== undefined),
              );
              args = [...uniqueArgs].map((name) => ({
                name,
                description: "",
                required: true,
              }));
            }
          }

          return {
            name,
            description: (data["description"] as string | undefined) ?? "",
            arguments: args,
          };
        });

      return { prompts };
    });

    this.#server.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const promptsGist = await this.#gistStore.getPrompts();
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

      for (const [key, value] of Object.entries(request.params.arguments ?? {})) {
        textContent = textContent.replaceAll(`{{${key}}}`, value);
      }

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
    await this.#server.connect(transport);
    console.error("GistPad MCP server running on stdio");
  }
}
