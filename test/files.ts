import assert from "node:assert";
import { mock, suite, test } from "node:test";
import type { FetchClient } from "../src/server/fetch.js";
import fileTools from "../src/tools/files.js";
import type { Gist, GistFile, RequestContext, ToolEntry } from "../src/types.js";

// Create a lookup object from the tools array for easy access in tests
const handlers = Object.fromEntries(fileTools.map((tool: ToolEntry) => [tool.name, tool.handler]));

// ============================================================================
// Test Helpers
// ============================================================================

interface MockContext extends RequestContext {
  fetchClient: FetchClient & { patch: ReturnType<typeof mock.fn> };
  gistStore: RequestContext["gistStore"] & {
    update: ReturnType<typeof mock.fn>;
  };
}

function createMockGist(id: string, files: Record<string, string>): Gist {
  return {
    id,
    description: "Test Gist",
    files: Object.fromEntries(
      Object.entries(files).map(([filename, content]) => [
        filename,
        {
          filename,
          content,
          type: "text/markdown",
          language: "Markdown",
          raw_url: `https://gist.githubusercontent.com/raw/${id}/${filename}`,
          size: content.length,
        } as GistFile,
      ]),
    ),
    public: false,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    owner: { login: "testuser" },
    comments: 0,
    url: `https://api.github.com/gists/${id}`,
    share_url: `https://gist.github.com/${id}`,
  };
}

function createMockContext(gists: Gist[]): MockContext {
  return {
    server: {} as MockContext["server"],
    gistStore: {
      getAll: mock.fn(async () => gists),
      update: mock.fn(),
      ensureContentLoaded: mock.fn(async (gist: Gist) => gist),
    } as unknown as MockContext["gistStore"],
    starredGistStore: {} as MockContext["starredGistStore"],
    fetchClient: {
      get: mock.fn(),
      post: mock.fn(),
      patch: mock.fn(
        async <T>(_url: string, data: { files: Record<string, { content: string }> }): Promise<T> =>
          ({
            ...gists[0],
            files: { ...gists[0]?.files, ...data.files },
            updated_at: new Date().toISOString(),
          }) as T,
      ),
      put: mock.fn(),
      delete: mock.fn(),
    } as unknown as MockContext["fetchClient"],
    includeArchived: false,
    includeStarred: false,
    includeDaily: false,
  };
}

function getPatchedContent(context: MockContext, filename: string): string | undefined {
  const calls = context.fetchClient.patch.mock.calls;
  if (calls.length === 0) return undefined;
  const patchData = calls[0]?.arguments[1] as
    | { files?: Record<string, { content?: string }> }
    | undefined;
  return patchData?.files?.[filename]?.content;
}

/**
 * Asserts that an edit operation throws an error matching the pattern.
 */
async function assertEditRejects(
  content: string,
  filename: string,
  oldString: string,
  newString: string,
  errorPattern: RegExp,
  options?: { gistFilename?: string },
): Promise<void> {
  const gistFilename = options?.gistFilename ?? filename;
  const gist = createMockGist("test-123", { [gistFilename]: content });
  const context = createMockContext([gist]);

  await assert.rejects(
    handlers.edit_gist_file!(
      {
        id: "test-123",
        filename,
        old_string: oldString,
        new_string: newString,
      },
      context,
    ),
    errorPattern,
  );
}

/**
 * Performs an edit and asserts the result contains/excludes expected strings.
 */
async function assertEdit(
  content: string,
  filename: string,
  oldString: string,
  newString: string,
  expectations: {
    includes?: string[];
    excludes?: string[];
    equals?: string;
    resultIncludes?: string;
  },
  options?: { replace_all?: boolean },
): Promise<void> {
  const gist = createMockGist("test-123", { [filename]: content });
  const context = createMockContext([gist]);

  const result = (await handlers.edit_gist_file!(
    {
      id: "test-123",
      filename,
      old_string: oldString,
      new_string: newString,
      ...options,
    },
    context,
  )) as string;

  const patchedContent = getPatchedContent(context, filename)!;

  if (expectations.equals !== undefined) {
    assert.strictEqual(patchedContent, expectations.equals);
  }
  for (const expected of expectations.includes ?? []) {
    assert.ok(patchedContent.includes(expected), `Expected content to include: "${expected}"`);
  }
  for (const excluded of expectations.excludes ?? []) {
    assert.ok(!patchedContent.includes(excluded), `Expected content to exclude: "${excluded}"`);
  }
  if (expectations.resultIncludes) {
    assert.ok(
      result.includes(expectations.resultIncludes),
      `Expected result to include: "${expectations.resultIncludes}"`,
    );
  }
}

