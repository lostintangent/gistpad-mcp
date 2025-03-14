#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { resourceHandlers } from "./resources/gists.js";
import { StarredGistStore, YourGistStore } from "./store.js";
import {
  archiveHandlers,
  basicHandlers,
  commentHandlers,
  dailyHandlers,
  fileHandlers,
  starHandlers,
} from "./tools/index.js";
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
        version: "0.2.2",
      },
      {
        capabilities: {
          resources: {
            subscribe: false,

            // This server will notify clients anytime that a gist
            // is added, deleted, renamed or duplicated.
            listChanged: true,
          },
          tools: {
            // This isn't applicable to this MCP server, since there
            // aren't any scenarios where tool availability is dynamic.
            listChanged: false,
          },
        },
      }
    );

    this.gistStore = new YourGistStore(
      this.axiosInstance,
      () => this.server.sendResourceListChanged()
    );

    this.starredGistStore = new StarredGistStore(this.axiosInstance);

    this.setupResourceHandlers();
    this.setupToolHandlers();

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
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: [
        ...basicHandlers.tools,
        ...fileHandlers.tools,
        ...starHandlers.tools,
        ...archiveHandlers.tools,
        ...dailyHandlers.tools,
        ...commentHandlers.tools,
      ]
    }));

    const toolHandlers = {
      ...basicHandlers.handlers,
      ...fileHandlers.handlers,
      ...starHandlers.handlers,
      ...archiveHandlers.handlers,
      ...dailyHandlers.handlers,
      ...commentHandlers.handlers,
    };

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
