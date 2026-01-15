import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ToolEntry } from "../types.js";
import { PROMPTS_DESCRIPTION } from "../utils.js";

const deletePromptSchema = z.object({
  name: z
    .string()
    .describe("Name of the prompt to delete (including .md extension if not already present)"),
});

const promptArgumentSchema = z.object({
  name: z.string().describe("Name of the argument"),
  description: z.string().describe("Description of the argument"),
});

const addPromptSchema = z.object({
  name: z
    .string()
    .describe(
      "Name of the prompt, which will be used as the filename, and therefore, shouldn't include invalid characters. It will be saved with a .md extension, and therefore, this field can be provided without the .md extension.",
    ),
  prompt: z
    .string()
    .describe(
      "The prompt content, which must be a natural language request that will be sent to the LLM in order to generate the requested response. It can include {{argument}} placeholders for arguments (referencing the argument name), that will be replaced dynamically when the prompt is used.",
    ),
  description: z
    .string()
    .optional()
    .describe(
      "Optional description of the prompt, that will be displayed to the user when later selecting the prompt in the UI.",
    ),
  arguments: z
    .array(promptArgumentSchema)
    .optional()
    .describe(
      "Optional list of arguments that the prompt accepts (using {{placeholder}} variables in its text).",
    ),
});

/**
 * Ensures a filename has a .md extension, adding it if not present.
 */
function ensureMarkdownExtension(name: string): string {
  return name.endsWith(".md") ? name : `${name}.md`;
}

export default [
  {
    name: "list_gist_prompts",
    description: "List the prompts in your gist-based prompts collection",
    handler: async (_args, context) => {
      const promptsGist = await context.gistStore.getPrompts();
      if (!promptsGist) {
        return {
          prompts: [],
        };
      }

      const prompts = Object.keys(promptsGist.files).map((filename) =>
        filename.replace(/\.md$/, ""),
      );

      return {
        prompts,
      };
    },
  },
  {
    name: "delete_gist_prompt",
    description: "Delete a prompt from your gist-based prompts collection",
    inputSchema: deletePromptSchema,
    handler: async (args, context) => {
      const { name } = args as z.infer<typeof deletePromptSchema>;
      const filename = ensureMarkdownExtension(name);

      const promptsGist = await context.gistStore.getPrompts();
      if (!promptsGist) {
        throw new McpError(ErrorCode.InvalidParams, "Prompts collection not found");
      }

      // Check if the file exists
      if (!promptsGist.files[filename]) {
        throw new McpError(ErrorCode.InvalidParams, `Prompt "${filename}" not found`);
      }

      const { data: updatedGist } = await context.axiosInstance.patch(`/${promptsGist.id}`, {
        files: {
          [filename]: null,
        },
      });

      context.gistStore.update(updatedGist);

      return `Successfully deleted prompt "${name}"`;
    },
  },
  {
    name: "add_gist_prompt",
    description: "Add a new prompt to your gist-based prompts collection",
    inputSchema: addPromptSchema,
    handler: async (args, context) => {
      const {
        name,
        prompt,
        description,
        arguments: promptArgs,
      } = args as z.infer<typeof addPromptSchema>;

      const filename = ensureMarkdownExtension(name);

      // Build the content with optional frontmatter
      let content = "";
      if (description || (promptArgs && promptArgs.length > 0)) {
        content += "---\n";
        if (description && typeof description === "string") {
          content += `description: ${description}\n`;
        }
        if (Array.isArray(promptArgs) && promptArgs.length > 0) {
          content += "arguments:\n";
          for (const arg of promptArgs) {
            content += `  ${arg.name}: ${arg.description}\n`;
          }
        }
        content += "---\n\n";
      }
      content += prompt;

      const filesPatch = {
        [filename]: {
          content,
        },
      };

      // Get or create the prompts gist
      let promptsGist = await context.gistStore.getPrompts();
      if (!promptsGist) {
        const { data: gist } = await context.axiosInstance.post("", {
          description: PROMPTS_DESCRIPTION,
          public: false,
          files: filesPatch,
        });

        context.gistStore.setPrompts(gist);
      } else {
        const { data: updatedGist } = await context.axiosInstance.patch(`/${promptsGist.id}`, {
          files: filesPatch,
        });

        context.gistStore.update(updatedGist);
      }

      return `Successfully added prompt "${name}" to prompts collection`;
    },
  },
] as ToolEntry[];
