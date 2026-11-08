import type { TrackReferenceOrPlaceholder } from "@livekit/components-react";
import { Track } from "livekit-client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { HumanMeeting } from "./client";
import { MeetingMaterials } from "./materials";
import { MeetingTile, trackKey } from "./tiles";

export function MeetingView({
  materials,
  tracks,
  focused,
  onFocus,
  onReset,
}: {
  materials?: HumanMeeting["materials"];
  tracks: TrackReferenceOrPlaceholder[];
  focused: string | null;
  onFocus: (key: string) => void;
  onReset: () => void;
}) {
  if (materials) {
    return <MeetingMaterials materials={materials} />;
  }
  const selected = tracks.find((track) => trackKey(track) === focused);
  const main = selected ?? tracks.find((track) => track.source === Track.Source.ScreenShare);
  if (main) {
    const others = tracks.filter((track) => track !== main);
    return (
      <div
        className={cn(
          "grid min-h-0 flex-1 gap-1.5 px-1.5 pb-1.5",
          others.length
            ? "grid-rows-[minmax(0,1fr)_8rem] md:grid-cols-[minmax(0,1fr)_clamp(9rem,18vw,13rem)] md:grid-rows-1"
            : "grid-cols-1",
        )}
      >
        <MeetingTile track={main} onReset={selected ? onReset : undefined} />
        {others.length > 0 && (
          <ScrollArea overscrollContain>
            <aside className="grid auto-cols-[12rem] grid-flow-col gap-1.5 md:auto-cols-auto md:auto-rows-[8rem] md:grid-flow-row md:content-start">
              {others.map((track) => (
                <MeetingTile
                  key={trackKey(track)}
                  track={track}
                  onFocus={() => onFocus(trackKey(track))}
                />
              ))}
            </aside>
          </ScrollArea>
        )}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "grid min-h-0 flex-1 auto-rows-fr gap-1.5 overflow-hidden px-1.5 pb-1.5",
        tracks.length > 1 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1",
        tracks.length > 4 && "xl:grid-cols-3",
      )}
    >
      {tracks.map((track) => (
        <MeetingTile key={trackKey(track)} track={track} onFocus={() => onFocus(trackKey(track))} />
      ))}
    </div>
  );
}
