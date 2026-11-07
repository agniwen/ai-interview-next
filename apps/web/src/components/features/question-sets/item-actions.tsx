import { IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import * as m from "@/paraglide/messages";

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
