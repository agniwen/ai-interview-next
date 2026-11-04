import { IconArrowUp, IconPlayerStopFilled } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Composer,
  ComposerActionGroup,
  ComposerActions,
  ComposerInput,
  ComposerSubmit,
} from "@/components/ui/composer";
import type { ComposerValue } from "@/components/ui/composer";

export function PromptInput({
  value,
  onValueChange,
  onSubmit,
  placeholder,
  label,
  sendLabel,
  stopLabel,
  running = false,
  disabled = false,
  onStop,
  actions,
}: {
  value: ComposerValue;
  onValueChange: (value: ComposerValue) => void;
  onSubmit: (value: ComposerValue) => void;
  placeholder: string;
  label: string;
  sendLabel: string;
  stopLabel: string;
  running?: boolean;
  disabled?: boolean;
  onStop: () => void;
  actions?: ReactNode;
}) {
  return (
    <Composer
      disabled={disabled}
      onSubmit={onSubmit}
      onValueChange={onValueChange}
      submitOnEnter="desktop"
      value={value}
    >
      <ComposerInput aria-label={label} placeholder={placeholder} render={<textarea />} />
      <ComposerActions>
        <ComposerActionGroup>{actions}</ComposerActionGroup>
        <ComposerActionGroup align="end">
          {running && (
            <Button
              aria-label={stopLabel}
              disabled={disabled}
              onClick={onStop}
              size="icon"
              variant="outline"
            >
              <IconPlayerStopFilled />
            </Button>
          )}
          <ComposerSubmit render={<Button aria-label={sendLabel} size="icon" />}>
            <IconArrowUp />
          </ComposerSubmit>
        </ComposerActionGroup>
      </ComposerActions>
    </Composer>
  );
}
