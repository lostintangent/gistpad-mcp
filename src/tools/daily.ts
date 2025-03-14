import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { Gist, RequestContext, ToolModule } from "../types.js";

function getTodaysFilename(): string {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const year = today.getFullYear();
    return `${month}-${day}-${year}.md`;
}

async function createDailyNotesGist(
    context: RequestContext,
    filename: string
): Promise<Gist> {
    const content = `# ${filename.replace(".md", "")}\n`;
    const response = await context.axiosInstance.post("", {
        description: "📆 Daily notes",
        public: false,
        files: {
            [filename]: {
                content,
            },
        },
    });

    context.gistStore.add(response.data);
    context.dailyNotesGistId = response.data.id;

    return response.data;
}

async function createTodaysNote(
    context: RequestContext,
    filename: string
): Promise<Gist> {
    const content = `# ${filename.replace(".md", "")}\n`;
    const response = await context.axiosInstance.patch(
        `/${context.dailyNotesGistId}`,
        {
            files: {
                [filename]: {
                    content,
                },
            },
        }
    );

    context.gistStore.update(response.data);
    return response.data;
}

export const dailyHandlers: ToolModule = {
    tools: [
        {
            name: "get_todays_note",
            description:
                "Get or create the daily note for today's date (for tracking todos, tasks, scratch notes, etc.)",
            inputSchema: {
                type: "object",
                properties: {},
                required: [],
            },
        },
        {
            name: "list_daily_notes",
            description: "List all of your existing/historical daily notes",
            inputSchema: {
                type: "object",
                properties: {},
                required: [],
            },
        },
        {
            name: "get_daily_note",
            description: "Get the contents for a specific/existing daily note",
            inputSchema: {
                type: "object",
                properties: {
                    date: {
                        type: "string",
                        description:
                            "Name/date of the daily note to retrieve, in the following format: MM-DD-YYYY (e.g. 03-10-2025)",
                    },
                },
                required: ["date"],
            },
        },
        {
            name: "delete_daily_note",
            description: "Delete a specific daily note by date",
            inputSchema: {
                type: "object",
                properties: {
                    date: {
                        type: "string",
                        description:
                            "Date of the daily note to delete, in the following format: MM-DD-YYYY (e.g. 03-10-2025)",
                    },
                },
                required: ["date"],
            },
        },
        {
            name: "update_todays_note",
            description:
                "Update the existing content of today's daily note, which is useful for tracking todos, tasks, scratch notes, etc.",
            inputSchema: {
                type: "object",
                properties: {
                    content: {
                        type: "string",
                        description: "The updated content for today's daily note",
                    },
                },
                required: ["content"],
            },
        },
    ],

    handlers: {
        update_todays_note: async ({ content }, context) => {
            // Note that we don't need to attempt to create
            // the gist or note for today, because in order
            // for the MCP client to call this method, it
            // must have already called get_todays_note, which
            // will have created the gist and note if they didn't
            // already exist.

            const filename = getTodaysFilename();
            const gists = await context.gistStore.getAll();

            const response = await context.axiosInstance.patch(
                `/${context.dailyNotesGistId}`,
                {
                    files: {
                        [filename]: {
                            content,
                        },
                    },
                }
            );

            context.gistStore.update(response.data);
            return "Successfully updated today's note";
        },

        get_todays_note: async (args, context) => {
            const filename = getTodaysFilename();
            const gists = await context.gistStore.getAll();

            let dailyNotesGist: Gist | undefined;
            if (!context.dailyNotesGistId) {
                dailyNotesGist = await createDailyNotesGist(context, filename);
            } else {
                dailyNotesGist = gists.find(
                    (gist) => gist.id === context.dailyNotesGistId
                )!;

                if (!dailyNotesGist.files[filename]) {
                    dailyNotesGist = await createTodaysNote(context, filename);
                } else {
                    // Check if the file contents are empty
                    const contents = dailyNotesGist.files[filename].content;
                    if (!contents) {
                        // Fetch the daily gist by ID
                        const response = await context.axiosInstance.get(
                            `/${context.dailyNotesGistId}`
                        );
                        dailyNotesGist = response.data;
                        context.gistStore.update(dailyNotesGist!);
                    }
                }
            }

            return dailyNotesGist!.files[filename].content;
        },

        list_daily_notes: async (args, context) => {
            const gists = await context.gistStore.getAll();

            // The user doesn't have an active daily notes gist
            // so just return an empty list, without creating one.
            if (!context.dailyNotesGistId) {
                return {
                    count: 0,
                    notes: [],
                };
            }

            const dailyNotesGist = gists.find(
                (gist) => gist.id === context.dailyNotesGistId
            )!;

            return {
                count: Object.keys(dailyNotesGist.files).length,
                notes: Object.entries(dailyNotesGist.files).map(([filename]) => ({
                    date: filename.replace(".md", ""),
                })),
            };
        },

        get_daily_note: async ({ date }, context) => {
            if (!date) {
                throw new McpError(ErrorCode.InvalidParams, "Date is required");
            }

            const gists = await context.gistStore.getAll();

            // Check after fetch since fetchAllGists updates the context
            if (!context.dailyNotesGistId) {
                throw new McpError(
                    ErrorCode.InvalidRequest,
                    "Requested daily note doesn't exist"
                );
            }

            const dailyNotesGist = gists.find(
                (gist) => gist.id === context.dailyNotesGistId
            )!;

            const file = dailyNotesGist.files[`${date}.md`];
            if (!file) {
                throw new McpError(
                    ErrorCode.InvalidRequest,
                    "Requested daily note doesn't exist"
                );
            }

            return file.content;
        },

        delete_daily_note: async ({ date }, context) => {
            if (!date) {
                throw new McpError(ErrorCode.InvalidParams, "Date is required");
            }

            const filename = `${date}.md`;
            const gists = await context.gistStore.getAll();

            if (!context.dailyNotesGistId) {
                throw new McpError(
                    ErrorCode.InvalidRequest,
                    "The specified daily note doesn't exist"
                );
            }

            const dailyNotesGist = gists.find(
                (gist) => gist.id === context.dailyNotesGistId
            )!;

            if (!dailyNotesGist.files[filename]) {
                throw new McpError(
                    ErrorCode.InvalidRequest,
                    "The specified daily note doesn't exist"
                );
            }

            const response = await context.axiosInstance.patch(
                `/${context.dailyNotesGistId}`,
                {
                    files: {
                        [filename]: null,
                    },
                }
            );

            context.gistStore.update(response.data);
            return `Successfully deleted daily note for ${date}`;
        },
    },
};
