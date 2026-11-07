"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { IconChevronLeft as ChevronLeftIcon, IconChevronRight as ChevronRightIcon, IconDots as MoreHorizontalIcon } from "@tabler/icons-react";
import type * as React from "react";
import { cn } from "@/lib/utils";
import { type Button, buttonVariants } from "@/components/ui/button";

/**
 * 页码导航的展示组件，提供前后页、页码和省略号；总页数与路由状态由调用方计算。
 * Pagination presentation for previous/next, pages and ellipses; callers compute page counts and routing state.
 */
export function Pagination({
  className,
  ...props
}: React.ComponentProps<"nav">): React.ReactElement {
  return (
    <nav
      aria-label="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      data-slot="pagination"
      {...props}
    />
  );
}

export function PaginationContent({
  className,
  ...props
}: React.ComponentProps<"ul">): React.ReactElement {
  return (
    <ul
      className={cn("flex flex-row items-center gap-1", className)}
      data-slot="pagination-content"
      {...props}
    />
  );
}

export function PaginationItem({ ...props }: React.ComponentProps<"li">): React.ReactElement {
  return <li data-slot="pagination-item" {...props} />;
}

export type PaginationLinkProps = {
  isActive?: boolean;
  size?: React.ComponentProps<typeof Button>["size"];
} & useRender.ComponentProps<"a">;

export function PaginationLink({
  className,
  isActive,
  size = "icon",
  render,
  ...props
}: PaginationLinkProps): React.ReactElement {
  const defaultProps = {
    "aria-current": isActive ? ("page" as const) : undefined,
    className: cn(buttonVariants({ size, variant: isActive ? "outline" : "ghost" }), className),
    "data-active": isActive,
    "data-slot": "pagination-link",
  };

  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(defaultProps, props),
    render,
  });
}

export function PaginationPrevious({
  className,
  label = "Previous",
  ...props
}: PaginationLinkProps & { label?: string }): React.ReactElement {
  return (
    <PaginationLink
      aria-label={label}
      className={cn("max-sm:aspect-square max-sm:p-0", className)}
      size="default"
      {...props}
    >
      <ChevronLeftIcon aria-hidden="true" className="sm:-ms-1" />
      <span className="max-sm:hidden">{label}</span>
    </PaginationLink>
  );
}

export function PaginationNext({
  className,
  label = "Next",
  ...props
}: PaginationLinkProps & { label?: string }): React.ReactElement {
  return (
    <PaginationLink
      aria-label={label}
      className={cn("max-sm:aspect-square max-sm:p-0", className)}
      size="default"
      {...props}
    >
      <span className="max-sm:hidden">{label}</span>
      <ChevronRightIcon aria-hidden="true" className="sm:-me-1" />
    </PaginationLink>
  );
}

export function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">): React.ReactElement {
  return (
    <span
      aria-hidden
      className={cn("flex min-w-7 justify-center", className)}
      data-slot="pagination-ellipsis"
      {...props}
    >
      <MoreHorizontalIcon className="size-5 sm:size-4" />
      <span className="sr-only">More pages</span>
    </span>
  );
}
