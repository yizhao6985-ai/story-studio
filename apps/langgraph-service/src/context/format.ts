import type { RelevantContext } from "./types.js";

export function formatWorkContextBlock(context: RelevantContext | undefined): string {
  if (!context) {
    return "（作品上下文尚未建立）";
  }

  const relevant =
    context.relevantFiles.length > 0
      ? context.relevantFiles
          .map((file) => {
            const entities =
              file.entities && file.entities.length > 0
                ? `；涉及：${file.entities.join("、")}`
                : "";
            return `- ${file.path} (${file.kind}): ${file.summary}${entities}`;
          })
          .join("\n")
      : "（无高相关文件，可参考下方完整索引）";

  const indexPreview =
    context.fileIndex.length > 0
      ? context.fileIndex.slice(0, 40).join("\n")
      : "（作品库暂无文本文件）";

  return `【作品概览】
${context.workBrief}

【与当前问题相关的文件摘要】
${relevant}

【作品文件索引（共 ${context.fileIndex.length} 个文本文件）】
${indexPreview}${context.fileIndex.length > 40 ? "\n…（其余文件已索引，可按需 read_file 读取）" : ""}`;
}
