import { ToolModule } from "../types.js";

export default {
    definitions: [
        {
            name: "refresh_gists",
            description:
                "Reload the gist and starred gist stores, bypassing the cache",
            inputSchema: {
                type: "object",
                properties: {},
                required: [],
            },
        },
    ],

    handlers: {
        refresh_gists: async (_, context) => {
            context.gistStore.invalidate();
            context.starredGistStore.invalidate();

            await Promise.all([
                context.gistStore.getAll(),
                context.starredGistStore.getAll(),
            ]);

            await context.server.sendResourceListChanged();
            return "Gists refreshed!";
        },
    },
} as ToolModule;
