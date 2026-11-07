/** 创建时记录题套选择，候选人首次进入时固定具体题目。
 * Creation records selected question sets; questions freeze on first candidate entry. */
export interface InterviewQuestionSelection {
  version: 1;
  formQuestionSetIds: string[];
  conversationQuestionSetIds: string[];
}
