import {
  IconHeadphones,
  IconMessages,
  IconPlugConnected,
  IconUserCheck,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import * as m from "@/paraglide/messages";

export function InterviewNotice({
  onBack,
  onConfirm,
  pending,
  error,
}: {
  onBack: () => void;
  onConfirm: () => void;
  pending: boolean;
  error: boolean;
}) {
  const items = [
    { icon: IconMessages, text: m.candidate_notice_conversation() },
    { icon: IconPlugConnected, text: m.candidate_notice_reconnect() },
    { icon: IconUserCheck, text: m.candidate_notice_experience() },
    { icon: IconHeadphones, text: m.candidate_ready_environment() },
  ];
  return (
    <div className="flex w-full max-w-2xl flex-col items-center">
      <h1 className="text-xl font-medium tracking-tight">{m.candidate_interview_notice()}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{m.candidate_notice_intro()}</p>
      <ul className="mt-8 grid w-full gap-3 text-left sm:grid-cols-2">
        {items.map(({ icon: Icon, text }) => (
          <Card key={text} render={<li />}>
            <CardContent className="flex gap-2.5 px-3.5 py-3">
              <Icon aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted-foreground" />
              <span className="text-sm leading-6 text-foreground/80">{text}</span>
            </CardContent>
          </Card>
        ))}
      </ul>
      <div className="mt-5 flex flex-col gap-2 text-left text-xs leading-5 text-muted-foreground">
        <p>{m.candidate_interview_recording_notice()}</p>
        <p>{m.candidate_interview_camera_notice()}</p>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive-foreground">
          {m.candidate_session_start_error()}
        </p>
      )}
      <div className="mt-8 flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
        <Button variant="outline" className="sm:min-w-24" disabled={pending} onClick={onBack}>
          {m.interviews_back()}
        </Button>
        <Button className="sm:min-w-32" loading={pending} onClick={onConfirm}>
          {m.candidate_session_start()}
        </Button>
      </div>
    </div>
  );
}
