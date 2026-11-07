import { z } from "zod";
import { listSearch } from "../ats/list-search";

export const questionSetListSearch = listSearch.extend({
  kind: z.enum(["form", "conversation"]).catch("form").default("form"),
});

export type QuestionSetListSearch = z.output<typeof questionSetListSearch>;
