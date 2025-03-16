import { Gist, ResourceHandlers } from "../types.js";

export const resourceHandlers: ResourceHandlers = {
    listResources: async (context) => {
        let gists = await context.gistStore.getAll();

        if (context.showStarred) {
            const starredGists = await context.starredGistStore.getAll();
            const markedStarredGists = starredGists.map(gist => ({
                ...gist,
                description: (gist.description || "") + " [Starred]"
            }));
            gists = [...gists, ...markedStarredGists];
        }
        return {
            resources: gists
                .filter((gist) => context.showArchived || !gist.description?.endsWith(" [Archived]"))
                .map((gist) => ({
                    uri: `gist:///${gist.id}`,
                    name:
                        gist.description ||
                        Object.keys(gist.files)[0].replace(".md", "") ||
                        "Untitled",
                    mimeType: "application/json",
                })),
        };
    },

    readResource: async (uri, context) => {
        const gistId = new URL(uri).pathname.replace(/^\//, "");

        const response = await context.axiosInstance.get(`/${gistId}`);
        const gist: Gist = response.data;

        context.gistStore.update(gist);

        return {
            contents: [
                {
                    uri,
                    mimeType: "application/json",
                    text: JSON.stringify(
                        {
                            id: gist.id,
                            description: gist.description,
                            files: Object.fromEntries(
                                Object.entries(gist.files).map(([name, file]) => [
                                    name,
                                    {
                                        content: file.content,
                                        language: file.language,
                                        size: file.size,
                                    },
                                ])
                            ),
                            created_at: gist.created_at,
                            updated_at: gist.updated_at,
                            public: gist.public,
                        },
                        null,
                        2
                    ),
                },
            ],
        };
    },
};
