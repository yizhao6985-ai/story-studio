import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Square,
  SquareCheck,
  SquareDot,
  SquareX,
} from "lucide-react";

import { MessageLoadingDots } from "@/components/ui/loading-dots";
import { MarkdownContent } from "@/features/markdown-content";
import type {
  ActivityEntry,
  ActivityStage,
  AgentRunStatus,
  SubTaskSummary,
} from "@/hooks/types";
import { cn } from "@/lib/utils";

const STAGE_LABEL: Record<ActivityStage, string> = {
  plan: "规划",
  explore: "探索",
  read: "读取",
  target: "定位",
  act: "写入",
  verify: "验证",
};

const STATUS_LABEL: Record<AgentRunStatus, string> = {
  planning: "规划任务",
  thinking: "思考中",
  executing: "执行工具",
  synthesizing: "生成回复",
};

type AssistantTurnBubbleProps = {
  text: string;
  streaming?: boolean;
  activityLog?: ActivityEntry[];
  subtasks?: SubTaskSummary[];
  agentStatus?: AgentRunStatus;
  onOpenPath?: (path: string) => void;
};

function indexStepsBySubtask(
  activityLog: ActivityEntry[],
): Map<string, ActivityEntry[]> {
  const map = new Map<string, ActivityEntry[]>();

  for (const entry of activityLog) {
    if (entry.stage === "plan") continue;
    const key = entry.subtaskId ?? "__ungrouped__";
    const list = map.get(key) ?? [];
    list.push(entry);
    map.set(key, list);
  }

  return map;
}

function resolveSubtaskDisplayStatus(
  status: string,
  streaming?: boolean,
): string {
  if (!streaming && status === "in_progress") {
    return "done";
  }
  return status;
}

function SubtaskTodoIcon({
  status,
  streaming,
}: {
  status: string;
  streaming?: boolean;
}) {
  const className = "h-3.5 w-3.5 shrink-0 stroke-[1.75]";
  const displayStatus = resolveSubtaskDisplayStatus(status, streaming);

  switch (displayStatus) {
    case "done":
      return <SquareCheck className={cn(className, "text-muted-foreground")} />;
    case "failed":
      return <SquareX className={cn(className, "text-destructive")} />;
    case "in_progress":
      return (
        <SquareDot
          className={cn(className, "text-foreground animate-pulse")}
        />
      );
    default:
      return <Square className={cn(className, "text-muted-foreground/60")} />;
  }
}

