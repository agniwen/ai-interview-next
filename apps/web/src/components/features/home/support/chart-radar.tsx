/* oxlint-disable react/no-unstable-nested-components -- Chart tooltip APIs accept render callbacks. */
"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from "recharts";
import { cn } from "@/lib/utils";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/features/home/support/chart";
import type { ChartConfig } from "@/components/features/home/support/chart";

export interface RadarDimensionPoint {
  key: string;
  label: string;
  score: number | null;
  weight?: number;
  rationale?: string;
  contribution?: number;
}

const DEFAULT_CONFIG: ChartConfig = {
  score: {
    label: "评分",
    theme: { dark: "#7699ef", light: "var(--chart-primary)" },
  },
};

/**
 * 评价维度雷达图，将维度数据转换为图表与提示信息，供首页评价演示复用。
 * Evaluation-dimension radar chart mapping data to chart and tooltip content for homepage demos.
 */
export function DimensionRadarChart({
  dimensions,
  className,
  compact = false,
  config = DEFAULT_CONFIG,
  ariaLabel = "维度评分雷达图",
  fillOpacity = 0.16,
  height: heightProp,
  maxScore = 100,
  empty,
  tooltipBody,
}: {
  dimensions: readonly RadarDimensionPoint[];
  className?: string;
  compact?: boolean;
  config?: ChartConfig;
  ariaLabel?: string;
  fillOpacity?: number;
  height?: number;
  /** Qualitative radial positions are never displayed as numeric scores. */
  maxScore?: number;
  empty?: ReactNode;
  tooltipBody?: (point: RadarDimensionPoint) => ReactNode;
}) {
  const data = useMemo(
    () => dimensions.map((point) => ({ ...point, radialValue: point.score ?? 0 })),
    [dimensions],
  );
  if (data.length === 0) {
    return (
      empty ?? (
        <div
          className={cn(
            "flex w-full min-w-0 items-center justify-center text-muted-foreground text-sm",
            compact ? "min-h-48" : "min-h-64",
          )}
        >
          暂无匹配维度
        </div>
      )
    );
  }
  const height = heightProp ?? (compact ? 192 : 272);
  return (
    <ChartContainer
      aria-label={ariaLabel}
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- The accessible image is a composed SVG chart.
      role="img"
      className={cn(
        "mx-auto aspect-square w-full text-muted-foreground",
        compact ? "max-w-[14rem]" : "max-w-[19rem]",
        className,
      )}
      config={config}
      style={{ height }}
      initialDimension={{ height, width: compact ? 224 : 304 }}
      data-radar-max-score={maxScore}
      data-radar-order={data.map((point) => point.key).join(",")}
    >
      <RadarChart accessibilityLayer data={data} outerRadius={compact ? "68%" : "72%"}>
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis
          dataKey="label"
          tick={{ fill: "var(--muted-foreground)", fontSize: compact ? 10 : 11 }}
        />
        <PolarRadiusAxis domain={[0, maxScore]} tick={false} axisLine={false} tickCount={5} />
        <ChartTooltip
          cursor={false}
          content={({ active, payload }) => {
            const point: RadarDimensionPoint | undefined = payload?.[0]?.payload;
            if (!active || !point) {
              return null;
            }
            return tooltipBody ? (
              <div className="max-w-80 rounded-lg border bg-popover px-3 py-2 text-popover-foreground text-xs shadow-xl">
                {tooltipBody(point)}
              </div>
            ) : (
              <ChartTooltipContent
                active={active}
                payload={payload}
                hideLabel
                formatter={() => `${point.label}：${point.score ?? "—"} 分`}
              />
            );
          }}
        />
        <Radar
          dataKey="radialValue"
          name="评分"
          stroke="var(--color-score)"
          strokeWidth={1.75}
          fill="var(--color-score)"
          fillOpacity={fillOpacity}
          dot={{
            fill: "var(--color-score)",
            r: compact ? 2.25 : 2.75,
            stroke: "var(--background)",
            strokeWidth: 1.25,
          }}
          isAnimationActive={false}
        />
      </RadarChart>
    </ChartContainer>
  );
}
