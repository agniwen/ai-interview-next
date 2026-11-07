import { IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import * as m from "@/paraglide/messages";

/**
 * 题目和选项复用的删除操作区，删除标签和处理逻辑由调用方提供。
 * Shared removal actions for questions and options, with labels and handlers supplied by callers.
 */
export function ItemActions({
  label,
  canRemove = true,
  disabled,
  onRemove,
}: {
  label: string;
  canRemove?: boolean;
  disabled: boolean;
  onRemove: () => void;
}) {
  const removeLabel = m.question_sets_remove({ label });
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={removeLabel}
        render={<Button size="icon-sm" variant="ghost" disabled={disabled || !canRemove} />}
        className="text-muted-foreground hover:text-destructive-foreground"
        onClick={onRemove}
      >
        <IconTrash aria-hidden="true" />
      </TooltipTrigger>
      <TooltipPopup>{removeLabel}</TooltipPopup>
    </Tooltip>
  );
}
