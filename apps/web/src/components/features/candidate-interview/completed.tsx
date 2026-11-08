import {
  IconChevronRight,
  IconCircleCheck,
  IconMessageCircle,
  IconStar,
} from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogPopup,
  DialogPanel,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import * as m from "@/paraglide/messages";
import { candidateFeedbackMutation } from "./client";
import type { CandidateInterview } from "./client";

export function InterviewCompleted({
  token,
  interview,
}: {
  token: string;
  interview: CandidateInterview;
}) {
  const { feedback } = interview;
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(interview.feedback?.rating ?? 0);
  const [comment, setComment] = useState(interview.feedback?.comment ?? "");
  const mutation = useMutation(candidateFeedbackMutation(useQueryClient(), token));
  return (
    <div className="flex min-h-[calc(100svh-12rem)] w-full max-w-2xl flex-col text-left md:min-h-0 md:pb-16">
      <section>
        <h1 className="text-2xl tracking-tight sm:text-3xl">{m.candidate_session_completed()}</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          {m.candidate_session_completed_help()}
        </p>
      </section>
      <div className="mt-auto pt-8 md:mt-8 md:pt-0">
        <Separator />
        {feedback ? (
          <section className="mt-4 flex items-start gap-4 p-1">
            <IconCircleCheck
              aria-hidden="true"
              className="mt-1 size-5 shrink-0 text-muted-foreground"
            />
            <div className="flex min-w-0 flex-col gap-3">
              <h2 className="text-sm font-medium">{m.candidate_feedback_thanks()}</h2>
              <p className="text-sm text-muted-foreground">{m.candidate_feedback_saved()}</p>
              <p
                className="flex gap-1"
                aria-label={m.candidate_feedback_rating({ rating: feedback.rating })}
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <IconStar
                    key={value}
                    aria-hidden="true"
                    className={
                      value <= feedback.rating
                        ? "size-4 fill-warning text-warning"
                        : "size-4 text-muted-foreground"
                    }
                  />
                ))}
              </p>
              {feedback.comment && (
                <p className="whitespace-pre-wrap text-sm leading-6">{feedback.comment}</p>
              )}
            </div>
          </section>
        ) : (
          <section className="mt-4 flex flex-wrap items-start gap-4 p-1 md:flex-nowrap">
            <IconMessageCircle
              aria-hidden="true"
              className="hidden size-5 shrink-0 text-muted-foreground md:block"
            />
            <div className="order-2 flex flex-1 basis-full flex-col gap-1.5 md:order-none md:basis-auto">
              <h2 className="hidden text-sm font-medium md:block">
                {m.candidate_feedback_prompt()}
              </h2>
              <p className="text-sm text-muted-foreground">{m.candidate_feedback_help()}</p>
            </div>
            <Button
              size="lg"
              variant="secondary"
              className="order-1 w-full md:order-none md:w-auto md:self-center"
              onClick={() => setOpen(true)}
            >
              {m.candidate_feedback_open()}
              <IconChevronRight aria-hidden="true" />
            </Button>
          </section>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{m.candidate_feedback_title()}</DialogTitle>
            <DialogDescription>{m.candidate_feedback_help()}</DialogDescription>
          </DialogHeader>
          <form
            className="flex min-h-0 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate({ comment, rating, version: 1 }, { onSuccess: () => setOpen(false) });
            }}
          >
            <DialogPanel className="flex flex-col gap-6">
              <ToggleGroup
                aria-label={m.candidate_feedback_title()}
                value={rating ? [String(rating)] : []}
                onValueChange={(values) => setRating(Number(values[0] ?? 0))}
                disabled={mutation.isPending}
                className="gap-2"
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <ToggleGroupItem
                    key={value}
                    value={String(value)}
                    className="size-11"
                    aria-label={m.candidate_feedback_rating({ rating: value })}
                  >
                    <IconStar
                      className={
                        value <= rating ? "fill-warning text-warning" : "text-muted-foreground"
                      }
                    />
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <Field>
                <FieldLabel>{m.candidate_feedback_comment()}</FieldLabel>
                <Textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder={m.candidate_feedback_comment()}
                  maxLength={3000}
                  rows={6}
                  className="min-h-32 resize-y"
                />
              </Field>
              {mutation.isError && (
                <p role="alert" className="text-sm text-destructive-foreground">
                  {m.candidate_feedback_error()}
                </p>
              )}
            </DialogPanel>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" disabled={mutation.isPending} />}>
                {m.interviews_cancel()}
              </DialogClose>
              <Button type="submit" disabled={!rating} loading={mutation.isPending}>
                {m.candidate_feedback_submit()}
              </Button>
            </DialogFooter>
          </form>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
