## 📆 v0.4.1 (04/04/2025)

- Added one-click install support for VS Code

## 📆 v0.4.0 (03/21/2025)

- Introduced support for managing MCP prompts, which are managed and served from a special gist named `💬 Prompts`.

## 📆 v0.3.2 (03/18/2025)

- Fixed a few bugs in the format that gist resources were being returned in

## 📆 v0.3.1 (03/18/2025)

- Added support for clients to subscribe to changes for a specific gist

## 📆 v0.3.0 (03/18/2025)

- Added support for the `--markdown` CLI flag to filter the gists that are returned to Markdown-only

## 📆 v0.2.5 (03/16/2025)

- Added support for `--daily` CLI flag to optionally include daily notes in the resources list
- Added resource template for accessing gist comments via `gist:///{gistId}/comments` URIs

## 📆 v0.2.4 (03/15/2025)

- Added support for `--starred` CLI flag to optionally include starred gists in the resources list, with notifications when gists are starred/unstarred

## 📆 v0.2.3 (03/15/2025)

- Added support for `--archived` CLI flag to optionally include archived gists in the resources list

## 📆 v0.2.2 (03/14/2025)

- Added the `edit_gist_comment` tool, which allows updating the content of existing gist comments

## 📆 v0.2.1 (03/13/2025)

- Introduced the `update_todays_note` tool, which allows updating the contents of the daily note
- Introduced the `delete_daily_note` tool, which allows deleting a specific daily note by date

## 📆 v0.2.0 (03/13/2025)

- MCP clients will now be notified whenever a gist is added/delete/duplicated/renamed. That way the resources list can be properly re-fetched.

## 📆 v0.1.1 (03/12/2025)

- 🚀 Initial release!