function ActivityStepRow({
  entry,
  onOpenPath,
}: {
  entry: ActivityEntry;
  onOpenPath?: (path: string) => void;
}) {
  const isError = entry.status === "error";
  const showStatusIcon = entry.stage === "verify" || entry.stage === "act";
  const iconClassName = "h-3 w-3 shrink-0 stroke-[1.75]";

  return (
    <li className="flex items-baseline gap-2 text-[11px] leading-[1.35] text-muted-foreground">
      {showStatusIcon ? (
        <span className="inline-flex shrink-0 translate-y-px items-center justify-center">
          {isError ? (
            <SquareX className={cn(iconClassName, "text-destructive")} />
          ) : (
            <SquareCheck className={cn(iconClassName, "text-muted-foreground")} />
          )}
        </span>
      ) : null}
      <span className="shrink-0 text-muted-foreground/70">
        {STAGE_LABEL[entry.stage]}
      </span>
      <div className="min-w-0 flex-1">
        <span className={isError ? "text-destructive" : undefined}>
          {entry.label}
        </span>
        {entry.path && onOpenPath ? (
          <button
            type="button"
            className="ml-1.5 cursor-pointer text-foreground/70 underline underline-offset-2 hover:text-foreground"
            onClick={() => onOpenPath(entry.path!)}
          >
            {entry.path}
          </button>
        ) : entry.path ? (
          <span className="ml-1.5 text-foreground/60">{entry.path}</span>
        ) : null}
        {entry.detail ? (
          <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground/80">
            {entry.detail}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function SubtaskBlock({
  subtask,
  steps,
  stepsExpanded,
  streaming,
  onToggleSteps,
  onOpenPath,
}: {
  subtask: SubTaskSummary;
  steps: ActivityEntry[];
  stepsExpanded: boolean;
  streaming?: boolean;
  onToggleSteps?: () => void;
  onOpenPath?: (path: string) => void;
}) {
  const displayStatus = resolveSubtaskDisplayStatus(subtask.status, streaming);
  const isDone = displayStatus === "done";
  const canToggle = Boolean(onToggleSteps && steps.length > 0);

  return (
    <div className="space-y-1">
      <div
        role={canToggle ? "button" : undefined}
        tabIndex={canToggle ? 0 : undefined}
        className={cn(
          "flex min-h-[14px] items-center gap-2 text-[11px] leading-[14px]",
          canToggle && "cursor-pointer hover:text-foreground",
          isDone && "text-muted-foreground",
          displayStatus === "in_progress" && "text-foreground/90",
          displayStatus === "failed" && "text-destructive",
        )}
        onClick={canToggle ? onToggleSteps : undefined}
        onKeyDown={
          canToggle
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggleSteps?.();
                }
              }
            : undefined
        }
      >
        <span className="inline-flex shrink-0 items-center justify-center">
          <SubtaskTodoIcon status={subtask.status} streaming={streaming} />
        </span>
        <span className={cn("min-w-0 flex-1", isDone && "line-through")}>
          {subtask.intent}
        </span>
        {canToggle ? (
          stepsExpanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          )
        ) : null}
      </div>

      {stepsExpanded && steps.length > 0 ? (
        <ul className="ml-5 space-y-1.5 border-l border-border/50 pl-3">
          {steps.map((entry) => (
            <ActivityStepRow
              key={entry.id}
              entry={entry}
              onOpenPath={onOpenPath}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function AssistantTurnBubble({
  text,
  streaming,
  activityLog = [],
  subtasks = [],
  agentStatus,
  onOpenPath,
}: AssistantTurnBubbleProps) {
  const hasActivity = activityLog.length > 0 || subtasks.length > 0;
  const [panelExpanded, setPanelExpanded] = useState(streaming ?? false);
  const [reviewSubtaskId, setReviewSubtaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!streaming && hasActivity) {
      setPanelExpanded(false);
      setReviewSubtaskId(null);
    }
  }, [streaming, hasActivity]);

  useEffect(() => {
    if (streaming) {
      setPanelExpanded(true);
      setReviewSubtaskId(null);
    }
  }, [streaming]);

  const stepsBySubtask = useMemo(
    () => indexStepsBySubtask(activityLog),
    [activityLog],
  );

  const orphanSteps = stepsBySubtask.get("__ungrouped__") ?? [];

  const activeSubtaskId = streaming
    ? (subtasks.find((s) => s.status === "in_progress")?.id ?? null)
    : reviewSubtaskId;

  const showProcess = hasActivity || (streaming && agentStatus);

  return (
    <div className="w-full self-stretch animate-fade-in text-[13px] leading-[1.7]">
      <div className="rounded-none px-3.5 py-2.5 text-foreground/90">
        {showProcess ? (
          <div className={cn(text ? "mb-2 border-b border-border/60 pb-2" : "")}>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-1.5 text-left text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => setPanelExpanded((v) => !v)}
            >
              {panelExpanded ? (
                <ChevronDown className="h-3 w-3 shrink-0" />
              ) : (
                <ChevronRight className="h-3 w-3 shrink-0" />
              )}
              <span className="text-foreground/80">执行过程</span>
              {streaming && agentStatus ? (
                <span className="text-muted-foreground/70">
                  · {STATUS_LABEL[agentStatus]}
                </span>
              ) : null}
            </button>

            {panelExpanded ? (
              <div className="mt-2 space-y-2 pl-1">
                {subtasks.length > 0 ? (
                  subtasks.map((subtask) => {
                    const steps = stepsBySubtask.get(subtask.id) ?? [];
                    const stepsExpanded = subtask.id === activeSubtaskId;

                    return (
                      <SubtaskBlock
                        key={subtask.id}
                        subtask={subtask}
                        steps={steps}
                        stepsExpanded={stepsExpanded}
                        streaming={streaming}
                        onToggleSteps={
                          !streaming && steps.length > 0
                            ? () =>
                                setReviewSubtaskId((current) =>
                                  current === subtask.id ? null : subtask.id,
                                )
                            : undefined
                        }
                        onOpenPath={onOpenPath}
                      />
                    );
                  })
                ) : streaming && agentStatus ? (
                  <p className="text-[11px] text-muted-foreground">
                    {STATUS_LABEL[agentStatus]}…
                  </p>
                ) : null}

                {orphanSteps.length > 0 ? (
                  <ul className="ml-5 space-y-1.5 border-l border-border/50 pl-3">
                    {orphanSteps.map((entry) => (
                      <ActivityStepRow
                        key={entry.id}
                        entry={entry}
                        onOpenPath={onOpenPath}
                      />
                    ))}
                  </ul>
                ) : null}

                {streaming && agentStatus === "synthesizing" ? (
                  <p className="flex min-h-[14px] items-center gap-2 text-[11px] leading-[14px] text-muted-foreground">
                    <span className="inline-flex shrink-0 items-center justify-center">
                      <SquareDot className="h-3.5 w-3.5 shrink-0 animate-pulse stroke-[1.75]" />
                    </span>
                    汇总并生成回复
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {text ? <MarkdownContent content={text} /> : null}
        {streaming ? <MessageLoadingDots className="mt-1" /> : null}
      </div>
    </div>
  );
}
