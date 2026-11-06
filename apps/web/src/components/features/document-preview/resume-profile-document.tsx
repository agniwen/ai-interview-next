import { IconLink, IconMail, IconMapPin, IconPhone } from "@tabler/icons-react";
import type { readResumeProfile } from "@/components/ats/client";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import * as m from "@/paraglide/messages";

type ResumeProfile = NonNullable<Awaited<ReturnType<typeof readResumeProfile>>["profile"]>;
type Employment = NonNullable<ResumeProfile["employment"]>[number];
type Period = Employment["period"];
type ResumeDate = NonNullable<Period>["start"];
type Contact = NonNullable<NonNullable<ResumeProfile["identity"]>["phones"]>[number];
type TextValue = string | null | undefined;

interface ResumeEntry {
  title?: TextValue;
  subtitle?: TextValue;
  time?: string;
  facts?: [label: string, value: TextValue][];
  lists?: [label: string, items: TextValue[] | null | undefined][];
  badges?: string[];
  stages?: ResumeEntry[];
}

function formatDate(date: ResumeDate) {
  const { day, month, year } = date ?? {};
  const trailingEmpty = [day, month, year].findIndex((part) => typeof part === "number");
  if (trailingEmpty === -1) {
    return "";
  }
  return [year, month, day]
    .slice(0, 3 - trailingEmpty)
    .map((part, index) =>
      typeof part === "number" ? String(part).padStart(index === 0 ? 1 : 2, "0") : "—",
    )
    .join("-");
}

function formatPeriod(period: Period) {
  const start = formatDate(period?.start);
  const end = period?.end === "ongoing" ? m.resume_profile_ongoing() : formatDate(period?.end);
  if (start && end) {
    return `${start} – ${end}`;
  }
  if (start) {
    return `${m.resume_profile_start()} ${start}`;
  }
  if (end && period?.end !== "ongoing") {
    return `${m.resume_profile_end()} ${end}`;
  }
  return end;
}

function formatYears(entry: NonNullable<ResumeProfile["selfReportedExperience"]>[number]) {
  const { qualifier, years } = entry;
  if (typeof years !== "number") {
    return;
  }
  const format = {
    about: m.resume_profile_years_about,
    at_least: m.resume_profile_years_at_least,
    exact: m.resume_profile_years_exact,
    more_than: m.resume_profile_years_more_than,
  }[qualifier ?? "exact"];
  return format({ years });
}

function employmentDetails(entry: Omit<Employment, "employer" | "stages">): ResumeEntry {
  return {
    facts: [
      [m.resume_profile_department(), entry.department],
      [m.resume_profile_work_locations(), entry.workLocations?.join(" · ")],
      [m.resume_profile_work_mode(), entry.workMode],
      [m.resume_profile_team_size(), entry.management?.teamSize],
      [m.resume_profile_reports_to(), entry.management?.reportsTo],
    ],
    lists: [
      [m.resume_profile_responsibilities(), entry.responsibilities],
      [m.resume_profile_achievements(), entry.achievements],
    ],
    time: formatPeriod(entry.period),
    title: entry.title,
  };
}

