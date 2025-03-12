import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { Gist, GistHandlerContext, HandlerModule } from "../types.js";

function getTodaysFilename(): string {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const year = today.getFullYear();
    return `${month}-${day}-${year}.md`;
}

async function createDailyNotesGist(context: GistHandlerContext, filename: string): Promise<Gist> {
    const content = `# ${filename.replace('.md', '')}\n`;
    const response = await context.axiosInstance.post("/gists", {
        description: "📆 Daily notes",
        public: false,
        files: {
            [filename]: {
                content
            }
        }
    });

    // Invalidate cache since we created a new gist
    context.invalidateCache();

    return response.data;
}

async function createTodaysNote(context: GistHandlerContext, gistId: string, filename: string): Promise<Gist> {
    const content = `# ${filename.replace('.md', '')}\n`;
    const response = await context.axiosInstance.patch(`/gists/${gistId}`, {
        files: {
            [filename]: {
                content
            }
        }
    });

    // Update cache
    context.updateGistInCache(response.data);

    return response.data;
}

export const dailyHandlers: HandlerModule = {
    tools: [
        {
            name: "get_todays_note",
            description: "Get or create the daily note for today",
            inputSchema: {
                type: "object",
                properties: {},
                required: [],
            },
        },
        {
            name: "list_daily_notes",
            description: "List all daily notes",
            inputSchema: {
                type: "object",
                properties: {},
                required: [],
            },
        },
        {
            name: "get_daily_note",
            description: "Get content of a specific daily note",
            inputSchema: {
                type: "object",
                properties: {
                    filename: {
                        type: "string",
                        description: "Name of the daily note file (e.g., '03-10-2025.md')",
                    },
                },
                required: ["filename"],
            },
        },
    ],

    handlers: {
        get_todays_note: async (request, context) => {
            const filename = getTodaysFilename();

            const gists = await context.fetchAllGists();
            let dailyNotesGist = gists.find(g => g.description === "📆 Daily notes");

            if (!dailyNotesGist) {
                dailyNotesGist = await createDailyNotesGist(context, filename);
            } else if (!dailyNotesGist.files[filename]) {
                dailyNotesGist = await createTodaysNote(context, dailyNotesGist.id, filename);
            }

            context.addGistToCache(dailyNotesGist);

            return {
                content: [
                    {
                        type: "text",
                        text: dailyNotesGist.files[filename].content,
                    },
                ],
            };
        },

        list_daily_notes: async (request, context) => {
            const gists = await context.fetchAllGists();

            if (!context.dailyNotesGistId) {
                throw new McpError(
                    ErrorCode.InternalError,
                    "Daily notes gist not found"
                );
            }

            const dailyNotesGist = gists.find(gist => gist.id === context.dailyNotesGistId);
            if (!dailyNotesGist) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "You don't currently have any daily notes",
                        },
                    ],
                }
            }

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(
                            {
                                total: gists.length,
                                count: Object.keys(dailyNotesGist.files).length,
                                notes: Object.entries(dailyNotesGist.files).map(([filename]) => ({
                                    filename,
                                    date: filename.replace(".md", ""),
                                }))
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        },

        get_daily_note: async (request, context) => {
            const args = request.params.arguments as { filename?: string } | undefined;
            const filename = args?.filename;

            if (!filename) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "Filename is required"
                );
            }

            // Ensure gists are fetched to get daily notes ID
            const gists = await context.fetchAllGists();

            // Check after fetch since fetchAllGists updates the context
            if (!context.dailyNotesGistId) {
                throw new McpError(
                    ErrorCode.InternalError,
                    "Daily notes gist not found"
                );
            }

            const dailyNotesGist = gists.find(gist => gist.id === context.dailyNotesGistId);

            if (!dailyNotesGist) {
                throw new McpError(
                    ErrorCode.InternalError,
                    "Daily notes gist not found in cache"
                );
            }

            const file = dailyNotesGist.files[filename];

            if (!file) {
                throw new McpError(
                    ErrorCode.InternalError,
                    `Daily note '${filename}' not found`
                );
            }

            return {
                content: [
                    {
                        type: "text",
                        text: file.content,
                    },
                ],
            };
        },
    },
};
