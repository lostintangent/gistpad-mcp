import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { ToolModule } from "../types.js";
import { PROMPTS_DESCRIPTION } from "../utils.js";

interface PromptArgument {
    name: string;
    description: string;
}

interface AddPromptArgs {
    name: string;
    prompt: string;
    description?: string;
    arguments?: PromptArgument[];
}

export default {
    definitions: [
        {
            name: "list_gist_prompts",
            description: "List the prompts in your gist-based prompts collection",
            inputSchema: {
                type: "object",
                properties: {},
                required: [],
            },
        },
        {
            name: "delete_gist_prompt",
            description: "Delete a prompt from your gist-based prompts collection",
            inputSchema: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        description:
                            "Name of the prompt to delete (including .md extension if not already present)",
                    },
                },
                required: ["name"],
            },
        },
        {
            name: "add_gist_prompt",
            description: "Add a new prompt to your gist-based prompts collection",
            inputSchema: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        description: "Name of the prompt, which will be used as the filename, and therefore, shouldn't include invalid characters. It will be saved with a .md extension, and therefore, this field can be provided without the .md extension.",
                    },
                    prompt: {
                        type: "string",
                        description:
                            "The prompt content, which must be a natural language request that will be sent to the LLM in order to generate the requested response. It can include {{argument}} placeholders for arguments (referencing the argument name), that will be replaced dynamically when the prompt is used.",
                    },
                    description: {
                        type: "string",
                        description: "Optional description of the prompt, that will be displayed to the user when later selecting the prompt in the UI.",
                    },
                    arguments: {
                        type: "array",
                        description: "Optional list of arguments that the prompt accepts (using {{placeholder}} variables in its text).",
                        items: {
                            type: "object",
                            properties: {
                                name: {
                                    type: "string",
                                    description: "Name of the argument",
                                },
                                description: {
                                    type: "string",
                                    description: "Description of the argument",
                                },
                            },
                            required: ["name", "description"],
                        },
                    },
                },
                required: ["name", "prompt"],
            },
        },
    ],

    handlers: {
        list_gist_prompts: async (_, context) => {
            const promptsGist = await context.gistStore.getPrompts();
            if (!promptsGist) {
                return {
                    prompts: [],
                }
            }

            const prompts = Object.keys(promptsGist.files)
                .map(filename => filename.replace(/\.md$/, ""));

            return {
                prompts,
            };
        },

        delete_gist_prompt: async (args: unknown, context) => {
            const { name } = args as { name: string };

            if (!name || typeof name !== "string") {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "Name is required and must be a string"
                );
            }

            const filename = name.toString().endsWith(".md")
                ? name.toString()
                : `${name}.md`;

            const promptsGist = await context.gistStore.getPrompts();
            if (!promptsGist) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "Prompts collection not found"
                );
            }

            // Check if the file exists
            if (!promptsGist.files[filename]) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    `Prompt '${filename}' not found`
                );
            }

            const { data: updatedGist } = await context.axiosInstance.patch(
                `/${promptsGist.id}`,
                {
                    files: {
                        [filename]: null,
                    },
                }
            );

            context.gistStore.update(updatedGist);

            return `Successfully deleted prompt "${name}"`;
        },

        add_gist_prompt: async (args: unknown, context) => {
            const {
                name,
                prompt,
                description,
                arguments: promptArgs,
            } = args as AddPromptArgs;

            if (
                !name ||
                typeof name !== "string" ||
                !prompt ||
                typeof prompt !== "string"
            ) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "Name and prompt are required and must be strings"
                );
            }

            // Ensure the name ends with .md
            const filename = name.toString().endsWith(".md")
                ? name.toString()
                : `${name}.md`;

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
                const { data: updatedGist } = await context.axiosInstance.patch(
                    `/${promptsGist.id}`,
                    {
                        files: filesPatch,
                    }
                );

                context.gistStore.update(updatedGist);
            }

            return `Successfully added prompt "${name}" to prompts collection`;
        },
    },
} as ToolModule;
