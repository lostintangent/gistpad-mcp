import { Gist } from "./types.js";

export class GistStore {
    private cache: Gist[] | null = null;

    private dataFetcher: () => Promise<Gist[]>;
    private changeNotifier: (() => void) | undefined;

    constructor(dataFetcher: () => Promise<Gist[]>, changeNotifier?: () => void) {
        this.dataFetcher = dataFetcher;
        this.changeNotifier = changeNotifier;
    }

    async getAll(): Promise<Gist[]> {
        if (this.cache === null) {
            this.cache = await this.dataFetcher();
        }
        return this.cache;
    }

    add(gist: Gist): void {
        if (this.cache && !this.cache.some(g => g.id === gist.id)) {
            this.cache.push(gist);
            this.changeNotifier && this.changeNotifier();
        }
    }

    remove(gistId: string): void {
        if (this.cache) {
            this.cache = this.cache.filter(g => g.id !== gistId);
            this.changeNotifier && this.changeNotifier();
        }
    }

    update(gist: Gist) {
        if (this.cache) {
            const index = this.cache.findIndex(g => g.id === gist.id);
            if (index !== -1) {
                const oldGist = this.cache[index];
                this.cache[index] = gist;
                if (this.changeNotifier && oldGist.description !== gist.description) {
                    this.changeNotifier();
                }
            }
        }
    }

    invalidate(): void {
        this.cache = null;
    }
}
