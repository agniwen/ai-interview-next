import { z } from "zod";

const optionalText = z.string().nullish();
const optionalTextList = z.array(z.string()).nullish();
const optionalDatePart = z.number().int().nullish();

const evidence = z
  .array(
    z.strictObject({
      /** 从 1 开始的 PDF 页码，能可靠定位时填写。 / One-based PDF page number when reliably known. */
      page: z.number().int().positive().nullish(),
      /** 可在转录文本中定位的原文片段。 / Excerpt locatable in the source transcript. */
      quote: optionalText,
    }),
  )
  .nullish();

const date = z.strictObject({
  /** 原文明确的日。 / Day stated in the resume. */
  day: optionalDatePart,
  /** 原文明确的月份。 / Month stated in the resume. */
  month: optionalDatePart,
  /** 原文明确的年份。 / Year stated in the resume. */
  year: optionalDatePart,
});

const period = z
  .strictObject({
    /** 原文所述的结束时间，明确持续至今时为 ongoing。 / Stated end date, or ongoing when explicitly continuing. */
    end: z.union([date, z.literal("ongoing")]).nullish(),
    /** 原文所述的开始时间。 / Stated start date. */
    start: date.nullish(),
  })
  .nullish();

const contact = z.strictObject({
  /** 支持号码、归属和首选标记的原文。 / Evidence for the value, ownership, and preference. */
  evidence,
  /** 原文明确标为首选时为 true。 / True when explicitly marked as preferred. */
  isExplicitlyPrimary: z.literal(true).nullish(),
  /** 联系方式的归属。 / Ownership of the contact detail. */
  owner: z.enum(["candidate", "third_party", "unclear"]).nullish(),
  /** 原样保留的手机号或邮箱。 / Phone number or email as written in the resume. */
  value: optionalText,
});

const employmentDetails = {
  /** 原文明示的成果。 / Stated achievements. */
  achievements: optionalTextList,
  /** 部门、团队或业务线。 / Department, team, or business unit. */
  department: optionalText,
  /** 任职或阶段的原文依据。 / Evidence for the tenure or stage. */
  evidence,
  /** 原文给出的管理范围。 / Stated management scope. */
  management: z
    .strictObject({
      /** 管理范围的原文依据。 / Evidence for the management scope. */
      evidence,
      /** 原文中的汇报对象。 / Stated reporting line. */
      reportsTo: optionalText,
      /** 下属人数，保留范围或加号。 / Stated team size, preserving ranges and plus signs. */
      teamSize: optionalText,
    })
    .nullish(),
  /** 总任期或阶段自己的任期。 / Overall tenure or the stage's own period. */
  period,
  /** 原文明示的职责。 / Stated responsibilities. */
  responsibilities: optionalTextList,
  /** 正式职称或阶段角色。 / Official title or stage role. */
  title: optionalText,
  /** 该段经历的工作地点。 / Work locations for this entry. */
  workLocations: optionalTextList,
  /** 原文明示的工作模式，例如远程。 / Explicit work mode, such as remote. */
  workMode: optionalText,
};

const sourcedText = z.strictObject({
  /** 该陈述的原文依据。 / Evidence for the statement. */
  evidence,
  /** 候选人明确陈述的内容。 / Content explicitly stated by the candidate. */
  text: optionalText,
});

