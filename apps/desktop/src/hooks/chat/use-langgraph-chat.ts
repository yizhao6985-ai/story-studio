import { HumanMessage } from "@langchain/core/messages";
import { useStream } from "@langchain/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AgentMode } from "@/hooks/types";
import {
  assistantIdForMode,
  deriveConversationTitle,
  discoverLangGraphApiUrl,
  getThreadMetadata,
  toDisplayMessages,
  updateConversationTitle,
} from "@/lib/langgraph";

type UseLangGraphChatOptions = {
  workPath: string | undefined;
  threadId: string | undefined;
  mode: AgentMode;
  onFinish?: () => void;
  onError?: (error: Error) => void;
};

export function useLangGraphChat({
  workPath,
  threadId,
  mode,
  onFinish,
  onError,
}: UseLangGraphChatOptions) {
  const [apiUrl, setApiUrl] = useState<string | null>(null);
  const wasLoadingRef = useRef(false);
  const titleUpdatedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void discoverLangGraphApiUrl()
      .then((url) => {
        if (!cancelled) setApiUrl(url);
      })
      .catch((error) => {
        if (!cancelled) {
          onError?.(error instanceof Error ? error : new Error(String(error)));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [onError]);

  const stream = useStream({
    apiUrl: apiUrl ?? "http://127.0.0.1:2024",
    assistantId: assistantIdForMode(mode),
    threadId: threadId && apiUrl ? threadId : undefined,
  });

  useEffect(() => {
    if (!stream.error) return;
    onError?.(
      stream.error instanceof Error
        ? stream.error
        : new Error(String(stream.error)),
    );
  }, [stream.error, onError]);

  useEffect(() => {
    if (wasLoadingRef.current && !stream.isLoading) {
      onFinish?.();
    }
    wasLoadingRef.current = stream.isLoading;
  }, [stream.isLoading, onFinish]);

  const messages = useMemo(
    () => toDisplayMessages(stream.messages ?? []),
    [stream.messages],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !workPath || !threadId) {
        throw new Error("MISSING_CONVERSATION");
      }

      const metadata = await getThreadMetadata(threadId);
      if (!metadata) {
        throw new Error("THREAD_METADATA_MISSING");
      }
      if (metadata.workPath !== workPath) {
        throw new Error("THREAD_WORKSPACE_MISMATCH");
      }
      if (metadata.mode !== mode) {
        throw new Error("THREAD_MODE_MISMATCH");
      }

      if (
        metadata.title === "新对话" &&
        !titleUpdatedRef.current.has(threadId)
      ) {
        titleUpdatedRef.current.add(threadId);
        await updateConversationTitle(
          threadId,
          deriveConversationTitle(trimmed),
        );
      }

      await stream.submit(
        { messages: [new HumanMessage(trimmed)] },
        {
          config: { configurable: { workPath, mode } },
          onError: (error) => {
            onError?.(
              error instanceof Error ? error : new Error(String(error)),
            );
          },
        },
      );
    },
    [workPath, threadId, mode, stream, onError],
  );

  const loading = stream.isLoading;
  const status = loading ? "streaming" : "ready";

  return {
    messages,
    sendMessage,
    stop: stream.stop.bind(stream),
    loading,
    status,
    error: stream.error,
  };
}
