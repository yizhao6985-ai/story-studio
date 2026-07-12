import { HumanMessage } from "@langchain/core/messages";
import { useStream } from "@langchain/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AgentMode } from "@/hooks/types";
import {
  assistantIdForMode,
  deriveConversationTitle,
  discoverLangGraphApiUrl,
  findNewWorkspaceMutations,
  getThreadMetadata,
  toDisplayMessages,
  updateConversationTitle,
} from "@/lib/langgraph";

type UseLangGraphChatOptions = {
  workPath: string | undefined;
  threadId: string | undefined;
  mode: AgentMode;
  onFinish?: () => void;
  onWorkspaceMutated?: () => void;
  onError?: (error: Error) => void;
};

export type SendMessageOptions = {
  workPath?: string;
  threadId?: string;
};

export function useLangGraphChat({
  workPath,
  threadId,
  mode,
  onFinish,
  onWorkspaceMutated,
  onError,
}: UseLangGraphChatOptions) {
  const [apiUrl, setApiUrl] = useState<string | null>(null);
  const wasLoadingRef = useRef(false);
  const titleUpdatedRef = useRef<Set<string>>(new Set());
  const processedMutationsRef = useRef<Set<string>>(new Set());

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
    apiUrl: apiUrl ?? "http://localhost:2024",
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
    processedMutationsRef.current.clear();
  }, [threadId]);

  useEffect(() => {
    if (wasLoadingRef.current && !stream.isLoading) {
      onFinish?.();
    }
    wasLoadingRef.current = stream.isLoading;
  }, [stream.isLoading, onFinish]);

  useEffect(() => {
    const messages = stream.messages ?? [];
    const newlyMutated = findNewWorkspaceMutations(
      messages,
      processedMutationsRef.current,
    );
    if (newlyMutated.length === 0) return;

    for (const toolCallId of newlyMutated) {
      processedMutationsRef.current.add(toolCallId);
    }
    onWorkspaceMutated?.();
  }, [stream.messages, onWorkspaceMutated]);

  const messages = useMemo(
    () => toDisplayMessages(stream.messages ?? []),
    [stream.messages],
  );

  const sendMessage = useCallback(
    async (text: string, overrides?: SendMessageOptions) => {
      const trimmed = text.trim();
      const effectiveWorkPath = overrides?.workPath ?? workPath;
      const effectiveThreadId = overrides?.threadId ?? threadId;
      if (!trimmed || !effectiveWorkPath || !effectiveThreadId) {
        throw new Error("MISSING_CONVERSATION");
      }

      const metadata = await getThreadMetadata(effectiveThreadId);
      if (!metadata) {
        throw new Error("THREAD_METADATA_MISSING");
      }
      if (metadata.workPath !== effectiveWorkPath) {
        throw new Error("THREAD_WORKSPACE_MISMATCH");
      }
      if (metadata.mode !== mode) {
        throw new Error("THREAD_MODE_MISMATCH");
      }

      if (
        metadata.title === "新对话" &&
        !titleUpdatedRef.current.has(effectiveThreadId)
      ) {
        titleUpdatedRef.current.add(effectiveThreadId);
        await updateConversationTitle(
          effectiveThreadId,
          deriveConversationTitle(trimmed),
        );
      }

      await stream.submit(
        { messages: [new HumanMessage(trimmed)] },
        {
          threadId: effectiveThreadId,
          config: { configurable: { workPath: effectiveWorkPath, mode } },
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
