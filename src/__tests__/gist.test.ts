import { gistHandlers } from "../tools/gist.js";

describe("Gist tools", () => {
    let mockContext: any;

    beforeEach(() => {
        mockContext = {
            axiosInstance: {
                post: jest.fn(),
                delete: jest.fn(),
                get: jest.fn(),
                patch: jest.fn()
            },
            addGistToCache: jest.fn(),
            removeGistFromCache: jest.fn(),
            updateGistInCache: jest.fn(),
            fetchAllGists: jest.fn(),
            notifyResourceChange: jest.fn()
        };
    });

    describe("create_gist", () => {
        it("should trigger resource notification when gist is created", async () => {
            const gistId = "test-gist-123";
            mockContext.axiosInstance.post.mockResolvedValueOnce({ 
                data: { id: gistId }
            });

            const request = {
                params: {
                    arguments: {
                        description: "Test gist",
                        content: "Test content"
                    }
                }
            };

            await gistHandlers.handlers.create_gist(request, mockContext);

            expect(mockContext.notifyResourceChange).toHaveBeenCalledWith({
                type: "add",
                resourceType: "gist",
                resourceId: gistId
            });
        });
    });

    describe("delete_gist", () => {
        it("should trigger resource notification when gist is deleted", async () => {
            const gistId = "test-gist-123";
            const request = {
                params: {
                    arguments: {
                        id: gistId
                    }
                }
            };

            await gistHandlers.handlers.delete_gist(request, mockContext);

            expect(mockContext.notifyResourceChange).toHaveBeenCalledWith({
                type: "delete", 
                resourceType: "gist",
                resourceId: gistId
            });
        });
    });
});