// ============================================================================
// Test Fixtures
// ============================================================================

const FIXTURES = {
  simpleList: `# Shopping List

- Apples
- Bananas
- Oranges
`,

  nestedList: `# Project Tasks

- Frontend
  - Design mockups
  - Implement components
  - Write tests
- Backend
  - API design
  - Database schema
`,

  multipleHeadings: `# Main Title

Some intro text.

## Section One

Content for section one.

## Section Two

Content for section two.

### Subsection

More detailed content.
`,

  withCodeBlock: `# API Documentation

Here's how to use the API:

\`\`\`typescript
const result = await api.call({
    method: 'GET',
    endpoint: '/users'
});
\`\`\`
`,

  withInlineCode: `# Config

Set \`DEBUG=true\` to enable logging.

Run \`npm install\` first.
`,

  withTable: `# User Data

| Name | Age | Role |
|------|-----|------|
| Alice | 30 | Admin |
| Bob | 25 | User |
| Carol | 35 | User |
`,

  withDuplicates: `# Task List

- TODO: Fix bug
- TODO: Add feature
- TODO: Write tests
- TODO: Update docs
`,

  withSpecialChars: `# Config

Pattern: [a-z]+.*
Regex: ^\\d{3}-\\d{4}$
Dollar: $100
Caret: ^start
`,

  unicodeContent: `# Hello World

Hello 世界! 🌍

- Café ☕
- Naïve 🎭
`,

  multipleParagraphs: `# Article

This is the first paragraph with some content.

This is the second paragraph with different content.

This is the third paragraph with a conclusion.
`,

  withLinks: `# Resources

Check out [Google](https://google.com) for search.

See also [GitHub](https://github.com).

![Logo](https://example.com/logo.png)
`,

  withBlockquote: `# Wisdom

> To be or not to be,
> that is the question.

More text here.
`,

  withTaskList: `# Tasks

- [x] Completed task
- [ ] Pending task
- [ ] Another pending
`,

  withHorizontalRule: `# Section 1

Content here.

---

# Section 2

More content.
`,
};

// ============================================================================
// Error Cases
// ============================================================================

suite("edit_gist_file - Error Cases", () => {
  test("should throw when gist not found", () => {
    const context = createMockContext([]);
    return assert.rejects(
      handlers.edit_gist_file!(
        {
          id: "nonexistent",
          filename: "test.md",
          old_string: "foo",
          new_string: "bar",
        },
        context,
      ),
      /Gist with ID "nonexistent" not found/,
    );
  });

  test("should throw when file not found in gist", () =>
    assertEditRejects(
      "# Hello",
      "nonexistent.md",
      "foo",
      "bar",
      /File "nonexistent.md" not found in gist/,
      { gistFilename: "readme.md" },
    ));

  test("should throw when old_string not found in file", () =>
    assertEditRejects(
      "# Hello World",
      "test.md",
      "Goodbye",
      "Hi",
      /old_string was not found/,
    ));

  test("should throw when multiple occurrences found without replace_all", () =>
    assertEditRejects(
      FIXTURES.withDuplicates,
      "todos.md",
      "TODO",
      "DONE",
      /Found 4 occurrences.*replace_all/,
    ));

  test("should throw when old_string equals new_string", () =>
    assertEditRejects(
      "# Hello",
      "test.md",
      "Hello",
      "Hello",
      /old_string and new_string must be different/,
    ));

  test("should throw when old_string is empty", () =>
    assertEditRejects("# Hello", "test.md", "", "something", /old_string was not found/));
});

// ============================================================================
// Markdown Lists
// ============================================================================

suite("edit_gist_file - Markdown Lists", () => {
  test("should add item to end of list", () =>
    assertEdit(FIXTURES.simpleList, "shopping.md", "- Oranges\n", "- Oranges\n- Grapes\n", {
      includes: ["- Grapes", "- Oranges"],
    }));

  test("should add item to beginning of list", () =>
    assertEdit(FIXTURES.simpleList, "shopping.md", "- Apples", "- Strawberries\n- Apples", {
      includes: ["- Strawberries", "- Apples"],
    }));

  test("should remove a list item", () =>
    assertEdit(FIXTURES.simpleList, "shopping.md", "- Bananas\n", "", {
      includes: ["Apples", "Oranges"],
      excludes: ["Bananas"],
    }));

  test("should edit item in nested list preserving indentation", () =>
    assertEdit(
      FIXTURES.nestedList,
      "tasks.md",
      "  - Design mockups",
      "  - Design mockups ✅",
      { includes: ["  - Design mockups ✅"] },
    ));

  test("should toggle task list checkbox", () =>
    assertEdit(
      FIXTURES.withTaskList,
      "tasks.md",
      "- [ ] Pending task",
      "- [x] Pending task",
      { includes: ["- [x] Pending task"] },
    ));
});

