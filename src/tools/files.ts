import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { Gist, ToolModule } from "../types.js";

export const fileHandlers: ToolModule = {
    tools: [
        {
            name: "update_gist_file",
            description: "Update the content of a file in a gist",
            inputSchema: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                        description: "The ID of the gist",
                    },
                    filename: {
                        type: "string",
                        description: "The name of the file to update",
                    },
                    content: {
                        type: "string",
                        description: "The new content for the file",
                    },
                },
                required: ["id", "filename", "content"],
            },
        },
        {
            name: "add_gist_file",
            description: "Add a new file to a gist",
            inputSchema: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                        description: "The ID of the gist",
                    },
                    filename: {
                        type: "string",
                        description: "The name of the new file",
                    },
                    content: {
                        type: "string",
                        description: "The content for the new file",
                    },
                },
                required: ["id", "filename", "content"],
            },
        },
        {
            name: "delete_gist_file",
            description: "Delete a file from a gist",
            inputSchema: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                        description: "The ID of the gist",
                    },
                    filename: {
                        type: "string",
                        description: "The name of the file to delete",
                    },
                },
                required: ["id", "filename"],
            },
        },
        {
            name: "rename_gist_file",
            description: "Rename a file in a gist",
            inputSchema: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                        description: "The ID of the gist",
                    },
                    old_filename: {
                        type: "string",
                        description: "The current name of the file",
                    },
                    new_filename: {
                        type: "string",
                        description: "The new name for the file",
                    },
                },
                required: ["id", "old_filename", "new_filename"],
            },
        },
    ],

    handlers: {
        update_gist_file: async (args, context) => {
            const { id, filename, content } = args as {
                id: string;
                filename?: string;
                content?: string;
            };
            const gists = await context.gistStore.getAll();
            const gist = gists.find((g: Gist) => g.id === id);

            if (!gist) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `Gist with ID '${id}' not found`
                );
            }

            if (!gist.files[filename!]) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `File '${filename}' not found in gist`
                );
            }

            const response = await context.axiosInstance.patch(`/${id}`, {
                files: {
                    [filename!]: {
                        content,
                    },
                },
            });

            context.gistStore.update(response.data);

            return {
                id,
                filename,
                message: "File updated successfully",
            };
        },

        add_gist_file: async (args, context) => {
            const { id, filename, content } = args as {
                id: string;
                filename: string;
                content: string;
            };

            const gists = await context.gistStore.getAll();
            const gist = gists.find((g: Gist) => g.id === id);

            if (!gist) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `Gist with ID '${id}' not found`
                );
            }

            if (gist.files[filename]) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `File '${filename}' already exists in gist`
                );
            }

            const response = await context.axiosInstance.patch(`/${id}`, {
                files: {
                    [filename]: {
                        content: content,
                    },
                },
            });

            context.gistStore.update(response.data);

            return {
                id,
                filename,
                message: "File added successfully",
            };
        },

        delete_gist_file: async (args, context) => {
            const { id, filename } = args as { id: string; filename: string };

            const gists = await context.gistStore.getAll();
            const gist = gists.find((g: Gist) => g.id === id);

            if (!gist) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `Gist with ID '${id}' not found`
                );
            }

            if (!gist.files[filename]) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `File '${filename}' not found in gist`
                );
            }

            if (Object.keys(gist.files).length === 1) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "Cannot delete the last file in a gist"
                );
            }

            const response = await context.axiosInstance.patch(`/${id}`, {
                files: {
                    [filename]: null,
                },
            });

            context.gistStore.update(response.data);

            return {
                id,
                filename,
                message: "File deleted successfully",
            };
        },

        rename_gist_file: async (args, context) => {
            const { id, old_filename, new_filename } = args as {
                id: string;
                old_filename: string;
                new_filename: string;
            };

            const gists = await context.gistStore.getAll();
            const gist = gists.find((g: Gist) => g.id === id);

            if (!gist) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `Gist with ID '${id}' not found`
                );
            }

            if (!gist.files[old_filename as string]) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `File '${old_filename}' not found in gist`
                );
            }

            if (gist.files[new_filename as string]) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `File '${new_filename}' already exists in gist`
                );
            }

            // Get the content of the old file
            const content = gist.files[old_filename].content;
            const response = await context.axiosInstance.patch(`/${id}`, {
                files: {
                    [old_filename]: null,
                    [new_filename]: {
                        content: content,
                    },
                },
            });

            context.gistStore.update(response.data);

            return {
                id,
                old_filename,
                new_filename,
                message: "File renamed successfully",
            };
        },
    },
};
