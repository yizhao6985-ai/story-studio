import { MessageLoadingDots } from "@/components/ui/loading-dots";
import { MarkdownContent } from "@/features/markdown-content";
import type { ChatDisplayMessage } from "@/lib/langgraph";
import { Wrench } from "lucide-react";

type ChatMessageListProps = {
  messages: ChatDisplayMessage[];
  status: string;
};

function TextMessagePart({ text }: { text: string }) {
  return text.trim() ? <MarkdownContent content={text} /> : null;
}

function ToolMessageBubble({ message }: { message: ChatDisplayMessage }) {
  return (
    <div className="animate-fade-in max-w-[92%] self-start rounded-none border border-border/80 bg-foreground/[0.03] px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
      <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground/80">
        <Wrench className="size-3 shrink-0" />
        <span>{message.toolName ?? "tool"}</span>
        {message.status === "running" ? (
          <MessageLoadingDots inline className="ml-1" />
        ) : null}
      </div>
      <div className="whitespace-pre-wrap break-words">{message.content}</div>
    </div>
  );
}

function AssistantMessageBubble({
  message,
  streaming,
}: {
  message: ChatDisplayMessage;
  streaming: boolean;
}) {
  const text = message.content;
  const hasText = text.trim().length > 0;

  return (
    <div className="animate-fade-in w-full text-[13px] leading-[1.7] text-foreground">
      <div className="space-y-2">
        {streaming && hasText ? (
          <div className="assistant-streaming-tail">
            <TextMessagePart text={text} />
            <MessageLoadingDots inline className="ml-0.5" />
          </div>
        ) : (
          <>
            <TextMessagePart text={text} />
            {streaming ? <MessageLoadingDots /> : null}
          </>
        )}
        {!hasText && !streaming ? (
          <span className="text-muted-foreground">（无内容）</span>
        ) : null}
      </div>
    </div>
  );
}

function UserMessageBubble({ message }: { message: ChatDisplayMessage }) {
  if (!message.content.trim()) return null;

  return (
    <div className="animate-fade-in max-w-[85%] self-end text-[13px] leading-[1.7] whitespace-pre-wrap">
      <div className="rounded-none border border-primary/15 bg-primary/5 px-3.5 py-2.5 text-foreground">
        {message.content}
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

        if (message.role === "tool") {
          return <ToolMessageBubble key={message.id} message={message} />;
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
