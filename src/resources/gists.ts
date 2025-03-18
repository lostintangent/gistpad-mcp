import {
    ResourceHandlers,
    isArchivedGist,
    isDailyNoteGist,
    mcpGist,
} from "../types.js";

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

        if (context.includeStarred) {
            const starredGists = await context.starredGistStore.getAll();
            const markedStarredGists = starredGists.map((gist) => ({
                ...gist,
                description: (gist.description || "") + " [Starred]",
            }));
            gists = [...gists, ...markedStarredGists];
        }

        return {
            resources: gists
                .filter(
                    (gist) =>
                        (context.includeArchived || !isArchivedGist(gist)) &&
                        (context.includeDaily || !isDailyNoteGist(gist))
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

        const { data: gist } = await context.axiosInstance.get(`/${path}`);
        context.gistStore.update(gist);

        return {
            contents: [
                {
                    uri,
                    mimeType: "application/json",
                    text: JSON.stringify(mcpGist(gist), null, 2),
                },
            ],
        };
    },
};
