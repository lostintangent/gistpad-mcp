import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { Gist, ToolModule, isArchivedGist, isDailyNoteGist } from "../types.js";

export const gistHandlers: ToolModule = {
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
            description: "Get the full contents of a GitHub Gist by ID (including files",
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
                    filename: {
                        type: "string",
                        description: "Name of the file to create (Defaults to README.md)",
                        default: "README.md",
                    },
                    content: {
                        type: "string",
                        description: "Contents of the new file",
                    },
                    public: {
                        type: "boolean",
                        description: "Whether the Gist should be public (Defaults to false)",
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
        list_gists: async (args, context) => {
            const gists = await context.gistStore.getAll();
            const filteredGists = gists.filter(
                (gist) => !isDailyNoteGist(gist) && !isArchivedGist(gist)
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

        get_gist: async ({ id }, context) => {
            const response = await context.axiosInstance.get(`/${id}`);
            const gist: Gist = response.data;

            context.gistStore.update(gist);

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

        create_gist: async (args, context) => {
            const { content, description = "", public: isPublic = false } = args;

            if (!description || !content) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "Description and content are required"
                );
            }

            const response = await context.axiosInstance.post("", {
                description,
                public: isPublic,
                files: {
                    ["README.md"]: {
                        content,
                    },
                },
            });

            context.gistStore.add(response.data);

            return {
                id: response.data.id,
                url: `https://gistpad.dev/#/${response.data.id}`,
                description,
            };
        },

        delete_gist: async ({ id }, context) => {
            await context.axiosInstance.delete(`/${id}`);

            context.gistStore.remove(id as string);

            return {
                message: "Successfully deleted gist",
            };
        },

        update_gist_description: async ({ id, description }, context) => {
            if (!id || !description) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "ID and description are required"
                );
            }

            const response = await context.axiosInstance.patch(`/${id}`, {
                description,
            });

            context.gistStore.update(response.data);

            return {
                id,
                description: response.data.description,
                message: "Successfully updated gist description",
            };
        },

        duplicate_gist: async ({ id }, context) => {
            const gists = await context.gistStore.getAll();
            const sourceGist = gists.find((gist: Gist) => gist.id === id);

            if (!sourceGist) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `Gist with ID ${id} not found`
                );
            }

            const newDescription = `${sourceGist.description || ""} (Copy)`.trim();
            const response = await context.axiosInstance.post("", {
                description: newDescription,
                public: sourceGist.public,
                files: Object.fromEntries(
                    Object.entries(sourceGist.files).map(([name, file]) => [
                        name,
                        { content: file.content },
                    ])
                ),
            });

            context.gistStore.add(response.data);

            return {
                source_id: id,
                new_id: response.data.id,
                description: newDescription,
                files: Object.keys(response.data.files),
                message: "Successfully duplicated gist",
            };
        },
    },
};
