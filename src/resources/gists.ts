import { Gist, ResourceHandlers, isArchivedGist, isDailyNoteGist } from "../types.js";

const RESOURCE_PREFIX = "gist:///";

export const resourceHandlers: ResourceHandlers = {
    listResourceTemplates: () => ({
        resourceTemplates: [
            {
                uriTemplate: `${RESOURCE_PREFIX}{gistId}/comments`,
                name: "Comments for a gist",
                description: "List of comments on a specific gist",
                mimeType: "application/json",
            },
        ],
    }),

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
                .filter((gist) =>
                    (context.showArchived || !isArchivedGist(gist)) &&
                    (context.showDaily || !isDailyNoteGist(gist))
                )
                .map((gist) => ({
                    uri: `${RESOURCE_PREFIX}${gist.id}`,
                    name:
                        gist.description ||
                        Object.keys(gist.files)[0].replace(".md", "") ||
                        "Untitled",
                    mimeType: "application/json",
                })),
        };
    },

    readResource: async (uri, context) => {
        const url = new URL(uri);
        const path = url.pathname.replace(/^\//, "");

        if (path.endsWith("/comments")) {
            const gistId = path.replace("/comments", "");
            const response = await context.axiosInstance.get(`/${gistId}/comments`);
            return {
                contents: [
                    {
                        uri,
                        mimeType: "application/json",
                        text: JSON.stringify(response.data, null, 2),
                    },
                ],
            };
        }

        const response = await context.axiosInstance.get(`/${path}`);
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
