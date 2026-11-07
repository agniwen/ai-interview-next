import {
  IconFileText,
  IconScan,
  IconSchema,
  IconUserScan,
  IconCheck,
  IconClock,
  IconLoader2,
  IconMinus,
  IconX,
  IconRefresh,
} from "@tabler/icons-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Background, Controls, Handle, Position, ReactFlow } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages";
import { atsApi, atsStatus } from "./client";
import type { readResumeProcessing } from "./client";

export type ProcessingDetail = NonNullable<Awaited<ReturnType<typeof readResumeProcessing>>>;
export type ProcessingStep = "original" | "extract_text" | "avatar" | "structure";

export function processingStepTitle(step: ProcessingStep) {
  return {
    avatar: m.resume_processing_avatar(),
    extract_text: m.resume_processing_text(),
    original: m.resume_preview_original(),
    structure: m.resume_processing_structure(),
  }[step];
}

export function processingStepStatus(detail: ProcessingDetail, step: ProcessingStep) {
  if (step === "original") {
    return detail.upload.status === "accepted" ? "succeeded" : detail.upload.status;
  }
  if (step === "avatar") {
    return detail.resume?.hasAvatar ? "available" : "unknown";
  }
  const attempts = detail.attempts.filter((attempt) => attempt.stage === step);
  const latest = attempts.at(-1);
  if (latest) {
    return latest.status;
  }
  if (detail.run?.stage === step && detail.run.status !== "succeeded") {
    return detail.run.status;
  }
  const output = step === "extract_text" ? detail.resume?.markdown : detail.resume?.profile;
  if (output && (detail.run?.status === "succeeded" || detail.run?.stage === "structure")) {
    return "reused";
  }
  return "waiting";
}

const statusIndicators: Record<string, { icon: typeof IconCheck; className: string }> = {
  available: { className: "bg-success/10 text-success-foreground", icon: IconCheck },
  failed: { className: "bg-destructive/10 text-destructive-foreground", icon: IconX },
  queued: { className: "bg-muted text-muted-foreground", icon: IconClock },
  reused: { className: "bg-muted text-muted-foreground", icon: IconRefresh },
  running: { className: "bg-info/10 text-info-foreground", icon: IconLoader2 },
  succeeded: { className: "bg-success/10 text-success-foreground", icon: IconCheck },
  upload_failed: { className: "bg-destructive/10 text-destructive-foreground", icon: IconX },
};

export function ProcessingStatus({
  status,
  compact = false,
}: {
  status: string;
  compact?: boolean;
}) {
  const variants: Record<string, BadgeProps["variant"]> = {
    available: "success",
    failed: "error",
    running: "info",
    succeeded: "success",
    upload_failed: "error",
  };
  const labels: Record<string, string> = {
    available: m.resume_processing_available(),
    reused: m.resume_processing_reused(),
    unknown: m.resume_processing_no_avatar(),
  };
  const label = labels[status] ?? atsStatus(status);
  if (compact) {
    const indicator = statusIndicators[status];
    const Icon = indicator?.icon ?? IconMinus;
    return (
      <span
        title={label}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full",
          indicator?.className ?? "bg-muted text-muted-foreground",
        )}
      >
        <Icon
          aria-hidden="true"
          className={cn("size-3.5", status === "running" && "motion-safe:animate-spin")}
          stroke={2}
        />
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  return <Badge variant={variants[status] ?? "outline"}>{label}</Badge>;
}

type StageNode = Node<
  {
    compact: boolean;
    step: ProcessingStep;
    avatarSrc?: string;
    fileType: string;
    status: string;
    summary: string;
    select: (step: ProcessingStep) => void;
  },
  "stage"
>;

const stageIcons = {
  avatar: IconUserScan,
  extract_text: IconScan,
  original: IconFileText,
  structure: IconSchema,
};

