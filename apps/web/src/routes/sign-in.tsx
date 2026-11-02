import { useState } from "react";
import { IconArrowLeft, IconAlertCircle } from "@tabler/icons-react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { BrandBackground } from "@/components/shaders/brand-background";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/client";
import * as m from "@/paraglide/messages";
import { localizeHref } from "@/paraglide/runtime";

export const Route = createFileRoute("/sign-in")({
  validateSearch: z.object({ error: z.string().optional() }),
  head: () => ({
    meta: [
      { title: `${m.login_title()} — Sainoa` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  // Named component keeps React hook detection intact in the route definition.
  // oxlint-disable-next-line func-name-matching
  component: function Login() {
    const { error: callbackError } = Route.useSearch();
    const { data: session, isPending } = authClient.useSession();
    const [pending, setPending] = useState(false);
    const [failed, setFailed] = useState(Boolean(callbackError));

    async function signIn() {
      setPending(true);
      setFailed(false);
      try {
        const { error } = await authClient.signIn.social({
          callbackURL: new URL(localizeHref("/sign-in"), window.location.origin).href,
          errorCallbackURL: new URL(localizeHref("/sign-in"), window.location.origin).href,
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
      <ScrollArea className="h-dvh">
        <main id="main-content" className="home-page min-h-dvh p-4 sm:p-6">
          <div className="grid min-h-[calc(100dvh-2rem)] gap-6 sm:min-h-[calc(100dvh-3rem)] lg:grid-cols-2">
            <section className="relative flex min-w-0 flex-col">
              <header className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 px-2 sm:px-4">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={m.login_back()}
                  render={<Link to="/" />}
                >
                  <IconArrowLeft aria-hidden="true" />
                </Button>
                <div className="flex items-center gap-1">
                  <ThemeSwitcher />
                  <LanguageSwitcher />
                </div>
              </header>
              <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16 sm:py-24">
                <div className="flex flex-col gap-2 text-center">
                  <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
                    {session ? m.login_success() : m.login_heading()}
                  </h1>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {session ? m.login_success_description() : m.login_description()}
                  </p>
                </div>

                {failed && (
                  <Alert variant="error">
                    <IconAlertCircle aria-hidden="true" />
                    <AlertTitle>{m.login_error_title()}</AlertTitle>
                    <AlertDescription>{m.login_error_description()}</AlertDescription>
                  </Alert>
                )}

                {session ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex min-w-0 flex-col gap-1 text-center">
                      <p className="font-medium truncate">{session.user.name}</p>
                      <p className="text-sm text-muted-foreground break-all">
                        {session.user.email}
                      </p>
                    </div>
                    <Button variant="outline" size="xl" disabled={pending} onClick={signOut}>
                      {pending && <Spinner />}
                      {pending ? m.login_signing_out() : m.login_sign_out()}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="xl"
                    className="w-full"
                    disabled={pending || isPending}
                    onClick={signIn}
                    aria-busy={pending}
                  >
                    {pending ? (
                      <Spinner />
                    ) : (
                      <img
                        src="/logos/google.svg"
                        alt=""
                        width={20}
                        height={20}
                        className="size-5"
                      />
                    )}
                    {pending ? m.login_connecting() : m.login_google()}
                  </Button>
                )}
              </div>
            </section>

            <BrandBackground className="relative hidden min-h-[36rem] rounded-3xl lg:block" />
          </div>
        </main>
      </ScrollArea>
    );
  },
});