function profileSections(profile: ResumeProfile): { title: string; entries: ResumeEntry[] }[] {
  return [
    {
      entries: (profile.employment ?? []).map((entry) => ({
        ...employmentDetails(entry),
        stages: entry.stages?.map(employmentDetails),
        subtitle: entry.employer,
      })),
      title: m.resume_profile_employment(),
    },
    {
      entries: (profile.education ?? []).map((entry) => ({
        facts: [
          [m.resume_profile_education_level(), entry.level],
          [m.resume_profile_fields_of_study(), entry.fieldsOfStudy?.join(" · ")],
        ],
        subtitle: entry.degree,
        time: formatPeriod(entry.period),
        title: entry.institution,
      })),
      title: m.resume_profile_education(),
    },
    {
      entries: (profile.projects ?? []).map((entry) => ({
        facts: [[m.resume_profile_tech_stack(), entry.techStack?.join(" · ")]],
        lists: [
          [m.resume_profile_contributions(), entry.contributions],
          [m.resume_profile_outcomes(), entry.outcomes],
        ],
        subtitle: entry.role,
        time: formatPeriod(entry.period),
        title: entry.name,
      })),
      title: m.resume_profile_projects(),
    },
    {
      entries: [
        {
          badges: profile.skills?.flatMap(({ name }) => (name?.trim() ? [name] : [])),
        },
      ],
      title: m.resume_profile_skills(),
    },
    {
      entries: (profile.selfReportedExperience ?? []).map((entry) => ({
        subtitle: formatYears(entry),
        title: entry.scope,
      })),
      title: m.resume_profile_reported_experience(),
    },
    {
      entries: (profile.certificates ?? []).map((entry) => ({
        subtitle: entry.issuer,
        time: formatDate(entry.obtainedAt),
        title: entry.name,
      })),
      title: m.resume_profile_certificates(),
    },
    {
      entries: (profile.languages ?? []).map((entry) => ({
        subtitle: entry.proficiency,
        title: entry.name,
      })),
      title: m.resume_profile_languages(),
    },
    {
      entries: (profile.awards ?? []).map((entry) => ({
        subtitle: entry.issuer,
        time: formatDate(entry.awardedAt),
        title: entry.name,
      })),
      title: m.resume_profile_awards(),
    },
  ];
}

function hasEntryContent(entry: ResumeEntry): boolean {
  return Boolean(
    entry.title?.trim() ||
    entry.subtitle?.trim() ||
    entry.time ||
    entry.facts?.some(([, value]) => value?.trim()) ||
    entry.lists?.some(([, items]) => items?.some((item) => item?.trim())) ||
    entry.badges?.length ||
    entry.stages?.some(hasEntryContent),
  );
}

function contactDetail(contact: Contact) {
  return [
    contact.isExplicitlyPrimary && m.resume_profile_primary_contact(),
    contact.owner === "third_party" && m.resume_profile_third_party_contact(),
    contact.owner === "unclear" && m.resume_profile_unclear_contact(),
  ]
    .filter(Boolean)
    .join(" · ");
}

function ResumeBadgeList({ labels, size }: { labels: string[]; size?: BadgeProps["size"] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {labels.map((label, index) => (
        <Badge
          className="h-auto max-w-full wrap-anywhere whitespace-normal sm:h-auto"
          key={`${label}-${index}`}
          render={<li />}
          size={size}
          variant="outline"
        >
          {label}
        </Badge>
      ))}
    </ul>
  );
}

