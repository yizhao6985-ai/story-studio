import { Memory } from "@mastra/memory";
import type { MastraCompositeStore } from "@mastra/core/storage";

import { resolveStoryStudioModel } from "../platform/llm/model.js";

const CONVERSATION_TITLE_INSTRUCTIONS = `你是对话标题生成器，服务于 Story Studio 内容创作协作。
根据用户首条消息与助手回复，生成一个简短中文标题，用于左侧对话列表展示。

要求：
- 6–16 字为宜，最多不超过 24 字
- 概括对话主题与创作意图，不要照搬原文
- 不要加引号，不要以句号、问号、感叹号结尾
- 不要用「对话」「关于」「新对话」等泛化前缀
- 可保留章节、人物、大纲、设定等创作相关关键词`;

export function createStudioMemory(storage: MastraCompositeStore): Memory {
  return new Memory({
    storage,
    options: {
      lastMessages: 48,
      generateTitle: {
        model: resolveStoryStudioModel,
        instructions: CONVERSATION_TITLE_INSTRUCTIONS,
      },
      workingMemory: {
        enabled: true,
        template: `# 作品会话备忘
- 作品路径：
- 用户当前关注：
- 已修改文件：
- 待办：
`,
      },
    },
  });
}
