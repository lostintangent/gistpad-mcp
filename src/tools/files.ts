import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { Gist, RequestContext, ToolModule } from "../types.js";
import { gistContent } from "../utils.js";

type FileAssertions = {
    exists?: string;
    notExists?: string;
};

async function assertGistFile(
    context: RequestContext,
    gistId: string,
    fileAssertions: FileAssertions
) {
    const gists = await context.gistStore.getAll();
    const gist = gists.find((g: Gist) => g.id === gistId);

    if (!gist) {
        throw new McpError(
            ErrorCode.InvalidParams,
            `Gist with ID "${gistId}" not found`
        );
    }

    if (fileAssertions.exists && !gist.files[fileAssertions.exists]) {
        throw new McpError(
            ErrorCode.InvalidParams,
            `File "${fileAssertions.exists}" not found in gist`
        );
    }

    if (fileAssertions.notExists && gist.files[fileAssertions.notExists]) {
        throw new McpError(
            ErrorCode.InvalidParams,
            `File "${fileAssertions.notExists}" already exists in gist`
        );
    }
}

type GistFilePatch = {
    content?: string;
    filename?: string;
};

async function patchGistFile(
    context: RequestContext,
    gistId: string,
    filename: string,
    patch: GistFilePatch | null
) {
    const response = await context.axiosInstance.patch(`/${gistId}`, {
        files: {
            [filename]: patch,
        },
    });

    context.gistStore.update(response.data);
}

export default {
    definitions: [
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
                filename: string;
                content: string;
            };

            await assertGistFile(context, id, { exists: filename });

            await patchGistFile(context, id, filename, {
                content: gistContent(content),
            });

            return "File updated successfully";
        },

        add_gist_file: async (args, context) => {
            const { id, filename, content } = args as {
                id: string;
                filename: string;
                content: string;
            };

            await assertGistFile(context, id, { notExists: filename });

            await patchGistFile(context, id, filename, {
                content: gistContent(content),
            });

            return "File added successfully";
        },

        delete_gist_file: async (args, context) => {
            const { id, filename } = args as { id: string; filename: string };

            await assertGistFile(context, id, { exists: filename });

            await patchGistFile(context, id, filename, null);

            return "File deleted successfully";
        },

        rename_gist_file: async (args, context) => {
            const {
                id,
                old_filename: oldFilename,
                new_filename: newFilename,
            } = args as {
                id: string;
                old_filename: string;
                new_filename: string;
            };

            await assertGistFile(context, id, {
                exists: oldFilename,
                notExists: newFilename,
            });

            await patchGistFile(context, id, oldFilename, {
                filename: newFilename,
            });

            return "File renamed successfully";
        },
    },
} as ToolModule;
