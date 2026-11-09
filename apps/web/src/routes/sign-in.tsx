import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import { SignInSessionSkeleton } from "@/components/skeletons/components/sign-in-session-skeleton";
import { useEffect, useState } from "react";
import { IconAlertCircle } from "@tabler/icons-react";
import { createFileRoute, useHydrated } from "@tanstack/react-router";
import { AuthPageLayout } from "@/components/features/auth/auth-page-layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/client";
import { loginSearch } from "@/lib/workspaces/client";
import * as m from "@/paraglide/messages";

export const Route = createFileRoute("/sign-in")({
  validateSearch: loginSearch,
  head: () => ({
    meta: [
      { title: `${m.login_title()} — Sainoa` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  // 命名组件确保路由定义中的 React Hook 能被识别。Named component preserves React hook detection in route definitions.
  // oxlint-disable-next-line func-name-matching
  component: function Login() {
    const hydrated = useHydrated();
    const { error: callbackError, next } = Route.useSearch();
    const { data: session, isPending } = authClient.useSession();
    const phase = useSkeletonPhase(isPending && !session);
    const currentSession = phase === "ready" ? session : null;
    const [pending, setPending] = useState(false);
    const [failed, setFailed] = useState(Boolean(callbackError));
    useEffect(() => {
      if (currentSession) {
        window.location.replace(next ?? "/workspaces");
      }
    }, [currentSession, next]);

    async function signIn() {
      setPending(true);
      setFailed(false);
      try {
        const errorCallbackURL = new URL("/sign-in", window.location.origin);
        errorCallbackURL.searchParams.set("next", next ?? "/workspaces");
        const { error } = await authClient.signIn.social({
          callbackURL: new URL(next ?? "/workspaces", window.location.origin).href,
          errorCallbackURL: errorCallbackURL.href,
          provider: "google",
        });
        if (error) {
          setFailed(true);
          setPending(false);
        }
      } catch {
        setFailed(true);
        setPending(false);
      }
    }

    async function signOut() {
      setPending(true);
      setFailed(false);
      try {
        const { error } = await authClient.signOut();
        setFailed(Boolean(error));
      } catch {
        setFailed(true);
      }
      setPending(false);
    }

    return (
      <AuthPageLayout>
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
            {currentSession ? m.login_success() : m.login_heading()}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {currentSession ? m.login_success_description() : m.login_description()}
          </p>
        </div>

        {/* 静态 HTML 不包含回调参数，水合后再显示登录错误。
            Static HTML has no callback parameters; show sign-in errors after hydration. */}
        {hydrated && failed && (
          <Alert variant="error">
            <IconAlertCircle aria-hidden="true" />
            <AlertTitle>{m.login_error_title()}</AlertTitle>
            <AlertDescription>{m.login_error_description()}</AlertDescription>
          </Alert>
        )}

        {phase === "skeleton" && <SignInSessionSkeleton />}
        {currentSession ? (
          <div className="flex flex-col gap-4">
            <div className="flex min-w-0 flex-col gap-1 text-center">
              <p className="font-medium truncate">{currentSession.user.name}</p>
              <p className="text-sm text-muted-foreground break-all">{currentSession.user.email}</p>
            </div>
            <Button variant="outline" size="xl" disabled={pending} onClick={signOut}>
              {pending && <Spinner />}
              {pending ? m.login_signing_out() : m.login_sign_out()}
            </Button>
          </div>
        ) : (
          phase === "ready" && (
            <Button
              variant="outline"
              size="xl"
              className="w-full"
              disabled={pending}
              onClick={signIn}
              aria-busy={pending}
            >
              {pending ? (
                <Spinner />
              ) : (
                <img src="/logos/google.svg" alt="" width={20} height={20} className="size-5" />
              )}
              {pending ? m.login_connecting() : m.login_google()}
            </Button>
          )
        )}
      </AuthPageLayout>
    );
  },
});
