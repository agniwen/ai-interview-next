import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function List({ className, ...props }: ComponentProps<"ul">) {
  return <ul className={cn("flex min-w-0 flex-col divide-y", className)} data-slot="list" {...props} />;
}

export function ListItem({ className, ...props }: ComponentProps<"li">) {
  return <li className={cn("flex min-w-0 flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between", className)} data-slot="list-item" {...props} />;
}

export function ListContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("min-w-0 flex-1", className)} data-slot="list-content" {...props} />;
}

export function ListTitle({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("break-words text-sm font-medium", className)} data-slot="list-title" {...props} />;
}

export function ListDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("break-all text-sm leading-6 text-muted-foreground", className)} data-slot="list-description" {...props} />;
}

export function ListActions({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-wrap items-center gap-2 sm:shrink-0", className)} data-slot="list-actions" {...props} />;
}
