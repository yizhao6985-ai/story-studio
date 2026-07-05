import { RequestContext } from "@mastra/core/request-context";
import { registerApiRoute } from "@mastra/core/server";
import { handleChatStream } from "@mastra/ai-sdk";
import { toAISdkMessages } from "@mastra/ai-sdk/ui";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import type { UIMessage } from "ai";
import { nanoid } from "nanoid";

import type {
  AgentActivityEvent,
  DelegateActivityEvent,
} from "@story-studio/shared/activity";
import { runDelegateSession } from "../../agent/studio/delegate.js";
import {
  syncConversationTitleFromMemory,
} from "../../agent/studio/run.js";
import {
  deleteWorkThread,
  ensureConversationThread,
} from "../../agent/platform/mastra/lifecycle.js";
import { getStudioMastra } from "../registry.js";

type StudioChatBody = {
  messages: UIMessage[];
  workPath?: string;
  conversationId?: string;
  mode?: "ask" | "normal";
  goal?: string;
  maxTurns?: number;
};

function getRequestContext(c: {
  get: (key: string) => unknown;
}): RequestContext | undefined {
  return c.get("requestContext") as RequestContext | undefined;
}

function buildStudioRequestContext(
  workPath: string,
  mode: "ask" | "normal",
  existing?: RequestContext,
): RequestContext {
  const requestContext = existing ?? new RequestContext();
  requestContext.set("mode", mode);
  requestContext.set("workPath", workPath);
  return requestContext;
}

function wrapStreamWithTitleSync(
  stream: ReadableStream<unknown>,
  workPath: string,
  conversationId: string,
): ReadableStream<unknown> {
  return stream.pipeThrough(
    new TransformStream({
      async flush() {
        try {
          await syncConversationTitleFromMemory({ workPath, conversationId });
        } catch {
          // 标题同步失败不阻塞主流程
        }
      },
    }),
  );
}

function activityToUiChunks(
  event: AgentActivityEvent | DelegateActivityEvent,
  state: { textId: string; textStarted: boolean },
): Array<Record<string, unknown>> {
  const chunks: Array<Record<string, unknown>> = [];

  switch (event.type) {
    case "delegate_turn":
      chunks.push({
        type: "data-delegate-turn",
        data: { turn: event.turn, message: event.message },
      });
      state.textId = nanoid();
      state.textStarted = false;
      break;
    case "delegate_status":
      chunks.push({
        type: "data-delegate-status",
        data: {
          status: event.status,
          turn: event.turn,
          maxTurns: event.maxTurns,
          artifactPaths: event.artifactPaths,
          goal: event.goal,
        },
      });
      break;
    case "delegate_complete":
      chunks.push({
        type: "data-delegate-complete",
        data: {
          status: event.status,
          summary: event.summary,
          artifactPaths: event.artifactPaths,
          turns: event.turns,
        },
      });
      break;
    case "reply_delta":
      if (!state.textStarted) {
        chunks.push({ type: "text-start", id: state.textId });
        state.textStarted = true;
      }
      chunks.push({
        type: "text-delta",
        id: state.textId,
        delta: event.delta,
      });
      break;
    case "error":
      chunks.push({
        type: "error",
        errorText: event.message,
      });
      break;
    case "done":
      if (state.textStarted) {
        chunks.push({ type: "text-end", id: state.textId });
        state.textStarted = false;
      }
      break;
    default:
      break;
  }

  return chunks;
}

