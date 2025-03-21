# 📓 GistPad MCP

An MCP server for managing and sharing your personal knowledge, daily notes, and re-useable prompts via GitHub Gists. It's a companion to the GistPad [VS Code extension](https://aka.ms/gistpad) and [GistPad.dev](https://gistpad.dev) (for web/mobile), which allows you to access and edit your gists from any MCP-enabled AI product (e.g. GitHub Copilot, Claude Desktop).

- 🏃 [Getting started](#-getting-started)
- 🛠️ [Included tools](#️-included-tools)
- 📁 [Included resources](#-included-resources)
- 💬 [Custom prompts](#-custom-prompts)
- 💻 [CLI reference](#-cli-reference)

## 🏃 Getting started

> ℹ️ The GistPad MCP server is built using Node.js and so before you perform the following steps, you need to ensure that you've got Node.js already installed.

1. Generate a personal access token that includes _only_ the `gist` scope: https://github.com/settings/tokens/new

1. Add the equivalent of the following to your client's MCP config file (or via an "Add MCP server" GUI/TUI):

   ```json
   {
     "mcpServers": {
       "gistpad": {
         "command": "npx",
         "args": ["-y", "gistpad-mcp"],
         "env": {
           "GITHUB_TOKEN": "<YOUR_PAT>"
         }
       }
     }
   }
   ```

1. Restart your MCP client _(optionally, depending on the tool)_

1. :partying_face: Start having fun with gists + MCP! For example, try things like...

   1. **Exploring content**

   - `How many gists have I edited this month?`
   - `What's the summary of my <foo> gist?`

   1. **Creating content**

   - `Create a new gist about <foo>`
   - `Update my <foo> gist to call out <bar>`

   1. **Daily todos**

   - `What are my unfinished todos for today?`
   - `Add a new todo for <foo>`

   1. **Collaboration**

   - `Add a comment to the <foo> gist saying <bar>`
   - `Give me a share URL for the <foo> gist`
   - `View my starred gists`

   1. **Gist organization**

   - `Archive my gist about <foo>`
   - `Add a new <foo> file to the <bar> gist and migrate the <baz> content into it`

## 🛠️ Included tools

### Gist management

- `list_gists` - List all of your gists (excluding daily notes and archived gists).
- `get_gist` - Get the contents of a gist by ID.
- `create_gist` - Create a new gist with a specified description and initial file contents.
- `delete_gist` - Delete a gist by ID.
- `update_gist_description` - Update a gist's description by ID.
- `duplicate_gist` - Create a copy of an existing gist with all its files.

### File management

- `update_gist_file` - Update the contents of a specific file in a gist.
- `add_gist_file` - Add a new file to an existing gist.
- `delete_gist_file` - Delete a file from a gist.
- `rename_gist_file` - Rename an existing file within a gist.

### Daily notes

- `get_todays_note` - Get or create today's daily note.
- `update_todays_note` - Update the content of today's daily note.
- `list_daily_notes` - List all of your daily notes.
- `get_daily_note` - Get the contents of a specific daily note by date.
- `delete_daily_note` - Delete a specific daily note by date.

### Starring

- `list_starred_gists` - List all your starred gists.
- `star_gist` - Star a specific gist by ID.
- `unstar_gist` - Unstar a starered gist by ID.

### Archiving

- `list_archived_gists` - List all of your archived gists.
- `archive_gist` - Archive one of your gists.
- `unarchive_gist` - Unarchive an archived gist.

### Comments

- `list_gist_comments` - List all comments for a specified gist.
- `add_gist_comment` - Add a new comment to a gist.
- `edit_gist_comment` - Update the content of an existing comment.
- `delete_gist_comment` - Delete a comment from a gist.

### Prompts

- `add_prompt` - Add a new prompt to your prompts collection.
- `delete_prompt` - Delete a prompt from your collection.

## 📁 Included resources

In addition to the above tools, the GistPad MCP server also exposes your gists as resources (using the `gist:///` URI scheme), which allows clients to read them without requiring tool execution.

When you add/delete/duplicate a gist, or change a gist's description, then a notification will be provided to MCP clients, indicating that the list of resources have changed. And if your MCP client supports resource subscriptions, then you can subscribe to a specific gist and get notified when it's updated.

Additionally, for MCP clients that support resource templates, GistPad also exposes a resource at `gist:///{gistId}/comments`, which allows querying the comments for a gist (without needing to execute the `list_gist_comments` tool).

### Resource configuration

If you'd like to expose either your archived gists, starred gists, and/or daily notes as resources, then simply update your MCP server config to pass the `--archived`, `--starred`, and/or `--daily` flags to the `gistpad-mcp` CLI.

## 💬 Custom prompts

GistPad allows you to create and manage parameterized/re-usable prompts that are stored as markdown files in a gist. You can manage prompts using the `add_prompt` and `delete_prompt` tool, by simply asking your MCP client to create/delete a prompt, with the specified contents/arguments you want.

Behind the scenes, prompts are stored as markdown files in a gist called `💬 Prompts` (which is automatically created by the `add_prompt` tool). The prompt files include their prompt as the body, and optionally, a description and arguments using front-matter. And if the prompt makes use of arguments, the body of the prompt should include `{{argument}}` placeholders, which will be replaced when the MCP client retrieves it.

## 💻 CLI Reference

The `gistpad-mcp` CLI accepts the following optional flags:

- `--archived` - Include archived gists in the list of MCP resources _(Note: The `list_archived_gists` tool is always available)_
- `--starred` - Include starred gists in the list of MCP resources _(Note: The `list_starred_gists` tool is always available)_
- `--daily` - Include daily notes in the list of MCP resources _(Note: The `list_daily_notes` tool is always available)_
- `--markdown` - Filter the list of gists that are returned, to only those that are composed of Markdown files.
