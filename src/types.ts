import { StarredGistStore, YourGistStore } from "./store.js";

// Utility functions

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

export const isArchivedGist = (gist: Gist): boolean => {
    return gist.description?.endsWith(" [Archived]") ?? false;
};

export const DAILY_NOTES_DESCRIPTION = "📆 Daily notes";
export const isDailyNoteGist = (gist: Gist): boolean => {
    return gist.description === DAILY_NOTES_DESCRIPTION;
};

// GitHub Gist API types

export interface GistComment {
    id: string;
    body: string;
    user: {
        login: string;
    };
    created_at: string;
    updated_at: string;
}

export interface GistFile {
    filename: string;
    type: string;
    language: string;
    raw_url: string;
    size: number;
    content: string;
}

export interface Gist {
    id: string;
    description: string;
    files: { [key: string]: GistFile };
    public: boolean;
    created_at: string;
    updated_at: string;
    owner: {
        login: string;
    };
    comments: number;
    url: string;
    share_url: string;
}

// MCP / GistPad server types

export interface RequestContext {
    gistStore: YourGistStore;
    starredGistStore: StarredGistStore;
    axiosInstance: any;
    includeArchived: boolean;
    includeStarred: boolean;
    includeDaily: boolean;
}

export type ToolHandler = (
    args: Record<string, unknown>,
    context: RequestContext
) => Promise<any>;

export type ToolDefinition = {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: Record<string, unknown>;
        required: string[];
    };
};

export interface ToolModule {
    definitions: ToolDefinition[];
    handlers: Record<string, ToolHandler>;
}

export interface ResourceHandlers {
    listResources: (context: RequestContext) => Promise<{
        resources: Array<{
            uri: string;
            name: string;
            mimeType: "application/json";
        }>;
    }>;

    listResourceTemplates: () => {
        resourceTemplates: Array<{
            uriTemplate: string;
            name: string;
            mimeType: string;
            description?: string;
        }>;
    };

    readResource: (
        uri: string,
        context: RequestContext
    ) => Promise<{
        contents: Array<{
            uri: string;
            mimeType: "application/json";
            text: string;
        }>;
    }>;
}
