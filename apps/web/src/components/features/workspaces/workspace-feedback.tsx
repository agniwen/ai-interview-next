import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * 工作区操作共用的错误提示视图，调用方决定错误来源和显示时机。
 * Shared workspace-action error view; callers choose the error source and display timing.
 */
export function WorkspaceFeedback({ error }: { error: Error | null }) {
  return error ? (
    <Alert variant="error">
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  ) : null;
}
