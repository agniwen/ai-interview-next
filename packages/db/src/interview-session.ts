import type { InterviewFormContent } from "./interview-form";
import type { InterviewQuestions } from "./interview-questions";
import type { ResumeParsedProfile } from "./resume-profile";

/** 实际开始时固定的访谈依据，后续材料及模板编辑不改变本轮内容。
 * Interview evidence frozen at the actual start, unaffected by later material or template edits. */
export interface InterviewSessionSnapshot {
  version: 1;
  candidate: { id: string; name: string };
  job: { id: string; title: string; requirements: string; internalCriteria: string };
  interviewer: { id: string; name: string; description: string; prompt: string } | null;
  resumes: {
    id: string;
    pdfObjectKey: string;
    markdown: string | null;
    parsedProfile: ResumeParsedProfile | null;
  }[];
  questions: InterviewQuestions;
  form: InterviewFormContent;
}
