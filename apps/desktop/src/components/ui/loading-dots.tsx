import { cn } from "@/lib/utils";

type MessageLoadingDotsProps = {
  className?: string;
  /** 紧跟正文末尾，与最后一行同行 */
  inline?: boolean;
};

/** AI 流式回复末尾的「...」加载动画 */
export function MessageLoadingDots({
  className,
  inline = false,
}: MessageLoadingDotsProps) {
  const Tag = inline ? "span" : "p";

  return (
    <Tag
      className={cn(
        "message-loading-dots text-muted-foreground",
        inline
          ? "inline-flex h-[1em] items-center align-baseline"
          : "flex h-5 items-center",
        className,
      )}
      aria-live="polite"
      aria-label="正在生成"
    >
      <span aria-hidden>.</span>
      <span aria-hidden>.</span>
      <span aria-hidden>.</span>
    </Tag>
  );
}
