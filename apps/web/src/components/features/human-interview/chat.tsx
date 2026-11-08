import { useState } from "react";
import { useChat } from "@livekit/components-react";
import { IconX, IconSend } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages";

export function MeetingChat({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { chatMessages, send, isSending } = useChat();
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  return (
    <aside
      hidden={!open}
      className={cn(
        "flex w-80 shrink-0 flex-col border-l bg-background max-md:absolute max-md:inset-0 max-md:z-30 max-md:w-full",
        !open && "hidden",
      )}
    >
      <header className="flex items-center justify-between border-b px-4 py-2">
        <h2 className="text-sm font-medium">{m.meeting_chat()}</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={m.meeting_close_panel()}
          onClick={onClose}
        >
          <IconX />
        </Button>
      </header>
      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        role="log"
        aria-label={m.meeting_chat()}
      >
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
      <form
        className="flex flex-col gap-2 border-t p-3"
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
    </aside>
  );
}
