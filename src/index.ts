#!/usr/bin/env node

import { parseArgs } from "node:util";
import { GistpadServer } from "./server/index.js";
import type { ServerConfig } from "#types";

// Import version from package.json using import attributes (Node.js 22+)
import packageJson from "../package.json" with { type: "json" };

const { values } = parseArgs({
  options: {
    markdown: {
      type: "boolean",
      short: "m",
      default: false,
    },
    starred: {
      type: "boolean",
      short: "s",
      default: false,
    },
    archived: {
      type: "boolean",
      short: "a",
      default: false,
    },
    daily: {
      type: "boolean",
      short: "d",
      default: false,
    },
    prompts: {
      type: "boolean",
      short: "p",
      default: false,
    },
    help: {
      type: "boolean",
      short: "h",
      default: false,
    },
    version: {
      type: "boolean",
      short: "v",
      default: false,
    },
  },
  strict: true,
});

// Handle --version flag
if (values.version) {
  console.log(`gistpad-mcp v${packageJson.version}`);
  process.exit(0);
}

// Handle --help flag
if (values.help) {
  console.log(`
gistpad-mcp v${packageJson.version}

An MCP server for managing your personal knowledge, daily notes, and reusable prompts via GitHub Gists.

USAGE:
  gistpad-mcp [OPTIONS]

OPTIONS:
  -m, --markdown   Only include markdown gists
  -s, --starred    Include starred gists in the resource list
  -a, --archived   Include archived gists in the resource list
  -d, --daily      Enable daily notes functionality
  -p, --prompts    Enable prompts functionality
  -h, --help       Show this help message
  -v, --version    Show version number

ENVIRONMENT VARIABLES:
  GITHUB_TOKEN     Required. Your GitHub personal access token.

EXAMPLES:
  # Run with all features enabled
  GITHUB_TOKEN=ghp_xxx gistpad-mcp --daily --prompts --starred --archived

  # Run with only markdown gists and daily notes
  GITHUB_TOKEN=ghp_xxx gistpad-mcp --markdown --daily
`);
  process.exit(0);
}

// Validate GitHub token
const GITHUB_TOKEN = process.env["GITHUB_TOKEN"];
if (!GITHUB_TOKEN) {
  console.error("Error: GITHUB_TOKEN environment variable is required");
  console.error("Run 'gistpad-mcp --help' for usage information.");
  process.exit(1);
}

// Build server config from parsed arguments
const config: ServerConfig = {
  githubToken: GITHUB_TOKEN,
  version: packageJson.version,
  markdownOnly: values.markdown,
  includeStarred: values.starred,
  includeArchived: values.archived,
  includeDaily: values.daily,
  includePrompts: values.prompts,
};

// Create and run the server
const server = new GistpadServer(config);
server.run().catch((error) => {
  console.error("An error occurred while running the GistPad MCP server:", error);
  process.exit(1);
});
