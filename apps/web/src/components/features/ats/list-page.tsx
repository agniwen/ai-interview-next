import { Link } from "@tanstack/react-router";
import { useTransition } from "react";
import type { ComponentProps, ReactNode } from "react";
import { Skeleton } from "skullet/react";
import { IconFolder, IconRefresh } from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";
import { PageHeader, PageHeaderContent } from "@/components/layout/page-header";
import { TableFilters, TableFilterSelect } from "@/components/layout/table-filters";
import { AtsTableSkeleton } from "@/components/skeletons/pages/ats-table-skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Frame } from "@/components/ui/frame";
import { Group, GroupSeparator } from "@/components/ui/group";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ScrollAreaPrimitive, ScrollBar } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages";

import { AtsListSearchField } from "./list-search-field";
import type { ListSearch } from "./list-search";

export interface AtsPageProps<Query extends ListSearch = ListSearch> {
  workspaceId: string;
  query: Query;
  onQueryChange: (changes: Partial<Query>) => void;
}

type AtsRows = { id: string; cells: ReactNode[]; action?: ReactNode }[];

const tableHeaderSurface = "bg-background bg-linear-to-b from-muted/72 to-muted/72";
const actionColumnClassName =
  "sticky right-0 z-10 w-px text-right in-data-overflow-x-end:before:pointer-events-none in-data-overflow-x-end:before:absolute in-data-overflow-x-end:before:inset-y-0 in-data-overflow-x-end:before:left-0 in-data-overflow-x-end:before:w-px in-data-overflow-x-end:before:bg-border";
// 用表框底色遮住圆角外侧露出的滚动内容。 / Cover scrolling content outside the rounded corners with the frame surface.
const actionCornerMask = cn(
  tableHeaderSurface,
  "pointer-events-none absolute -right-px hidden size-[var(--radius-xl)] in-data-overflow-x-end:block",
);

