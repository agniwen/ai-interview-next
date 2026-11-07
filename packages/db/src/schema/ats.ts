import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { ResumeParsedProfile } from "../resume-profile";
import { user } from "./auth";
import { organization } from "./organization";

/** 评估结果 JSON，带格式版本。 / Evaluation result JSON with its format version. */
export interface ApplicationEvaluationResult extends Record<string, unknown> {
  /** 评估结果 JSON 的格式版本。 / Format version of the evaluation result JSON. */
  version: 1;
}

const workspaceIdColumn = () =>
  text("workspaceId")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });

/** 候选人的当前档案。 / A candidate's current profile. */
export const candidate = sqliteTable(
  "candidate",
  {
    /** 档案归档时间，空值表示当前有效。 / Archive time. Null means the profile is active. */
    archivedAt: integer("archivedAt", { mode: "timestamp_ms" }),
    /** 档案建立时间。 / Profile creation time. */
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    /** 档案由人工建立或由简历导入建立。 / Whether the profile was created manually or from a resume import. */
    creationSource: text("creationSource", { enum: ["manual", "resume_import"] }).notNull(),
    /** 当前采用的联系邮箱。 / Current contact email. */
    email: text("email"),
    /** 候选人 ID。 / Candidate ID. */
    id: text("id").primaryKey(),
    /** 从最近一份已确定归属且包含工作经历的简历派生的最近任职公司。 / Most recent employer derived from the latest owned resume that contains work history. */
    latestEmployer: text("latestEmployer"),
    /** 建立档案时必须有的当前姓名。 / Current name required when creating the profile. */
    name: text("name").notNull(),
    /** 当前用于自动匹配的归一化手机号。 / Current normalized mobile number used for automatic matching. */
    phoneNormalized: text("phoneNormalized"),
    /** 最近一次人工维护档案的时间，包括确认换号。 / Last manual profile edit, including a confirmed phone change. */
    profileEditedAt: integer("profileEditedAt", { mode: "timestamp_ms" }),
    /** 档案所属工作区。 / Workspace that owns the profile. */
    workspaceId: workspaceIdColumn(),
  },
  (table) => [
    uniqueIndex("candidate_workspace_id_uq").on(table.workspaceId, table.id),
    uniqueIndex("candidate_active_phone_uq")
      .on(table.workspaceId, table.phoneNormalized)
      .where(sql`${table.archivedAt} is null and ${table.phoneNormalized} is not null`),
  ],
);

/** 候选人确认换号后的历史。 / History of confirmed changes to a candidate's phone number. */
export const candidatePhoneHistory = sqliteTable(
  "candidate_phone_history",
  {
    /** 已换号的候选人。 / Candidate whose phone number changed. */
    candidateId: text("candidateId").notNull(),
    /** 换号生效时间。 / Time the change took effect. */
    changedAt: integer("changedAt", { mode: "timestamp_ms" }).notNull(),
    /** 确认换号的用户。 / User who confirmed the change. */
    changedByUserId: text("changedByUserId")
      .notNull()
      .references(() => user.id),
    /** 历史记录 ID。 / History entry ID. */
    id: text("id").primaryKey(),
    /** 已退役的归一化号码。 / Previous normalized number retired by this change. */
    previousPhoneNormalized: text("previousPhoneNormalized").notNull(),
    /** 候选人所属工作区。 / Workspace that owns the candidate. */
    workspaceId: workspaceIdColumn(),
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.candidateId],
      foreignColumns: [candidate.workspaceId, candidate.id],
    }),
  ],
);