function ResumeEntryBody({ entry }: { entry: ResumeEntry }) {
  const facts = entry.facts?.filter(([, value]) => value?.trim()) ?? [];
  const lists = entry.lists?.flatMap(([label, items]) => {
    const text = items?.filter((item) => item?.trim()) ?? [];
    return text.length ? [{ label, text }] : [];
  });

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      {(entry.title?.trim() || entry.subtitle?.trim() || entry.time) && (
        <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-baseline sm:gap-5">
          <div className="min-w-0 break-words">
            {entry.title?.trim() && <h3 className="text-base font-semibold">{entry.title}</h3>}
            {entry.subtitle?.trim() && (
              <p className={entry.title?.trim() ? "mt-0.5 text-card-foreground/85" : undefined}>
                {entry.subtitle}
              </p>
            )}
          </div>
          {entry.time && (
            <p className="shrink-0 text-xs font-medium tabular-nums text-card-foreground/80">
              {entry.time}
            </p>
          )}
        </div>
      )}
      {facts.length > 0 && (
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-card-foreground/80">
          {facts.map(([label, value]) => (
            <div className="flex min-w-0 gap-1.5" key={label}>
              <dt className="shrink-0 font-medium text-card-foreground">{label}</dt>
              <dd className="min-w-0 break-words">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {lists?.map(({ label, text }) => (
        <div className="flex flex-col gap-1" key={label}>
          <p className="text-sm font-medium text-card-foreground/85">{label}</p>
          <ul className="flex list-disc flex-col gap-2 ps-4 leading-relaxed marker:text-card-foreground/75">
            {text.map((item, index) => (
              <li className="whitespace-pre-line break-words" key={`${item}-${index}`}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {entry.badges && <ResumeBadgeList labels={entry.badges} />}
      {entry.stages?.filter(hasEntryContent).map((stage, index) => (
        <div
          className="mt-1 border-s-2 border-card-foreground/15 ps-3"
          key={`${stage.title}-${stage.time}-${index}`}
        >
          <ResumeEntryBody entry={stage} />
        </div>
      ))}
    </div>
  );
}

function profileContacts(identity: ResumeProfile["identity"]) {
  return [
    { detail: "", icon: IconMapPin, value: identity?.currentCity },
    ...(identity?.phones ?? []).map((contact) => ({
      detail: contactDetail(contact),
      icon: IconPhone,
      value: contact.value,
    })),
    ...(identity?.emails ?? []).map((contact) => ({
      detail: contactDetail(contact),
      icon: IconMail,
      value: contact.value,
    })),
    ...(identity?.links ?? []).map((value) => ({ detail: "", icon: IconLink, value })),
  ].filter(({ value }) => value?.trim());
}

export function ResumeProfileDocument({ profile }: { profile: ResumeProfile }) {
  const { identity } = profile;
  const targetRoles =
    profile.targetRoles?.flatMap(({ text }) => (text?.trim() ? [text] : [])) ?? [];
  const summary =
    profile.professionalSummary?.flatMap(({ text }) => (text?.trim() ? [text] : [])) ?? [];
  const contacts = profileContacts(identity);
  const sections = profileSections(profile)
    .map(({ entries, title }) => ({ entries: entries.filter(hasEntryContent), title }))
    .filter(({ entries }) => entries.length > 0);
  const name = identity?.name?.trim();

  if (!(name || targetRoles.length || contacts.length || summary.length || sections.length)) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">{m.resume_profile_empty()}</p>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-3 sm:p-6">
      <article className="flex select-text flex-col gap-6 p-5 text-sm sm:gap-8 sm:p-10">
        <header className="flex flex-col gap-3">
          <h2 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">
            {name || m.resume_preview_standard()}
          </h2>
          {targetRoles.length > 0 && (
            <dl className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-3">
              <dt className="shrink-0 font-semibold">{m.resume_profile_target_roles()}</dt>
              <dd className="min-w-0">
                <ResumeBadgeList labels={targetRoles} size="lg" />
              </dd>
            </dl>
          )}
          {contacts.length > 0 && (
            <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-card-foreground/80">
              {contacts.map(({ detail, icon: Icon, value }, index) => (
                <li className="flex min-w-0 items-start gap-1.5" key={`${value}-${index}`}>
                  <Icon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                  <span className="min-w-0 wrap-anywhere">
                    {value}
                    {detail && <span className="ms-1.5">({detail})</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </header>
        {summary.length > 0 && (
          <section className="flex flex-col gap-3.5">
            <h2 className="border-b border-card-foreground/15 pb-2 text-lg font-semibold">
              {m.resume_profile_summary()}
            </h2>
            <div className="flex flex-col gap-2 leading-relaxed">
              {summary.map((text, index) => (
                <p className="whitespace-pre-line break-words" key={`${text}-${index}`}>
                  {text}
                </p>
              ))}
            </div>
          </section>
        )}
        {sections.map(({ entries, title }) => (
          <section className="flex flex-col gap-3.5" key={title}>
            <h2 className="border-b border-card-foreground/15 pb-2 text-lg font-semibold">
              {title}
            </h2>
            <div className="flex flex-col gap-6">
              {entries.map((entry, index) => (
                <ResumeEntryBody entry={entry} key={`${entry.title}-${entry.time}-${index}`} />
              ))}
            </div>
          </section>
        ))}
      </article>
    </div>
  );
}
