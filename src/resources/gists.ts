import { Gist, GistHandlerContext } from "../types.js";

export interface ResourceHandlers {
    listResources: (context: GistHandlerContext) => Promise<{
        resources: Array<{
            uri: string;
            name: string;
            mimeType: "application/json";
        }>;
    }>;

    readResource: (
        uri: string,
        context: GistHandlerContext
    ) => Promise<{
        contents: Array<{
            uri: string;
            mimeType: "application/json";
            text: string;
        }>;
    }>;
}

export const resourceHandlers: ResourceHandlers = {
    listResources: async (context) => {
        const gists = await context.fetchAllGists();
        return {
            resources: gists
                // Exclude archived gists, since they're not expected to be used often.
                .filter((gist) => !gist.description?.endsWith(" [Archived]"))
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

        const response = await context.axiosInstance.get(`/gists/${gistId}`);
        const gist: Gist = response.data;

        context.updateGistInCache(gist);

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
