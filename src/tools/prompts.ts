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
            name: "delete_prompt",
            description: "Delete a prompt from your prompts collection",
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
            name: "add_prompt",
            description: "Add a new prompt to your prompts collection",
            inputSchema: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        description: "Name of the prompt (will be used as the filename)",
                    },
                    prompt: {
                        type: "string",
                        description: "The prompt content",
                    },
                    description: {
                        type: "string",
                        description: "Optional description of the prompt",
                    },
                    arguments: {
                        type: "array",
                        description: "Optional list of argument definitions",
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
        delete_prompt: async (args: unknown, context) => {
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

        add_prompt: async (args: unknown, context) => {
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

            await context.server.sendPromptListChanged();

            return `Successfully added prompt "${name}" to prompts collection`;
        },
    },
} as ToolModule;
