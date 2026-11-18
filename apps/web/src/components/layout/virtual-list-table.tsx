import { tableFeatures, useTable } from "@tanstack/react-table";
import type { TableOptions_Columns } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  tableCardHeaderSurface,
} from "@/components/ui/table";
import type { TableVariant } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const virtualListFeatures = tableFeatures({});
type VirtualListColumns<Row extends { id: string }> = TableOptions_Columns<
  typeof virtualListFeatures,
  Row
>["columns"];

const headerHeight = 40;

export function VirtualListTable<Row extends { id: string }>({
  className,
  columns,
  columnWidths,
  data,
  hasNextPage,
  isFetching,
  isFetchingNextPage,
  isFetchNextPageError,
  label,
  loadingLabel,
  loadMore,
  retryLabel,
  scrollAreaClassName,
  total,
  variant = "default",
}: {
  className?: string;
  columns: VirtualListColumns<Row>;
  columnWidths?: readonly (string | number | undefined)[];
  data: Row[];
  hasNextPage: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  label: string;
  loadingLabel: string;
  loadMore: () => Promise<unknown>;
  retryLabel: string;
  scrollAreaClassName?: string;
  total: number;
  variant?: TableVariant;
}) {
  const table = useTable({
    columns,
    data,
    features: virtualListFeatures,
    getRowId: (row) => row.id,
  });
  const { rows } = table.getRowModel();
  const viewport = useRef<HTMLDivElement>(null);
  const getItemKey = useCallback((index: number) => rows[index].id, [rows]);
  // 虚拟器实例须随滚动读取当前的测量值。
  // The virtualizer must read live measurements as the viewport scrolls.
  // eslint-disable-next-line react/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => 61,
    getItemKey,
    getScrollElement: () => viewport.current,
    overscan: 4,
    scrollMargin: headerHeight,
  });
  const items = virtualizer.getVirtualItems();
  const [first] = items;
  const last = items.at(-1);
  const lastIndex = last?.index ?? -1;

  useEffect(() => {
    if (lastIndex >= rows.length - 1 && hasNextPage && !isFetching && !isFetchNextPageError) {
      void loadMore();
    }
  }, [hasNextPage, isFetching, isFetchNextPageError, lastIndex, loadMore, rows.length]);

  // 表头在滚动容器内，表体占位高度从表头之后开始计算。
  // The header is inside the scroller, so body spacer heights start below it.
  const top = first ? first.start - headerHeight : 0;
  const bottom = last ? virtualizer.getTotalSize() - (last.end - headerHeight) : 0;
  const columnCount = columns.length;

  return (
    <ScrollArea
      className={cn("h-80 rounded-xl sm:h-96", scrollAreaClassName)}
      overscrollContain
      viewportProps={{ ref: viewport }}
    >
      <table
        data-variant={variant}
        aria-label={label}
        aria-rowcount={total + 1}
        className={cn("w-full table-fixed border-separate border-spacing-0 text-sm", className)}
      >
        <colgroup>
          {table.getAllLeafColumns().map((column, index) => (
            <col key={column.id} style={{ width: columnWidths?.[index] }} />
          ))}
        </colgroup>
        <thead
          className={cn(
            "sticky top-0 z-10 bg-background",
            variant === "card" && tableCardHeaderSurface,
          )}
        >
          {table.getHeaderGroups().map((group) => (
            <TableRow aria-rowindex={1} key={group.id}>
              {group.headers.map((header) => (
                <TableHead
                  className={cn("px-4 last:pe-6", variant === "default" && "border-b bg-muted/40")}
                  key={header.id}
                  scope="col"
                  style={{ height: headerHeight }}
                >
                  <table.FlexRender header={header} />
                </TableHead>
              ))}
            </TableRow>
          ))}
        </thead>
        <TableBody>
          {top > 0 && (
            <tr aria-hidden="true">
              <td
                aria-hidden="true"
                className="border-0!"
                colSpan={columnCount}
                style={{ height: top }}
              />
            </tr>
          )}
          {items.map((item) => {
            const row = rows[item.index];
            return (
              <TableRow
                aria-rowindex={item.index + 2}
                data-index={item.index}
                key={row.id}
                ref={virtualizer.measureElement}
              >
                {row.getAllCells().map((cell) => (
                  <TableCell
                    className="whitespace-normal border-b px-4 py-2.5 leading-normal last:pe-6"
                    key={cell.id}
                  >
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
          {bottom > 0 && (
            <tr aria-hidden="true">
              <td
                aria-hidden="true"
                className="border-0!"
                colSpan={columnCount}
                style={{ height: bottom }}
              />
            </tr>
          )}
        </TableBody>
      </table>
      {isFetchingNextPage && (
        <output className="block px-4 py-2 text-center text-xs text-muted-foreground">
          {loadingLabel}
        </output>
      )}
      {isFetchNextPageError && (
        <div className="flex justify-center p-2">
          <Button onClick={() => loadMore()} size="sm" variant="ghost">
            {retryLabel}
          </Button>
        </div>
      )}
    </ScrollArea>
  );
}
