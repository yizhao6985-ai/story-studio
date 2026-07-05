import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatShortcutKey,
  KEYBOARD_SHORTCUTS,
  type KeyboardShortcut,
} from "@/lib/keyboard-shortcuts";

type KeyboardShortcutsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function ShortcutKeys({ keys }: { keys: KeyboardShortcut["keys"] }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {keys.map((key, index) => (
        <span key={`${key}-${index}`} className="flex items-center gap-1">
          {index > 0 ? (
            <span className="text-[10px] text-muted-foreground">+</span>
          ) : null}
          <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded border border-border bg-foreground/[0.04] px-1.5 py-0.5 font-mono text-[11px] text-foreground">
            {formatShortcutKey(key)}
          </kbd>
        </span>
      ))}
    </span>
  );
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  const scopes = [...new Set(KEYBOARD_SHORTCUTS.map((item) => item.scope))];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>快捷键</DialogTitle>
          <DialogDescription>Story Studio 桌面常用操作</DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(60vh,420px)] space-y-4 overflow-y-auto pr-1">
          {scopes.map((scope) => (
            <section key={scope}>
              <h3 className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground">
                {scope}
              </h3>
              <ul className="space-y-1.5">
                {KEYBOARD_SHORTCUTS.filter((item) => item.scope === scope).map(
                  (item) => (
                    <li
                      key={`${item.scope}-${item.label}-${item.keys.join("-")}`}
                      className="flex items-center justify-between gap-4 rounded-none px-2 py-1.5"
                    >
                      <span className="text-[13px] text-foreground">{item.label}</span>
                      <ShortcutKeys keys={item.keys} />
                    </li>
                  ),
                )}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
