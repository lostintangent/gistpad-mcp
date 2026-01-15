import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { Gist, RequestContext, ToolEntry } from "../types.js";
import { EMPTY_FILE_CONTENT, gistContent, patchGistFile } from "../utils.js";

// Shared schemas
const updateFileSchema = z.object({
  id: z.string().describe("The ID of the gist"),
  filename: z.string().describe("The name of the file to update"),
  content: z.string().describe("The new content for the file"),
});

const addFileSchema = z.object({
  id: z.string().describe("The ID of the gist"),
  filename: z.string().describe("The name of the new file"),
  content: z.string().describe("The content for the new file"),
});

const deleteFileSchema = z.object({
  id: z.string().describe("The ID of the gist"),
  filename: z.string().describe("The name of the file to delete"),
});

const renameFileSchema = z.object({
  id: z.string().describe("The ID of the gist"),
  old_filename: z.string().describe("The current name of the file"),
  new_filename: z.string().describe("The new name for the file"),
});

const editFileSchema = z.object({
  id: z.string().describe("The ID of the gist"),
  filename: z.string().describe("The name of the file to edit"),
  old_string: z
    .string()
    .describe(
      "The exact text to find and replace. Must match precisely, " +
      "including whitespace, indentation, and newlines. Include " +
      "surrounding context to ensure uniqueness (e.g., full lines).",
    ),
  new_string: z
    .string()
    .describe(
      "The replacement text. Use empty string to delete. " +
      "For insertions, include the original text plus new content.",
    ),
  replace_all: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      "Replace all occurrences (true) or require unique match (false, default). " +
      "When false, edit fails if old_string appears more than once.",
    ),
});

/**
 * Counts non-overlapping occurrences of a substring within a string.
 * Returns 0 for empty search strings (considered invalid).
 */
function countOccurrences(content: string, searchString: string): number {
  if (searchString.length === 0) return 0;

  let count = 0;
  let position = 0;

  while ((position = content.indexOf(searchString, position)) !== -1) {
    count++;
    position += searchString.length;
  }

  return count;
}

/**
 * Normalizes file content by converting the empty file placeholder to an actual empty string.
 * This allows edit operations to work naturally on "empty" files.
 */
function normalizeContent(content: string): string {
  return content === EMPTY_FILE_CONTENT ? "" : content;
}

type FileAssertions = {
  exists?: string;
  notExists?: string;
};

/**
 * Validates gist and file existence, returning the gist if found.
 * Throws McpError with helpful messages if validation fails.
 */
async function getGistWithFileAssertions(
  context: RequestContext,
  gistId: string,
  fileAssertions: FileAssertions,
): Promise<Gist> {
  const gists = await context.gistStore.getAll();
  const gist = gists.find((g: Gist) => g.id === gistId);

  if (!gist) {
    throw new McpError(ErrorCode.InvalidParams, `Gist with ID "${gistId}" not found`);
  }

  if (fileAssertions.exists && !gist.files[fileAssertions.exists]) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `File "${fileAssertions.exists}" not found in gist`,
    );
  }

  if (fileAssertions.notExists && gist.files[fileAssertions.notExists]) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `File "${fileAssertions.notExists}" already exists in gist`,
    );
  }

  return gist;
}

export default [
  {
    name: "update_gist_file",
    description: "Update the content of a file in a gist",
    inputSchema: updateFileSchema,
    handler: async (args, context) => {
      const { id, filename, content } = args as z.infer<typeof updateFileSchema>;

      await getGistWithFileAssertions(context, id, { exists: filename });
      await patchGistFile(context, id, filename, {
        content: gistContent(content),
      });

      return "File updated successfully";
    },
  },
  {
    name: "add_gist_file",
    description: "Add a new file to a gist",
    inputSchema: addFileSchema,
    handler: async (args, context) => {
      const { id, filename, content } = args as z.infer<typeof addFileSchema>;

      await getGistWithFileAssertions(context, id, { notExists: filename });
      await patchGistFile(context, id, filename, {
        content: gistContent(content),
      });

      return "File added successfully";
    },
  },
  {
    name: "delete_gist_file",
    description: "Delete a file from a gist",
    inputSchema: deleteFileSchema,
    handler: async (args, context) => {
      const { id, filename } = args as z.infer<typeof deleteFileSchema>;

      await getGistWithFileAssertions(context, id, { exists: filename });
      await patchGistFile(context, id, filename, null);

      return "File deleted successfully";
    },
  },
  {
    name: "rename_gist_file",
    description: "Rename a file in a gist",
    inputSchema: renameFileSchema,
    handler: async (args, context) => {
      const {
        id,
        old_filename: oldFilename,
        new_filename: newFilename,
      } = args as z.infer<typeof renameFileSchema>;

      await getGistWithFileAssertions(context, id, {
        exists: oldFilename,
        notExists: newFilename,
      });
      await patchGistFile(context, id, oldFilename, {
        filename: newFilename,
      });

      return "File renamed successfully";
    },
  },
  {
    name: "edit_gist_file",
    description:
      "Edit a file in a gist using find-and-replace. More efficient than update_gist_file " +
      "for targeted changes. The old_string must uniquely identify the text to replace - " +
      "if multiple matches exist, the edit will fail unless replace_all is true.",
    inputSchema: editFileSchema,
    handler: async (args, context) => {
      const {
        id,
        filename,
        old_string: oldString,
        new_string: newString,
        replace_all: replaceAll,
      } = args as z.infer<typeof editFileSchema>;

      // Validate old_string and new_string are different
      if (oldString === newString) {
        throw new McpError(ErrorCode.InvalidParams, "old_string and new_string must be different");
      }

      // Validate gist/file exist and get the gist in one call
      const gist = await getGistWithFileAssertions(context, id, {
        exists: filename,
      });

      // Ensure file content is loaded (gists can be fetched without content)
      const loadedGist = await context.gistStore.ensureContentLoaded(gist);
      const rawContent = loadedGist.files[filename].content;
      const content = normalizeContent(rawContent);

      // Count occurrences to validate uniqueness constraint
      const occurrences = countOccurrences(content, oldString);

      if (occurrences === 0) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `The specified old_string was not found in the file "${filename}". ` +
          `Make sure the string matches exactly, including whitespace and line breaks.`,
        );
      }

      if (occurrences > 1 && !replaceAll) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Found ${occurrences} occurrences of old_string in "${filename}". ` +
          `Either set replace_all to true to replace all occurrences, ` +
          `or provide a more specific old_string with surrounding context to match uniquely.`,
        );
      }

      // Perform the replacement
      const newContent = replaceAll
        ? content.split(oldString).join(newString)
        : content.replace(oldString, newString);

      // Save changes
      await patchGistFile(context, id, filename, {
        content: gistContent(newContent),
      });

      // Return informative success message
      const replacementCount = replaceAll ? occurrences : 1;
      return `Successfully replaced ${replacementCount} occurrence${replacementCount > 1 ? "s" : ""} in "${filename}"`;
    },
  },
] as ToolEntry[];
