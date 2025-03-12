import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { GistComment, HandlerModule } from "../types.js";

export const commentHandlers: HandlerModule = {
    tools: [
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
    ],

    handlers: {
        list_gist_comments: async (request, context) => {
            const gistId = String(request.params.arguments?.id);
            const gists = await context.fetchAllGists();
            const gist = gists.find(g => g.id === gistId);

            if (!gist) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `Gist with ID '${gistId}' not found`
                );
            }

            const response = await context.axiosInstance.get(`/gists/${gistId}/comments`);
            const comments = response.data as GistComment[];

            return {
                gist_id: gistId,
                count: comments.length,
                comments: comments.map(comment => ({
                    id: comment.id,
                    body: comment.body,
                    user: comment.user.login,
                    created_at: comment.created_at,
                    updated_at: comment.updated_at,
                }))
            };
        },

        add_gist_comment: async (request, context) => {
            const args = request.params.arguments as { id?: string; body?: string } | undefined;
            const gistId = String(args?.id);
            const body = args?.body;

            if (!body?.trim()) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "Comment body is required and cannot be empty"
                );
            }

            const gists = await context.fetchAllGists();
            const gist = gists.find(g => g.id === gistId);

            if (!gist) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `Gist with ID '${gistId}' not found`
                );
            }

            const response = await context.axiosInstance.post(`/gists/${gistId}/comments`, {
                body: body.trim()
            });

            const comment = response.data as GistComment;

            return {
                gist_id: gistId,
                comment_id: comment.id,
                message: "Comment added successfully",
            };
        },

        delete_gist_comment: async (request, context) => {
            const args = request.params.arguments as { gist_id?: string; comment_id?: string } | undefined;
            const gistId = String(args?.gist_id);
            const commentId = String(args?.comment_id);

            const gists = await context.fetchAllGists();
            const gist = gists.find(g => g.id === gistId);

            if (!gist) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `Gist with ID '${gistId}' not found`
                );
            }

            await context.axiosInstance.delete(`/gists/${gistId}/comments/${commentId}`);

            return {
                gist_id: gistId,
                comment_id: commentId,
                message: "Comment deleted successfully",
            };
        },
    },
};
