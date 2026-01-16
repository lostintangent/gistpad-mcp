import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { Gist, ToolEntry } from "#types";
import {
  ARCHIVED_SUFFIX,
  ARCHIVED_SUFFIX_REGEX,
  findGistById,
  gistIdSchema,
  isArchivedGist,
  isDailyNoteGist,
  mcpGist,
} from "#utils";

export default [
  {
    name: "list_archived_gists",
    description: "List all of your archived gists",
    handler: async (_args, context) => {
      const gists = await context.gistStore.getAll();
      const archivedGists = gists.filter(isArchivedGist);

      return {
        count: archivedGists.length,
        gists: archivedGists.map(mcpGist),
      };
    },
  },
  {
    name: "archive_gist",
    description: "Archive a gist by ID",
    inputSchema: gistIdSchema,
    handler: async ({ id }, context) => {
      const gist = await findGistById(context, id as string);

      if (isDailyNoteGist(gist)) {
        throw new McpError(ErrorCode.InvalidParams, "Cannot archive daily notes");
      }

      if (isArchivedGist(gist)) {
        throw new McpError(ErrorCode.InvalidParams, "Gist is already archived");
      }

      const newDescription = `${gist.description ?? ""}${ARCHIVED_SUFFIX}`.trim();
      const updatedGist = await context.fetchClient.patch<Gist>(`/${id}`, {
        description: newDescription,
      });

      context.gistStore.update(updatedGist);

      return "Gist archived successfully";
    },
  },
  {
    name: "unarchive_gist",
    description: "Unarchive a gist",
    inputSchema: gistIdSchema,
    handler: async ({ id }, context) => {
      const gist = await findGistById(context, id as string);

      if (!isArchivedGist(gist)) {
        throw new McpError(ErrorCode.InvalidParams, "Gist is not archived");
      }

      const newDescription = gist.description.replace(ARCHIVED_SUFFIX_REGEX, "");
      const updatedGist = await context.fetchClient.patch<Gist>(`/${id}`, {
        description: newDescription,
      });

      context.gistStore.update(updatedGist);

      return "Gist unarchived successfully";
    },
  },
] as ToolEntry[];
