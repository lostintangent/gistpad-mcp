import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { GistComment, ToolModule } from "../types.js";

export default {
    definitions: [
        {
            name: "list_gist_comments",
            description: "List all comments on a gist",
            inputSchema: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                        description: "The ID of the gist",
                    },
                },
                required: ["id"],
            },
        },
        {
            name: "add_gist_comment",
            description: "Add a comment to a gist",
            inputSchema: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                        description: "The ID of the gist",
                    },
                    body: {
                        type: "string",
                        description: "The comment text",
                    },
                },
                required: ["id", "body"],
            },
        },
        {
            name: "delete_gist_comment",
            description: "Delete a comment from a gist",
            inputSchema: {
                type: "object",
                properties: {
                    gist_id: {
                        type: "string",
                        description: "The ID of the gist",
                    },
                    comment_id: {
                        type: "string",
                        description: "The ID of the comment to delete",
                    },
                },
                required: ["gist_id", "comment_id"],
            },
        },
        {
            name: "edit_gist_comment",
            description: "Update the content of an existing gist comment",
            inputSchema: {
                type: "object",
                properties: {
                    gist_id: {
                        type: "string",
                        description: "The ID of the gist",
                    },
                    comment_id: {
                        type: "string",
                        description: "The ID of the comment to edit",
                    },
                    body: {
                        type: "string",
                        description: "The new comment text",
                    },
                },
                required: ["gist_id", "comment_id", "body"],
            },
        },
    ],

    handlers: {
        list_gist_comments: async ({ id }, context) => {
            const response = await context.axiosInstance.get(`/${id}/comments`);
            const comments = response.data as GistComment[];

            return {
                count: comments.length,
                comments: comments.map((comment) => ({
                    id: comment.id,
                    body: comment.body,
                    user: comment.user.login,
                    created_at: comment.created_at,
                    updated_at: comment.updated_at,
                })),
            };
        },

        add_gist_comment: async ({ id, body }, context) => {
            if (!body) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "Comment body is required and cannot be empty"
                );
            }

            const response = await context.axiosInstance.post(`/${id}/comments`, {
                body,
            });

            return {
                gist_id: id,
                comment_id: response.data.id,
                message: "Comment added successfully",
            };
        },

        delete_gist_comment: async ({ gist_id, comment_id }, context) => {
            await context.axiosInstance.delete(`/${gist_id}/comments/${comment_id}`);

            return "Comment deleted successfully";
        },

        edit_gist_comment: async ({ gist_id, comment_id, body }, context) => {
            if (!body) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "Comment body is required and cannot be empty"
                );
            }

            await context.axiosInstance.patch(`/${gist_id}/comments/${comment_id}`, {
                body,
            });

            return "Comment updated successfully";
        },
    },
} as ToolModule