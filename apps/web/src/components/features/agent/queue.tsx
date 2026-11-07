import { Reorder, useDragControls } from "motion/react";
import { useState } from "react";
import { IconGripVertical, IconArrowUp, IconPencil, IconX } from "@tabler/icons-react";
import type { QueueItem } from "@ai-interview/agent";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import * as m from "@/paraglide/messages";

function QueueRow({
  item,
  busy,
  canSteer,
  move,
  save,
  remove,
  steer,
  finish,
}: {
  item: QueueItem;
  busy: boolean;
  canSteer: boolean;
  move: (direction: number) => void;
  save: (text: string) => Promise<boolean>;
  remove: () => void;
  steer: () => void;
  finish: () => void;
}) {
  const controls = useDragControls();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);
  return (
    <Reorder.Item
      value={item.id}
      dragListener={false}
      dragControls={controls}
      onDragEnd={finish}
      className="group/queue relative rounded-md px-1 py-0.5 text-xs hover:bg-muted/40 focus-within:bg-muted/40"
    >
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="size-6 touch-none cursor-grab text-muted-foreground/60 active:cursor-grabbing"
          disabled={busy || editing}
          aria-label={m.agent_drag()}
          onPointerDown={(event) => controls.start(event)}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              move(event.key === "ArrowUp" ? -1 : 1);
            }
          }}
        >
          <IconGripVertical />
        </Button>
        {editing ? (
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Textarea
              aria-label={m.agent_message()}
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={32_000}
            />
            <div className="flex justify-end gap-1">
              <Button type="button" size="xs" variant="ghost" onClick={() => setEditing(false)}>
                {m.agent_cancel()}
              </Button>
              <Button
                type="button"
                size="xs"
                disabled={busy || !text.trim()}
                onClick={async () => {
                  if (await save(text)) {
                    setEditing(false);
                  }
                }}
              >
                {m.agent_save()}
              </Button>
            </div>
          </div>
        ) : (
          <p className="min-w-0 flex-1 truncate px-1 py-1" title={item.text}>
            {item.text}
          </p>
        )}
        {!editing && (
          <div className="flex shrink-0 gap-0.5 text-muted-foreground opacity-0 transition-opacity group-hover/queue:opacity-100 group-focus-within/queue:opacity-100 max-md:opacity-100">
            <Button
              type="button"
              size="icon-xs"
              className="size-6 rounded-md"
              variant="ghost"
              disabled={busy || !canSteer}
              aria-label={m.agent_steer()}
              title={m.agent_steer()}
              onClick={steer}
            >
              <IconArrowUp />
            </Button>
            <Button
              type="button"
              size="icon-xs"
              className="size-6 rounded-md"
              variant="ghost"
              disabled={busy}
              aria-label={m.agent_edit()}
              onClick={() => {
                setText(item.text);
                setEditing(true);
              }}
            >
              <IconPencil />
            </Button>
            <Button
              type="button"
              size="icon-xs"
              className="size-6 rounded-md"
              variant="ghost"
              disabled={busy}
              aria-label={m.agent_remove()}
              onClick={remove}
            >
              <IconX />
            </Button>
          </div>
        )}
      </div>
    </Reorder.Item>
  );
}

export function ChatQueue({
  items,
  busy,
  canSteer,
  onReorder,
  onEdit,
  onRemove,
  onSteer,
}: {
  items: QueueItem[];
  busy: boolean;
  canSteer: boolean;
  onReorder: (ids: string[]) => Promise<boolean>;
  onEdit: (id: string, text: string) => Promise<boolean>;
  onRemove: (id: string) => void;
  onSteer: (id: string) => void;
}) {
  const [source, setSource] = useState(items);
  const [order, setOrder] = useState(() => items.map((item) => item.id));
  // 在提交渲染前同步服务端队列，保留行身份及其编辑状态。
  // Reconcile the server queue before committing while preserving row identity and editing state.
  if (source !== items) {
    setSource(items);
    setOrder(items.map((item) => item.id));
  }
  const itemsById = Object.fromEntries(items.map((item) => [item.id, item]));
  const visibleOrder = source === items ? order : items.map((item) => item.id);
  async function persist(next: string[]) {
    if (!(await onReorder(next))) {
      setOrder(items.map((item) => item.id));
    }
  }
  return (
    <div className="mx-2 rounded-t-xl border border-b-0 border-border/60 bg-muted/15 px-1 py-1">
      <ScrollArea
        className="max-h-28"
        viewportClassName="max-h-28 focus-visible:ring-0 focus-visible:ring-offset-0"
        overscrollContain
      >
        <Reorder.Group
          axis="y"
          values={visibleOrder}
          onReorder={setOrder}
          className="flex flex-col"
          aria-label={m.agent_queue()}
        >
          {visibleOrder.map((id, index) => {
            const item = itemsById[id];
            return (
              <QueueRow
                key={item.id}
                item={item}
                busy={busy}
                canSteer={canSteer}
                finish={() => {
                  if (order.some((entryId, position) => entryId !== items[position]?.id)) {
                    void persist(order);
                  }
                }}
                move={(direction) => {
                  const target = index + direction;
                  if (target < 0 || target >= order.length) {
                    return;
                  }
                  const next = [...order];
                  [next[index], next[target]] = [next[target], next[index]];
                  setOrder(next);
                  void persist(next);
                }}
                save={(text) => onEdit(item.id, text)}
                remove={() => onRemove(item.id)}
                steer={() => onSteer(item.id)}
              />
            );
          })}
        </Reorder.Group>
      </ScrollArea>
    </div>
  );
}
