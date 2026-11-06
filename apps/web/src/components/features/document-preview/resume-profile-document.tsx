import { IconLink, IconMail, IconMapPin, IconPhone } from "@tabler/icons-react";
import type { ReactNode } from "react";
import type { readResumeProfile } from "@/components/ats/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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

export function ResumeBadgeList({ labels, size }: { labels: string[]; size?: BadgeProps["size"] }) {
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
  const stages = entry.stages?.filter(hasEntryContent) ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {(entry.title?.trim() || entry.subtitle?.trim() || entry.time) && (
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <div className="min-w-0 wrap-anywhere">
            {entry.title?.trim() && (
              <h3 className="text-[0.9375rem] leading-6 font-semibold">{entry.title}</h3>
            )}
            {entry.subtitle?.trim() && (
              <p className="text-sm leading-6 text-muted-foreground">{entry.subtitle}</p>
            )}
          </div>
          {entry.time && (
            <p className="w-full text-xs leading-6 text-muted-foreground tabular-nums sm:ms-auto sm:w-auto">
              {entry.time}
            </p>
          )}
        </div>
      )}
      {facts.length > 0 && (
        <dl className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm leading-6">
          {facts.map(([label, value]) => (
            <div className="flex min-w-0 items-baseline gap-1.5" key={label}>
              <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
              <dd className="min-w-0 wrap-anywhere">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {lists?.map(({ label, text }) => (
        <div className="flex flex-col gap-1.5" key={label}>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <ul className="flex list-disc flex-col gap-1.5 ps-5 leading-6 marker:text-muted-foreground/70">
            {text.map((item, index) => (
              <li className="wrap-anywhere whitespace-pre-line" key={`${item}-${index}`}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {entry.badges && <ResumeBadgeList labels={entry.badges} />}
      {stages.length > 0 && (
        <ul className="mt-1 flex flex-col gap-5 border-s border-border ps-4">
          {stages.map((stage, index) => (
            <li key={`${stage.title}-${stage.time}-${index}`}>
              <ResumeEntryBody entry={stage} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function profileContacts(identity: ResumeProfile["identity"]) {
  return [
    { detail: "", icon: IconMapPin, label: m.resume_profile_city(), value: identity?.currentCity },
    ...(identity?.phones ?? []).map((contact) => ({
      detail: contactDetail(contact),
      icon: IconPhone,
      label: m.resume_profile_phone(),
      value: contact.value,
    })),
    ...(identity?.emails ?? []).map((contact) => ({
      detail: contactDetail(contact),
      icon: IconMail,
      label: m.resume_profile_email(),
      value: contact.value,
    })),
    ...(identity?.links ?? []).map((value) => ({
      detail: "",
      icon: IconLink,
      label: m.resume_profile_link(),
      value,
    })),
  ].filter(({ value }) => value?.trim());
}

export function getResumeProfileBasics(profile: ResumeProfile) {
  return {
    contacts: profileContacts(profile.identity),
    targetRoles: profile.targetRoles?.flatMap(({ text }) => (text?.trim() ? [text] : [])) ?? [],
  };
}

function ResumeProfileBasics({ contacts, targetRoles }: ReturnType<typeof getResumeProfileBasics>) {
  if (!targetRoles.length && !contacts.length) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      {targetRoles.length > 0 && (
        <dl className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-3">
          <dt className="shrink-0 font-semibold">{m.resume_profile_target_roles()}</dt>
          <dd className="min-w-0">
            <ResumeBadgeList labels={targetRoles} size="lg" />
          </dd>
        </dl>
      )}
      {contacts.length > 0 && (
        <dl className="flex flex-wrap gap-x-4 gap-y-2.5 text-card-foreground/80">
          {contacts.map(({ detail, icon: Icon, label, value }, index) => (
            <div className="min-w-0" key={`${value}-${index}`}>
              <dt className="sr-only">{label}</dt>
              <dd className="flex items-start gap-1.5">
                <Icon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                <span className="min-w-0 wrap-anywhere">
                  {value}
                  {detail && <span className="ms-1.5">({detail})</span>}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function ResumeSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="flex min-w-0 flex-col gap-4 border-t border-border/70 pt-5 first:border-t-0 first:pt-0 sm:pt-6">
      <h2 className="text-base leading-6 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function ResumeProfileDocument({
  avatarSrc,
  profile,
  layout = "preview",
}: {
  avatarSrc?: string;
  profile: ResumeProfile;
  layout?: "inline" | "preview";
}) {
  const basics = layout === "preview" ? getResumeProfileBasics(profile) : null;
  const name = profile.identity?.name?.trim();
  const summary =
    profile.professionalSummary?.flatMap(({ text }) => (text?.trim() ? [text] : [])) ?? [];
  const sections = profileSections(profile)
    .map(({ entries, title }) => ({ entries: entries.filter(hasEntryContent), title }))
    .filter(({ entries }) => entries.length > 0);

  if (
    !summary.length &&
    !sections.length &&
    !(basics && (avatarSrc || name || basics.targetRoles.length || basics.contacts.length))
  ) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">{m.resume_profile_empty()}</p>
    );
  }

  return (
    <article
      className={cn(
        "flex max-w-4xl select-text flex-col gap-5 text-sm sm:gap-6",
        layout === "preview" ? "mx-auto p-8 sm:p-16" : "pt-2 pb-6",
      )}
    >
      {basics && (
        <header className="flex flex-col gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {avatarSrc && (
              <Avatar aria-hidden="true" className="[--avatar-size:--spacing(14)]">
                <AvatarImage alt="" src={avatarSrc} />
                <AvatarFallback>{name?.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
            )}
            <h2 className="min-w-0 wrap-anywhere text-2xl font-semibold tracking-tight sm:text-3xl">
              {name || m.resume_preview_standard()}
            </h2>
          </div>
          <ResumeProfileBasics {...basics} />
        </header>
      )}
      {summary.length > 0 && (
        <ResumeSection title={m.resume_profile_summary()}>
          <div className="flex flex-col gap-2.5 leading-7">
            {summary.map((text, index) => (
              <p className="wrap-anywhere whitespace-pre-line" key={`${text}-${index}`}>
                {text}
              </p>
            ))}
          </div>
        </ResumeSection>
      )}
      {sections.map(({ entries, title }) => (
        <ResumeSection key={title} title={title}>
          <ul className="flex flex-col gap-6 sm:gap-7">
            {entries.map((entry, index) => (
              <li key={`${entry.title}-${entry.time}-${index}`}>
                <ResumeEntryBody entry={entry} />
              </li>
            ))}
          </ul>
        </ResumeSection>
      ))}
    </article>
  );
}
