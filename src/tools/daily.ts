import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { Gist, RequestContext, ToolEntry } from "#types";
import { DAILY_NOTES_DESCRIPTION, patchGistFile } from "#utils";

const dateSchema = z.object({
  date: z
    .string()
    .describe(
      "Name/date of the daily note to retrieve, in the following format: YYYY-MM-DD (e.g. 2025-03-10)",
    ),
});

const contentSchema = z.object({
  content: z.string().describe("The updated content for today's daily note"),
});

/**
 * Gets the daily notes gist, throwing an error if it doesn't exist.
 */
async function requireDailyNotes(context: RequestContext): Promise<Gist> {
  const dailyNotes = await context.gistStore.getDailyNotes();
  if (!dailyNotes) {
    throw new McpError(ErrorCode.InvalidRequest, "Daily notes gist not found");
  }
  return dailyNotes;
}

function getTodaysFilename(): string {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const year = today.getFullYear();
  return `${year}-${month}-${day}.md`;
}

async function createDailyNotesGist(context: RequestContext, filename: string): Promise<Gist> {
  const content = `# ${filename.replace(".md", "")}\n`;
  const gist = await context.fetchClient.post<Gist>("", {
    description: DAILY_NOTES_DESCRIPTION,
    public: false,
    files: {
      [filename]: {
        content,
      },
    },
  });

  context.gistStore.setDailyNotes(gist);
  return gist;
}

const TEMPLATE_FILENAME = "template.md";
async function createTodaysNote(
  context: RequestContext,
  dailyNotes: Gist,
  filename: string,
): Promise<Gist> {
  const dateString = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  let content = `# ${dateString}\n\n`;

  if (dailyNotes.files[TEMPLATE_FILENAME]) {
    const templateContent = dailyNotes.files[TEMPLATE_FILENAME].content;
    content = templateContent.replaceAll("{{date}}", dateString);
  }

  const gist = await context.fetchClient.patch<Gist>(`/${dailyNotes.id}`, {
    files: {
      [filename]: {
        content,
      },
    },
  });

  context.gistStore.update(gist);
  return gist;
}

export default [
  {
    name: "get_todays_note",
    description:
      "Get or create the daily note for today's date (for tracking todos, tasks, scratch notes, etc.)",
    annotations: { title: "Get Today's Note" },
    handler: async (_args, context) => {
      const filename = getTodaysFilename();
      let dailyNotes = await context.gistStore.getDailyNotes();

      if (!dailyNotes) {
        dailyNotes = await createDailyNotesGist(context, filename);
      } else if (!dailyNotes.files[filename]) {
        dailyNotes = await createTodaysNote(context, dailyNotes, filename);
      } else {
        // Check if the file contents are empty
        const contents = dailyNotes.files[filename].content;
        if (!contents) {
          // Fetch the daily gist by ID
          dailyNotes = await context.fetchClient.get<Gist>(`/${dailyNotes.id}`);
          context.gistStore.update(dailyNotes);
        }
      }

      return dailyNotes.files[filename]!.content;
    },
  },
  {
    name: "list_daily_notes",
    description: "List all of your existing/historical daily notes",
    handler: async (_args, context) => {
      const dailyNotes = await context.gistStore.getDailyNotes();

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
  },
  {
    name: "get_daily_note",
    description: "Get the contents for a specific/existing daily note",
    inputSchema: dateSchema,
    handler: async ({ date }, context) => {
      if (!date) {
        throw new McpError(ErrorCode.InvalidParams, "Date is required");
      }

      const dailyNotes = await requireDailyNotes(context);

      const file = dailyNotes.files[`${date}.md`];
      if (!file) {
        throw new McpError(ErrorCode.InvalidRequest, "Requested daily note doesn't exist");
      }

      return file.content;
    },
  },
  {
    name: "delete_daily_note",
    description: "Delete a specific daily note by date",
    inputSchema: dateSchema,
    handler: async ({ date }, context) => {
      if (!date) {
        throw new McpError(ErrorCode.InvalidParams, "Date is required");
      }

      const filename = `${date}.md`;
      const dailyNotes = await requireDailyNotes(context);

      if (!dailyNotes.files[filename]) {
        throw new McpError(ErrorCode.InvalidRequest, "The specified daily note doesn't exist");
      }

      await patchGistFile(context, dailyNotes.id, filename, null);

      return `Successfully deleted daily note for ${date}`;
    },
  },
  {
    name: "update_todays_note",
    description:
      "Update the existing content of today's daily note, which is useful for tracking todos, tasks, scratch notes, etc.",
    inputSchema: contentSchema,
    annotations: { title: "Update Today's Note" },
    handler: async ({ content }, context) => {
      // Note that we don't need to attempt to create
      // the gist or note for today, because in order
      // for the MCP client to call this method, it
      // must have already called get_todays_note, which
      // will have created the gist and note if they didn't
      // already exist.

      const filename = getTodaysFilename();
      const dailyNotes = await requireDailyNotes(context);

      await patchGistFile(context, dailyNotes.id, filename, {
        content: content as string,
      });

      return "Successfully updated today's note";
    },
  },
] as ToolEntry[];
