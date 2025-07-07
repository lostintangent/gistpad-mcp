import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Gist } from "./types.js";
import { isContentLoaded, isDailyNoteGist, isPromptGist } from "./utils.js";

function filterGists(gists: Gist[]): Gist[] {
    return gists.filter((gist: Gist) => {
        const files = Object.entries(gist.files);

        return files.every(
            ([_, file]) =>
                file.language === "Markdown" || file.filename.endsWith(".tldraw")
        );
    });
}

export abstract class GistStore {
    private cache: Gist[] | null = null;
    private subscribedGists: Set<string> = new Set();

    constructor(
        protected axiosInstance: {
            get<T>(url: string, config?: any): Promise<{ data: T }>;
        },
        private server: Server,
        private triggerNotifications: boolean = true,
        private markdownOnly: boolean = false
    ) { }

    protected abstract fetchGists(): Promise<Gist[]>;

    private notifyResourceListChanged(): void {
        if (this.triggerNotifications) {
            this.server.sendResourceListChanged();
        }
    }

    private notifyResourceChanged(gistId: string): void {
        if (this.triggerNotifications && this.subscribedGists.has(gistId)) {
            this.server.sendResourceUpdated({ uri: `gist:///${gistId}` });
        }
    }

    private notifyPromptListChanged() {
        if (this.triggerNotifications) {
            this.server.sendPromptListChanged();
        }
    }

    async getAll(forceRefresh: boolean = false): Promise<Gist[]> {
        if (this.cache === null || forceRefresh) {
            const gists = await this.fetchGists();
            this.cache = this.markdownOnly ? filterGists(gists) : gists;
        }
        return this.cache;
    }

    add(gist: Gist): void {
        if (this.cache && !this.cache.some((g) => g.id === gist.id)) {
            this.cache.push(gist);

            if (isPromptGist(gist)) {
                this.notifyPromptListChanged();
            } else {
                this.notifyResourceListChanged();
            }
        }
    }

    remove(gistId: string) {
        if (this.cache) {
            this.cache = this.cache.filter((g) => g.id !== gistId);
            this.notifyResourceListChanged();
        }
    }

    update(gist: Gist) {
        if (this.cache) {
            const index = this.cache.findIndex((g) => g.id === gist.id);
            if (index !== -1) {
                const oldGist = this.cache[index];
                this.cache[index] = gist;

                // If the gist didn't actually change, we don't need to notify.
                if (oldGist.updated_at === gist.updated_at) {
                    return;
                }

                if (isPromptGist(gist)) {
                    this.notifyPromptListChanged();
                } else {
                    // The resource list only includes the gist ID and
                    // description, so we only need to notify clients to
                    // update the list when a gist's description changes.
                    if (oldGist.description !== gist.description) {
                        this.notifyResourceListChanged();
                    }

                    this.notifyResourceChanged(gist.id);
                }
            }
        }
    }

    async refresh() {
        await this.getAll(true);
        this.notifyResourceListChanged();
    }

    subscribe(gistId: string) {
        this.subscribedGists.add(gistId);
    }

    unsubscribe(gistId: string) {
        this.subscribedGists.delete(gistId);
    }

    async ensureContentLoaded(gist: Gist): Promise<Gist> {
        if (isContentLoaded(gist)) return gist;

        const { data: loadedGist } = await this.axiosInstance.get<Gist>(
            `/${gist.id}`
        );

        this.update(loadedGist);
        return loadedGist;
    }
}

export class YourGistStore extends GistStore {
    private dailyNotesGistId: string | null = null;
    private promptsGistId: string | null = null;

    async getDailyNotes(): Promise<Gist | null> {
        const gists = await this.fetchGists();
        if (this.dailyNotesGistId) {
            const gist = gists.find((gist) => gist.id === this.dailyNotesGistId);
            if (gist) {
                return this.ensureContentLoaded(gist);
            }
        }

        return null;
    }

    async getPrompts(): Promise<Gist | null> {
        const gists = await this.fetchGists();
        if (this.promptsGistId) {
            const gist = gists.find((gist) => gist.id === this.promptsGistId);
            if (gist) {
                return this.ensureContentLoaded(gist);
            }
        }

        return null;
    }

    setDailyNotes(gist: Gist) {
        this.add(gist);
        this.dailyNotesGistId = gist.id;
    }

    setPrompts(gist: Gist) {
        this.add(gist);
        this.promptsGistId = gist.id;
    }

    protected async fetchGists(): Promise<Gist[]> {
        const allGists: Gist[] = [];
        let page = 1;
        const perPage = 100;

        while (true) {
            const response = await this.axiosInstance.get<Gist[]>("", {
                params: {
                    per_page: perPage,
                    page: page,
                },
            });

            const gists = response.data;
            allGists.push(...gists);

            if (gists.length < perPage) {
                break;
            }

            page++;
        }

        const dailyNotesGist = allGists.find(isDailyNoteGist);
        if (dailyNotesGist) {
            this.dailyNotesGistId = dailyNotesGist.id;
        }

        const promptsGist = allGists.find(isPromptGist);
        if (promptsGist) {
            this.promptsGistId = promptsGist.id;
        }

        return allGists;
    }
}

export class StarredGistStore extends GistStore {
    protected async fetchGists(): Promise<Gist[]> {
        const response = await this.axiosInstance.get<Gist[]>("/starred");
        return response.data;
    }
}
