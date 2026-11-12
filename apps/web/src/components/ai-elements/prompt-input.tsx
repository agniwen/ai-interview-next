import { IconArrowUp, IconPlayerStopFilled } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Composer,
  ComposerActionGroup,
  ComposerActions,
  ComposerInput,
  ComposerSubmit,
  getComposerText,
} from "@/components/ui/composer";
import type { ComposerValue } from "@/components/ui/composer";

/** 参考 Beautiful UI Prompt Bar 的紧凑布局，输入与换行测量复用本地 Composer。
 * Adapt Beautiful UI Prompt Bar’s compact layout using the local Composer for input and wrapping. */
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
  focusRequest,
  onStop,
  actions,
  children,
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
  focusRequest: number;
  onStop: () => void;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const inputRef = useRef<HTMLDivElement>(null);
  const handledFocusRequest = useRef<number>(undefined);
  useEffect(() => {
    if (!disabled && handledFocusRequest.current !== focusRequest) {
      inputRef.current?.focus({ preventScroll: true });
      handledFocusRequest.current = focusRequest;
    }
  }, [disabled, focusRequest]);

  return (
    <div className="relative">
      {children}
      <Composer
        layout={actions ? "stacked" : "adaptive"}
        className="rounded-[14px] border-border/70 bg-background p-1.5 shadow-xs/5 transition-[border-color,border-radius,box-shadow] duration-150 [--composer-padding:--spacing(2)] [--composer-max-height:100px] before:shadow-none! has-[[data-slot=composer-input]:focus-visible]:border-foreground/12 has-[[data-slot=composer-input]:focus-visible]:shadow-[0_4px_20px_-4px_rgb(0_0_0/0.06)] has-[[data-slot=composer-input]:focus-visible]:ring-0 dark:bg-muted/35"
        disabled={disabled}
        onSubmit={onSubmit}
        onValueChange={onValueChange}
        submitOnEnter="desktop"
        value={value}
      >
        <ComposerInput
          ref={inputRef}
          aria-label={label}
          className="px-2 py-1.5 [--composer-min-rows:1]"
          placeholder={placeholder}
          render={<textarea />}
        />
        <ComposerActions className="mx-0 px-0.5 pt-1">
          {actions && <ComposerActionGroup>{actions}</ComposerActionGroup>}
          <ComposerActionGroup align="end">
            {running && !getComposerText(value).trim() ? (
              <Button
                aria-label={stopLabel}
                disabled={disabled}
                onClick={onStop}
                size="icon-sm"
                className="rounded-lg shadow-none transition-[background-color,transform] enabled:active:scale-95 motion-reduce:transform-none"
                variant="outline"
              >
                <IconPlayerStopFilled />
              </Button>
            ) : (
              <ComposerSubmit
                render={
                  <Button
                    aria-label={sendLabel}
                    className="rounded-lg shadow-none transition-[background-color,transform] enabled:active:scale-95 motion-reduce:transform-none"
                    size="icon-sm"
                  />
                }
              >
                <IconArrowUp />
              </ComposerSubmit>
            )}
          </ComposerActionGroup>
        </ComposerActions>
      </Composer>
    </div>
  );
}
