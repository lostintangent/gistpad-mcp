import { Gist, ToolModule } from "../types.js";
import { mcpGist } from "../utils.js";

export default {
    definitions: [
        {
            name: "list_starred_gists",
            description: "List all your starred gists",
            inputSchema: {
                type: "object",
                properties: {},
                required: [],
            },
        },
        {
            name: "star_gist",
            description: "Star a gist",
            inputSchema: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                        description: "The ID of the gist to star",
                    },
                },
                required: ["id"],
            },
        },
        {
            name: "unstar_gist",
            description: "Unstar a gist",
            inputSchema: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                        description: "The ID of the gist to unstar",
                    },
                },
                required: ["id"],
            },
        },
    ],

    handlers: {
        list_starred_gists: async (_, context) => {
            const starredGists = await context.starredGistStore.getAll();

            return {
                count: starredGists.length,
                gists: starredGists.map(mcpGist),
            };
        },

        star_gist: async ({ id }, context) => {
            await context.axiosInstance.put(`/${id}/star`);

            const gists = await context.gistStore.getAll();
            let gist = gists.find((g: Gist) => g.id === id);
            if (!gist) {
                const response = await context.axiosInstance.get(`/${id}`);
                gist = response.data;
            }

            context.starredGistStore.add(gist!);

            return "Gist starred successfully";
        },

        unstar_gist: async ({ id }, context) => {
            await context.axiosInstance.delete(`/${id}/star`);
            context.starredGistStore.remove(id as string);

            return "Gist unstarred successfully";
        },
    },
} as ToolModule;
