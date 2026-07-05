import type { CorsOptions } from "@mastra/core/server";

/** Electron 渲染进程（Vite）与 AI SDK UI 流式 chat 所需的 CORS 配置。 */
export function createStudioCors(): CorsOptions {
  return {
    origin: (origin) => {
      // Electron file:// 或部分 fetch 不带 Origin
      if (!origin || origin === "null") return "*";
      // 本地开发：Vite、Mastra Studio、Electron（任意端口）
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return origin;
      }
      return null;
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "Accept-Language",
      "Content-Language",
      "Cache-Control",
      "X-Requested-With",
      "x-mastra-client-type",
      "x-mastra-dev-playground",
    ],
    exposeHeaders: [
      "Content-Length",
      "Content-Type",
      "Cache-Control",
      "Connection",
      "X-Requested-With",
      "x-vercel-ai-ui-message-stream",
      "x-accel-buffering",
    ],
    maxAge: 86_400,
    credentials: false,
  };
}
