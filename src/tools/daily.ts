import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { Gist, RequestContext, ToolModule } from "../types.js";
import { DAILY_NOTES_DESCRIPTION } from "../utils.js";

function getTodaysFilename(): string {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const year = today.getFullYear();
    return `${year}-${month}-${day}.md`;
}

async function createDailyNotesGist(
    context: RequestContext,
    filename: string
): Promise<Gist> {
    const content = `# ${filename.replace(".md", "")}\n`;
    const response = await context.axiosInstance.post("", {
        description: DAILY_NOTES_DESCRIPTION,
        public: false,
        files: {
            [filename]: {
                content,
            },
        },
    });

    context.gistStore.setDailyNotes(response.data);
    return response.data;
}

const TEMPLATE_FILENAME = "template.md";
async function createTodaysNote(
    context: RequestContext,
    dailyNotes: Gist,
    filename: string
): Promise<Gist> {
    const dateString = new Date().toLocaleDateString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });

    let content = `# ${dateString}\n\n`;

    if (dailyNotes.files[TEMPLATE_FILENAME]) {
        const templateContent = dailyNotes.files[TEMPLATE_FILENAME].content;
        content = templateContent.replace(/\{\{date\}\}/g, dateString);
    }

    const response = await context.axiosInstance.patch(`/${dailyNotes.id}`, {
        files: {
            [filename]: {
                content,
            },
        },
    });

    context.gistStore.update(response.data);
    return response.data;
}

export default {
    definitions: [
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
            const dailyNotes = await context.gistStore.getDailyNotes();

            const response = await context.axiosInstance.patch(`/${dailyNotes!.id}`, {
                files: {
                    [filename]: {
                        content,
                    },
                },
            });

            context.gistStore.update(response.data);
            return "Successfully updated today's note";
        },

        get_todays_note: async (args, context) => {
            const filename = getTodaysFilename();
            let dailyNotes = await context.gistStore.getDailyNotes();

            if (!dailyNotes) {
                dailyNotes = await createDailyNotesGist(context, filename);
            } else {
                if (!dailyNotes.files[filename]) {
                    dailyNotes = await createTodaysNote(context, dailyNotes, filename);
                } else {
                    // Check if the file contents are empty
                    const contents = dailyNotes.files[filename].content;
                    if (!contents) {
                        // Fetch the daily gist by ID
                        const response = await context.axiosInstance.get(
                            `/${dailyNotes.id}`
                        );
                        dailyNotes = response.data;
                        context.gistStore.update(dailyNotes!);
                    }
                }
            }

            return dailyNotes!.files[filename].content;
        },

        list_daily_notes: async (args, context) => {
            const dailyNotes = await context.gistStore.getDailyNotes();

            // The user doesn't have an active daily notes gist
            // so just return an empty list, without creating one.
            if (!dailyNotes) {
                return {
                    count: 0,
                    notes: [],
                };
            }

            return {
                count: Object.keys(dailyNotes.files).length,
                notes: Object.entries(dailyNotes.files).map(([filename]) => ({
                    date: filename.replace(".md", ""),
                })),
            };
        },

        get_daily_note: async ({ date }, context) => {
            if (!date) {
                throw new McpError(ErrorCode.InvalidParams, "Date is required");
            }

            const dailyNotes = await context.gistStore.getDailyNotes();
            const file = dailyNotes!.files[`${date}.md`];
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
            const dailyNotes = await context.gistStore.getDailyNotes();

            if (!dailyNotes!.files[filename]) {
                throw new McpError(
                    ErrorCode.InvalidRequest,
                    "The specified daily note doesn't exist"
                );
            }

            const response = await context.axiosInstance.patch(`/${dailyNotes!.id}`, {
                files: {
                    [filename]: null,
                },
            });

            context.gistStore.update(response.data);
            return `Successfully deleted daily note for ${date}`;
        },
    },
} as ToolModule;
