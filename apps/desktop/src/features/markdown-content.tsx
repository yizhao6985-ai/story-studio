import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

type MarkdownContentProps = {
  content: string;
  className?: string;
};

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={cn("assistant-markdown min-w-0", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
        p: ({ children }) => (
          <p className="mb-2 last:mb-0 leading-[1.7]">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-[1.7]">{children}</li>,
        h1: ({ children }) => (
          <h1 className="mb-2 text-base font-semibold last:mb-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-2 text-[15px] font-semibold last:mb-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-1.5 text-[14px] font-medium last:mb-0">{children}</h3>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ className: codeClass, children }) => {
          const isBlock = codeClass?.includes("language-");
          if (isBlock) {
            return (
              <code className="block overflow-x-auto rounded-none bg-foreground/[0.05] px-2 py-1.5 font-mono text-[12px] leading-relaxed">
                {children}
              </code>
            );
          }
          return (
            <code className="rounded-none bg-foreground/[0.06] px-1 py-0.5 font-mono text-[12px]">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="mb-2 overflow-x-auto last:mb-0">{children}</pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-2 border-l-2 border-border pl-3 text-muted-foreground last:mb-0">
            {children}
          </blockquote>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-foreground underline underline-offset-2 hover:text-foreground/80"
            target="_blank"
            rel="noreferrer"
          >
            {children}
          </a>
        ),
        hr: () => <hr className="my-3 border-border" />,
      }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
