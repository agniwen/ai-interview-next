import { Alert, AlertDescription } from "@/components/ui/alert";

export function WorkspaceFeedback({ error }: { error: Error | null }) {
  return error ? (
    <Alert variant="error">
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  ) : null;
}
