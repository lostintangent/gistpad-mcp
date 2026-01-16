import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  ListResourcesResult,
  ListResourceTemplatesResult,
  ReadResourceResult,
  ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import type { StarredGistStore, YourGistStore } from "./server/store.js";
import type { FetchClient } from "./server/fetch.js";

// GitHub Gist API types

export interface GistComment {
  id: string;
  body: string;
  user: {
    login: string;
  };
  created_at: string;
  updated_at: string;
}

export interface GistFile {
  filename: string;
  type: string;
  language: string;
  raw_url: string;
  size: number;
  content: string;
}

export interface Gist {
  id: string;
  description: string;
  files: { [key: string]: GistFile };
  public: boolean;
  created_at: string;
  updated_at: string;
  owner: {
    login: string;
  };
  comments: number;
  url: string;
  share_url: string;
}

// MCP / GistPad server types

export interface RequestContext {
  server: McpServer;
  gistStore: YourGistStore;
  starredGistStore: StarredGistStore;
  fetchClient: FetchClient;
  includeArchived: boolean;
  includeStarred: boolean;
  includeDaily: boolean;
}

export type ToolHandler = (
  args: Record<string, unknown>,
  context: RequestContext,
) => Promise<unknown>;

/**
 * A unified tool entry that combines definition and handler.
 * Used by tool modules to export tools that get registered with McpServer.
 */
export interface ToolEntry {
  name: string;
  description: string;
  inputSchema?: z.ZodObject<z.ZodRawShape>;
  annotations?: ToolAnnotations;
  handler: ToolHandler;
}

export interface ResourceHandlers {
  listResources: (context: RequestContext) => Promise<ListResourcesResult>;
  listResourceTemplates: () => ListResourceTemplatesResult;
  readResource: (uri: string, context: RequestContext) => Promise<ReadResourceResult>;
}

/** Configuration options for the server */
export interface ServerConfig {
  /** GitHub personal access token for API authentication */
  githubToken: string;
  /** Server version from package.json */
  version: string;
  /** Only include markdown gists */
  markdownOnly: boolean;
  /** Include starred gists in resource list */
  includeStarred: boolean;
  /** Include archived gists in resource list */
  includeArchived: boolean;
  /** Include daily notes functionality */
  includeDaily: boolean;
  /** Include prompts functionality */
  includePrompts: boolean;
}
