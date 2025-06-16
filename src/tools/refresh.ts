import { ToolModule } from "../types.js";

export default {
    definitions: [
        {
            name: "refresh_gists",
            description:
                "Refresh the server's cache of gists, to ensure it picks up any changes made by external clients.",
            inputSchema: {
                type: "object",
                properties: {},
                required: [],
            },
        },
    ],

    handlers: {
        refresh_gists: async (_, context) => {
            await Promise.all([
                context.gistStore.refresh(),
                context.starredGistStore.refresh(),
            ]);

            return "Gists refreshed!";
        },
    },
} as ToolModule;
