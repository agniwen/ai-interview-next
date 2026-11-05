import type { ResumeParsedProfile } from "@ai-interview/db/resume-profile";

export type ResumeStructurer = (text: string) => Promise<ResumeParsedProfile>;