/** 工作区内一份简历的版本、解析结果和长期归属。 / A workspace resume version with its parsed result and lasting ownership. */
export const resume = sqliteTable(
  "resume",
  {
    /** 私有简历头像的对象键，没有提取到时为空。 / Private object key for the extracted resume avatar, if available. */
    avatarObjectKey: text("avatarObjectKey"),
    /** 文件查重时采用的候选人归属，待识别时为空。 / Candidate matched by file hash. Null while ownership is unresolved. */
    candidateId: text("candidateId"),
    /** 首次登记该简历文件的时间。 / Time this resume file was first registered. */
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    /** 唯一选定用于自动查重的归一化本人手机号。 / The candidate's normalized mobile number uniquely selected for automatic matching. */
    extractedPhoneNormalized: text("extractedPhoneNormalized"),
    /** 简历版本 ID。 / Resume version ID. */
    id: text("id").primaryKey(),
    /** 从该版本转录出的 Markdown。 / Markdown transcribed from this version. */
    markdown: text("markdown"),
    /** 文本与结构化字段的解析状态。 / Extraction status for text and structured fields. */
    parseStatus: text("parseStatus", {
      enum: ["pending", "processing", "succeeded", "failed"],
    })
      .notNull()
      .default("pending"),
    /** 这份简历提交时的结构化事实及原文证据。 / Structured facts and source evidence from this submitted resume. */
    parsedProfile: text("parsedProfile", { mode: "json" }).$type<ResumeParsedProfile>(),
    /** 原始简历文件在对象存储中的键，沿用原 PDF 字段。 / Original resume file key, kept in the existing PDF column. */
    pdfObjectKey: text("pdfObjectKey").notNull(),
    /** 停用这份简历的手机号匹配线索的时间。 / Time the phone matching hint was disabled for this resume. */
    phoneMatchDisabledAt: integer("phoneMatchDisabledAt", { mode: "timestamp_ms" }),
    /** 原始简历文件字节的 SHA-256。 / SHA-256 of the original resume file bytes. */
    sha256: text("sha256").notNull(),
    /** 简历所属工作区。 / Workspace that owns the resume. */
    workspaceId: workspaceIdColumn(),
  },
  (table) => [
    uniqueIndex("resume_workspace_id_uq").on(table.workspaceId, table.id),
    uniqueIndex("resume_workspace_sha256_uq").on(table.workspaceId, table.sha256),
    foreignKey({
      columns: [table.workspaceId, table.candidateId],
      foreignColumns: [candidate.workspaceId, candidate.id],
    }),
  ],
);

/** 工作区内的一批招聘岗位。 / A group of recruiting jobs in a workspace. */
export const recruitmentProject = sqliteTable("recruitment_project", {
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  /** 创建人 ID，历史记录未保存时为空。 / Creator ID; null for historical records without attribution. */
  createdBy: text("createdBy"),
  description: text("description").notNull().default(""),
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  workspaceId: workspaceIdColumn(),
});

export const department = sqliteTable(
  "department",
  {
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    /** 历史岗位导入的部门可能没有创建人记录。 / Departments imported from historical jobs may lack creator attribution. */
    createdBy: text("createdBy"),
    description: text("description").notNull().default(""),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    workspaceId: workspaceIdColumn(),
  },
  (table) => [
    index("department_workspace_created_idx").on(table.workspaceId, table.createdAt, table.id),
  ],
);

/** 工作区内的招聘岗位。 / A job opening in a workspace. */
export const job = sqliteTable(
  "job",
  {
    /** 岗位建立时间。 / Job creation time. */
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    /** 创建人 ID，历史记录未保存时为空。 / Creator ID; null for historical records without attribution. */
    createdBy: text("createdBy"),
    /** 保留旧部门名称用于历史数据迁移，新写入使用 departmentId。 / Retain legacy department names for migration; new writes use departmentId. */
    department: text("department"),
    departmentId: text("departmentId").references(() => department.id),
    /** 岗位 ID。 / Job ID. */
    id: text("id").primaryKey(),
    internalCriteria: text("internalCriteria").notNull().default(""),
    projectId: text("projectId").references(() => recruitmentProject.id),
    /** 当前岗位要求。 / Current job requirements. */
    requirements: text("requirements").notNull(),
    /** 岗位名称。 / Job title. */
    title: text("title").notNull(),
    /** 岗位所属工作区。 / Workspace that owns the job. */
    workspaceId: workspaceIdColumn(),
  },
  (table) => [uniqueIndex("job_workspace_id_uq").on(table.workspaceId, table.id)],
);

