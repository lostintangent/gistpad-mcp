import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { Gist, ToolModule } from "../types.js";
import { isArchivedGist, isDailyNoteGist, mcpGist } from "../utils.js";

export default {
    definitions: [
        {
            name: "list_archived_gists",
            description: "List all of your archived gists",
            inputSchema: {
                type: "object",
                properties: {},
                required: [],
            },
        },
        {
            name: "archive_gist",
            description: "Archive a gist by",
            inputSchema: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                        description: "The ID of the gist to archive",
                    },
                },
                required: ["id"],
            },
        },
        {
            name: "unarchive_gist",
            description: "Unarchive a gist",
            inputSchema: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                        description: "The ID of the gist to unarchive",
                    },
                },
                required: ["id"],
            },
        },
    ],

    handlers: {
        list_archived_gists: async (_, context) => {
            const gists = await context.gistStore.getAll();
            const archivedGists = gists.filter(isArchivedGist);

            return {
                count: archivedGists.length,
                gists: archivedGists.map(mcpGist),
            };
        },

        archive_gist: async ({ id }, context) => {
            const gists = await context.gistStore.getAll();
            const gist = gists.find((g: Gist) => g.id === id);

            if (!gist) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `Gist with ID '${id}' not found`
                );
            }

            if (isDailyNoteGist(gist)) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "Cannot archive daily notes"
                );
            }

            if (isArchivedGist(gist)) {
                throw new McpError(ErrorCode.InvalidParams, "Gist is already archived");
            }

            const newDescription = `${gist.description || ""} [Archived]`.trim();
            const response = await context.axiosInstance.patch(`/${id}`, {
                description: newDescription,
            });

            context.gistStore.update(response.data);

            return "Gist archived successfully";
        },

        unarchive_gist: async ({ id }, context) => {
            const gists = await context.gistStore.getAll();
            const gist = gists.find((g: Gist) => g.id === id);

            if (!gist) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `Gist with ID "${id}" not found`
                );
            }

            if (!isArchivedGist(gist)) {
                throw new McpError(ErrorCode.InvalidParams, "Gist is not archived");
            }

            const newDescription = gist.description.replace(/ \[Archived\]$/, "");
            const response = await context.axiosInstance.patch(`/${id}`, {
                description: newDescription,
            });

            context.gistStore.update(response.data);

            return "Gist unarchived successfully";
        },
    },
} as ToolModule;
