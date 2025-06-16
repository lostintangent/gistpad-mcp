import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { Gist, ToolModule } from "../types.js";
import {
    gistContent,
    isArchivedGist,
    isDailyNoteGist,
    isPromptGist,
    mcpGist,
} from "../utils.js";

export default {
    definitions: [
        {
            name: "list_gists",
            description:
                "List all of your GitHub Gists (excluding daily notes, prompts, and archived gists)",
            inputSchema: {
                type: "object",
                properties: {},
                required: [],
            },
        },
        {
            name: "get_gist",
            description:
                "Get the full contents of a GitHub Gist by ID (including file contents).",
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
                        description:
                            "Name of the file to create. This defaults to README.md, and so only specify it if explicity requested by the user, or you need to create a non-markdown file.",
                        default: "README.md",
                    },
                    content: {
                        type: "string",
                        description: "Contents of the new file",
                    },
                    public: {
                        type: "boolean",
                        description:
                            "Whether the Gist should be public (Defaults to false)",
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
        list_gists: async (_, context) => {
            const gists = await context.gistStore.getAll();
            const filteredGists = gists.filter(
                (gist) =>
                    !isDailyNoteGist(gist) && !isPromptGist(gist) && !isArchivedGist(gist)
            );

            return {
                count: filteredGists.length,
                gists: filteredGists.map(mcpGist),
            };
        },

        get_gist: async ({ id }, context) => {
            const { data: gist } = await context.axiosInstance.get(`/${id}`);

            context.gistStore.update(gist);

            return mcpGist(gist);
        },

        create_gist: async (args, context) => {
            const {
                description = "",
                filename = "README.md",
                content = "",
                public: isPublic = false,
            } = args;

            if (!description || !content) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "Description and content are required"
                );
            }

            const { data: gist } = await context.axiosInstance.post("", {
                description,
                public: isPublic,
                files: {
                    [filename as string]: {
                        content: gistContent(content as string),
                    },
                },
            });

            context.gistStore.add(gist);

            return mcpGist(gist);
        },

        delete_gist: async ({ id }, context) => {
            await context.axiosInstance.delete(`/${id}`);

            context.gistStore.remove(id as string);

            return "Successfully deleted gist";
        },

        update_gist_description: async ({ id, description }, context) => {
            if (!id || !description) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "ID and description are required"
                );
            }

            const { data: gist } = await context.axiosInstance.patch(`/${id}`, {
                description,
            });

            context.gistStore.update(gist);

            return "Successfully updated gist description";
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
            const { data: gist } = await context.axiosInstance.post("", {
                description: newDescription,
                public: sourceGist.public,
                files: Object.fromEntries(
                    Object.entries(sourceGist.files).map(([name, file]) => [
                        name,
                        { content: file.content },
                    ])
                ),
            });

            context.gistStore.add(gist);

            return mcpGist(gist);
        },
    },
} as ToolModule;
