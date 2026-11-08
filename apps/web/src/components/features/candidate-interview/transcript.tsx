import { orderSessionMessages } from "./transcript-order";
import type { AgentState, ReceivedMessage } from "@livekit/components-react";
import { MessageResponse } from "@/components/ai-elements/message-response";
import { Message, MessageContent } from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Card } from "@/components/ui/card";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import * as m from "@/paraglide/messages";

export function InterviewTranscript({
  messages,
  state,
}: {
  messages: ReceivedMessage[];
  state: AgentState;
}) {
  return (
    <MessageScrollerProvider autoScroll scrollEdgeThreshold={64}>
      <MessageScroller className="text-left">
        <MessageScrollerViewport
          role="log"
          aria-label={m.candidate_session_transcript()}
          scrollFade
          className="[--fade-size:2rem]"
        >
          <MessageScrollerContent className="gap-8 px-4 py-5 md:px-6">
            {orderSessionMessages(messages, { includeChatMessages: false }).map((message) => (
              <MessageScrollerItem messageId={message.id} key={message.id}>
                <Message
                  align={message.type === "userTranscript" ? "end" : "start"}
                  title={new Date(message.timestamp).toLocaleTimeString()}
                >
                  <MessageContent>
                    <span className="sr-only">
                      {message.type === "userTranscript"
                        ? m.candidate_session_you()
                        : m.candidate_session_interviewer()}
                    </span>
                    {message.type === "userTranscript" ? (
                      <Bubble align="end" variant="outline" className="max-w-[88%]">
                        <Card className="rounded-xl px-3 py-2 before:rounded-[calc(var(--radius-xl)-1px)]">
                          <MessageResponse>{message.message}</MessageResponse>
                        </Card>
                      </Bubble>
                    ) : (
                      <Bubble variant="ghost" className="w-full">
                        <BubbleContent className="w-full">
                          <MessageResponse>{message.message}</MessageResponse>
                        </BubbleContent>
                      </Bubble>
                    )}
                  </MessageContent>
                </Message>
              </MessageScrollerItem>
            ))}
            {state === "thinking" && (
              <MessageScrollerItem messageId="thinking">
                <output
                  aria-label={m.candidate_session_thinking()}
                  className="flex h-7 items-center gap-1.5 text-muted-foreground"
                >
                  {[0, 1, 2].map((index) => (
                    <span
                      key={index}
                      aria-hidden="true"
                      className="size-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none"
                      style={{ animationDelay: `${index * 150}ms` }}
                    />
                  ))}
                </output>
              </MessageScrollerItem>
            )}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton label={m.candidate_latest_message()} />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
