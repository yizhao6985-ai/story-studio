import type { UIMessage } from "ai";

import { MessageLoadingDots } from "@/components/ui/loading-dots";
import { MarkdownContent } from "@/features/markdown-content";
import type { StudioUIMessage } from "@/lib/mastra";

type ChatMessageListProps = {
  messages: StudioUIMessage[];
  status: string;
};

function RawMessagePart({ part }: { part: StudioUIMessage["parts"][number] }) {
  if (part.type === "text") {
    return part.text.trim() ? <MarkdownContent content={part.text} /> : null;
  }

  return (
    <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-none border border-border/40 bg-muted/20 px-3 py-2 text-[11px] leading-relaxed text-foreground/90">
      {JSON.stringify(part, null, 2)}
    </pre>
  );
}

function AssistantMessageBubble({
  message,
  streaming,
}: {
  message: StudioUIMessage;
  streaming: boolean;
}) {
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
  const hasRenderableParts = message.parts.some(
    (part) => part.type !== "text" || part.text.trim(),
  );

  return (
    <div className="animate-fade-in max-w-[90%] self-start text-[13px] leading-[1.7]">
      <div className="space-y-2 rounded-none border border-border/40 bg-card px-3.5 py-2.5 text-foreground">
        {message.parts.map((part, index) => (
          <RawMessagePart key={`${message.id}-${index}`} part={part} />
        ))}
        {!hasRenderableParts && streaming ? <MessageLoadingDots /> : null}
        {!text.trim() && !streaming && !hasRenderableParts ? (
          <span className="text-muted-foreground">（无内容）</span>
        ) : null}
      </div>
    </div>
  );
}

function UserMessageBubble({ message }: { message: UIMessage }) {
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
  if (!text.trim()) return null;

  return (
    <div className="animate-fade-in max-w-[85%] self-end text-[13px] leading-[1.7] whitespace-pre-wrap">
      <div className="rounded-none border border-primary/15 bg-primary/5 px-3.5 py-2.5 text-foreground">
        {text}
      </div>
    </div>
  );
}

export function ChatMessageList({ messages, status }: ChatMessageListProps) {
  const isStreaming = status === "streaming" || status === "submitted";

  return (
    <>
      {messages.map((message, index) => {
        const streaming =
          isStreaming &&
          index === messages.length - 1 &&
          message.role === "assistant";

        if (message.role === "user") {
          return <UserMessageBubble key={message.id} message={message} />;
        }

        if (message.role === "assistant") {
          return (
            <AssistantMessageBubble
              key={message.id}
              message={message}
              streaming={streaming}
            />
          );
        }

        return null;
      })}
    </>
  );
}
