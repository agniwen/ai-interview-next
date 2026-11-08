import { useIsSpeaking } from "@livekit/components-react";
import type { Participant } from "livekit-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages";
import type { HumanMeeting } from "./client";

export function ParticipantAvatar({
  name,
  image,
  className,
}: {
  name: string;
  image?: string | null;
  className?: string;
}) {
  return (
    <Avatar className={className}>
      <AvatarImage src={image ?? undefined} alt="" />
      <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
    </Avatar>
  );
}

function ParticipantItem({
  participant,
  image,
}: {
  participant: Participant;
  image?: string | null;
}) {
  const speaking = useIsSpeaking(participant);
  const name = participant.name || m.meeting_interviewer();
  return (
    <li
      title={`${name}${participant.isLocal ? ` (${m.meeting_you()})` : ""}`}
      className="relative flex w-9 shrink-0 flex-col items-center pb-1"
      data-speaking={speaking}
    >
      <ParticipantAvatar
        name={name}
        image={image}
        className={cn(
          "size-7 ring-2 transition-shadow",
          speaking ? "ring-success-foreground" : "ring-background",
        )}
      />
      <Badge
        variant="outline"
        className="absolute bottom-0 block h-3 max-w-full truncate rounded-sm bg-background px-0.5 text-[8px] leading-[10px]"
      >
        {name}
      </Badge>
    </li>
  );
}

export function MeetingParticipants({
  participants,
  people,
}: {
  participants: Participant[];
  people: HumanMeeting["materials"]["people"];
}) {
  return (
    <ul aria-label={m.meeting_participants()} className="flex items-center gap-1">
      {[
        ...participants.filter((person) => person.attributes.role === "candidate"),
        ...participants.filter((person) => person.attributes.role !== "candidate"),
      ].map((participant) => (
        <ParticipantItem
          key={participant.identity}
          participant={participant}
          image={people.find((person) => person.identity === participant.identity)?.image}
        />
      ))}
    </ul>
  );
}
