import { GistFile, ResourceHandlers } from "../types.js";
import {
    isArchivedGist,
    isDailyNoteGist,
    isPromptGist,
    mcpGist,
} from "../utils.js";

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
                        !isPromptGist(gist) &&
                        (context.includeArchived || !isArchivedGist(gist)) &&
                        (context.includeDaily || !isDailyNoteGist(gist))
                )
                .sort(
                    (a, b) =>
                        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
                )
                .map((gist) => {
                    let name = gist.description?.trim();
                    if (!name) {
                        const firstFile = Object.keys(gist.files)[0];
                        if (!firstFile) {
                            name = "Empty";
                        } else if (firstFile === "README.md") {
                            // Explicity mark this as "Untitled", since the file
                            // name isn't unique enough to be used as a name, and 
                            // we want to draw attention to it.
                            name = "Untitled";
                        } else {
                            // Strip the extension off markdown files, since
                            // we'll treat those as pseudo descriptions.
                            name = firstFile.replace(/\.md$/i, "");
                        }
                    }

                    return {
                        uri: `${RESOURCE_PREFIX}${gist.id}`,
                        name,
                        mimeType: "application/json",
                    };
                }),
        };
    },

    readResource: async (uri, context) => {
        const { pathname } = new URL(uri);
        if (pathname.endsWith("/comments")) {
            const response = await context.axiosInstance.get(pathname);
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

        const { data: gist } = await context.axiosInstance.get(pathname);
        context.gistStore.update(gist);

        const resource = {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(mcpGist(gist), null, 2),
        };

        // Note: Nothing uses this at the moment, but it could be useful in the future.
        if (pathname.endsWith("/raw")) {
            const mainFile: GistFile =
                gist.files["README.md"] || Object.keys(gist.files)[0]!;

            resource.mimeType = mainFile.type;
            resource.text = mainFile.content;
        }

        return {
            contents: [resource],
        };
    },
};
