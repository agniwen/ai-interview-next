import { pageHeaderFadeClassName } from "@/components/layout/page-header";
import { MessageResponse } from "@/components/ai-elements/message-response";
import { ScrollArea } from "@/components/ui/scroll-area";
import useEmblaCarousel from "embla-carousel-react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import {
  contentPanelClassName,
  ContentSidePanelContent,
} from "@/components/layout/content-side-panel";
import type { KeyboardEvent } from "react";
import { useEffect, useState } from "react";
import type { RecruitingCard } from "@ai-interview/agent";
import {
  IconArrowUpRight,
  IconBriefcase,
  IconChevronLeft,
  IconChevronRight,
  IconFileText,
  IconRoute,
  IconUser,
  IconX,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetHeader, SheetPopup, SheetTitle } from "@/components/ui/sheet";
import { atsStatus } from "@/components/features/ats/client";
import { LocalTime } from "@/components/local-time";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages";

const types = {
  application: { icon: IconRoute, label: m.ats_applications },
  candidate: { icon: IconUser, label: m.ats_candidate },
  job: { icon: IconBriefcase, label: m.ats_job },
  resume: { icon: IconFileText, label: m.ats_application_resume },
};

function cardTitle(card: RecruitingCard) {
  return card.title ?? types[card.kind].label();
}

function roundStatus(status: string) {
  switch (status) {
    case "scheduled": {
      return m.interviews_scheduled();
    }
    case "in_progress": {
      return m.interviews_in_progress();
    }
    case "completed": {
      return m.interviews_completed();
    }
    default: {
      return status;
    }
  }
}

function cardProgress(card: RecruitingCard) {
  if (card.kind !== "application") {
    return;
  }
  if (card.fields.status === "closed") {
    return m.ats_closed();
  }
  const round = card.interviews?.at(-1);
  if (round) {
    return `${round.label || m.interviews_round({ number: round.sequence })} · ${roundStatus(round.status)}`;
  }
  return card.fields.stage === "screening" ? m.agent_card_screening() : card.fields.stage;
}

type OpenCard = (card: RecruitingCard) => void;

function Card({ card, onOpen }: { card: RecruitingCard; onOpen?: OpenCard }) {
  const { icon: Icon, label } = types[card.kind];
  const description = [
    card.kind === "job" ? card.fields.department : null,
    card.subtitle,
    cardProgress(card),
  ]
    .filter(Boolean)
    .join(" · ");
  const requirements = card.kind === "job" ? card.fields.requirements?.trim() : undefined;
  return (
    <article
      className={cn(
        "flex min-h-36 min-w-0 flex-col justify-between gap-3 rounded-xl border bg-card p-4 shadow-xs",
        card.kind === "job" && "min-h-90",
      )}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-4" />
        {label()}
      </div>
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold">{cardTitle(card)}</h3>
        {description && <p className="truncate text-xs text-muted-foreground">{description}</p>}
      </div>
      {requirements && (
        <div inert className="max-h-54 overflow-hidden mask-b-from-70% mask-b-to-100%">
          <MessageResponse className="text-sm leading-6 text-muted-foreground [&_li]:my-0 [&_p]:my-0 [&_ul]:my-0 [&_ol]:my-0">
            {requirements}
          </MessageResponse>
        </div>
      )}
      <Button
        size="xs"
        variant="outline"
        className={cn("self-start", !onOpen && "invisible")}
        onClick={() => onOpen?.(card)}
      >
        {requirements ? m.agent_card_more() : m.agent_card_view()}
        <IconArrowUpRight />
      </Button>
    </article>
  );
}

