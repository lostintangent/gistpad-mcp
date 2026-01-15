import { z } from "zod";
import { gistIdSchema, ToolEntry } from "../types.js";
import {
  findGistById,
  gistContent,
  isArchivedGist,
  isDailyNoteGist,
  isPromptGist,
  mcpGist,
} from "../utils.js";

const createGistSchema = z.object({
  description: z.string().describe("Description of the Gist"),
  filename: z
    .string()
    .optional()
    .default("README.md")
    .describe(
      "Name of the file to create. This defaults to README.md, and so only specify it if explicity requested by the user, or you need to create a non-markdown file.",
    ),
  content: z.string().describe("Contents of the new file"),
  public: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether the Gist should be public (Defaults to false)"),
});

const updateDescriptionSchema = z.object({
  id: z.string().describe("The ID of the Gist to update"),
  description: z.string().describe("The new description for the Gist"),
});

export default [
  {
    name: "list_gists",
    description:
      "List all of your GitHub Gists (excluding daily notes, prompts, and archived gists)",
    handler: async (_args, context) => {
      const gists = await context.gistStore.getAll();
      const filteredGists = gists.filter(
        (gist) => !isDailyNoteGist(gist) && !isPromptGist(gist) && !isArchivedGist(gist),
      );

      return {
        count: filteredGists.length,
        gists: filteredGists.map(mcpGist),
      };
    },
  },
  {
    name: "get_gist",
    description: "Get the full contents of a GitHub Gist by ID (including file contents).",
    inputSchema: gistIdSchema,
    handler: async ({ id }, context) => {
      const { data: gist } = await context.axiosInstance.get(`/${id}`);

      context.gistStore.update(gist);

      return mcpGist(gist);
    },
  },
  {
    name: "create_gist",
    description: "Create a new GitHub Gist",
    inputSchema: createGistSchema,
    handler: async (args, context) => {
      const {
        description,
        filename,
        content,
        public: isPublic,
      } = args as z.infer<typeof createGistSchema>;

      const { data: gist } = await context.axiosInstance.post("", {
        description,
        public: isPublic,
        files: {
          [filename]: {
            content: gistContent(content),
          },
        },
      });

      context.gistStore.add(gist);

      return mcpGist(gist);
    },
  },
  {
    name: "delete_gist",
    description: "Delete a GitHub Gist by ID",
    inputSchema: gistIdSchema,
    handler: async ({ id }, context) => {
      await context.axiosInstance.delete(`/${id}`);

      context.gistStore.remove(id as string);

      return "Successfully deleted gist";
    },
  },
  {
    name: "update_gist_description",
    description: "Update a GitHub Gist's description",
    inputSchema: updateDescriptionSchema,
    handler: async ({ id, description }, context) => {
      const { data: gist } = await context.axiosInstance.patch(`/${id}`, {
        description,
      });

      context.gistStore.update(gist);

      return "Successfully updated gist description";
    },
  },
  {
    name: "duplicate_gist",
    description: "Create a copy of an existing gist",
    inputSchema: gistIdSchema,
    handler: async ({ id }, context) => {
      const sourceGist = await findGistById(context, id as string);

      const newDescription = `${sourceGist.description || ""} (Copy)`.trim();
      const { data: gist } = await context.axiosInstance.post("", {
        description: newDescription,
        public: sourceGist.public,
        files: Object.fromEntries(
          Object.entries(sourceGist.files).map(([name, file]) => [name, { content: file.content }]),
        ),
      });

      context.gistStore.add(gist);

      return mcpGist(gist);
    },
  },
] as ToolEntry[];
