import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { GistHandlerContext } from "../types.js";

export interface ResourceHandlers {
    listResources: (context: GistHandlerContext) => Promise<{
        resources: Array<{
            uri: string;
            name: string;
            mimeType: string;
            description: string;
        }>;
    }>;
    readResource: (
        uri: string,
        context: GistHandlerContext
    ) => Promise<{
        contents: Array<{
            uri: string;
            mimeType: string;
            text: string;
        }>;
    }>;
}

export const resourceHandlers: ResourceHandlers = {
    listResources: async (context) => {
        try {
            const gists = await context.fetchAllGists();
            return {
                resources: gists.map((gist) => ({
                    uri: `gist:///${gist.id}`,
                    name: Object.keys(gist.files)[0] || "Untitled Gist",
                    mimeType: "application/json",
                    description: gist.description || "No description provided",
                })),
            };
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new McpError(
                    ErrorCode.InternalError,
                    `GitHub API error: ${error.response?.data.message ?? error.message}`
                );
            }
            throw error;
        }
    },

    readResource: async (uri, context) => {
        try {
            const gistId = new URL(uri).pathname.replace(/^\//, "");
            const gists = await context.fetchAllGists();
            const gist = gists.find(g => g.id === gistId);

            if (!gist) {
                throw new McpError(
                    ErrorCode.InternalError,
                    `Gist '${gistId}' not found`
                );
            }

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
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new McpError(
                    ErrorCode.InternalError,
                    `GitHub API error: ${error.response?.data.message ?? error.message}`
                );
            }
            throw error;
        }
    },
};
