import { createQueryKeys } from "@lukemorales/query-key-factory";
import type {
  ApplicationListSearch,
  JobListSearch,
  ListSearch,
  ResumeListSearch,
} from "./list-search";

export const atsKeys = createQueryKeys("ats", {
  applications: (workspaceId: string) => ({
    contextQueries: {
      detail: (id: string) => [id],
      list: (query: ApplicationListSearch) => [query],
    },
    queryKey: [workspaceId],
  }),
  candidates: (workspaceId: string) => ({
    contextQueries: {
      list: (query: ListSearch) => [query],
      resolveOptions: null,
      resumes: (id: string) => [id],
    },
    queryKey: [workspaceId],
  }),
  departments: (workspaceId: string) => ({
    contextQueries: {
      list: (query: ListSearch) => [query],
      options: (search: string) => [search],
    },
    queryKey: [workspaceId],
  }),
  jobs: (workspaceId: string) => ({
    contextQueries: {
      detail: (id: string) => [id],
      list: (query: JobListSearch) => [query],
      options: null,
    },
    queryKey: [workspaceId],
  }),
  projects: (workspaceId: string) => ({
    contextQueries: {
      detail: (id: string) => [id],
      list: (query: ListSearch) => [query],
      options: null,
    },
    queryKey: [workspaceId],
  }),
  resumes: (workspaceId: string) => ({
    contextQueries: {
      list: (query: ResumeListSearch) => [query],
      options: (search: string, offsetMinutes: number) => [{ offsetMinutes, search }],
      processing: (id: string) => [id],
      profile: (id: string) => [id],
    },
    queryKey: [workspaceId],
  }),
});
