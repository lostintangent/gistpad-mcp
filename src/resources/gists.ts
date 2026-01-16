import type { Gist, GistComment, GistFile, RequestContext, ResourceHandlers } from "#types";
import { GIST_URI_PREFIX, isArchivedGist, isDailyNoteGist, isPromptGist, mcpGist } from "#utils";

/**
 * Determines if a gist should be included in the resource list based on context flags.
 */
function shouldIncludeInResourceList(gist: Gist, context: RequestContext): boolean {
  return (
    !isPromptGist(gist) &&
    (context.includeArchived || !isArchivedGist(gist)) &&
    (context.includeDaily || !isDailyNoteGist(gist))
  );
}

/**
 * Gets a user-friendly display name for a gist.
 * Falls back to first filename or "Empty"/"Untitled" if no description exists.
 */
function getGistDisplayName(gist: Gist): string {
  const name = gist.description?.trim();
  if (name) {
    return name;
  }

  const firstFile = Object.keys(gist.files)[0];
  if (!firstFile) {
    return "Empty";
  }

  if (firstFile === "README.md") {
    // Explicitly mark this as "Untitled", since the file
    // name isn't unique enough to be used as a name, and
    // we want to draw attention to it.
    return "Untitled";
  }

  // Strip the extension off markdown files, since
  // we'll treat those as pseudo descriptions.
  return firstFile.replace(/\.md$/i, "");
}

export const resourceHandlers: ResourceHandlers = {
  listResourceTemplates: () => ({
    resourceTemplates: [
      {
        uriTemplate: `${GIST_URI_PREFIX}{gistId}/comments`,
        name: "Comments for a gist",
        description: "List of comments on a specific gist",
        mimeType: "application/json",
      },
    ],
  }),

  listResources: async (context) => {
    let gists = await context.gistStore.getAll();

    if (context.includeStarred) {
      const starredGists = await context.starredGistStore.getAll();
      const markedStarredGists = starredGists.map((gist) => ({
        ...gist,
        description: (gist.description ?? "") + " [Starred]",
      }));
      gists = [...gists, ...markedStarredGists];
    }

    return {
      resources: gists
        .filter((gist) => shouldIncludeInResourceList(gist, context))
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .map((gist) => ({
          uri: `${GIST_URI_PREFIX}${gist.id}`,
          name: getGistDisplayName(gist),
          mimeType: "application/json",
          annotations: {
            lastModified: gist.updated_at,
          },
        })),
    };
  },

  readResource: async (uri, context) => {
    const { pathname } = new URL(uri);
    if (pathname.endsWith("/comments")) {
      const comments = await context.fetchClient.get<GistComment[]>(pathname);

      // Use the most recent comment's updated_at as lastModified
      const firstComment = comments[0];
      const lastModified = firstComment
        ? comments.reduce(
            (latest, comment) => (comment.updated_at > latest ? comment.updated_at : latest),
            firstComment.updated_at,
          )
        : undefined;

      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(comments, null, 2),
            ...(lastModified && { annotations: { lastModified } }),
          },
        ],
      };
    }

    const gist = await context.fetchClient.get<Gist>(pathname);
    context.gistStore.update(gist);

    const resource = {
      uri,
      mimeType: "application/json",
      text: JSON.stringify(mcpGist(gist), null, 2),
    };

    // Note: Nothing uses this at the moment, but it could be useful in the future.
    if (pathname.endsWith("/raw")) {
      const mainFile: GistFile = gist.files["README.md"] ?? Object.values(gist.files).at(0)!;

      resource.mimeType = mainFile.type;
      resource.text = mainFile.content;
    }

    return {
      contents: [resource],
    };
  },
};
