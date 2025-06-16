import { Gist } from "./types.js";

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
    return gist.description?.endsWith(" [Archived]") ?? false;
}

export const DAILY_NOTES_DESCRIPTION = "📆 Daily notes";
export function isDailyNoteGist(gist: Gist): boolean {
    return gist.description === DAILY_NOTES_DESCRIPTION;
}

export const PROMPTS_DESCRIPTION = "💬 Prompts";
export function isPromptGist(gist: Gist): boolean {
    return gist.description === PROMPTS_DESCRIPTION;
}

export function isContentLoaded(gist: Gist): boolean {
    return Object.values(gist.files).every((file) => file.content !== undefined);
}

// Gist's aren't allowed to be empty, so we're using an
// "invisible plus" as content when the content is empty.
const EMPTY_FILE_CONTENT = "\u{2064}";
export function gistContent(content: string): string {
    return content || EMPTY_FILE_CONTENT;
}