/** 一份简历提交时明确陈述的结构化事实。 / Structured facts explicitly stated in a submitted resume. */
export const resumeParsedProfileSchema = z.strictObject({
  /** 明确具名的荣誉或表彰。 / Named awards or recognitions. */
  awards: z
    .array(
      z.strictObject({
        /** 原文明示的获奖时间。 / Award date stated in the resume. */
        awardedAt: date.nullish(),
        /** 荣誉的原文依据。 / Evidence for the award. */
        evidence,
        /** 原文明示的授予方。 / Awarding organization stated in the resume. */
        issuer: optionalText,
        /** 荣誉名称。 / Award name. */
        name: optionalText,
      }),
    )
    .nullish(),
  /** 逐项记录的证书。 / Individual certificates. */
  certificates: z
    .array(
      z.strictObject({
        /** 证书的原文依据。 / Evidence for the certificate. */
        evidence,
        /** 签发机构。 / Certificate issuer. */
        issuer: optionalText,
        /** 证书名称。 / Certificate name. */
        name: optionalText,
        /** 原文所述的取得时间。 / Date obtained, as stated. */
        obtainedAt: date.nullish(),
      }),
    )
    .nullish(),
  /** 按就读或学位保存的教育经历。 / Education entries by period of study or degree. */
  education: z
    .array(
      z.strictObject({
        /** 原文所述的学位。 / Degree as stated. */
        degree: optionalText,
        /** 教育经历的原文依据。 / Evidence for the education entry. */
        evidence,
        /** 该教育条目列出的专业。 / Fields of study listed for this entry. */
        fieldsOfStudy: optionalTextList,
        /** 学校或教育机构。 / School or educational institution. */
        institution: optionalText,
        /** 原文所述的学历层次。 / Education level as stated. */
        level: optionalText,
        /** 就读时间。 / Dates of study. */
        period,
      }),
    )
    .nullish(),
  /** 一段连续任职及其分阶段角色。 / Continuous tenures with their stage roles. */
  employment: z
    .array(
      z.strictObject({
        /** 公司或雇主名称。 / Company or employer name. */
        employer: optionalText,
        ...employmentDetails,
        /** 同一总任职下各自有职称和时间的阶段。 / Stages with their own titles and dates within one tenure. */
        stages: z.array(z.strictObject(employmentDetails)).nullish(),
      }),
    )
    .nullish(),
  /** 候选人身份和联系方式。 / Candidate identity and contact details. */
  identity: z
    .strictObject({
      /** 原文明示的现居城市。 / Explicitly stated current city. */
      currentCity: optionalText,
      /** 提取到的邮箱。 / Extracted email addresses. */
      emails: z.array(contact).nullish(),
      /** 职业主页或作品链接。 / Professional profile or portfolio links. */
      links: optionalTextList,
      /** 原文中的姓名。 / Name as written in the resume. */
      name: optionalText,
      /** 提取到的手机号。 / Extracted mobile numbers. */
      phones: z.array(contact).nullish(),
    })
    .nullish(),
  /** 明确声明的语言能力。 / Explicitly stated language capabilities. */
  languages: z
    .array(
      z.strictObject({
        /** 语言能力的原文依据。 / Evidence for the language capability. */
        evidence,
        /** 语言名称。 / Language name. */
        name: optionalText,
        /** 原文所述的语言水平。 / Proficiency as stated. */
        proficiency: optionalText,
      }),
    )
    .nullish(),
  /** 简历自我介绍中的职业要点。 / Professional points from the resume's self-introduction. */
  professionalSummary: z.array(sourcedText).nullish(),
  /** 逐项记录的项目及其技术栈。 / Individual projects and their technology stacks. */
  projects: z
    .array(
      z.strictObject({
        /** 候选人在项目中的贡献。 / Candidate's stated contributions. */
        contributions: optionalTextList,
        /** 项目的原文依据。 / Evidence for the project. */
        evidence,
        /** 项目名称。 / Project name. */
        name: optionalText,
        /** 原文所述的项目成果。 / Stated project outcomes. */
        outcomes: optionalTextList,
        /** 项目时间。 / Project dates. */
        period,
        /** 候选人在该项目中的角色。 / Candidate's role on the project. */
        role: optionalText,
        /** 原文明示用于该项目的技术。 / Technologies explicitly used on this project. */
        techStack: optionalTextList,
      }),
    )
    .nullish(),
  /** 候选人自述的各类经验年限。 / Candidate-reported durations for different experience areas. */
  selfReportedExperience: z
    .array(
      z.strictObject({
        /** 年限和范围的原文依据。 / Evidence for the duration and scope. */
        evidence,
        /** 年数的限定词，分别对应精确、至少、超过和约。 / Duration qualifier for exact, at least, more than, or about. */
        qualifier: z.enum(["exact", "at_least", "more_than", "about"]).nullish(),
        /** 年限适用的经验范围。 / Experience area to which the duration applies. */
        scope: optionalText,
        /** 候选人明确给出的年数。 / Number of years explicitly stated. */
        years: z.number().nullish(),
      }),
    )
    .nullish(),
  /** 原文点名的技能、工具或技术。 / Skills, tools, or technologies named in the resume. */
  skills: z
    .array(
      z.strictObject({
        /** 技能的原文依据。 / Evidence for the skill. */
        evidence,
        /** 简历中使用的技能名称。 / Skill name used in the resume. */
        name: optionalText,
      }),
    )
    .nullish(),
  /** 候选人明确声明的求职目标。 / Target roles explicitly stated by the candidate. */
  targetRoles: z.array(sourcedText).nullish(),
  /** 简历解析 JSON 的格式版本。 / Format version of the parsed resume JSON. */
  version: z.literal(1),
});

export type ResumeParsedProfile = z.infer<typeof resumeParsedProfileSchema>;
