import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { IconDeviceFloppy, IconRobot, IconUsers } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldLabel } from "@/components/ui/field";
import { TimeRange } from "@/components/ui/time-range";
import type { TimeRangeValue } from "@/components/ui/time-range";
import { Radio, RadioGroup } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Toolbar, ToolbarButton } from "@/components/ui/toolbar";
import { InterviewFormSkeleton } from "@/components/skeletons/components/interview-form-skeleton";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import * as m from "@/paraglide/messages";
import { ChoicePicker } from "./choice-picker";
import { SetSelection } from "./set-selection";
import { createInterviewMutation, setupQuery, updateInterviewMutation, editQuery } from "./client";
import type { Choice, InterviewInput } from "./client";

interface FormValues {
  kind: "ai" | "human";
  label: string;
  agent: Choice | null;
  reviewer: Choice | null;
  interviewers: Choice[];
  form: Choice[];
  conversation: Choice[];
  timeRange?: TimeRangeValue;
}

function InterviewTypeField({
  id,
  kind,
  disabled,
  readOnly,
  onChange,
}: {
  id: string;
  kind: "ai" | "human";
  disabled: boolean;
  readOnly: boolean;
  onChange: (value: unknown) => void;
}) {
  return (
    <Field>
      <FieldLabel id={`${id}-type`}>{m.interviews_type()}</FieldLabel>
      <RadioGroup
        aria-labelledby={`${id}-type`}
        value={kind}
        disabled={disabled || readOnly}
        onValueChange={onChange}
        className="grid grid-cols-2 gap-3"
      >
        {(["ai", "human"] as const).map((type) => (
          <label
            key={type}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 has-data-checked:border-primary has-data-checked:bg-accent/40 has-data-disabled:cursor-default"
          >
            <Radio value={type} />
            {type === "ai" ? (
              <IconRobot aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <IconUsers aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">
              {type === "ai" ? m.interviews_ai() : m.interviews_human()}
            </span>
          </label>
        ))}
      </RadioGroup>
    </Field>
  );
}

function toInterviewInput({
  kind,
  label,
  agent,
  reviewer,
  interviewers,
  form,
  conversation,
  timeRange,
}: FormValues): InterviewInput {
  return {
    ...(kind === "ai"
      ? {
          confirmationUserId: reviewer?.id,
          conversationQuestionSetIds: conversation.map((set) => set.id),
          formQuestionSetIds: form.map((set) => set.id),
          interviewerAgentId: agent?.id ?? "",
          kind,
        }
      : {
          admissionDeadline: timeRange?.to?.toISOString() ?? "",
          interviewerUserIds: interviewers.map((person) => person.id),
          kind,
          scheduledAt: timeRange?.from?.toISOString() ?? "",
        }),
    label,
    version: 1,
  };
}

function canSaveInterview(
  {
    kind,
    agent,
    reviewer,
    interviewers,
  }: Pick<FormValues, "kind" | "agent" | "reviewer" | "interviewers">,
  hasQuestions: boolean,
  validTimes: boolean,
) {
  return kind === "ai"
    ? Boolean(agent && reviewer && hasQuestions)
    : interviewers.length > 0 && validTimes;
}

function Form({
  workspaceId,
  applicationId,
  initial,
  title,
  roundId,
  questionsLocked = false,
  onClose,
}: {
  workspaceId: string;
  applicationId: string;
  initial: FormValues;
  title: string;
  roundId?: string;
  questionsLocked?: boolean;
  onClose: () => void;
}) {
  const id = useId();
  const client = useQueryClient();
  const mutation = useMutation(
    roundId
      ? updateInterviewMutation(client, workspaceId, applicationId, roundId)
      : createInterviewMutation(client, workspaceId, applicationId),
  );
  const [kind, setKind] = useState(initial.kind);
  const [interviewers, setInterviewers] = useState(initial.interviewers);
  const [agent, setAgent] = useState(initial.agent);
  const [reviewer, setReviewer] = useState(initial.reviewer);
  const [form, setForm] = useState(initial.form);
  const [conversation, setConversation] = useState(initial.conversation);
  const [label, setLabel] = useState(initial.label);
  const [timeRange, setTimeRange] = useState(initial.timeRange);
  const validTimes = Boolean(timeRange?.from && timeRange.to && timeRange.to > timeRange.from);
  const invalidTimes = Boolean(timeRange?.from && timeRange.to && !validTimes);
  const questionsDisabled = mutation.isPending || questionsLocked;
  const hasQuestions = questionsLocked || conversation.some((set) => (set.questionCount ?? 0) > 0);
  const canSave = canSaveInterview(
    { agent, interviewers, kind, reviewer },
    hasQuestions,
    validTimes,
  );
  return (
    <form
      className="flex min-w-0 flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate(
          toInterviewInput({
            agent,
            conversation,
            form,
            interviewers,
            kind,
            label,
            reviewer,
            timeRange,
          }),
          { onSuccess: onClose },
        );
      }}
    >
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{m.interviews_type_help()}</p>
      </div>
      {mutation.isError && (
        <Alert variant="error">
          <AlertDescription>{m.interviews_save_error()}</AlertDescription>
        </Alert>
      )}
      <InterviewTypeField
        id={id}
        kind={kind}
        disabled={mutation.isPending}
        readOnly={Boolean(roundId)}
        onChange={(value) => {
          setKind(value as "ai" | "human");
          if (value === "human" && !timeRange) {
            const from = new Date();
            from.setSeconds(0, 0);
            setTimeRange({ from, to: new Date(from.getTime() + 60 * 60 * 1000) });
          }
          mutation.reset();
        }}
      />
      {kind === "ai" ? (
        <Field>
          <FieldLabel htmlFor={`${id}-agent`}>{m.interviewer_agents_title()}</FieldLabel>
          <ChoicePicker
            id={`${id}-agent`}
            workspaceId={workspaceId}
            kind="agent"
            value={agent}
            onChange={setAgent}
            disabled={mutation.isPending}
          />
        </Field>
      ) : (
        <Field>
          <FieldLabel htmlFor={`${id}-interviewers`}>{m.interviews_interviewers()}</FieldLabel>
          <ChoicePicker
            id={`${id}-interviewers`}
            workspaceId={workspaceId}
            kind="member"
            multiple
            value={interviewers}
            onChange={setInterviewers}
            disabled={mutation.isPending}
          />
          <p className="text-xs text-muted-foreground">{m.interviews_interviewers_help()}</p>
        </Field>
      )}
      <Field>
        <FieldLabel htmlFor={`${id}-label`}>{m.interviews_label()}</FieldLabel>
        <Input
          id={`${id}-label`}
          value={label}
          maxLength={200}
          disabled={mutation.isPending}
          onChange={(e) => setLabel(e.target.value)}
        />
      </Field>
      {kind === "human" && (
        <>
          <Field data-invalid={invalidTimes}>
            <FieldLabel htmlFor={`${id}-time-range`}>{m.interviews_time_range()}</FieldLabel>
            <TimeRange
              id={`${id}-time-range`}
              value={timeRange}
              onChange={setTimeRange}
              disabled={mutation.isPending}
              startLabel={m.interviews_start()}
              endLabel={m.interviews_deadline()}
              invalid={invalidTimes}
            />
            {invalidTimes && (
              <p className="text-sm text-destructive">{m.interviews_time_error()}</p>
            )}
          </Field>
          <p className="text-xs text-muted-foreground">{m.interviews_time_help()}</p>
        </>
      )}
      {kind === "ai" && (
        <>
          {!roundId && (
            <p className="text-xs text-muted-foreground">{m.interviews_defaults_help()}</p>
          )}
          <Field>
            <FieldLabel htmlFor={`${id}-reviewer`}>{m.interviews_reviewer()}</FieldLabel>
            <ChoicePicker
              id={`${id}-reviewer`}
              workspaceId={workspaceId}
              kind="member"
              value={reviewer}
              onChange={setReviewer}
              disabled={mutation.isPending}
            />
          </Field>
          <SetSelection
            id={`${id}-conversation`}
            workspaceId={workspaceId}
            kind="conversation"
            value={conversation}
            onChange={setConversation}
            disabled={questionsDisabled}
          />
          {questionsLocked && (
            <p className="text-xs text-muted-foreground">{m.interviews_questions_locked()}</p>
          )}
          {!hasQuestions && (
            <p className="text-sm text-muted-foreground">{m.interviews_questions_required()}</p>
          )}
          <SetSelection
            id={`${id}-form`}
            workspaceId={workspaceId}
            kind="form"
            value={form}
            onChange={setForm}
            disabled={questionsDisabled}
          />
        </>
      )}
      <Toolbar
        aria-label={m.ats_action()}
        className="sticky bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 mx-auto mt-auto w-fit max-w-full gap-1 bg-card/95 p-1.5 backdrop-blur-md md:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
      >
        <ToolbarButton
          render={<Button size="sm" variant="outline" />}
          disabled={mutation.isPending}
          onClick={onClose}
        >
          {m.interviews_cancel()}
        </ToolbarButton>
        <ToolbarButton
          type="submit"
          render={<Button size="sm" variant="outline" loading={mutation.isPending} />}
          disabled={mutation.isPending || !canSave}
        >
          <IconDeviceFloppy />
          {m.ats_save()}
        </ToolbarButton>
      </Toolbar>
    </form>
  );
}

