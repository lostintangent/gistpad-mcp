import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { Gist, HandlerModule } from "../types.js";

export const gistHandlers: HandlerModule = {
    tools: [
        {
            name: "list_gists",
            description:
                "List all of your GitHub Gists (excluding daily notes and archived gists)",
            inputSchema: {
                type: "object",
                properties: {},
                required: [],
            },
        },
        {
            name: "get_gist",
            description: "Get a specific GitHub Gist by ID",
            inputSchema: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                        description: "The ID of the Gist to retrieve",
                    },
                },
                required: ["id"],
            },
        },
        {
            name: "create_gist",
            description: "Create a new GitHub Gist",
            inputSchema: {
                type: "object",
                properties: {
                    description: {
                        type: "string",
                        description: "Description of the Gist",
                    },
                    content: {
                        type: "string",
                        description: "Content of the file",
                    },
                    public: {
                        type: "boolean",
                        description: "Whether the Gist should be public",
                        default: false,
                    },
                },
                required: ["description", "content"],
            },
        },
        {
            name: "delete_gist",
            description: "Delete a GitHub Gist by ID",
            inputSchema: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                        description: "The ID of the Gist to delete",
                    },
                },
                required: ["id"],
            },
        },
        {
            name: "update_gist_description",
            description: "Update a GitHub Gist's description",
            inputSchema: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                        description: "The ID of the Gist to update",
                    },
                    description: {
                        type: "string",
                        description: "The new description for the Gist",
                    },
                },
                required: ["id", "description"],
            },
        },
        {
            name: "duplicate_gist",
            description: "Create a copy of an existing gist",
            inputSchema: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                        description: "The ID of the Gist to duplicate",
                    },
                },
                required: ["id"],
            },
        },
    ],

    handlers: {
        list_gists: async (request, context) => {
            const gists = await context.fetchAllGists();
            const filteredGists = gists.filter(
                (gist) =>
                    gist.description !== "📆 Daily notes" &&
                    !gist.description?.endsWith(" [Archived]")
            );

            return {
                count: filteredGists.length,
                gists: filteredGists.map((gist) => ({
                    id: gist.id,
                    description: gist.description,
                    files: Object.keys(gist.files),
                    created_at: gist.created_at,
                    updated_at: gist.updated_at,
                    public: gist.public,
                    url: `https://gistpad.dev/#/${gist.id}`,
                    share_url: `https://gistpad.dev/#/share/${gist.id}`,
                })),
            };
        },

        get_gist: async (request, context) => {
            const gistId = String(request.params.arguments?.id);

            const response = await context.axiosInstance.get(`/gists/${gistId}`);
            const gist: Gist = response.data;

            context.updateGistInCache(gist);

            return {
                id: gist.id,
                description: gist.description,
                files: Object.fromEntries(
                    Object.entries(gist.files).map(([name, file]) => [
                        name,
                        {
                            content: file.content,
                            language: file.language,
                            size: file.size,
                        },
                    ])
                ),
                created_at: gist.created_at,
                updated_at: gist.updated_at,
                public: gist.public,
                url: `https://gistpad.dev/#/${gist.id}`,
                share_url: `https://gistpad.dev/#/share/${gist.id}`,
            };
        },

        create_gist: async (request, context) => {
            const {
                content,
                description = "",
                public: isPublic = false,
            } = request.params.arguments ?? {};

            if (!description || !content) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "Description and content are required"
                );
            }

            const response = await context.axiosInstance.post("/gists", {
                description,
                public: isPublic,
                files: {
                    ["README.md"]: {
                        content,
                    },
                },
            });

            context.addGistToCache(response.data);

            return {
                id: response.data.id,
                url: `https://gistpad.dev/#/${response.data.id}`,
                description,
            };
        },

        delete_gist: async (request, context) => {
            const gistId = String(request.params.arguments?.id);
            await context.axiosInstance.delete(`/gists/${gistId}`);

            return {
                message: "Successfully deleted gist",
            };
        },

        update_gist_description: async (request, context) => {
            const { id, description } = request.params.arguments ?? {};

            if (!id || !description) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "ID and description are required"
                );
            }

            const response = await context.axiosInstance.patch(`/gists/${id}`, {
                description,
            });

            context.updateGistInCache(response.data);

            return {
                id: response.data.id,
                description: response.data.description,
                message: "Successfully updated gist description",
            };
        },

        duplicate_gist: async (request, context) => {
            const gistId = String(request.params.arguments?.id);

            const gists = await context.fetchAllGists();
            const sourceGist = gists.find((gist) => gist.id === gistId);

            if (!sourceGist) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `Gist with ID ${gistId} not found`
                );
            }

            const newDescription = `${sourceGist.description || ""} (Copy)`.trim();
            const response = await context.axiosInstance.post("/gists", {
                description: newDescription,
                public: sourceGist.public,
                files: Object.fromEntries(
                    Object.entries(sourceGist.files).map(([name, file]) => [
                        name,
                        { content: file.content },
                    ])
                ),
            });

            context.addGistToCache(response.data);

            return {
                source_id: gistId,
                new_id: response.data.id,
                description: newDescription,
                files: Object.keys(response.data.files),
                message: "Successfully duplicated gist",
            };
        },
    },
};
