import type { ChatOnDataCallback } from "ai";
import { useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

import {
  buildChatApiUrl,
  type StudioUIMessage,
} from "@/lib/mastra";
import type { AgentMode, ComposerMode } from "@/hooks/types";

type UseStudioChatOptions = {
  workPath: string | undefined;
  conversationId: string | undefined;
  mode: ComposerMode;
  delegateMaxTurns: number;
  onFinish?: () => void;
  onError?: (error: Error) => void;
  onData?: ChatOnDataCallback<StudioUIMessage>;
};

export function useStudioChat({
  workPath,
  conversationId,
  mode,
  delegateMaxTurns,
  onFinish,
  onError,
  onData,
}: UseStudioChatOptions) {
  const chatId =
    workPath && conversationId ? `${workPath}\0${conversationId}` : "idle";

  const isDelegate = mode === "delegate";
  const agentMode: AgentMode = mode === "delegate" ? "normal" : mode;

  const transport = useMemo(
    () =>
      new DefaultChatTransport<StudioUIMessage>({
        api: "",
        credentials: "omit",
        prepareSendMessagesRequest: async ({ messages, body, api }) => {
          if (!workPath || !conversationId) {
            throw new Error("MISSING_CONVERSATION");
          }

          const chatApi = await buildChatApiUrl(
            isDelegate ? "/studio/delegate/chat" : "/studio/chat",
          );

          const lastUser = [...messages]
            .reverse()
            .find((message) => message.role === "user");
          const goal =
            isDelegate && lastUser
              ? lastUser.parts
                  .filter((part) => part.type === "text")
                  .map((part) => part.text)
                  .join("")
              : undefined;

          return {
            api: chatApi,
            body: {
              ...body,
              messages,
              workPath,
              conversationId,
              ...(isDelegate
                ? { goal, maxTurns: delegateMaxTurns }
                : { mode: agentMode }),
            },
          };
        },
      }),
    [
      workPath,
      conversationId,
      isDelegate,
      agentMode,
      delegateMaxTurns,
    ],
  );

  const chat = useChat<StudioUIMessage>({
    id: chatId,
    transport,
    onFinish,
    onError,
    onData,
  });

  const loading =
    chat.status === "streaming" || chat.status === "submitted";

  return {
    ...chat,
    loading,
    stop: chat.stop,
  };
}