export function InterviewForm({
  workspaceId,
  applicationId,
  onClose,
}: {
  workspaceId: string;
  applicationId: string;
  onClose: () => void;
}) {
  const query = useQuery(setupQuery(workspaceId, applicationId));
  const phase = useSkeletonPhase(query.isPending);
  if (phase === "skeleton") {
    return <InterviewFormSkeleton />;
  }
  if (phase === "pending") {
    return null;
  }
  if (!query.data) {
    return (
      <Alert variant="error">
        <AlertDescription>
          {m.ats_error()}{" "}
          <Button variant="outline" onClick={() => query.refetch()}>
            {m.ats_retry()}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <Form
      workspaceId={workspaceId}
      applicationId={applicationId}
      title={m.interviews_create()}
      initial={{
        agent: null,
        conversation: query.data.sets.filter((set) => set.kind === "conversation"),
        form: query.data.sets.filter((set) => set.kind === "form"),
        interviewers: [],
        kind: "ai",
        label: "",
        reviewer: query.data.reviewer ?? null,
      }}
      onClose={onClose}
    />
  );
}

export function EditInterviewForm({
  workspaceId,
  applicationId,
  roundId,
  onClose,
}: {
  workspaceId: string;
  applicationId: string;
  roundId: string;
  onClose: () => void;
}) {
  const query = useQuery(editQuery(workspaceId, roundId));
  const phase = useSkeletonPhase(query.isPending);
  if (phase === "skeleton") {
    return <InterviewFormSkeleton />;
  }
  if (phase === "pending") {
    return null;
  }
  if (!query.data) {
    return (
      <Alert variant="error">
        <AlertDescription>
          {m.interviews_edit_error()}{" "}
          <Button variant="outline" onClick={() => query.refetch()}>
            {m.ats_retry()}
          </Button>{" "}
          <Button variant="outline" onClick={onClose}>
            {m.interviews_cancel()}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  const { round, sets, agent } = query.data;
  const byId = new Map(sets.map((set) => [set.id, set]));
  return (
    <Form
      key={roundId}
      workspaceId={workspaceId}
      applicationId={applicationId}
      roundId={roundId}
      questionsLocked={round.questionsBoundAt !== null}
      title={m.interviews_edit()}
      onClose={onClose}
      initial={{
        agent,
        conversation: round.questionSelection.conversationQuestionSetIds.map(
          (id) => byId.get(id) ?? { id, name: id },
        ),
        form: round.questionSelection.formQuestionSetIds.map(
          (id) => byId.get(id) ?? { id, name: id },
        ),
        interviewers: round.assignments.filter((person) => person.role === "interviewer"),
        kind: round.kind,
        label: round.label,
        reviewer: round.assignments.find((person) => person.role === "reviewer") ?? null,
        timeRange:
          round.scheduledAt && round.admissionDeadline
            ? { from: new Date(round.scheduledAt), to: new Date(round.admissionDeadline) }
            : undefined,
      }}
    />
  );
}
