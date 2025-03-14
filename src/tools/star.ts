import { Gist, ToolModule } from "../types.js";

export const starHandlers: ToolModule = {
    tools: [
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
        list_starred_gists: async (args, context) => {
            const starredGists = await context.starredGistStore.getAll();

            return {
                count: starredGists.length,
                gists: starredGists.map((gist) => ({
                    id: gist.id,
                    description: gist.description,
                    files: Object.keys(gist.files),
                    created_at: gist.created_at,
                    updated_at: gist.updated_at,
                    url: `https://gistpad.dev/#/${gist.id}`,
                    share_url: `https://gistpad.dev/#/share/${gist.id}`,
                })),
            };
        },

        star_gist: async (args, context) => {
            const gistId = String(args.id);

            await context.axiosInstance.put(`/${gistId}/star`);

            const gists = await context.gistStore.getAll();
            let gist = gists.find((g: Gist) => g.id === gistId);
            if (!gist) {
                const response = await context.axiosInstance.get(`/${gistId}`);
                gist = response.data;
            }

            context.starredGistStore.add(gist!);

            return {
                id: gist!.id,
                description: gist!.description,
                message: "Gist starred successfully",
            };
        },

        unstar_gist: async (args, context) => {
            const gistId = String(args.id);

            const gists = await context.starredGistStore.getAll();
            let gist = gists.find((g: Gist) => g.id === gistId)!;

            await context.axiosInstance.delete(`/${gistId}/star`);
            context.starredGistStore.remove(gistId);

            return {
                id: gist.id,
                description: gist.description,
                message: "Gist unstarred successfully",
            };
        },
    },
};
