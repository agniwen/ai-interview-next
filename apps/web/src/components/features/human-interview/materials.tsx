import { MeetingMarkdown } from "./markdown";
import { useState } from "react";
import { ResumeProfileDocument } from "@/components/features/document-preview/resume-profile-document";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MeetingHistory } from "./history";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import * as m from "@/paraglide/messages";
import type { HumanMeeting } from "./client";
import { MeetingResume } from "./resume";

export function MeetingMaterials({ materials }: { materials: HumanMeeting["materials"] }) {
  const [tab, setTab] = useState("candidate");
  return (
    <Tabs value={tab} onValueChange={setTab} className="flex h-full min-h-0 flex-col gap-0">
      <div className="shrink-0 border-b px-4">
        <TabsList variant="underline">
          <TabsTab value="candidate">{m.meeting_materials()}</TabsTab>
          <TabsTab value="job">{m.meeting_job()}</TabsTab>
          <TabsTab value="criteria">{m.meeting_criteria()}</TabsTab>
        </TabsList>
      </div>
      <ScrollArea className="min-h-0 flex-1" overscrollContain>
        <div className="p-4 md:px-8 md:py-6">
          <TabsPanel value="candidate" className="mx-auto max-w-5xl">
            <MeetingHistory history={materials.history}>
              <div className="flex flex-col gap-4 pb-6">
                {materials.resumes.map((resume) => (
                  <MeetingResume key={resume.id} url={resume.documentUrl}>
                    {resume.parsedProfile ? (
                      <ResumeProfileDocument profile={resume.parsedProfile} />
                    ) : (
                      <MeetingMarkdown>{resume.markdown || m.meeting_no_resume()}</MeetingMarkdown>
                    )}
                  </MeetingResume>
                ))}
              </div>
            </MeetingHistory>
          </TabsPanel>
          <TabsPanel value="job" className="mx-auto max-w-4xl">
            <h2 className="mb-6 text-2xl font-medium">{materials.job.title}</h2>
            <MeetingMarkdown>{materials.job.requirements}</MeetingMarkdown>
          </TabsPanel>
          <TabsPanel value="criteria" className="mx-auto max-w-4xl">
            <h2 className="mb-6 text-xl font-medium">{m.meeting_criteria()}</h2>
            <MeetingMarkdown>{materials.job.internalCriteria || "—"}</MeetingMarkdown>
          </TabsPanel>
        </div>
      </ScrollArea>
    </Tabs>
  );
}
