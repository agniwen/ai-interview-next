import { Field, FieldLabel } from "@/components/ui/field";
import * as m from "@/paraglide/messages";
import { ChoicePicker } from "./choice-picker";
import type { Choice } from "./client";

/**
 * 在多选输入框内展示轮次已选题套，按选择顺序保存，绑定题目后锁定编辑。
 * Displays selected round question sets inside a multi-select input, preserving selection order and locking edits after questions bind.
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
        multiple
        id={id}
        workspaceId={workspaceId}
        kind={kind}
        disabled={disabled}
        value={value}
        onChange={onChange}
      />
    </Field>
  );
}
