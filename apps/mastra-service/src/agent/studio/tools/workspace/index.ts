export { WORKSPACE_TOOL_LABELS } from "./constants.js";
export { createReadTools } from "./read.js";
export { createWriteTools } from "./write.js";

import { createReadTools } from "./read.js";
import { createWriteTools } from "./write.js";

export function createAllWorkspaceTools() {
  return { ...createReadTools(), ...createWriteTools() };
}
