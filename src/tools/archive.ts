import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { Gist, ToolModule } from "../types.js";

export const archiveHandlers: ToolModule = {
    tools: [
        {
            name: "list_archived_gists",
            description:
                "List all of your archived gists",
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
            description:
                "Unarchive a gist",
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
        list_archived_gists: async (args, context) => {
            const gists = await context.gistStore.getAll();
            const archivedGists = gists.filter((gist: Gist) =>
                gist.description?.endsWith(" [Archived]")
            );
            return {
                count: archivedGists.length,
                gists: archivedGists.map((gist) => ({
                    id: gist.id,
                    description: gist.description.replace(/ \[Archived\]$/, ""),
                    files: Object.keys(gist.files),
                    created_at: gist.created_at,
                    updated_at: gist.updated_at,
                })),
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

            if (gist.description === "📆 Daily notes") {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "Cannot archive daily notes"
                );
            }

            if (gist.description?.endsWith(" [Archived]")) {
                throw new McpError(ErrorCode.InvalidParams, "Gist is already archived");
            }

            const response = await context.axiosInstance.patch(`/${id}`, {
                description: `${gist.description || ""} [Archived]`.trim(),
            });

            context.gistStore.update(response.data);

            return {
                id: response.data.id,
                description: response.data.description.replace(/ \[Archived\]$/, ""),
                message: "Gist archived successfully",
            };
        },

        unarchive_gist: async ({ id }, context) => {
            const gists = await context.gistStore.getAll();
            const gist = gists.find((g: Gist) => g.id === id);

            if (!gist) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `Gist with ID '${id}' not found`
                );
            }

            if (!gist.description?.endsWith(" [Archived]")) {
                throw new McpError(ErrorCode.InvalidParams, "Gist is not archived");
            }

            const newDescription = gist.description.replace(/ \[Archived\]$/, "");
            const response = await context.axiosInstance.patch(`/${id}`, {
                description: newDescription,
            });

            context.gistStore.update(response.data);

            return {
                id: response.data.id,
                description: response.data.description,
                message: "Gist unarchived successfully",
            };
        },
    },
};