// ============================================================================
// Markdown Headings
// ============================================================================

suite("edit_gist_file - Markdown Headings", () => {
  test("should edit heading text", () =>
    assertEdit(FIXTURES.multipleHeadings, "doc.md", "# Main Title", "# Updated Title", {
      includes: ["# Updated Title"],
      excludes: ["# Main Title"],
    }));

  test("should change heading level", () =>
    assertEdit(FIXTURES.multipleHeadings, "doc.md", "### Subsection", "## Subsection", {
      includes: ["\n## Subsection"],
      excludes: ["### Subsection"],
    }));

  test("should insert new section with heading", () =>
    assertEdit(
      FIXTURES.multipleHeadings,
      "doc.md",
      "## Section Two",
      "## New Section\n\nNew content.\n\n## Section Two",
      { includes: ["## New Section", "## Section Two"] },
    ));
});

// ============================================================================
// Markdown Paragraphs
// ============================================================================

suite("edit_gist_file - Markdown Paragraphs", () => {
  test("should edit paragraph content", () =>
    assertEdit(
      FIXTURES.multipleParagraphs,
      "article.md",
      "This is the first paragraph with some content.",
      "This is the UPDATED first paragraph.",
      { includes: ["UPDATED first paragraph"] },
    ));

  test("should add new paragraph between existing ones", () =>
    assertEdit(
      FIXTURES.multipleParagraphs,
      "article.md",
      "This is the second paragraph with different content.",
      "This is the second paragraph with different content.\n\nINSERTED PARAGRAPH HERE.",
      { includes: ["INSERTED PARAGRAPH HERE"] },
    ));

  test("should delete paragraph by replacing with empty string", () =>
    assertEdit(
      FIXTURES.multipleParagraphs,
      "article.md",
      "\n\nThis is the second paragraph with different content.",
      "",
      {
        includes: ["first paragraph", "third paragraph"],
        excludes: ["second paragraph"],
      },
    ));
});

// ============================================================================
// Markdown Code Blocks
// ============================================================================

suite("edit_gist_file - Markdown Code Blocks", () => {
  test("should edit code inside fenced code block", () =>
    assertEdit(FIXTURES.withCodeBlock, "api.md", "method: 'GET'", "method: 'POST'", {
      includes: ["method: 'POST'"],
      excludes: ["method: 'GET'"],
    }));

  test("should change code block language", () =>
    assertEdit(FIXTURES.withCodeBlock, "api.md", "```typescript", "```javascript", {
      includes: ["```javascript"],
    }));

  test("should edit inline code", () =>
    assertEdit(FIXTURES.withInlineCode, "config.md", "`DEBUG=true`", "`DEBUG=false`", {
      includes: ["`DEBUG=false`"],
    }));
});

// ============================================================================
// Markdown Tables
// ============================================================================

suite("edit_gist_file - Markdown Tables", () => {
  test("should edit table cell content", () =>
    assertEdit(
      FIXTURES.withTable,
      "users.md",
      "| Alice | 30 | Admin |",
      "| Alice | 31 | SuperAdmin |",
      { includes: ["| Alice | 31 | SuperAdmin |"] },
    ));

  test("should add table row", () =>
    assertEdit(
      FIXTURES.withTable,
      "users.md",
      "| Carol | 35 | User |",
      "| Carol | 35 | User |\n| Dave | 28 | User |",
      { includes: ["| Dave | 28 | User |"] },
    ));

  test("should delete table row", () =>
    assertEdit(FIXTURES.withTable, "users.md", "| Bob | 25 | User |\n", "", {
      includes: ["Alice", "Carol"],
      excludes: ["Bob"],
    }));
});

// ============================================================================
// Markdown Links and Images
// ============================================================================

