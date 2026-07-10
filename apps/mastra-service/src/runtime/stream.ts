import type { AgentActivityEvent } from "@story-studio/shared/activity";
import type { ChunkType } from "@mastra/core/stream";

export type StreamSink = {
  emit: (event: AgentActivityEvent) => void;
  artifactPaths: Set<string>;
};

export function createStreamSink(
  emit?: (event: AgentActivityEvent) => void,
): StreamSink {
  return {
    artifactPaths: new Set<string>(),
    emit: (event) => emit?.(event),
  };
}

function pickToolPath(args: unknown): string | undefined {
  if (!args || typeof args !== "object") return undefined;
  const record = args as Record<string, unknown>;
  if (typeof record.path === "string" && record.path) return record.path;
  if (typeof record.fromPath === "string" && record.fromPath) {
    return typeof record.toPath === "string" && record.toPath
      ? `${record.fromPath} → ${record.toPath}`
      : record.fromPath;
  }
  if (typeof record.pattern === "string" && record.pattern) {
    return record.pattern;
  }
  if (typeof record.pathPrefix === "string" && record.pathPrefix) {
    return record.pathPrefix;
  }
  return undefined;
}

const ARTIFACT_TOOL_IDS = new Set([
  "mastra_workspace_edit_file",
  "mastra_workspace_write_file",
  "mastra_workspace_mkdir",
  "mastra_workspace_delete",
]);

function pickArtifactPath(toolName: string, args: unknown): string | undefined {
  if (!args || typeof args !== "object") return undefined;
  const record = args as Record<string, unknown>;
  if (!ARTIFACT_TOOL_IDS.has(toolName)) return undefined;
  return typeof record.path === "string" && record.path ? record.path : undefined;
}

export function handleStreamChunk(
  chunk: ChunkType,
  sink: StreamSink,
  state: { reply: string },
): void {
  switch (chunk.type) {
    case "start":
    case "step-start":
      sink.emit({ type: "status", status: "thinking" });
      break;
    case "text-delta": {
      const delta =
        "payload" in chunk &&
        chunk.payload &&
        typeof chunk.payload === "object" &&
        "text" in chunk.payload
          ? String((chunk.payload as { text?: string }).text ?? "")
          : "";
      if (delta) {
        state.reply += delta;
        sink.emit({ type: "reply_delta", delta });
      }
      break;
    }
    case "tool-call": {
      const payload = chunk.payload as {
        toolName?: string;
        args?: unknown;
      };
      const toolName = payload.toolName ?? "tool";
      const path = pickArtifactPath(toolName, payload.args) ?? pickToolPath(payload.args);
      if (path) sink.artifactPaths.add(path);
      sink.emit({ type: "status", status: "executing" });
      break;
    }
    case "tool-error":
      sink.emit({ type: "status", status: "executing" });
      break;
    default:
      break;
  }
}
