import type { TrackReferenceOrPlaceholder } from "@livekit/components-react";
import { Track } from "livekit-client";
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
    return (
      <>
        <MeetingMaterials materials={materials} />
        <div className="absolute right-3 bottom-3 flex max-w-[calc(100%-1.5rem)] gap-2 overflow-x-auto rounded-lg border bg-background p-1.5 shadow-lg">
          {tracks
            .filter((track) => track.source === Track.Source.Camera)
            .map((track) => (
              <div key={trackKey(track)} className="h-28 w-40 shrink-0">
                <MeetingTile track={track} onFocus={() => onFocus(trackKey(track))} />
              </div>
            ))}
        </div>
      </>
    );
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
          <aside className="grid min-h-0 auto-cols-[12rem] grid-flow-col gap-1.5 overflow-auto md:auto-cols-auto md:auto-rows-[8rem] md:grid-flow-row md:content-start">
            {others.map((track) => (
              <MeetingTile
                key={trackKey(track)}
                track={track}
                onFocus={() => onFocus(trackKey(track))}
              />
            ))}
          </aside>
        )}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "grid min-h-0 flex-1 auto-rows-fr gap-1.5 overflow-auto px-1.5 pb-1.5",
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
