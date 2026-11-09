import { Badge } from "@/components/ui/badge";
import * as m from "@/paraglide/messages";

function closeReason(outcome: string | null) {
  switch (outcome) {
    case "closed": {
      return m.ats_close_reason_manual();
    }
    case "transferred": {
      return m.ats_close_reason_job_changed();
    }
    case "rejected": {
      return m.ats_close_reason_interview_failed();
    }
    default: {
      return null;
    }
  }
}

export function ApplicationStatusBadge({
  closedAt,
  outcome,
}: {
  closedAt: string | null;
  outcome: string | null;
}) {
  const status = closedAt ? m.ats_closed() : m.ats_open();
  const reason = closedAt ? closeReason(outcome) : null;
  return (
    <Badge variant={closedAt ? "secondary" : "info"}>
      {reason ? `${status} · ${reason}` : status}
    </Badge>
  );
}
