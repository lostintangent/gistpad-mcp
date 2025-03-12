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
import {
  archiveHandlers,
  basicHandlers,
  commentHandlers,
  dailyHandlers,
  fileHandlers,
  starHandlers,
} from "./tools/index.js";
import { Gist, GistHandlerContext } from "./types.js";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  throw new Error("GITHUB_TOKEN environment variable is required");
}

class GistpadServer {
  private server: Server;
  private axiosInstance;

  private gists: Gist[] | null = null;
  private starredGists: Gist[] | null = null;
  private dailyNotesGistId: string | null = null;

  private async findDailyNotesGistId(gists: Gist[]): Promise<string> {
    if (this.dailyNotesGistId) {
      return this.dailyNotesGistId;
    }

    const dailyNotesGist = gists.find(
      (gist) => gist.description === "📆 Daily notes"
    );

    if (!dailyNotesGist) {
      throw new McpError(ErrorCode.InternalError, "Daily notes gist not found");
    }

    this.dailyNotesGistId = dailyNotesGist.id;
    return dailyNotesGist.id;
  }

  private filterGists(gists: Gist[]): Gist[] {
    return gists.filter((gist: Gist) => {
      const files = Object.entries(gist.files);
      return files.every(([_, file]) => file.language === "Markdown" || file.filename.endsWith(".tldraw"));
    });
  }

  private async fetchAllGists(): Promise<Gist[]> {
    if (this.gists !== null) {
      return this.gists;
    }

    const allGists: Gist[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await this.axiosInstance.get<Gist[]>("/gists", {
        params: {
          per_page: perPage,
          page: page,
        },
      });

      const gists = response.data
      const filteredGists = this.filterGists(gists);
      allGists.push(...filteredGists);

      if (gists.length < perPage) {
        break;
      }

      page++;
    }

    this.gists = allGists;

    // Find and set daily notes gist ID
    await this.findDailyNotesGistId(allGists);

    return allGists;
  }

  private async fetchStarredGists(): Promise<Gist[]> {
    if (this.starredGists !== null) {
      return this.starredGists;
    }

    const response = await this.axiosInstance.get<Gist[]>("/gists/starred");
    this.starredGists = this.filterGists(response.data);

    return this.starredGists;
  }

  private addGistToCache(gist: Gist) {
    if (this.gists) {
      if (!this.gists.some(g => g.id === gist.id)) {
        this.gists.push(gist);
      }
    }
  }

  private removeGistFromCache(gistId: string) {
    if (this.gists) {
      this.gists = this.gists.filter(g => g.id !== gistId);
    }
  }

  private addStarredGist(gist: Gist) {
    if (this.starredGists) {
      if (!this.starredGists.some(g => g.id === gist.id)) {
        this.starredGists.push(gist);
      }
    }
  }

  private removeStarredGist(gistId: string) {
    if (this.starredGists) {
      this.starredGists = this.starredGists.filter(g => g.id !== gistId);
    }
  }

  constructor() {
    this.server = new Server(
      {
        name: "gistpad",
        version: "0.1.0",
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.axiosInstance = axios.create({
      baseURL: "https://api.github.com",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    this.setupResourceHandlers();
    this.setupToolHandlers();

    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupResourceHandlers() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const context: GistHandlerContext = {
        fetchAllGists: () => this.fetchAllGists(),
        fetchStarredGists: () => this.fetchStarredGists(),
        updateGistInCache: (gist: Gist) => {
          if (this.gists) {
            const index = this.gists.findIndex((g) => g.id === gist.id);
            if (index !== -1) {
              this.gists[index] = gist;
            }
          }
        },
        invalidateCache: () => {
          this.gists = null;
        },
        axiosInstance: this.axiosInstance,
        dailyNotesGistId: this.dailyNotesGistId,

        addGistToCache: (gist) => this.addGistToCache(gist),
        removeGistFromCache: (gistId) => this.removeGistFromCache(gistId),

        addStarredGist: (gist) => this.addStarredGist(gist),
        removeStarredGist: (gistId) => this.removeStarredGist(gistId),
      };
      return await resourceHandlers.listResources(context);
    });

    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        const context: GistHandlerContext = {
          fetchAllGists: () => this.fetchAllGists(),
          fetchStarredGists: () => this.fetchStarredGists(),
          updateGistInCache: (gist: Gist) => {
            if (this.gists) {
              const index = this.gists.findIndex((g) => g.id === gist.id);
              if (index !== -1) {
                this.gists[index] = gist;
              }
            }
          },
          invalidateCache: () => {
            this.gists = null;
          },
          axiosInstance: this.axiosInstance,
          dailyNotesGistId: this.dailyNotesGistId,

          addGistToCache: (gist) => this.addGistToCache(gist),
          removeGistFromCache: (gistId) => this.removeGistFromCache(gistId),

          addStarredGist: (gist) => this.addStarredGist(gist),
          removeStarredGist: (gistId) => this.removeStarredGist(gistId),
        };
        return await resourceHandlers.readResource(request.params.uri, context);
      }
    );
  }

  private setupToolHandlers() {
    const tools = [
      ...basicHandlers.tools,
      ...fileHandlers.tools,
      ...starHandlers.tools,
      ...archiveHandlers.tools,
      ...dailyHandlers.tools,
      ...commentHandlers.tools,
    ];

    this.server.setRequestHandler(ListToolsRequestSchema, () => ({ tools }));

    const context: GistHandlerContext = {
      fetchAllGists: () => this.fetchAllGists(),
      fetchStarredGists: () => this.fetchStarredGists(),
      updateGistInCache: (gist: Gist) => {
        if (this.gists) {
          const index = this.gists.findIndex((g) => g.id === gist.id);
          if (index !== -1) {
            this.gists[index] = gist;
          }
        }
      },
      invalidateCache: () => {
        this.gists = null;
      },
      axiosInstance: this.axiosInstance,
      dailyNotesGistId: this.dailyNotesGistId,

      addGistToCache: (gist) => this.addGistToCache(gist),
      removeGistFromCache: (gistId) => this.removeGistFromCache(gistId),

      addStarredGist: (gist) => this.addStarredGist(gist),
      removeStarredGist: (gistId) => this.removeStarredGist(gistId),
    };

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

        return await handler(request, context);
      } catch (error) {
        if (axios.isAxiosError(error)) {
          throw new McpError(
            ErrorCode.InternalError,
            `GitHub API error: ${error.response?.data.message ?? error.message}`
          );
        }
        throw error;
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
  console.error("An error occurred while running the GistPad server:", error);
  process.exit(1);
});
