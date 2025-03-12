import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { HandlerModule } from "../types.js";

export const archiveHandlers: HandlerModule = {
    tools: [
        {
            name: "list_archived_gists",
            description: "List all archived gists (gists with [Archived] in description)",
            inputSchema: {
                type: "object",
                properties: {},
                required: [],
            },
        },
        {
            name: "archive_gist",
            description: "Archive a gist by appending [Archived] to its description",
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
            description: "Unarchive a gist by removing [Archived] from its description",
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
        list_archived_gists: async (request, context) => {
            const gists = await context.fetchAllGists();
            const archivedGists = gists.filter(
                (gist) => gist.description?.endsWith(" [Archived]")
            );
            return {
                count: archivedGists.length,
                gists: archivedGists.map((gist) => ({
                    id: gist.id,
                    description: gist.description.replace(/ \[Archived\]$/, ""),
                    files: Object.keys(gist.files),
                    created_at: gist.created_at,
                }))
            };
        },

        archive_gist: async (request, context) => {
            const gistId = String(request.params.arguments?.id);
            const gists = await context.fetchAllGists();
            const gist = gists.find(g => g.id === gistId);

            if (!gist) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `Gist with ID '${gistId}' not found`
                );
            }

            if (gist.description === "📆 Daily notes") {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "Cannot archive daily notes gist"
                );
            }

            if (gist.description?.endsWith(" [Archived]")) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "Gist is already archived"
                );
            }

            const response = await context.axiosInstance.patch(`/gists/${gistId}`, {
                description: `${gist.description || ""} [Archived]`.trim(),
            });

            context.updateGistInCache(response.data);

            return {
                id: response.data.id,
                description: response.data.description.replace(/ \[Archived\]$/, ""),
                message: "Gist archived successfully",
            };
        },

        unarchive_gist: async (request, context) => {
            const gistId = String(request.params.arguments?.id);
            const gists = await context.fetchAllGists();
            const gist = gists.find(g => g.id === gistId);

            if (!gist) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `Gist with ID '${gistId}' not found`
                );
            }

            if (!gist.description?.endsWith(" [Archived]")) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "Gist is not archived"
                );
            }

            const newDescription = gist.description.replace(/ \[Archived\]$/, "");
            const response = await context.axiosInstance.patch(`/gists/${gistId}`, {
                description: newDescription,
            });

            context.updateGistInCache(response.data);

            return {
                id: response.data.id,
                description: response.data.description,
                message: "Gist unarchived successfully",
            };
        },
    },
};