/** 一位候选人参与一个岗位的一次招聘流程。 / One hiring process for a candidate and a job. */
export const application = sqliteTable(
  "application",
  {
    /** 该次招聘流程的候选人。 / Candidate in this hiring process. */
    candidateId: text("candidateId").notNull(),
    /** 流程结束时间，空值表示仍在进行中。 / Closing time. Null means the application is open. */
    closedAt: integer("closedAt", { mode: "timestamp_ms" }),
    /** 应聘记录建立时间。 / Application creation time. */
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    /** 发起者 ID，历史记录缺少发起者时为空。 / Creator ID. Null for historical records without a recorded creator. */
    createdBy: text("createdBy"),
    /** 发起者是用户还是系统。 / Whether the creator is a user or the system. */
    createdByType: text("createdByType", { enum: ["user", "system"] }),
    /** 流程被创建人删除的时间。 / Time when the creator deleted the application. */
    deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
    /** 应聘记录 ID。 / Application ID. */
    id: text("id").primaryKey(),
    /** 该次招聘流程的岗位。 / Job in this hiring process. */
    jobId: text("jobId").notNull(),
    /** 招聘流程结果。 / Outcome of the hiring process. */
    outcome: text("outcome"),
    /** 当前招聘阶段。 / Current hiring stage. */
    stage: text("stage").notNull(),
    /** 应聘所属工作区。 / Workspace that owns the application. */
    workspaceId: workspaceIdColumn(),
  },
  (table) => [
    uniqueIndex("application_workspace_id_uq").on(table.workspaceId, table.id),
    uniqueIndex("application_open_candidate_job_uq")
      .on(table.workspaceId, table.candidateId, table.jobId)
      .where(sql`${table.closedAt} is null and ${table.deletedAt} is null`),
    foreignKey({
      columns: [table.workspaceId, table.candidateId],
      foreignColumns: [candidate.workspaceId, candidate.id],
    }),
    foreignKey({
      columns: [table.workspaceId, table.jobId],
      foreignColumns: [job.workspaceId, job.id],
    }),
  ],
);

/** 每次上传以及这次投递的身份识别结果。 / An individual upload and its identity resolution. */
export const resumeSubmission = sqliteTable(
  "resume_submission",
  {
    /** 投递关联的应聘，候选人或岗位待确定时为空。 / Linked application. Null while the candidate or job is unresolved. */
    applicationId: text("applicationId"),
    /** 收到本次投递的时间。 / Time this submission was received. */
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    /** 投递记录 ID。 / Submission ID. */
    id: text("id").primaryKey(),
    /** 身份识别进度，包含等待解析、人工确认和已确认。 / Identity resolution progress across parsing, human review, and resolution. */
    identityStatus: text("identityStatus", { enum: ["pending", "pending_review", "resolved"] })
      .notNull()
      .default("pending"),
    /** 本次投递的岗位，待定岗时为空。 / Target job. Null while the job is undetermined. */
    jobId: text("jobId"),
    /** 本次上传时提供的文件名。 / File name provided with this upload. */
    originalFilename: text("originalFilename").notNull(),
    /** 本次查重时由 PDF 哈希命中的候选人。 / Candidate matched by PDF hash at submission time. */
    pdfMatchedCandidateId: text("pdfMatchedCandidateId"),
    /** 由本次投递提议的换号确认状态。 / Review status of the phone change proposed by this submission. */
    phoneChangeStatus: text("phoneChangeStatus", {
      enum: ["pending_confirmation", "confirmed", "dismissed"],
    }),
    /** 本次查重时由手机号命中的候选人。 / Candidate matched by mobile number at submission time. */
    phoneMatchedCandidateId: text("phoneMatchedCandidateId"),
    /** 本次投递最终识别出的候选人。 / Candidate resolved for this submission. */
    resolvedCandidateId: text("resolvedCandidateId"),
    /** 本次上传对应的 PDF 简历版本。 / PDF resume version uploaded in this submission. */
    resumeId: text("resumeId").notNull(),
    /** 投递所属工作区。 / Workspace that owns the submission. */
    workspaceId: workspaceIdColumn(),
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.resumeId],
      foreignColumns: [resume.workspaceId, resume.id],
    }),
    foreignKey({
      columns: [table.workspaceId, table.jobId],
      foreignColumns: [job.workspaceId, job.id],
    }),
    foreignKey({
      columns: [table.workspaceId, table.pdfMatchedCandidateId],
      foreignColumns: [candidate.workspaceId, candidate.id],
    }),
    foreignKey({
      columns: [table.workspaceId, table.phoneMatchedCandidateId],
      foreignColumns: [candidate.workspaceId, candidate.id],
    }),
    foreignKey({
      columns: [table.workspaceId, table.resolvedCandidateId],
      foreignColumns: [candidate.workspaceId, candidate.id],
    }),
    foreignKey({
      columns: [table.workspaceId, table.applicationId],
      foreignColumns: [application.workspaceId, application.id],
    }),
  ],
);

