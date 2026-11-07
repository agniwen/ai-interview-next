import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toastManager } from "@/components/ui/toast";
import * as m from "@/paraglide/messages";

/**
 * 失焦或回车提交的设置输入框，维护本地草稿、保存进度和错误反馈。
 * Settings input saving on blur or Enter, with local draft, pending and error state.
 */
export function AutoSaveInput({
  id,
  label,
  value,
  onSave,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  onSave: (value: string) => Promise<unknown>;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(value);
  const mutation = useMutation({
    mutationFn: onSave,
    onError: (_error, next) => {
      toastManager.add({
        actionProps: {
          children: m.settings_retry(),
          onClick: () => mutation.mutate(next),
        },
        title: m.settings_save_failed(),
        type: "error",
      });
    },
    onSuccess: (_result, next) => {
      setSaved(next);
      toastManager.add({ title: m.settings_saved(), type: "success" });
    },
  });
  const empty = draft.trim().length === 0;

  function save() {
    const next = draft.trim();
    setDraft(next);
    if (next && next !== saved) {
      mutation.mutate(next);
    }
  }

  return (
    <Field
      className="w-full min-w-0 sm:w-72"
      invalid={empty || mutation.isError}
      disabled={disabled || mutation.isPending}
    >
      <FieldLabel className="sr-only" htmlFor={id}>
        {label}
      </FieldLabel>
      <Input
        id={id}
        value={draft}
        disabled={disabled || mutation.isPending}
        aria-invalid={empty || mutation.isError}
        aria-busy={mutation.isPending}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        required
      />
      {empty && (
        <span className="text-xs text-destructive-foreground" role="alert">
          {m.settings_name_required()}
        </span>
      )}
    </Field>
  );
}
