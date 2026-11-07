export type InterviewFormAnswer = string | number | number[] | null;

/** 题目快照 ID 标识答案；选项使用快照中的位置，不依赖可能重复的选项文字。
 * Snapshot question IDs identify answers; choices use snapshot positions rather than possibly repeated labels. */
export interface InterviewFormContent {
  version: 1;
  answers: Record<string, InterviewFormAnswer>;
}
