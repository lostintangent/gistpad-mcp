import { ToolEntry } from "../types.js";

export default [
  {
    name: "refresh_gists",
    description:
      "Refresh the server's cache of gists, to ensure it picks up any changes made by external clients.",
    handler: async (_args, context) => {
      await Promise.all([context.gistStore.refresh(), context.starredGistStore.refresh()]);

      return "Gists refreshed!";
    },
  },
] as ToolEntry[];
