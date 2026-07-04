import { cn } from "@/lib/utils";

type MessageLoadingDotsProps = {
  className?: string;
};

/** AI 流式回复末尾的「...」加载动画（独占一行） */
export function MessageLoadingDots({ className }: MessageLoadingDotsProps) {
  return (
    <p
      className={cn(
        "message-loading-dots flex h-5 items-center text-muted-foreground",
        className,
      )}
      aria-live="polite"
      aria-label="正在生成"
    >
      <span aria-hidden>.</span>
      <span aria-hidden>.</span>
      <span aria-hidden>.</span>
    </p>
  );
}
