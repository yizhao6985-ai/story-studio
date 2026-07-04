/** human message 中的成稿划词引用 */
export const HUMAN_PREVIEW_SELECTION_PART_TYPE = "preview_selection" as const;

export type HumanPreviewSelectionPart = {
  type: typeof HUMAN_PREVIEW_SELECTION_PART_TYPE;
  blockId: string;
  quote: string;
};

export type HumanPreviewSelection = {
  blockId: string;
  quote: string;
};

/** human message 中的附件块（仅 URL 来源） */
export type HumanAssetContentPart = {
  url: string;
  mime_type: string;
  original_name?: string | null;
};

export type HumanAttachmentAsset = {
  url: string;
  mime_type: string;
  original_name?: string | null;
};

export function isHumanAssetContentPart(
  part: unknown,
): part is HumanAssetContentPart {
  if (!part || typeof part !== "object") return false;
  const value = part as Record<string, unknown>;
  if (value.type === "text" || value.type === HUMAN_PREVIEW_SELECTION_PART_TYPE) {
    return false;
  }
  return typeof value.url === "string" && typeof value.mime_type === "string";
}

export function isHumanPreviewSelectionPart(
  part: unknown,
): part is HumanPreviewSelectionPart {
  return (
    part != null &&
    typeof part === "object" &&
    "type" in part &&
    (part as { type?: unknown }).type === HUMAN_PREVIEW_SELECTION_PART_TYPE &&
    typeof (part as HumanPreviewSelectionPart).blockId === "string" &&
    typeof (part as HumanPreviewSelectionPart).quote === "string"
  );
}

export function extractPreviewSelectionsFromContent(
  content: unknown,
): HumanPreviewSelection[] {
  if (!Array.isArray(content)) return [];
  return content
    .filter(isHumanPreviewSelectionPart)
    .map((part) => ({ blockId: part.blockId, quote: part.quote }));
}

export function extractAttachmentAssetsFromContent(
  content: unknown,
): HumanAttachmentAsset[] {
  if (!Array.isArray(content)) return [];
  return content.filter(isHumanAssetContentPart).map((part) => ({
    url: part.url,
    mime_type: part.mime_type,
    original_name: part.original_name,
  }));
}

function previewSelectionLabel(quote: string, maxLength = 48): string {
  const trimmed = quote.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}…`;
}

export function previewSelectionsSummary(
  selections: HumanPreviewSelection[],
): string {
  if (selections.length === 0) return "";
  if (selections.length === 1) {
    return `[引用成稿片段：「${previewSelectionLabel(selections[0]!.quote, 120)}」]`;
  }
  return `[引用 ${selections.length} 处成稿片段]`;
}
