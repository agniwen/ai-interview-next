import { IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { SortableItem, SortableList } from "../question-sets/sortable-list";
import * as m from "@/paraglide/messages";
import { ChoicePicker } from "./choice-picker";
import type { Choice } from "./client";

/**
 * 轮次的题套多选与排序区域，顺序由父表单保存，绑定题目后可切换为锁定展示。
 * Round question-set selection and ordering; the parent form stores order and can lock the view after questions bind.
 */
export function SetSelection({
  id,
  kind,
  workspaceId,
  value,
  onChange,
  disabled,
}: {
  id: string;
  kind: "form" | "conversation";
  workspaceId: string;
  value: Choice[];
  onChange: (value: Choice[]) => void;
  disabled: boolean;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>
        {kind === "form" ? m.question_sets_form() : m.question_sets_conversation()}
      </FieldLabel>
      <ChoicePicker
        key={value.map((row) => row.id).join(":")}
        id={id}
        workspaceId={workspaceId}
        kind={kind}
        disabled={disabled}
        value={null}
        excluded={value.map((row) => row.id)}
        onChange={(choice) => {
          if (choice) {
            onChange([...value, choice]);
          }
        }}
      />
      <SortableList items={value.map((row) => ({ ...row, key: row.id }))} onChange={onChange}>
        <div className="flex flex-col gap-2">
          {value.map((row, index) => (
            <SortableItem
              key={row.id}
              id={row.id}
              index={index}
              label={row.name}
              disabled={disabled}
            >
              {(handle) => (
                <div className="flex min-w-0 items-center gap-2 p-2">
                  {handle}
                  <span className="min-w-0 flex-1 truncate">{row.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {m.question_sets_question_count({ count: row.questionCount ?? 0 })}
                  </span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`${m.interviews_remove()} ${row.name}`}
                    disabled={disabled}
                    onClick={() => onChange(value.filter((item) => item.id !== row.id))}
                  >
                    <IconX />
                  </Button>
                </div>
              )}
            </SortableItem>
          ))}
        </div>
      </SortableList>
    </Field>
  );
}
