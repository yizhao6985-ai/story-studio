import { Mastra } from "@mastra/core";

import { prepareAgentShutdown } from "../agent/studio/shutdown.js";
import {
  closeStudioStorage,
  registerWorkStorageShutdownHooks,
} from "../agent/studio/storage.js";
import { createLlmContextMiddleware } from "./middleware/llm-context.js";
import { createStudioCors } from "./cors.js";
import { createStudioRoutes } from "./routes/studio.js";
import { initStudioMastra } from "./registry.js";

registerWorkStorageShutdownHooks();

export {
  createStudioMastra,
  evictStudioMastra,
  getStudioMastra,
  initStudioMastra,
} from "./registry.js";

function createServerConfig() {
  const apiPrefix =
    process.env.STORY_STUDIO_MASTRA_API_PREFIX?.trim() || "/api";

  return {
    port: Number(process.env.PORT ?? 4111),
    // 绑定 IPv4+IPv6，避免仅 ::1 时 127.0.0.1 连不上
    host: (process.env.HOST?.trim() || "0.0.0.0") as "0.0.0.0",
    apiPrefix,
    cors: createStudioCors(),
    middleware: createLlmContextMiddleware(),
    apiRoutes: createStudioRoutes(),
  };
}

/** Mastra CLI dev/build 入口；全局单实例 + server 配置。 */
export const mastra = new Proxy({} as Mastra, {
  get(_target, prop, _receiver) {
    const instance = initStudioMastra(createServerConfig());
    if (prop === "shutdown") {
      return async () => {
        await prepareAgentShutdown();
        await closeStudioStorage();
        return instance.shutdown();
      };
    }
    // 必须用 instance 作为 receiver，否则访问 #observability 等私有字段会失败
    const value = Reflect.get(instance, prop, instance);
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(instance)
      : value;
  },
});