function StageCard({ data, selected }: NodeProps<StageNode>) {
  const Icon = stageIcons[data.step];
  const handleStyle = {
    background: selected ? "var(--info)" : "var(--muted-foreground)",
    border: "2px solid var(--card)",
    height: 10,
    width: 10,
  };
  return (
    <>
      {data.step !== "original" && (
        <Handle
          style={handleStyle}
          type="target"
          position={data.compact && data.step !== "avatar" ? Position.Top : Position.Left}
        />
      )}
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => data.select(data.step)}
        className={cn(
          "nodrag nopan flex h-26 w-70 cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-4 text-left text-card-foreground shadow-xs transition-[border-color,box-shadow] hover:border-foreground/15 hover:bg-muted/20 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-info motion-reduce:transition-none",
          selected && "border-info ring-2 ring-info/15 hover:border-info",
        )}
      >
        <span
          className={cn(
            "flex h-13 w-10 shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-lg bg-muted/50 text-muted-foreground",
            selected && "bg-info/8 text-info-foreground",
          )}
        >
          {data.step === "avatar" && data.avatarSrc ? (
            <img src={data.avatarSrc} alt="" className="size-full object-cover" />
          ) : (
            <>
              <Icon aria-hidden="true" className="size-5" stroke={1.6} />
              {data.step === "original" && (
                <span className="max-w-full truncate px-1 text-[9px] font-semibold leading-3">
                  {data.fileType}
                </span>
              )}
            </>
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-center gap-2">
            <span className="min-w-0 flex-1 text-sm font-medium leading-5">
              {processingStepTitle(data.step)}
            </span>
            <ProcessingStatus status={data.status} compact />
          </span>
          <span
            title={data.summary}
            className="line-clamp-2 text-xs leading-4 text-muted-foreground wrap-anywhere"
          >
            {data.summary}
          </span>
        </span>
      </button>
      {(data.step === "original" || data.step === "extract_text") && (
        <Handle
          style={handleStyle}
          type="source"
          position={data.compact ? Position.Bottom : Position.Right}
        />
      )}
      {data.step === "original" && (
        <Handle
          id="portrait"
          style={handleStyle}
          type="source"
          position={data.compact ? Position.Left : Position.Right}
        />
      )}
    </>
  );
}

const nodeTypes = { stage: StageCard };
const steps = [
  { id: "original", position: { x: 0, y: 0 } },
  { id: "extract_text", position: { x: 360, y: 0 } },
  { id: "structure", position: { x: 720, y: 0 } },
  { id: "avatar", position: { x: 360, y: 180 } },
] as const;
const connections = [
  { source: "original", target: "extract_text" },
  { source: "extract_text", target: "structure" },
  { source: "original", sourceHandle: "portrait", target: "avatar" },
] as const;

/**
 * 把简历处理步骤及状态绘制为可选择的流程图，步骤详情由外层页面展示。
 * Selectable flow diagram of resume processing steps and statuses; the parent page presents step details.
 */
export function ResumeProcessingFlow({
  detail,
  selected,
  onSelect,
  workspaceId,
}: {
  detail: ProcessingDetail;
  workspaceId: string;
  selected: ProcessingStep | null;
  onSelect: (step: ProcessingStep) => void;
}) {
  const { resolvedTheme } = useTheme();
  const compact = useMediaQuery("(max-width: 767px)");
  const profile = detail.resume?.profile;
  const avatarSrc = detail.resume?.hasAvatar
    ? atsApi.resumes[":id"].avatar.$path({ param: { id: detail.resume.id, workspaceId } })
    : undefined;
  const summaries = {
    avatar: detail.resume?.hasAvatar
      ? (profile?.identity?.name ?? m.resume_processing_available())
      : m.resume_processing_no_avatar(),
    extract_text: detail.resume?.markdown
      ? m.resume_processing_characters({ count: detail.resume.markdown.length })
      : m.resume_processing_no_output(),
    original: detail.upload.filename,
    structure: profile
      ? m.resume_processing_profile_summary({
          education: profile.education?.length ?? 0,
          employment: profile.employment?.length ?? 0,
          skills: profile.skills?.length ?? 0,
        })
      : m.resume_processing_no_output(),
  };
  const nodes: StageNode[] = steps.map(({ id, position }, index) => ({
    data: {
      avatarSrc,
      compact,
      fileType: detail.upload.filename.split(".").at(-1)?.toUpperCase() ?? "",
      select: onSelect,
      status: processingStepStatus(detail, id),
      step: id,
      summary: summaries[id],
    },
    id,
    position: compact ? { x: 0, y: index * 180 } : position,
    selected: selected === id,
    type: "stage",
  }));
  const edges = connections.map((connection) => ({
    ...connection,
    animated:
      connection.target !== "avatar" &&
      processingStepStatus(detail, connection.target) === "running",
    id: `${connection.source}-${connection.target}`,
    type: "smoothstep",
  }));
  return (
    <div className="absolute inset-0 bg-background" aria-label={m.resume_processing_graph()}>
      <ReactFlow
        key={compact ? "vertical" : "horizontal"}
        colorMode={resolvedTheme === "dark" ? "dark" : "light"}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onSelect(node.data.step)}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        deleteKeyCode={null}
        fitView
        fitViewOptions={{ maxZoom: 1, padding: 0.2 }}
        minZoom={0.25}
        maxZoom={1.5}
        ariaLabelConfig={{
          "controls.fitView.ariaLabel": m.resume_processing_fit(),
          "controls.zoomIn.ariaLabel": m.resume_processing_zoom_in(),
          "controls.zoomOut.ariaLabel": m.resume_processing_zoom_out(),
        }}
      >
        <Background gap={24} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
