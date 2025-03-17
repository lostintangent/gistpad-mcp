import { Gist, isDailyNoteGist } from "./types.js";

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

    constructor(
        protected axiosInstance: {
            get<T>(url: string, config?: any): Promise<{ data: T }>;
        },
        private server: { sendResourceListChanged(): void },
        private triggerNotifications: boolean = true
    ) { }

    protected abstract fetchData(): Promise<Gist[]>;

    private notifyResourceListChanged(): void {
        if (this.triggerNotifications) {
            this.server.sendResourceListChanged();
        }
    }

    async getAll(): Promise<Gist[]> {
        if (this.cache === null) {
            this.cache = await this.fetchData();
        }
        return this.cache;
    }

    add(gist: Gist): void {
        if (this.cache && !this.cache.some((g) => g.id === gist.id)) {
            this.cache.push(gist);
            this.notifyResourceListChanged();
        }
    }

    remove(gistId: string): void {
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
                if (oldGist.description !== gist.description) {
                    this.notifyResourceListChanged();
                }
            }
        }
    }

    invalidate(): void {
        this.cache = null;
    }
}

export class YourGistStore extends GistStore {
    private dailyNotesGistId: string | null = null;

    async getDailyNotes(): Promise<Gist | null> {
        const gists = await this.fetchData();
        if (this.dailyNotesGistId) {
            const gist = gists.find((gist) => gist.id === this.dailyNotesGistId);
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

        const dailyNotesGist = allGists.find(isDailyNoteGist);
        if (dailyNotesGist) {
            this.dailyNotesGistId = dailyNotesGist.id;
        }

        return allGists;
    }
}

export class StarredGistStore extends GistStore {
    protected async fetchData(): Promise<Gist[]> {
        const response = await this.axiosInstance.get<Gist[]>("/starred");
        return filterGists(response.data);
    }
}
