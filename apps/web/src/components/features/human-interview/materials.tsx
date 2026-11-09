import { MeetingHistory } from "./history";
import * as m from "@/paraglide/messages";
import type { HumanMeeting } from "./client";
import { MeetingResume } from "./resume";

export function MeetingCandidateMaterials({
  materials,
  resumeEvaluation,
  showTimeline,
}: {
  materials: Pick<HumanMeeting["materials"], "history" | "resumes">;
  resumeEvaluation?: HumanMeeting["materials"]["resumeEvaluation"];
  showTimeline?: boolean;
}) {
  return (
    <MeetingHistory
      history={materials.history}
      resumeEvaluation={resumeEvaluation}
      showTimeline={showTimeline}
    >
      <div className="flex flex-col gap-4 pb-6">
        {materials.resumes.length === 0 && (
          <p className="text-sm text-muted-foreground">{m.meeting_no_resume()}</p>
        )}
        {materials.resumes.map((resume) => (
          <MeetingResume key={resume.id} filename={resume.filename} url={resume.documentUrl} />
        ))}
      </div>
    </MeetingHistory>
  );
}