/** 一次应聘对一份 PDF 的材料使用决定。 / The decision to use a PDF as material for one application. */
export const applicationResume = sqliteTable(
  "application_resume",
  {
    /** 使用该材料的应聘。 / Application that uses the material. */
    applicationId: text("applicationId").notNull(),
    /** 人工确认使用该材料的时间。 / Time use of the material was explicitly confirmed. */
    confirmedAt: integer("confirmedAt", { mode: "timestamp_ms" }),
    /** 人工确认使用该材料的用户。 / User who explicitly confirmed use of the material. */
    confirmedByUserId: text("confirmedByUserId").references(() => user.id),
    /** 建立材料关联的时间。 / Time the material link was created. */
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    /** 应聘材料关联 ID。 / Application material link ID. */
    id: text("id").primaryKey(),
    /** 作为材料的简历版本，可归属其他候选人。 / Resume version used as material. Its owner may be another candidate. */
    resumeId: text("resumeId").notNull(),
    /** 材料待确认、可使用或已从当前材料中移除。 / Whether the material awaits confirmation, is available, or has been removed. */
    status: text("status", { enum: ["pending_confirmation", "available", "removed"] }).notNull(),
    /** 应聘材料所属工作区。 / Workspace that owns the application material. */
    workspaceId: workspaceIdColumn(),
  },
  (table) => [
    uniqueIndex("application_resume_pair_uq").on(table.applicationId, table.resumeId),
    foreignKey({
      columns: [table.workspaceId, table.applicationId],
      foreignColumns: [application.workspaceId, application.id],
    }),
    foreignKey({
      columns: [table.workspaceId, table.resumeId],
      foreignColumns: [resume.workspaceId, resume.id],
    }),
  ],
);

/** 一次应聘中的面试轮次。 / An interview round within an application. */
export const interviewRound = sqliteTable(
  "interview_round",
  {
    /** 面试所在的应聘。 / Application that owns the interview. */
    applicationId: text("applicationId").notNull(),
    /** 面试轮次建立时间。 / Interview round creation time. */
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    /** 面试轮次 ID。 / Interview round ID. */
    id: text("id").primaryKey(),
    /** 该轮使用的简历版本，尚未选定时为空。 / Resume version used in this round. Null until selected. */
    resumeId: text("resumeId"),
    /** 计划开始面试的时间。 / Scheduled interview start time. */
    scheduledAt: integer("scheduledAt", { mode: "timestamp_ms" }),
    /** 本次应聘中的轮次序号。 / Round number within this application. */
    sequence: integer("sequence").notNull(),
    /** 面试轮次的当前状态。 / Current state of the interview round. */
    status: text("status").notNull(),
    /** 面试轮次所属工作区。 / Workspace that owns the interview round. */
    workspaceId: workspaceIdColumn(),
  },
  (table) => [
    uniqueIndex("interview_round_workspace_id_uq").on(table.workspaceId, table.id),
    foreignKey({
      columns: [table.workspaceId, table.applicationId],
      foreignColumns: [application.workspaceId, application.id],
    }),
    foreignKey({
      columns: [table.workspaceId, table.resumeId],
      foreignColumns: [resume.workspaceId, resume.id],
    }),
  ],
);

/** 面试轮次的人工反馈。 / Human feedback on an interview round. */
export const interviewFeedback = sqliteTable(
  "interview_feedback",
  {
    /** 反馈作者。 / Feedback author. */
    authorUserId: text("authorUserId")
      .notNull()
      .references(() => user.id),
    /** 反馈正文。 / Feedback body. */
    body: text("body").notNull(),
    /** 反馈提交时间。 / Feedback submission time. */
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    /** 面试反馈 ID。 / Interview feedback ID. */
    id: text("id").primaryKey(),
    /** 收到该反馈的面试轮次。 / Interview round receiving the feedback. */
    interviewRoundId: text("interviewRoundId").notNull(),
    /** 面试反馈所属工作区。 / Workspace that owns the interview feedback. */
    workspaceId: workspaceIdColumn(),
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.interviewRoundId],
      foreignColumns: [interviewRound.workspaceId, interviewRound.id],
    }),
  ],
);

