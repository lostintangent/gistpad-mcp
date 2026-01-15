import { Gist, gistIdSchema, ToolEntry } from "../types.js";
import { findGistById, mcpGist } from "../utils.js";

export default [
  {
    name: "list_starred_gists",
    description: "List all your starred gists",
    handler: async (_args, context) => {
      const starredGists = await context.starredGistStore.getAll();

      return {
        count: starredGists.length,
        gists: starredGists.map(mcpGist),
      };
    },
  },
  {
    name: "star_gist",
    description: "Star a gist",
    inputSchema: gistIdSchema,
    handler: async ({ id }, context) => {
      await context.axiosInstance.put(`/${id}/star`);

      // Try to find gist in cache first, otherwise fetch it
      let gist: Gist;
      try {
        gist = await findGistById(context, id as string);
      } catch {
        const response = await context.axiosInstance.get(`/${id}`);
        gist = response.data;
      }

      context.starredGistStore.add(gist);

      return "Gist starred successfully";
    },
  },
  {
    name: "unstar_gist",
    description: "Unstar a gist",
    inputSchema: gistIdSchema,
    handler: async ({ id }, context) => {
      await context.axiosInstance.delete(`/${id}/star`);
      context.starredGistStore.remove(id as string);

      return "Gist unstarred successfully";
    },
  },
] as ToolEntry[];
