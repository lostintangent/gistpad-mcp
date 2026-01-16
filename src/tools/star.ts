import type { Gist, ToolEntry } from "#types";
import { findGistById, gistIdSchema, mcpGist } from "#utils";

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
      await context.fetchClient.put(`/${id}/star`);

      // Try to find gist in cache first, otherwise fetch it
      let gist: Gist;
      try {
        gist = await findGistById(context, id as string);
      } catch {
        gist = await context.fetchClient.get<Gist>(`/${id}`);
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
      await context.fetchClient.delete(`/${id}/star`);
      context.starredGistStore.remove(id as string);

      return "Gist unstarred successfully";
    },
  },
] as ToolEntry[];
