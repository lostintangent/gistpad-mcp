import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { RequestContext, ServerConfig, ToolEntry } from "../types.js";
import archiveTools from "./archive.js";
import commentTools from "./comments.js";
import dailyTools from "./daily.js";
import fileTools from "./files.js";
import gistTools from "./gist.js";
import promptTools from "./prompts.js";
import refreshTools from "./refresh.js";
import starTools from "./star.js";

/** Core tools that are always registered */
const coreTools: ToolEntry[] = [...commentTools, ...fileTools, ...gistTools, ...refreshTools];

/**
 * Converts a snake_case tool name to a Title Case string.
 * e.g., "list_archived_gists" -> "List Archived Gists"
 */
function toTitleCase(name: string): string {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Prefixes that indicate a tool is read-only (no side effects). */
const READ_ONLY_PREFIXES = ["list_", "get_", "refresh_"];

/** Prefixes that indicate a tool is destructive (deletes data). */
const DESTRUCTIVE_PREFIXES = ["delete_"];

/**
 * Computes default annotations for a tool based on its name.
 * - Adds readOnlyHint: true for read-only tools
 * - Adds destructiveHint: false for non-read, non-delete tools
 * - Adds title derived from name (if not explicitly set)
 */
function getDefaultAnnotations(name: string, existing?: ToolAnnotations): ToolAnnotations {
  const isReadOnly = READ_ONLY_PREFIXES.some((prefix) => name.startsWith(prefix));
  const isDestructive = DESTRUCTIVE_PREFIXES.some((prefix) => name.startsWith(prefix));
  const isNonDestructiveWrite = !isReadOnly && !isDestructive;

  return {
    // Auto-set readOnlyHint for list/get tools
    ...(isReadOnly && { readOnlyHint: true }),
    // Auto-set destructiveHint: false for non-read, non-delete tools
    ...(isNonDestructiveWrite && { destructiveHint: false }),
    // Spread explicit annotations (can override auto-derived values)
    ...existing,
    // Auto-derive title from name (only if not explicitly set)
    title: existing?.title ?? toTitleCase(name),
  };
}

/**
 * Registers tools with the McpServer, applying default annotations.
 * Core tools are always registered; optional tools (archive, daily, prompts)
 * are registered based on the provided options.
 */
export function registerTools(
  server: McpServer,
  context: RequestContext,
  config: ServerConfig,
): void {
  const tools: ToolEntry[] = [
    ...coreTools,
    ...(config.includeArchived ? archiveTools : []),
    ...(config.includeDaily ? dailyTools : []),
    ...(config.includePrompts ? promptTools : []),
    ...(config.includeStarred ? starTools : []),
  ];

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: getDefaultAnnotations(tool.name, tool.annotations),
      },
      async (args: Record<string, unknown>) => {
        const result = await tool.handler(args, context);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      },
    );
  }
}
