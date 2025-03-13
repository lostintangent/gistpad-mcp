# 📓 GistPad MCP

An MCP server for managing and sharing your personal knowledge/daily notes via GitHub Gists. It's a companion to the GistPad [VS Code extension](https://aka.ms/gistpad) and [GistPad.dev](https://gistpad.dev) (for web/mobile), which allows you to access and edit your gists from any MCP-enabled AI product (e.g. Claude Desktop).

- 🏃 [Getting started](#-getting-started)
- 🛠️ [Included tools](#️-included-tools)
- 📁 [Included resources](#-included-resources)

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

   1. `How many gists have I updated this month?`
   1. `Create a new gist about the JavaScript programming language`
   1. `Archive my gist about <foo>`
   1. `Give me a share URL for the gist about <bar>`
   1. Much much more!

## 🛠️ Included tools

### Gist management

- `list_gists` - List all of your gists (excluding daily notes and archived gists).
- `get_gist` - Get the contents of a gist by ID.
- `create_gist` - Create a new gist with a specified descrpition and initial `README.md` content.
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
- `list_daily_notes` - List all of your daily notes.
- `get_daily_note` - Get the contents of a specific daily note by date

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
- `delete_gist_comment` - Delete a comment from a gist.

<ins>Unsupported/future enhancements:</ins>

- Firing a notification when gists are added/updated/deleted
- Exposing the daily tasks and overdue status as tool context
- Any of the AI features from gistpad.dev (since the MCP client will have these!)

## 📁 Included resources

In addition to the above tools, the GistPad MCP server also exposes your gists as resources (using the `gist:///` URI scheme), which allows clients to read them without requiring tool execution.

When you add/delete/duplicate a gist, or change a gist's description, then a notification will be provided to MCP clients, indicating that the list of resources have changed.

<ins>Unsupported/future enhancements:</ins>

- Exposing archived/starred gists as resources
- Allowing clients to subscribe to updates for specific gists