function renderTableViewport({ children, className, ...props }: ComponentProps<"div">) {
  return (
    <ScrollAreaPrimitive.Viewport
      className={cn(
        "rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Content>{children}</ScrollAreaPrimitive.Content>
    </ScrollAreaPrimitive.Viewport>
  );
}

export function AtsTable({
  firstColumnClassName,
  hasRowActions,
  headings,
  loading = false,
  rows,
}: {
  firstColumnClassName?: string;
  hasRowActions?: boolean;
  headings: string[];
  rows: AtsRows;
  loading?: boolean;
}) {
  // 在单元格内测量，避免表体被识别为整块、固定列遮住覆盖层。 / Measure inside cells so the body is not one block and pinned cells do not cover the overlay.
  const renderCell = (content: ReactNode) =>
    loading ? <Skeleton loading>{content}</Skeleton> : content;
  return (
    <Frame className={cn("w-full", tableHeaderSurface)}>
      <ScrollAreaPrimitive.Root
        className="min-w-0 data-has-overflow-x:pb-3.5"
        overflowEdgeThreshold={1}
      >
        <Table render={renderTableViewport} variant="card">
          <TableHeader>
            <TableRow>
              {headings.map((heading, index) => (
                <TableHead className={index === 0 ? firstColumnClassName : undefined} key={heading}>
                  {renderCell(heading)}
                </TableHead>
              ))}
              {hasRowActions && (
                <TableHead className={cn(actionColumnClassName, tableHeaderSurface)} scope="col">
                  {renderCell(m.ats_action())}
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, rowIndex) => (
              <TableRow key={row.id}>
                {row.cells.map((cell, index) => (
                  <TableCell key={headings[index]}>{renderCell(cell)}</TableCell>
                ))}
                {hasRowActions && (
                  <TableCell className={cn(actionColumnClassName, "bg-clip-border")}>
                    {renderCell(row.action)}
                    {rowIndex === 0 && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          actionCornerMask,
                          "-top-px [mask-image:radial-gradient(circle_at_bottom_left,transparent_calc(var(--radius-xl)-0.5px),black_var(--radius-xl))]",
                        )}
                      />
                    )}
                    {rowIndex === rows.length - 1 && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          actionCornerMask,
                          "-bottom-px [mask-image:radial-gradient(circle_at_top_left,transparent_calc(var(--radius-xl)-0.5px),black_var(--radius-xl))]",
                        )}
                      />
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollAreaPrimitive.Root>
    </Frame>
  );
}

function visiblePages(page: number, pages: number) {
  if (pages <= 7) {
    return Array.from({ length: pages }, (_, index) => index + 1);
  }
  const start = Math.max(2, Math.min(page - 1, pages - 3));
  return [
    1,
    ...(start > 2 ? ["before"] : []),
    start,
    start + 1,
    start + 2,
    ...(start + 2 < pages - 1 ? ["after"] : []),
    pages,
  ];
}

function renderPageLink(page: number) {
  return <Link to="." search={(prev) => ({ ...prev, page })} />;
}

export function AtsListPage({
  action,
  children,
  title,
  description,
  navigation,
  icon: Icon,
  filters,
  feedback,
  hasRowActions,
  headings,
  firstColumnClassName,
  rows,
  empty,
  query,
  searchPlaceholder,
  total,
  onQueryChange,
  onRefresh,
  error,
}: {
  action?: ReactNode;
  children?: ReactNode;
  title: string;
  description?: string;
  navigation?: ReactNode;
  icon: Icon;
  filters?: ReactNode;
  feedback?: ReactNode;
  hasRowActions?: boolean;
  headings: string[];
  firstColumnClassName?: string;
  rows?: AtsRows;
  empty: string;
  query: ListSearch;
  searchPlaceholder: string;
  total: number;
  onQueryChange: (changes: Partial<ListSearch>) => void;
  onRefresh: () => Promise<unknown>;
  error: boolean;
}) {
  const [refreshing, startRefresh] = useTransition();
  const { page, pageSize, search } = query;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const phase = useSkeletonPhase(!error && !rows);
  const sampleRowAction = (
    <span className="inline-flex h-8 items-center sm:h-7">{m.ats_action()}</span>
  );
  return (
    <>
      <PageHeaderContent>
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate text-sm font-medium">{title}</span>
      </PageHeaderContent>
      <section aria-label={title} className="flex min-w-0 flex-col gap-4">
        <PageHeader description={description} title={title} />
        {navigation}
        <TableFilters
          actions={
            <Group aria-label={m.ats_action()}>
              {action && (
                <>
                  {action}
                  <GroupSeparator />
                </>
              )}
              <Tooltip>
                <TooltipTrigger
                  aria-label={m.ats_refresh()}
                  render={<Button loading={refreshing} size="icon" variant="outline" />}
                  onClick={() => {
                    startRefresh(async () => {
                      await onRefresh();
                    });
                  }}
                >
                  <IconRefresh aria-hidden="true" />
                </TooltipTrigger>
                <TooltipPopup>{m.ats_refresh()}</TooltipPopup>
              </Tooltip>
            </Group>
          }
        >
          <AtsListSearchField
            onSearch={(next) => onQueryChange({ page: 1, search: next })}
            placeholder={searchPlaceholder}
            value={search}
          />
          {filters}
        </TableFilters>
        {feedback}
        {phase === "ready" && error && (
          <Alert variant="error">
            <AlertDescription>{m.ats_error()}</AlertDescription>
          </Alert>
        )}
        {phase === "skeleton" && (
          <AtsTableSkeleton>
            <AtsTable
              firstColumnClassName={firstColumnClassName}
              hasRowActions={hasRowActions}
              headings={headings}
              loading
              rows={Array.from({ length: 5 }, (_, index) => ({
                action: sampleRowAction,
                cells: headings,
                id: String(index),
              }))}
            />
          </AtsTableSkeleton>
        )}
        {phase === "ready" && rows && (
          <>
            {rows.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <IconFolder aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>{empty}</EmptyTitle>
                  <EmptyDescription>{m.ats_empty_description()}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <AtsTable
                firstColumnClassName={firstColumnClassName}
                hasRowActions={hasRowActions}
                headings={headings}
                rows={rows}
              />
            )}
            {(total > 0 || page > 1) && (
              <div className="flex flex-wrap items-center justify-end gap-2 [&_:is([data-slot=group-text],[data-slot=select-trigger])]:border-transparent [&_:is([data-slot=group-text],[data-slot=select-trigger])]:shadow-none [&_:is([data-slot=group-text],[data-slot=select-trigger])]:before:hidden [&_[data-slot=separator]]:hidden">
                <TableFilterSelect
                  label={m.ats_page_size()}
                  onChange={(next) => onQueryChange({ page: 1, pageSize: next })}
                  options={[...new Set([20, 50, 100, pageSize])].map((size) => ({
                    label: String(size),
                    value: size,
                  }))}
                  triggerClassName="min-w-18 tabular-nums"
                  value={pageSize}
                />
                <Pagination aria-label={m.ats_pagination()} className="mx-0 w-auto max-w-full">
                  <PaginationContent className="flex-wrap justify-end max-sm:gap-0">
                    <PaginationItem>
                      <PaginationPrevious
                        className="max-sm:size-8"
                        label={m.ats_previous()}
                        render={
                          page > 1 ? (
                            renderPageLink(Math.min(page - 1, pages))
                          ) : (
                            <button aria-label={m.ats_previous()} disabled type="button" />
                          )
                        }
                      />
                    </PaginationItem>
                    {visiblePages(page, pages).map((target) => (
                      <PaginationItem key={target}>
                        {typeof target === "number" ? (
                          <PaginationLink
                            className="min-w-8 px-1.5 max-sm:h-8"
                            isActive={target === page}
                            render={renderPageLink(target)}
                            size="default"
                          >
                            {target}
                          </PaginationLink>
                        ) : (
                          <PaginationEllipsis className="max-sm:min-w-5" />
                        )}
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        className="max-sm:size-8"
                        label={m.ats_next()}
                        render={
                          page < pages ? (
                            renderPageLink(page + 1)
                          ) : (
                            <button aria-label={m.ats_next()} disabled type="button" />
                          )
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </section>
      {children}
    </>
  );
}
