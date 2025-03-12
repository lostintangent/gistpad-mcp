import { HandlerModule } from "../types.js";

export const starHandlers: HandlerModule = {
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
        list_starred_gists: async (request, context) => {
            const starredGists = await context.fetchStarredGists();

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(
                            {
                                count: starredGists.length,
                                gists: starredGists.map((gist) => ({
                                    id: gist.id,
                                    description: gist.description,
                                    files: Object.keys(gist.files),
                                    created_at: gist.created_at,
                                })),
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        },

        star_gist: async (request, context) => {
            const gistId = String(request.params.arguments?.id);

            await context.axiosInstance.put(`/gists/${gistId}/star`);

            const gists = await context.fetchAllGists();
            let gist = gists.find((g) => g.id === gistId);
            if (!gist) {
                const response = await context.axiosInstance.get(`/gists/${gistId}`);
                gist = response.data;
            }

            context.addStarredGist(gist!);

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(
                            {
                                id: gist!.id,
                                description: gist!.description,
                                message: "Gist starred successfully",
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        },

        unstar_gist: async (request, context) => {
            const gistId = String(request.params.arguments?.id);

            const gists = await context.fetchStarredGists();
            let gist = gists.find((g) => g.id === gistId)!;

            await context.axiosInstance.delete(`/gists/${gistId}/star`);
            context.removeStarredGist(gistId);

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(
                            {
                                id: gist.id,
                                description: gist.description,
                                message: "Gist unstarred successfully",
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    },
};
