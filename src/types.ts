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
    url: string;
    share_url: string;
}

// MCP / GistPad server types

export interface HandlerContext {
    fetchAllGists: () => Promise<Gist[]>;
    fetchStarredGists: () => Promise<Gist[]>;
    dailyNotesGistId: string | null;

    updateGistInCache: (gist: Gist) => void;
    addGistToCache: (gist: Gist) => void;
    removeGistFromCache: (gistId: string) => void;

    axiosInstance: any;

    addStarredGist: (gist: Gist) => void;
    removeStarredGist: (gistId: string) => void;
}

export interface RequestWithParams {
    params: {
        name: string;
        arguments?: Record<string, unknown>;
    };
}

export type ToolHandler = (
    request: RequestWithParams,
    context: HandlerContext
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
    handlers: Record<string, ToolHandler>;
    tools: ToolDefinition[];
}

export interface ResourceHandlers {
    listResources: (context: HandlerContext) => Promise<{
        resources: Array<{
            uri: string;
            name: string;
            mimeType: "application/json";
        }>;
    }>;

    readResource: (
        uri: string,
        context: HandlerContext
    ) => Promise<{
        contents: Array<{
            uri: string;
            mimeType: "application/json";
            text: string;
        }>;
    }>;
}