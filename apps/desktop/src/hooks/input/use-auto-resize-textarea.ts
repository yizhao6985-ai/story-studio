import { useLayoutEffect, useRef } from "react";

type UseAutoResizeTextareaOptions = {
  value: string;
  minRows?: number;
  maxRows?: number;
};

export function useAutoResizeTextarea({
  value,
  minRows = 1,
  maxRows = 5,
}: UseAutoResizeTextareaOptions) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.height = "0px";
    const styles = getComputedStyle(el);
    const lineHeight = Number.parseFloat(styles.lineHeight) || 20;
    const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0;
    const verticalPadding = paddingTop + paddingBottom;
    const minHeight = lineHeight * minRows + verticalPadding;
    const maxHeight = lineHeight * maxRows + verticalPadding;
    const nextHeight = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight);

    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value, minRows, maxRows]);

  return ref;
}
