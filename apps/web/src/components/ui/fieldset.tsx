"use client";

import { Fieldset as FieldsetPrimitive } from "@base-ui/react/fieldset";
import type React from "react";
import { cn } from "@/lib/utils";

/**
 * 表单相关字段的语义分组容器，提供组标题及统一布局。
 * Semantic grouping for related form fields, with a legend and shared layout.
 */
export function Fieldset({
  className,
  ...props
}: FieldsetPrimitive.Root.Props): React.ReactElement {
  return <FieldsetPrimitive.Root className={className} data-slot="fieldset" {...props} />;
}
export function FieldsetLegend({
  className,
  ...props
}: FieldsetPrimitive.Legend.Props): React.ReactElement {
  return (
    <FieldsetPrimitive.Legend
      className={cn("font-semibold text-foreground", className)}
      data-slot="fieldset-legend"
      {...props}
    />
  );
}

export { FieldsetPrimitive };