/** 应聘评估及当时采用的材料依据。 / An application evaluation and the inputs used at the time. */
export const applicationEvaluation = sqliteTable(
  "application_evaluation",
  {
    /** 被评估的应聘。 / Application being evaluated. */
    applicationId: text("applicationId").notNull(),
    /** 评估记录建立时间。 / Evaluation creation time. */
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    /** 评估记录 ID。 / Evaluation ID. */
    id: text("id").primaryKey(),
    /** 评估实际使用的岗位要求快照。 / Snapshot of the job requirements used in the evaluation. */
    jobRequirementsSnapshot: text("jobRequirementsSnapshot").notNull(),
    /** 结构化评估结果。 / Structured evaluation result. */
    result: text("result", { mode: "json" }).$type<ApplicationEvaluationResult>().notNull(),
    /** 评估实际使用的简历版本。 / Resume version used in the evaluation. */
    resumeId: text("resumeId").notNull(),
    /** 评估所属工作区。 / Workspace that owns the evaluation. */
    workspaceId: workspaceIdColumn(),
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.applicationId],
      foreignColumns: [application.workspaceId, application.id],
    }),
    foreignKey({
      columns: [table.workspaceId, table.resumeId],
      foreignColumns: [resume.workspaceId, resume.id],
    }),
  ],
);

/** 简历长期归属更正的审计记录。 / Audit record for a change to a resume's lasting ownership. */
export const resumeOwnershipChange = sqliteTable(
  "resume_ownership_change",
  {
    /** 归属更正的时间。 / Time of the ownership change. */
    changedAt: integer("changedAt", { mode: "timestamp_ms" }).notNull(),
    /** 执行归属更正的用户。 / User who changed ownership. */
    changedByUserId: text("changedByUserId")
      .notNull()
      .references(() => user.id),
    /** 更正前的候选人。 / Candidate who owned the resume before the change. */
    fromCandidateId: text("fromCandidateId").notNull(),
    /** 归属更正记录 ID。 / Ownership change ID. */
    id: text("id").primaryKey(),
    /** 该操作是否同时停用了这份 PDF 的手机号线索。 / Whether the change also disabled this PDF's phone matching hint. */
    phoneMatchDisabled: integer("phoneMatchDisabled", { mode: "boolean" }).notNull().default(false),
    /** 本次更正归属的简历版本。 / Resume version whose ownership changed. */
    resumeId: text("resumeId").notNull(),
    /** 更正后的候选人。 / Candidate who owns the resume after the change. */
    toCandidateId: text("toCandidateId").notNull(),
    /** 更正操作所属工作区。 / Workspace in which the ownership change occurred. */
    workspaceId: workspaceIdColumn(),
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.resumeId],
      foreignColumns: [resume.workspaceId, resume.id],
    }),
    foreignKey({
      columns: [table.workspaceId, table.fromCandidateId],
      foreignColumns: [candidate.workspaceId, candidate.id],
    }),
    foreignKey({
      columns: [table.workspaceId, table.toCandidateId],
      foreignColumns: [candidate.workspaceId, candidate.id],
    }),
  ],
);

/** 招聘人员在候选人档案中留下的备注。 / A recruiter's note on a candidate profile. */
export const candidateNote = sqliteTable(
  "candidate_note",
  {
    /** 备注作者。 / Note author. */
    authorUserId: text("authorUserId")
      .notNull()
      .references(() => user.id),
    /** 备注正文。 / Note body. */
    body: text("body").notNull(),
    /** 备注所属候选人。 / Candidate the note belongs to. */
    candidateId: text("candidateId").notNull(),
    /** 备注建立时间。 / Note creation time. */
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    /** 候选人备注 ID。 / Candidate note ID. */
    id: text("id").primaryKey(),
    /** 备注所属工作区。 / Workspace that owns the note. */
    workspaceId: workspaceIdColumn(),
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.candidateId],
      foreignColumns: [candidate.workspaceId, candidate.id],
    }),
  ],
);
