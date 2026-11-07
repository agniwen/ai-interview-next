import { memo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { IconArrowDown } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { CodeBlockCopyButton } from "@/components/ui/code-block";
import { toastManager } from "@/components/ui/toast";
import type { ChatSnapshot } from "@ai-interview/agent";
import { Message, MessageContent } from "@/components/ui/message";
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  useMessageScroller,
  useMessageScrollerScrollable,
} from "@/components/ui/message-scroller";
import { ScrollAreaPrimitive, ScrollBar } from "@/components/ui/scroll-area";
import { MessageResponse } from "@/components/ai-elements/message-response";
import { Reasoning } from "@/components/ai-elements/reasoning";
import { Trace } from "@/components/ui/trace";
import { Spinner } from "@/components/ui/spinner";
import * as m from "@/paraglide/messages";

function TranscriptMessageContent({
  message,
  streaming,
}: {
  message: ChatSnapshot["messages"][number];
  streaming: boolean;
}) {
  return (
    <MessageScrollerItem messageId={message.id} key={message.id}>
      <Message align={message.role === "user" ? "end" : "start"}>
        <MessageContent className="gap-1">
          {message.role === "user" ? (
            <div className="max-w-[88%] self-end rounded-2xl bg-muted/65 px-3.5 py-2 sm:max-w-[75%]">
              <p className="whitespace-pre-wrap text-sm leading-6 wrap-anywhere">{message.text}</p>
            </div>
          ) : (
            <div className="min-w-0 space-y-3 px-1">
              {message.reasoning && (
                <Trace>
                  <Reasoning title={m.agent_reasoning()} streaming={streaming && !message.text}>
                    <MessageResponse
                      streaming={streaming && !message.text}
                      className="text-inherit"
                    >
                      {message.reasoning}
                    </MessageResponse>
                  </Reasoning>
                </Trace>
              )}
              <MessageResponse streaming={streaming}>{message.text}</MessageResponse>
              {message.interrupted && (
                <p className="text-xs text-muted-foreground">{m.agent_interrupted()}</p>
              )}
            </div>
          )}
          {message.text && !message.id.startsWith("live-") && (
            <div className={message.role === "user" ? "flex h-7 justify-end" : "flex h-7"}>
              <CodeBlockCopyButton
                value={message.text}
                copyLabel={m.agent_copy()}
                copiedLabel={m.agent_copied()}
                variant="ghost"
                size="icon-xs"
                className="rounded-md text-muted-foreground opacity-0 transition-opacity group-hover/message:opacity-100 group-focus-within/message:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
                onCopyError={() => toastManager.add({ title: m.agent_error(), type: "error" })}
              />
            </div>
          )}
        </MessageContent>
      </Message>
    </MessageScrollerItem>
  );
}

const TranscriptMessage = memo(TranscriptMessageContent);

const floatingControlClass =
  "flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-popover/85 text-xs text-muted-foreground shadow-xs/5 backdrop-blur-sm transition-colors hover:bg-popover hover:text-foreground";

function TranscriptControls({ status }: { status: ChatSnapshot["status"] }) {
  const { end } = useMessageScrollerScrollable();
  const { scrollToEnd } = useMessageScroller();
  const reduceMotion = useReducedMotion();
  const responding = status === "running" || status === "stopping";
  const transition = { duration: reduceMotion ? 0 : 0.18 };

  return (
    <div
      data-slot="agent-floating-controls"
      className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4"
    >
      {/* 同一行按宽度进出，剩余控件自然居中，不因流式内容变化移动。
          Animate widths in one row so remaining controls recenter independently of streamed content. */}
      <AnimatePresence initial={false}>
        {responding && (
          <motion.div
            key="status"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={transition}
            className="overflow-hidden py-1"
          >
            <output
              data-slot="agent-response-status"
              className={`${floatingControlClass} pointer-events-auto mx-1 whitespace-nowrap px-2.5`}
            >
              <Spinner className="size-3 shrink-0" />
              {status === "stopping" ? m.agent_stopping() : m.agent_running()}
            </output>
          </motion.div>
        )}
        {end && (
          <motion.div
            key="jump"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={transition}
            className="overflow-hidden py-1"
          >
            <Button
              data-slot="message-scroller-button"
              aria-label={m.agent_latest()}
              variant="ghost"
              size="icon-sm"
              className={`${floatingControlClass} pointer-events-auto mx-1 w-8 sm:h-8 sm:w-8`}
              onClick={() => scrollToEnd({ behavior: reduceMotion ? "auto" : "smooth" })}
            >
              <IconArrowDown />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TranscriptContent({ snapshot }: { snapshot: ChatSnapshot }) {
  const responding = snapshot.status === "running" || snapshot.status === "stopping";
  return (
    <MessageScrollerProvider autoScroll scrollEdgeThreshold={64}>
      <ScrollAreaPrimitive.Root render={<MessageScroller />} className="min-h-0 flex-1">
        <ScrollAreaPrimitive.Viewport
          render={<MessageScrollerViewport />}
          aria-label={m.agent_chats()}
          className="outline-none focus-visible:ring-0 [scrollbar-width:none]"
        >
          <ScrollAreaPrimitive.Content className="min-h-full" style={{ minWidth: 0 }}>
            <MessageScrollerContent
              className={`mx-auto w-full max-w-3xl gap-5 px-4 pt-18 md:px-6 ${responding ? "pb-14" : "pb-3"}`}
            >
              {snapshot.messages.map((message) => (
                <TranscriptMessage
                  message={message}
                  key={message.id}
                  streaming={
                    message.id.startsWith("live-") &&
                    (snapshot.status === "running" || snapshot.status === "stopping")
                  }
                />
              ))}
            </MessageScrollerContent>
          </ScrollAreaPrimitive.Content>
        </ScrollAreaPrimitive.Viewport>
        <ScrollBar />
        <TranscriptControls status={snapshot.status} />
      </ScrollAreaPrimitive.Root>
    </MessageScrollerProvider>
  );
}

/**
 * 根据会话快照渲染消息、推理及工具调用，并通过共用消息滚动组件处理跟随与跳到底部。
 * Renders messages, reasoning and tool calls from a session snapshot, using shared scrolling primitives for following and jumping to the end.
 */
export const Transcript = memo(TranscriptContent);
