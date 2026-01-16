import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { GistComment, ToolEntry } from "#types";
import { gistIdSchema } from "#utils";

const ERROR_COMMENT_BODY_REQUIRED = "Comment body is required and cannot be empty";

const addCommentSchema = z.object({
  id: z.string().describe("The ID of the gist"),
  body: z.string().describe("The comment text"),
});

const deleteCommentSchema = z.object({
  gist_id: z.string().describe("The ID of the gist"),
  comment_id: z.string().describe("The ID of the comment to delete"),
});

const editCommentSchema = z.object({
  gist_id: z.string().describe("The ID of the gist"),
  comment_id: z.string().describe("The ID of the comment to edit"),
  body: z.string().describe("The new comment text"),
});

export default [
  {
    name: "list_gist_comments",
    description: "List all comments on a gist",
    inputSchema: gistIdSchema,
    handler: async ({ id }, context) => {
      const comments = await context.fetchClient.get<GistComment[]>(`/${id}/comments`);

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
  },
  {
    name: "add_gist_comment",
    description: "Add a comment to a gist",
    inputSchema: addCommentSchema,
    handler: async ({ id, body }, context) => {
      if (!body) {
        throw new McpError(ErrorCode.InvalidParams, ERROR_COMMENT_BODY_REQUIRED);
      }

      const comment = await context.fetchClient.post<GistComment>(`/${id}/comments`, {
        body,
      });

      return {
        gist_id: id,
        comment_id: comment.id,
        message: "Comment added successfully",
      };
    },
  },
  {
    name: "delete_gist_comment",
    description: "Delete a comment from a gist",
    inputSchema: deleteCommentSchema,
    handler: async ({ gist_id, comment_id }, context) => {
      await context.fetchClient.delete(`/${gist_id}/comments/${comment_id}`);

      return "Comment deleted successfully";
    },
  },
  {
    name: "edit_gist_comment",
    description: "Update the content of an existing gist comment",
    inputSchema: editCommentSchema,
    handler: async ({ gist_id, comment_id, body }, context) => {
      if (!body) {
        throw new McpError(ErrorCode.InvalidParams, ERROR_COMMENT_BODY_REQUIRED);
      }

      await context.fetchClient.patch(`/${gist_id}/comments/${comment_id}`, {
        body,
      });

      return "Comment updated successfully";
    },
  },
] as ToolEntry[];
