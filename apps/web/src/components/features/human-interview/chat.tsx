import { useEffect, useRef, useState } from "react";
import { useChat } from "@livekit/components-react";
import { IconSend } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MeetingPanel } from "./panel";
import * as m from "@/paraglide/messages";

export function MeetingChat({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { chatMessages, send, isSending } = useChat();
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open && chatMessages.length && viewport.current) {
      viewport.current.scrollTop = viewport.current.scrollHeight;
    }
  }, [open, chatMessages.length]);
  return (
    <MeetingPanel open={open} onClose={onClose} title={m.meeting_chat()}>
      <ScrollArea className="min-h-0 flex-1" overscrollContain viewportProps={{ ref: viewport }}>
        <div className="px-4 py-4" role="log" aria-label={m.meeting_chat()}>
          <p className="mb-5 text-xs leading-5 text-muted-foreground">{m.meeting_chat_help()}</p>
          {!chatMessages.length && (
            <p className="text-sm text-muted-foreground">{m.meeting_chat_empty()}</p>
          )}
          {chatMessages.map((item) => (
            <div key={item.id} className="mb-4">
              <p className="mb-1 text-xs text-muted-foreground">
                {item.from?.name} ·{" "}
                {new Date(item.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p className="whitespace-pre-wrap wrap-anywhere text-sm leading-6">{item.message}</p>
            </div>
          ))}
        </div>
      </ScrollArea>
      <form
        className="flex flex-col gap-2 border-t p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await send(message.trim());
            setMessage("");
            setError(false);
          } catch {
            setError(true);
          }
        }}
      >
        <Textarea
          aria-label={m.meeting_chat_placeholder()}
          placeholder={m.meeting_chat_placeholder()}
          value={message}
          maxLength={4000}
          onChange={(event) => setMessage(event.target.value)}
          rows={2}
        />
        {error && (
          <p role="alert" className="text-xs text-destructive-foreground">
            {m.ats_error()}
          </p>
        )}
        <Button
          type="submit"
          variant="outline"
          className="self-end"
          disabled={!message.trim()}
          loading={isSending}
        >
          <IconSend />
          {m.meeting_send()}
        </Button>
      </form>
    </MeetingPanel>
  );
}
