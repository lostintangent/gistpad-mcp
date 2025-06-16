import { ToolHandler, ToolModule } from "../types.js";
import archiveTools from "./archive.js";
import commentTools from "./comments.js";
import daily from "./daily.js";
import fileTools from "./files.js";
import gistTools from "./gist.js";
import promptTools from "./prompts.js";
import refreshTools from "./refresh.js";
import starTools from "./star.js";

const tools: ToolModule[] = [
    archiveTools,
    commentTools,
    daily,
    fileTools,
    gistTools,
    promptTools,
    refreshTools,
    starTools,
];

export const toolDefinitions = tools.flatMap((tool) => tool.definitions);
export const toolHandlers = tools.reduce((handlers, tool) => {
    return { ...handlers, ...tool.handlers };
}, {}) as Record<string, ToolHandler>;
