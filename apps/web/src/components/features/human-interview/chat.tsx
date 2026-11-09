import { useEffect, useId, useRef, useState } from "react";
import { useChat } from "@livekit/components-react";
import { IconSend } from "@tabler/icons-react";
import { LocalTime } from "@/components/local-time";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages";
import { MeetingPanel } from "./panel";

export function MeetingChat({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { chatMessages, send, isSending } = useChat();
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const helpId = useId();
  const latestId = chatMessages.at(-1)?.id;
  const text = message.trim();
  const canSend = Boolean(text) && !isSending;

  useEffect(() => {
    if (open && latestId && viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight });
    }
  }, [open, latestId, viewport]);

  return (
    <MeetingPanel open={open} onClose={onClose} title={m.meeting_chat()} initialFocus={textarea}>
      <div className="relative flex min-h-0 flex-1">
        <ScrollArea
          className="touch-auto"
          overscrollContain
          scrollFade
          viewportProps={{ ref: setViewport }}
        >
          <div
            className="flex min-w-0 flex-col gap-4 px-4 py-2"
            role="log"
            aria-label={m.meeting_chat()}
          >
            {chatMessages.map((item) => {
              const local = item.from?.isLocal;
              return (
                <Bubble
                  key={item.id}
                  align={local ? "end" : "start"}
                  variant={local ? "secondary" : "muted"}
                  className="max-w-[85%]"
                >
                  <div
                    className={cn(
                      "flex min-w-0 items-baseline gap-2 text-xs text-muted-foreground",
                      local && "justify-end",
                    )}
                  >
                    <span className="truncate">
                      {local ? m.meeting_you() : item.from?.name || item.from?.identity}
                    </span>
                    <LocalTime className="shrink-0" format="time" value={item.timestamp} />
                  </div>
                  <BubbleContent className="whitespace-pre-wrap wrap-anywhere">
                    {item.message}
                  </BubbleContent>
                </Bubble>
              );
            })}
          </div>
        </ScrollArea>
        {chatMessages.length === 0 && (
          <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted-foreground">
            {m.meeting_chat_empty()}
          </p>
        )}
      </div>
      <div className="shrink-0 p-3">
        <p className="sr-only" id={helpId}>
          {m.meeting_chat_help()}
        </p>
        {error && (
          <p role="alert" className="mb-2 text-xs text-destructive-foreground">
            {m.ats_error()}
          </p>
        )}
        <form
          className="flex items-end gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await send(text);
              setMessage((current) => (current === message ? "" : current));
              setError(false);
            } catch {
              setError(true);
            }
          }}
        >
          <Textarea
            aria-describedby={helpId}
            aria-label={m.meeting_chat_placeholder()}
            className="min-w-0 flex-1 has-focus-visible:ring-2 has-focus-visible:ring-ring/16 [&>textarea]:max-h-32 [&>textarea]:min-h-8.5 [&>textarea]:resize-none [&>textarea]:py-[calc(--spacing(2)-1px)] [&>textarea]:leading-5"
            maxLength={4000}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                if (canSend) {
                  event.currentTarget.form?.requestSubmit();
                }
              }
            }}
            placeholder={m.meeting_chat_placeholder()}
            ref={textarea}
            rows={1}
            value={message}
          />
          <Button
            aria-label={m.meeting_send()}
            className="sm:size-9"
            disabled={!canSend}
            loading={isSending}
            size="icon"
            type="submit"
            variant="secondary"
          >
            <IconSend aria-hidden="true" />
          </Button>
        </form>
      </div>
    </MeetingPanel>
  );
}