function Carousel({ cards, onOpen }: { cards: RecruitingCard[]; onOpen: OpenCard }) {
  const [selected, setSelected] = useState(0);
  const reducedMotion = useReducedMotion();
  const [viewportRef, embla] = useEmblaCarousel({
    align: "center",
    containScroll: false,
    duration: 32,
    loop: true,
  });
  // 两张卡不足以同时显示前后邻卡，重复一组让 Embla 能连续循环。
  // Repeat a two-card set so Embla can loop with a neighbour on both sides.
  const slides = cards.length === 2 ? [...cards, ...cards] : cards;

  useEffect(() => {
    if (!embla) {
      return;
    }
    const onSelect = () => setSelected(embla.selectedScrollSnap());
    onSelect();
    embla.on("select", onSelect);
    embla.on("reInit", onSelect);
    return () => {
      embla.off("select", onSelect);
      embla.off("reInit", onSelect);
    };
  }, [embla]);

  function move(direction: "previous" | "next") {
    if (direction === "previous") {
      embla?.scrollPrev(Boolean(reducedMotion));
    } else {
      embla?.scrollNext(Boolean(reducedMotion));
    }
  }

  function onArrowKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    move(event.key === "ArrowLeft" ? "previous" : "next");
  }

  return (
    <section aria-label={types[cards[0].kind].label()} className="space-y-2">
      <div ref={viewportRef} className="overflow-hidden py-2 perspective-[900px]">
        <div className="-ml-3 flex touch-pan-y">
          {slides.map((card, index) => {
            const active = index === selected;
            const previous = (selected + slides.length - 1) % slides.length === index;
            return (
              <div key={`${card.id}:${index}`} className="relative min-w-0 flex-[0_0_76%] pl-3">
                <div
                  aria-hidden={!active}
                  inert={!active}
                  className={cn(
                    "transition-[transform,opacity] duration-300 motion-reduce:transform-none motion-reduce:transition-none",
                    !active && "scale-95 opacity-70",
                    !active && (previous ? "origin-right rotate-y-18" : "origin-left -rotate-y-18"),
                  )}
                >
                  <Card card={card} onOpen={active ? onOpen : undefined} />
                </div>
                {!active && (
                  <button
                    aria-label={cardTitle(card)}
                    className="absolute inset-y-0 right-0 left-3 cursor-pointer rounded-xl"
                    onClick={() => embla?.scrollTo(index, Boolean(reducedMotion))}
                    tabIndex={-1}
                    type="button"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-center gap-2">
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={m.agent_card_previous()}
          onClick={() => move("previous")}
          onKeyDown={onArrowKey}
        >
          <IconChevronLeft />
        </Button>
        <output
          aria-live="polite"
          className="min-w-10 text-center text-xs tabular-nums text-muted-foreground"
        >
          {(selected % cards.length) + 1} / {cards.length}
        </output>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={m.agent_card_next()}
          onClick={() => move("next")}
          onKeyDown={onArrowKey}
        >
          <IconChevronRight />
        </Button>
      </div>
    </section>
  );
}

export function RecruitingCards({ cards, onOpen }: { cards: RecruitingCard[]; onOpen: OpenCard }) {
  return (
    <div className="space-y-4">
      {Object.keys(types).map((kind) => {
        const group = cards.filter((card) => card.kind === kind);
        if (group.length === 1) {
          return <Card key={kind} card={group[0]} onOpen={onOpen} />;
        }
        return group.length > 1 && <Carousel key={kind} cards={group} onOpen={onOpen} />;
      })}
    </div>
  );
}

const fieldLabels = {
  department: m.ats_department,
  education: m.agent_card_education,
  email: m.agent_card_email,
  employer: m.ats_employer,
  experience: m.agent_card_experience,
  filename: m.agent_card_file,
  internalCriteria: m.ats_internal_criteria,
  phone: m.agent_card_phone,
  project: m.ats_project,
  requirements: m.ats_requirements,
  stage: m.agent_card_stage,
  status: m.ats_status,
};

function Details({ card }: { card: RecruitingCard }) {
  const reduceMotion = useReducedMotion();
  return (
    <ScrollArea className="-mt-12 min-h-0 flex-1" fill overscrollContain>
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
        className="space-y-6 px-5 pt-19 pb-5"
      >
        <p className="text-xs text-muted-foreground">{m.agent_card_snapshot()}</p>
        <dl className="space-y-4">
          {Object.entries(fieldLabels).map(([key, label]) => {
            const field = key as keyof RecruitingCard["fields"];
            let value = card.fields[field];
            if (field === "stage") {
              value = cardProgress(card);
            } else if (field === "status") {
              value = card.kind === "resume" && value ? atsStatus(value) : undefined;
            }
            return (
              value && (
                <div key={key}>
                  <dt className="text-xs text-muted-foreground">{label()}</dt>
                  <dd className="mt-1 text-sm wrap-anywhere whitespace-pre-wrap">
                    {field === "requirements" || field === "internalCriteria" ? (
                      <MessageResponse className="whitespace-normal">{value}</MessageResponse>
                    ) : (
                      value
                    )}
                  </dd>
                </div>
              )
            );
          })}
        </dl>
        {card.interviews && (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">{m.agent_card_interviews()}</h3>
            {card.interviews.length === 0 && (
              <p className="text-sm text-muted-foreground">{m.interviews_empty()}</p>
            )}
            {card.interviews.map((round) => (
              <div key={round.sequence} className="rounded-lg border p-3 text-sm">
                <p>{round.label || m.interviews_round({ number: round.sequence })}</p>
                <p className="text-xs text-muted-foreground">{roundStatus(round.status)}</p>
                {round.scheduledAt && (
                  <LocalTime value={round.scheduledAt} className="text-xs text-muted-foreground" />
                )}
              </div>
            ))}
          </section>
        )}
      </motion.div>
    </ScrollArea>
  );
}

function DetailHeading({ card, mobile = false }: { card: RecruitingCard; mobile?: boolean }) {
  const Title = mobile ? SheetTitle : "h2";
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
        {types[card.kind].label()}
      </span>
      <Title className="min-w-0 truncate text-base font-semibold" title={cardTitle(card)}>
        {cardTitle(card)}
      </Title>
    </div>
  );
}

function MobileDetails({
  card,
  onClose,
  selection,
}: {
  card?: RecruitingCard;
  onClose: () => void;
  selection: number;
}) {
  const [lastCard, setLastCard] = useState(card);
  if (card && card !== lastCard) {
    setLastCard(card);
  }
  const detail = card ?? lastCard;
  const reduceMotion = useReducedMotion();
  return (
    <Sheet
      open={Boolean(card)}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <SheetPopup
        closeProps={{ "aria-label": m.agent_card_close(), className: "absolute end-2 top-2 z-20" }}
        className={cn(reduceMotion && "transition-none")}
      >
        {detail && (
          <>
            <SheetHeader
              className={cn(
                pageHeaderFadeClassName,
                "relative h-12 shrink-0 justify-center py-0! pr-12 pl-4",
              )}
            >
              <DetailHeading card={detail} mobile />
            </SheetHeader>
            <Details key={`${detail.kind}:${detail.id}:${selection}`} card={detail} />
          </>
        )}
      </SheetPopup>
    </Sheet>
  );
}

function DesktopDetails({
  card,
  onClose,
  selection,
}: {
  card: RecruitingCard;
  onClose: () => void;
  selection: number;
}) {
  const present = useIsPresent();
  const reduceMotion = useReducedMotion();
  const wide = useMediaQuery("2xl");
  const width = wide ? "26.5rem" : "24.5rem";

  return (
    <motion.div
      initial={{ width: "0rem" }}
      animate={{ width }}
      exit={{ width: "0rem" }}
      transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="my-2 shrink-0 overflow-clip [overflow-clip-margin:2px]"
      inert={!present}
    >
      <motion.aside
        aria-label={m.agent_card_view()}
        initial={reduceMotion ? false : { opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0, x: 12 }}
        transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
        className={cn(contentPanelClassName, "me-2 flex h-full w-96 flex-col 2xl:w-[26rem]")}
      >
        <header
          className={cn(
            pageHeaderFadeClassName,
            "relative flex h-12 shrink-0 items-center justify-between gap-3 px-4",
          )}
        >
          <DetailHeading card={card} />
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={m.agent_card_close()}
            onClick={onClose}
          >
            <IconX />
          </Button>
        </header>
        <Details key={`${card.kind}:${card.id}:${selection}`} card={card} />
      </motion.aside>
    </motion.div>
  );
}

export function RecruitingDetailsPanel({
  card,
  onClose,
  selection,
}: {
  card?: RecruitingCard;
  onClose: () => void;
  selection: number;
}) {
  const split = useMediaQuery("xl");
  if (!split) {
    return <MobileDetails card={card} onClose={onClose} selection={selection} />;
  }
  return (
    <ContentSidePanelContent>
      <AnimatePresence>
        {card && (
          <DesktopDetails key="desktop" card={card} onClose={onClose} selection={selection} />
        )}
      </AnimatePresence>
    </ContentSidePanelContent>
  );
}
