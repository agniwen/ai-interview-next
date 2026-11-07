import { move } from "@dnd-kit/helpers";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { IconGripVertical } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages";

export function SortableList<T extends { key: string }>({
  items,
  onChange,
  children,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  children: ReactNode;
}) {
  return (
    <DragDropProvider
      onDragEnd={(event) => {
        onChange(
          move(
            items.map((item) => ({ id: item.key, item })),
            event,
          ).map(({ item }) => item),
        );
      }}
    >
      {children}
    </DragDropProvider>
  );
}

export function SortableItem({
  id,
  index,
  label,
  disabled,
  className,
  children,
}: {
  id: string;
  index: number;
  label: string;
  disabled: boolean;
  className?: string;
  children: (handle: ReactNode) => ReactNode;
}) {
  const { ref, handleRef, isDragSource } = useSortable({ disabled, id, index });
  const dragLabel = m.question_sets_drag({ label });

  return (
    <div
      ref={ref}
      data-dragging={isDragSource || undefined}
      className={cn(
        "relative min-w-0 rounded-xl border bg-background transition-[border-color,box-shadow] data-dragging:border-primary/50 data-dragging:shadow-lg data-dragging:ring-2 data-dragging:ring-primary/15 motion-reduce:transition-none",
        className,
      )}
    >
      {children(
        <Tooltip>
          <TooltipTrigger
            render={<Button ref={handleRef} size="icon-sm" variant="ghost" disabled={disabled} />}
            aria-label={dragLabel}
            aria-description={m.question_sets_sort_keyboard()}
            className="touch-none cursor-grab text-muted-foreground active:cursor-grabbing"
          >
            <IconGripVertical aria-hidden="true" />
          </TooltipTrigger>
          <TooltipPopup>{dragLabel}</TooltipPopup>
        </Tooltip>,
      )}
    </div>
  );
}
