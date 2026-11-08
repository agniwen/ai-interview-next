import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ResumeProfileDocument } from "@/components/features/document-preview/resume-profile-document";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import * as m from "@/paraglide/messages";
import type { HumanMeeting } from "./client";
import { MeetingResume } from "./resume";

export function MeetingMarkdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm max-w-none text-left leading-7 wrap-anywhere dark:prose-invert">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

export function MeetingMaterials({ materials }: { materials: HumanMeeting["materials"] }) {
  const [tab, setTab] = useState(materials.resumes.length ? materials.resumes[0].id : "job");
  return (
    <Tabs value={tab} onValueChange={setTab} className="flex h-full min-h-0 flex-col gap-0">
      <div className="shrink-0 overflow-x-auto border-b px-4">
        <TabsList variant="underline">
          {materials.resumes.map((resume, index) => (
            <TabsTab key={resume.id} value={resume.id}>
              {m.meeting_resume()} {index + 1}
            </TabsTab>
          ))}
          <TabsTab value="job">{m.meeting_job()}</TabsTab>
          <TabsTab value="criteria">{m.meeting_criteria()}</TabsTab>
        </TabsList>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-44 md:p-10 md:pb-48">
        {materials.resumes.map((resume) => (
          <TabsPanel key={resume.id} value={resume.id} className="mx-auto max-w-4xl">
            <div className="mb-6 flex justify-end">
              <MeetingResume url={resume.documentUrl} />
            </div>
            {resume.parsedProfile ? (
              <ResumeProfileDocument profile={resume.parsedProfile} />
            ) : (
              <MeetingMarkdown>{resume.markdown || m.meeting_no_resume()}</MeetingMarkdown>
            )}
          </TabsPanel>
        ))}
        <TabsPanel value="job" className="mx-auto max-w-4xl">
          <h2 className="mb-6 text-2xl font-medium">{materials.job.title}</h2>
          <MeetingMarkdown>{materials.job.requirements}</MeetingMarkdown>
        </TabsPanel>
        <TabsPanel value="criteria" className="mx-auto max-w-4xl">
          <h2 className="mb-6 text-xl font-medium">{m.meeting_criteria()}</h2>
          <MeetingMarkdown>{materials.job.internalCriteria || "—"}</MeetingMarkdown>
        </TabsPanel>
      </div>
    </Tabs>
  );
}
