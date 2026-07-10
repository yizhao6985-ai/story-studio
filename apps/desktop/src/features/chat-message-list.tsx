import type { UIMessage } from "ai";

import { MessageLoadingDots } from "@/components/ui/loading-dots";
import { MarkdownContent } from "@/features/markdown-content";
import type { StudioUIMessage } from "@/lib/mastra";

type ChatMessageListProps = {
  messages: StudioUIMessage[];
  status: string;
};

function TextMessagePart({ text }: { text: string }) {
  return text.trim() ? <MarkdownContent content={text} /> : null;
}

function AssistantMessageBubble({
  message,
  streaming,
}: {
  message: StudioUIMessage;
  streaming: boolean;
}) {
  const textParts = message.parts.filter(
    (part): part is Extract<StudioUIMessage["parts"][number], { type: "text" }> =>
      part.type === "text",
  );
  const text = textParts.map((part) => part.text).join("");
  const hasText = text.trim().length > 0;
  const trailingParts = textParts.slice(0, -1);
  const lastTextPart = textParts.at(-1);

  return (
    <div className="animate-fade-in w-full text-[13px] leading-[1.7] text-foreground">
      <div className="space-y-2">
        {streaming && hasText && lastTextPart ? (
          <>
            {trailingParts.map((part, index) => (
              <TextMessagePart key={`${message.id}-${index}`} text={part.text} />
            ))}
            <div className="assistant-streaming-tail">
              <TextMessagePart
                key={`${message.id}-${textParts.length - 1}`}
                text={lastTextPart.text}
              />
              <MessageLoadingDots inline className="ml-0.5" />
            </div>
          </>
        ) : (
          <>
            {textParts.map((part, index) => (
              <TextMessagePart key={`${message.id}-${index}`} text={part.text} />
            ))}
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
