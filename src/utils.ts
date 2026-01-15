import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { Gist, RequestContext } from "./types.js";

export function mcpGist(gist: Gist) {
  return {
    id: gist.id,
    description: gist.description,
    owner: gist.owner.login,
    public: gist.public,
    created_at: gist.created_at,
    updated_at: gist.updated_at,
    files: Object.entries(gist.files).map(([filename, file]) => ({
      filename,
      type: file.type,
      size: file.size,
      content: file.content,
    })),
    comments: gist.comments,
    url: `https://gistpad.dev/#/${gist.id}`,
    share_url: `https://gistpad.dev/#/share/${gist.id}`,
  };
}

export function isArchivedGist(gist: Gist): boolean {
  return gist.description?.endsWith(ARCHIVED_SUFFIX) ?? false;
}

export const DAILY_NOTES_DESCRIPTION = "📆 Daily notes";
export function isDailyNoteGist(gist: Gist): boolean {
  return gist.description === DAILY_NOTES_DESCRIPTION;
}

export const PROMPTS_DESCRIPTION = "💬 Prompts";
export function isPromptGist(gist: Gist): boolean {
  return gist.description === PROMPTS_DESCRIPTION;
}

export const ARCHIVED_SUFFIX = " [Archived]";
export const ARCHIVED_SUFFIX_REGEX = / \[Archived\]$/;

export const GIST_URI_PREFIX = "gist:///";

export function isContentLoaded(gist: Gist): boolean {
  return Object.values(gist.files).every((file) => file.content !== undefined);
}

// Gist's aren't allowed to be empty, so we're using an
// "invisible plus" as content when the content is empty.
export const EMPTY_FILE_CONTENT = "\u{2064}";
export function gistContent(content: string): string {
  return content || EMPTY_FILE_CONTENT;
}

/**
 * Finds a gist by ID from the store, throwing a helpful error if not found.
 */
export async function findGistById(
  context: RequestContext,
  id: string,
  errorMessage?: string,
): Promise<Gist> {
  const gists = await context.gistStore.getAll();
  const gist = gists.find((g: Gist) => g.id === id);
  if (!gist) {
    throw new McpError(ErrorCode.InvalidParams, errorMessage || `Gist with ID "${id}" not found`);
  }
  return gist;
}

/**
 * Updates a gist file by patching it through the GitHub API.
 */
export async function patchGistFile(
  context: RequestContext,
  gistId: string,
  filename: string,
  patch: { content?: string; filename?: string } | null,
): Promise<void> {
  const response = await context.axiosInstance.patch(`/${gistId}`, {
    files: {
      [filename]: patch,
    },
  });
  context.gistStore.update(response.data);
}
