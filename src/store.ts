import { Gist } from "./types.js";

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

    protected abstract fetchData(): Promise<Gist[]>;
    protected abstract notifyChange(): void;

    async getAll(): Promise<Gist[]> {
        if (this.cache === null) {
            this.cache = await this.fetchData();
        }
        return this.cache;
    }

    add(gist: Gist): void {
        if (this.cache && !this.cache.some(g => g.id === gist.id)) {
            this.cache.push(gist);
            this.notifyChange();
        }
    }

    remove(gistId: string): void {
        if (this.cache) {
            this.cache = this.cache.filter(g => g.id !== gistId);
            this.notifyChange();
        }
    }

    update(gist: Gist) {
        if (this.cache) {
            const index = this.cache.findIndex(g => g.id === gist.id);
            if (index !== -1) {
                const oldGist = this.cache[index];
                this.cache[index] = gist;
                if (oldGist.description !== gist.description) {
                    this.notifyChange();
                }
            }
        }
    }

    invalidate(): void {
        this.cache = null;
    }
}

export class YourGistStore extends GistStore {
    private axiosInstance: {
        get<T>(url: string, config?: any): Promise<{ data: T }>
    };
    private sendResourceListChanged: () => void;
    private dailyNotesGistId: string | null = null;

    constructor(axiosInstance: { get<T>(url: string, config?: any): Promise<{ data: T }> }, sendResourceListChanged: () => void) {
        super();
        this.axiosInstance = axiosInstance;
        this.sendResourceListChanged = sendResourceListChanged;
    }

    async getDailyNotes(): Promise<Gist | null> {
        const gists = await this.fetchData();
        if (this.dailyNotesGistId) {
            const gist = gists.find(gist => gist.id === this.dailyNotesGistId);
            if (gist) {
                return gist;
            }
        }

        return null;
    }

    setDailyNotes(gist: Gist) {
        this.add(gist);
        this.dailyNotesGistId = gist.id;
    }

    protected async fetchData(): Promise<Gist[]> {
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
            const filteredGists = filterGists(gists);
            allGists.push(...filteredGists);

            if (gists.length < perPage) {
                break;
            }

            page++;
        }

        const dailyNotesGist = allGists.find(
            (gist) => gist.description === "📆 Daily notes"
        );

        if (dailyNotesGist) {
            this.dailyNotesGistId = dailyNotesGist.id;
        }

        return allGists;
    }

    protected notifyChange(): void {
        this.sendResourceListChanged();
    }
}

export class StarredGistStore extends GistStore {
    private axiosInstance: {
        get<T>(url: string, config?: any): Promise<{ data: T }>
    };

    constructor(axiosInstance: { get<T>(url: string, config?: any): Promise<{ data: T }> }) {
        super();
        this.axiosInstance = axiosInstance;
    }

    protected async fetchData(): Promise<Gist[]> {
        const response = await this.axiosInstance.get<Gist[]>("/starred");
        return filterGists(response.data);
    }

    protected notifyChange(): void {
        // Starred gists don't need to notify changes
    }
}
