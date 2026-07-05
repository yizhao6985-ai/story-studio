import type { UIMessage } from "ai";

/** Studio 对话自定义 data parts（托管模式） */
export type StudioChatDataTypes = {
  "delegate-turn": { turn: number; message: string };
  "delegate-status": {
    status: string;
    turn: number;
    maxTurns: number;
    artifactPaths: string[];
    goal: string;
  };
  "delegate-complete": {
    status: string;
    summary: string;
    artifactPaths: string[];
    turns: number;
  };
};

export type StudioUIMessage = UIMessage<unknown, StudioChatDataTypes>;

export function getMessageText(message: StudioUIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function isStreamingMessage(
  message: StudioUIMessage,
  chatStatus: string,
): boolean {
  if (chatStatus !== "streaming" && chatStatus !== "submitted") return false;
  return message.role === "assistant";
}