export function createStudioChatRoutes() {
  return [
    registerApiRoute("/studio/chat", {
      method: "POST",
      handler: async (c) => {
        const body = (await c.req.json()) as StudioChatBody;
        const workPath = body.workPath?.trim();
        const conversationId = body.conversationId?.trim();
        const mode = body.mode ?? "normal";
        const messages = body.messages;

        if (!workPath || !conversationId || !Array.isArray(messages)) {
          return Response.json({ error: "MISSING_PARAMS" }, { status: 400 });
        }

        await ensureConversationThread(workPath, conversationId);
        const mastra = getStudioMastra();
        const requestContext = buildStudioRequestContext(
          workPath,
          mode,
          getRequestContext(c),
        );

        const uiStream = await handleChatStream({
          mastra,
          agentId: "storySupervisor",
          version: "v6",
          params: {
            messages: messages as never,
            requestContext,
            memory: {
              thread: conversationId,
              resource: workPath,
            },
            abortSignal: c.req.raw.signal,
            maxSteps: mode === "ask" ? 16 : 24,
          },
        });

        const wrapped = wrapStreamWithTitleSync(
          uiStream as ReadableStream<unknown>,
          workPath,
          conversationId,
        );

        return createUIMessageStreamResponse({
          stream: wrapped as Parameters<
            typeof createUIMessageStreamResponse
          >[0]["stream"],
        });
      },
    }),

    registerApiRoute("/studio/chat/messages", {
      method: "GET",
      handler: async (c) => {
        const workPath = c.req.query("workPath");
        const conversationId = c.req.query("conversationId");
        if (!workPath || !conversationId) {
          return Response.json({ error: "MISSING_PARAMS" }, { status: 400 });
        }

        await ensureConversationThread(workPath, conversationId);
        const mastra = getStudioMastra();
        const memory = await mastra.getAgent("storySupervisor").getMemory();
        if (!memory) {
          return Response.json({ messages: [] });
        }

        const thread = await memory.getThreadById({
          threadId: conversationId,
        });
        if (!thread) {
          return Response.json({ messages: [] });
        }

        let recalledMessages: Awaited<
          ReturnType<typeof memory.recall>
        >["messages"] = [];
        try {
          ({ messages: recalledMessages } = await memory.recall({
            threadId: conversationId,
            resourceId: workPath,
            perPage: false,
          }));
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes("No thread found")
          ) {
            return Response.json({ messages: [] });
          }
          throw error;
        }

        const messages = toAISdkMessages(recalledMessages, { version: "v6" });
        return Response.json({ messages });
      },
    }),

    registerApiRoute("/studio/delegate/chat", {
      method: "POST",
      handler: async (c) => {
        const body = (await c.req.json()) as StudioChatBody;
        const workPath = body.workPath?.trim();
        const conversationId = body.conversationId?.trim();
        const goal = body.goal?.trim();
        const maxTurns = body.maxTurns;

        if (!workPath || !conversationId || !goal) {
          return Response.json({ error: "MISSING_PARAMS" }, { status: 400 });
        }

        await ensureConversationThread(workPath, conversationId);
        const requestContext = buildStudioRequestContext(
          workPath,
          "normal",
          getRequestContext(c),
        );

        const uiStream = createUIMessageStream({
          execute: async ({ writer }) => {
            const messageId = nanoid();
            writer.write({ type: "start", messageId });
            const state = { textId: nanoid(), textStarted: false };

            await runDelegateSession({
              workPath,
              conversationId,
              goal,
              maxTurns,
              requestContext,
              onActivity: (event) => {
                for (const chunk of activityToUiChunks(event, state)) {
                  writer.write(
                    chunk as Parameters<typeof writer.write>[0],
                  );
                }
              },
            });

            if (state.textStarted) {
              writer.write({ type: "text-end", id: state.textId });
            }
            writer.write({ type: "finish", finishReason: "stop" });
          },
        });

        const wrapped = wrapStreamWithTitleSync(
          uiStream as ReadableStream<unknown>,
          workPath,
          conversationId,
        );

        return createUIMessageStreamResponse({
          stream: wrapped as Parameters<
            typeof createUIMessageStreamResponse
          >[0]["stream"],
        });
      },
    }),

    registerApiRoute("/studio/threads/ensure", {
      method: "POST",
      handler: async (c) => {
        const body = (await c.req.json()) as {
          workPath: string;
          conversationId: string;
          title?: string;
        };
        await ensureConversationThread(
          body.workPath,
          body.conversationId,
          body.title,
        );
        return Response.json({ ok: true });
      },
    }),

    registerApiRoute("/studio/threads/:threadId", {
      method: "DELETE",
      handler: async (c) => {
        const workPath = c.req.query("workPath");
        const threadId = c.req.param("threadId");
        if (!workPath || !threadId) {
          return Response.json({ error: "MISSING_PARAMS" }, { status: 400 });
        }
        await deleteWorkThread(workPath, threadId);
        return Response.json({ ok: true });
      },
    }),
  ];
}
