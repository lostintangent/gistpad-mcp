
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

export interface ResourceNotification {
    type: "add" | "delete";
    resourceType: "gist";
    resourceId: string;
}

export interface GistHandlerContext {
    fetchAllGists: () => Promise<Gist[]>;
    fetchStarredGists: () => Promise<Gist[]>;
    dailyNotesGistId: string | null;

    updateGistInCache: (gist: Gist) => void;
    addGistToCache: (gist: Gist) => void;
    removeGistFromCache: (gistId: string) => void;
    invalidateCache: () => void;

    axiosInstance: any;

    addStarredGist: (gist: Gist) => void;
    removeStarredGist: (gistId: string) => void;

    // Method to trigger resource notifications when gists are added/deleted
    notifyResourceChange?: (notification: ResourceNotification) => void;
}

export interface RequestWithParams {
    params: {
        name: string;
        arguments?: Record<string, unknown>;
    };
}

export type ToolHandler = (
    request: RequestWithParams,
    context: GistHandlerContext
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

export interface HandlerModule {
    handlers: Record<string, ToolHandler>;
    tools: ToolDefinition[];
}