suite("edit_gist_file - Links and Images", () => {
  test("should update link URL", () =>
    assertEdit(
      FIXTURES.withLinks,
      "links.md",
      "[Google](https://google.com)",
      "[Google](https://www.google.com)",
      { includes: ["https://www.google.com"] },
    ));

  test("should change link text", () =>
    assertEdit(
      FIXTURES.withLinks,
      "links.md",
      "[GitHub](https://github.com)",
      "[GitHub Homepage](https://github.com)",
      { includes: ["[GitHub Homepage]"] },
    ));

  test("should update image URL", () =>
    assertEdit(
      FIXTURES.withLinks,
      "links.md",
      "![Logo](https://example.com/logo.png)",
      "![Logo](https://example.com/new-logo.png)",
      { includes: ["new-logo.png"] },
    ));
});

// ============================================================================
// Markdown Blockquotes
// ============================================================================

suite("edit_gist_file - Blockquotes", () => {
  test("should edit blockquote content", () =>
    assertEdit(
      FIXTURES.withBlockquote,
      "quote.md",
      "> To be or not to be,",
      "> To code or not to code,",
      { includes: ["> To code or not to code,"] },
    ));
});

// ============================================================================
// Edge Cases and Special Characters
// ============================================================================

suite("edit_gist_file - Edge Cases", () => {
  test("should handle single character content", () =>
    assertEdit("#", "minimal.md", "#", "# New Heading", {
      equals: "# New Heading",
    }));

  test("should handle unicode content", () =>
    assertEdit(FIXTURES.unicodeContent, "unicode.md", "Hello 世界!", "Bonjour 世界!", {
      includes: ["Bonjour 世界!", "🌍"],
    }));

  test("should treat regex special characters as literals", () =>
    assertEdit(FIXTURES.withSpecialChars, "config.md", "[a-z]+.*", "[A-Z]+\\d*", {
      includes: ["[A-Z]+\\d*"],
      excludes: ["[a-z]+.*"],
    }));

  test("should handle dollar sign as literal", () =>
    assertEdit(FIXTURES.withSpecialChars, "config.md", "$100", "$200", {
      includes: ["$200"],
    }));

  test("should preserve exact whitespace and indentation", () =>
    assertEdit(
      "# Title\n\n    indented line\n\nregular line",
      "whitespace.md",
      "    indented line",
      "        double indent",
      { includes: ["        double indent"] },
    ));

  test("should handle multiline replacement", () =>
    assertEdit(
      FIXTURES.simpleList,
      "doc.md",
      "- Apples\n- Bananas",
      "- Apples\n- Blueberries\n- Bananas",
      { includes: ["- Apples", "- Blueberries", "- Bananas"] },
    ));

  test("should replace entire file content", () =>
    assertEdit("Old content", "test.md", "Old content", "Completely new content", {
      equals: "Completely new content",
    }));

  test("should handle horizontal rule", () =>
    assertEdit(FIXTURES.withHorizontalRule, "doc.md", "---", "***", {
      includes: ["***"],
      excludes: ["---"],
    }));
});

// ============================================================================
// replace_all Behavior
// ============================================================================

suite("edit_gist_file - replace_all", () => {
  test("should replace all occurrences when replace_all is true", () =>
    assertEdit(
      FIXTURES.withDuplicates,
      "todos.md",
      "TODO",
      "DONE",
      { excludes: ["TODO"], resultIncludes: "4 occurrences" },
      { replace_all: true },
    ));

  test("should work with replace_all for single occurrence", () =>
    assertEdit(
      "Hello World",
      "test.md",
      "Hello",
      "Hi",
      { equals: "Hi World", resultIncludes: "1 occurrence" },
      { replace_all: true },
    ));

  test("should return singular 'occurrence' for single replacement", () =>
    assertEdit("# Hello World", "test.md", "Hello", "Hi", {
      resultIncludes: "1 occurrence",
    }));
});

// ============================================================================
// Store Update Verification
// ============================================================================

suite("edit_gist_file - Store Integration", () => {
  test("should call gistStore.update after successful edit", async () => {
    const gist = createMockGist("test-123", { "test.md": "Hello" });
    const context = createMockContext([gist]);

    await handlers.edit_gist_file!(
      {
        id: "test-123",
        filename: "test.md",
        old_string: "Hello",
        new_string: "Hi",
      },
      context,
    );

    assert.strictEqual(context.gistStore.update.mock.calls.length, 1);
  });

  test("should not call gistStore.update if edit fails", async () => {
    const gist = createMockGist("test-123", { "test.md": "Hello" });
    const context = createMockContext([gist]);

    await assert.rejects(
      handlers.edit_gist_file!(
        {
          id: "test-123",
          filename: "test.md",
          old_string: "NotFound",
          new_string: "Hi",
        },
        context,
      ),
    );

    assert.strictEqual(context.gistStore.update.mock.calls.length, 0);
  });
});
