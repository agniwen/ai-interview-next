import type { ReactNode } from "react";
import { IconChevronLeft, IconChevronRight, IconFolder } from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";
import { PageHeaderContent } from "@/components/layout/page-header";
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
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as m from "@/paraglide/messages";

export interface AtsPageProps {
  workspaceId: string;
  page: number;
  onPage: (page: number) => void;
}

export function AtsListPage({
  title,
  icon: Icon,
  toolbar,
  headings,
  rows,
  empty,
  page,
  pageSize,
  total,
  onPage,
  error,
}: {
  title: string;
  icon: Icon;
  toolbar?: ReactNode;
  headings: string[];
  rows?: { id: string; cells: ReactNode[] }[];
  empty: string;
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  error: boolean;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <>
      <PageHeaderContent>
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h1 className="truncate text-sm font-medium">{title}</h1>
      </PageHeaderContent>
      <section aria-label={title} className="flex min-w-0 flex-col gap-4">
        {toolbar && <div className="flex flex-wrap items-center justify-end gap-2">{toolbar}</div>}
        {error && (
          <Alert variant="error">
            <AlertDescription>{m.ats_error()}</AlertDescription>
          </Alert>
        )}
        {!error && !rows && <AtsTableSkeleton />}
        {!error && rows && (
          <>
            <div className="rounded-lg border">
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headings.map((heading) => (
                        <TableHead key={heading}>{heading}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.cells.map((cell, index) => (
                          <TableCell key={headings[index]}>{cell}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            {(pages > 1 || page > 1) && (
              <Pagination aria-label={m.ats_pagination()}>
                <PaginationContent>
                  <PaginationItem>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={m.ats_previous()}
                      disabled={page <= 1}
                      onClick={() => onPage(page - 1)}
                    >
                      <IconChevronLeft />
                    </Button>
                  </PaginationItem>
                  <PaginationItem>
                    <span className="px-2 text-sm tabular-nums text-muted-foreground">
                      {page} / {pages}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={m.ats_next()}
                      disabled={page >= pages}
                      onClick={() => onPage(page + 1)}
                    >
                      <IconChevronRight />
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </>
        )}
      </section>
    </>
  );
}
