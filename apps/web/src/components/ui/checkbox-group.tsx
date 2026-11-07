"use client";

import { CheckboxGroup as CheckboxGroupPrimitive } from "@base-ui/react/checkbox-group";
import type React from "react";
import { cn } from "@/lib/utils";

/**
 * 复选框选项组，统一组布局并将选中集合交由底层控件和调用方管理。
 * Checkbox option group sharing layout while the primitive and caller manage selected values.
 */
export function CheckboxGroup({
  className,
  ...props
}: CheckboxGroupPrimitive.Props): React.ReactElement {
  return (
    <CheckboxGroupPrimitive
      className={cn("flex flex-col items-start gap-3", className)}
      {...props}
    />
  );
}

export { CheckboxGroupPrimitive };
