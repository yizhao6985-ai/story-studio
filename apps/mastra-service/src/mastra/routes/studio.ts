import type { RequestContext } from "@mastra/core/request-context";
import { registerApiRoute } from "@mastra/core/server";

import { setRuntimeConfig } from "../../platform/runtime-config.js";
import { getAgentContextUsage } from "../../runtime/run.js";
import { evictStudioMastra } from "../registry.js";
import { createStudioChatRoutes } from "./studio-chat.js";

function getRequestContext(c: {
  get: (key: string) => unknown;
}): RequestContext | undefined {
  return c.get("requestContext") as RequestContext | undefined;
}

export function createStudioRoutes() {
  return [
    registerApiRoute("/studio/health", {
      method: "GET",
      handler: async () => Response.json({ ok: true }),
    }),
    registerApiRoute("/studio/runtime/register", {
      method: "POST",
      handler: async (c) => {
        const body = (await c.req.json()) as {
          userDataRoot: string;
        };
        if (!body.userDataRoot?.trim()) {
          return Response.json({ error: "MISSING_PARAMS" }, { status: 400 });
        }
        setRuntimeConfig(body);
        return Response.json({ ok: true });
      },
    }),
    registerApiRoute("/studio/context-usage", {
      method: "GET",
      handler: async (c) => {
        const workPath = c.req.query("workPath");
        const conversationId = c.req.query("conversationId");
        const mode = c.req.query("mode") as "ask" | "normal" | undefined;
        const draftMessage = c.req.query("draftMessage");
        if (!workPath || !conversationId || !mode) {
          return Response.json({ error: "MISSING_PARAMS" }, { status: 400 });
        }
        const usage = await getAgentContextUsage({
          workPath,
          conversationId,
          mode,
          draftMessage,
          requestContext: getRequestContext(c),
        });
        return Response.json(usage);
      },
    }),
    registerApiRoute("/studio/works/evict", {
      method: "POST",
      handler: async (c) => {
        const body = (await c.req.json()) as { workPath: string };
        if (!body.workPath?.trim()) {
          return Response.json({ error: "MISSING_WORK_PATH" }, { status: 400 });
        }
        await evictStudioMastra(body.workPath);
        return Response.json({ ok: true });
      },
    }),
    ...createStudioChatRoutes(),
  ];
}
