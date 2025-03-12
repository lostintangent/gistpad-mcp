import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { HandlerModule } from "../types.js";

export const fileHandlers: HandlerModule = {
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
        update_gist_file: async (request, context) => {
            const args = request.params.arguments as { id?: string; filename?: string; content?: string } | undefined;
            const gistId = String(args?.id);
            const filename = String(args?.filename);
            const content = args?.content;
            const gists = await context.fetchAllGists();
            const gist = gists.find(g => g.id === gistId);

            if (!gist) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `Gist with ID '${gistId}' not found`
                );
            }

            if (!gist.files[filename]) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `File '${filename}' not found in gist`
                );
            }

            const response = await context.axiosInstance.patch(`/gists/${gistId}`, {
                files: {
                    [filename]: {
                        content: content
                    }
                }
            });

            // Update the cached gist
            context.updateGistInCache(response.data);

            return {
                id: gistId,
                filename,
                message: "File updated successfully",
            };
        },

        add_gist_file: async (request, context) => {
            const args = request.params.arguments as { id?: string; filename?: string; content?: string } | undefined;
            const gistId = String(args?.id);
            const filename = String(args?.filename);
            const content = args?.content;
            const gists = await context.fetchAllGists();
            const gist = gists.find(g => g.id === gistId);

            if (!gist) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `Gist with ID '${gistId}' not found`
                );
            }

            if (gist.files[filename]) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `File '${filename}' already exists in gist`
                );
            }

            const response = await context.axiosInstance.patch(`/gists/${gistId}`, {
                files: {
                    [filename]: {
                        content: content
                    }
                }
            });

            // Update the cached gist
            context.updateGistInCache(response.data);

            return {
                id: gistId,
                filename,
                message: "File added successfully",
            };
        },

        delete_gist_file: async (request, context) => {
            const args = request.params.arguments as { id?: string; filename?: string } | undefined;
            const gistId = String(args?.id);
            const filename = String(args?.filename);
            const gists = await context.fetchAllGists();
            const gist = gists.find(g => g.id === gistId);

            if (!gist) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `Gist with ID '${gistId}' not found`
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

            const response = await context.axiosInstance.patch(`/gists/${gistId}`, {
                files: {
                    [filename]: null
                }
            });

            // Update the cached gist
            context.updateGistInCache(response.data);

            return {
                id: gistId,
                filename,
                message: "File deleted successfully",
            };
        },

        rename_gist_file: async (request, context) => {
            const args = request.params.arguments as { id?: string; old_filename?: string; new_filename?: string } | undefined;
            const gistId = String(args?.id);
            const old_filename = String(args?.old_filename);
            const new_filename = String(args?.new_filename);
            const gists = await context.fetchAllGists();
            const gist = gists.find(g => g.id === gistId);

            if (!gist) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `Gist with ID '${gistId}' not found`
                );
            }

            if (!gist.files[old_filename]) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `File '${old_filename}' not found in gist`
                );
            }

            if (gist.files[new_filename]) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `File '${new_filename}' already exists in gist`
                );
            }

            // Get the content of the old file
            const content = gist.files[old_filename].content;

            const response = await context.axiosInstance.patch(`/gists/${gistId}`, {
                files: {
                    [old_filename]: null,
                    [new_filename]: {
                        content: content
                    }
                }
            });

            // Update the cached gist
            context.updateGistInCache(response.data);

            return {
                id: gistId,
                old_filename,
                new_filename,
                message: "File renamed successfully",
            };
        },
    },
};
