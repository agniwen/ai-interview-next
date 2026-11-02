import { useState } from "react";
import { IconArrowLeft, IconAlertCircle } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/brand-mark";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { BrandBackground } from "@/components/shaders/brand-background";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/client";
import * as m from "@/paraglide/messages";
import { localizeHref } from "@/paraglide/runtime";

export function LoginPage({ hasCallbackError }: { hasCallbackError: boolean }) {
  const { data: session, isPending } = authClient.useSession();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(hasCallbackError);

  async function signIn() {
    setPending(true);
    setFailed(false);
    try {
      const { error } = await authClient.signIn.social({
        callbackURL: new URL(localizeHref("/login"), window.location.origin).href,
        errorCallbackURL: new URL(localizeHref("/login"), window.location.origin).href,
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
          <section className="flex min-w-0 flex-col">
            <header className="flex items-center justify-between gap-2 px-2 sm:px-4">
              <Link to="/" className="flex items-center gap-2.5 font-medium">
                <BrandMark />
                Sainoa
              </Link>
              <LanguageSwitcher />
            </header>
            <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 py-16 sm:py-24">
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">{m.login_tagline()}</p>
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
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="font-medium truncate">{session.user.name}</p>
                    <p className="text-sm text-muted-foreground break-all">{session.user.email}</p>
                  </div>
                  <Button variant="outline" size="xl" disabled={pending} onClick={signOut}>
                    {pending && <Spinner />}
                    {pending ? m.login_signing_out() : m.login_sign_out()}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
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
                  <p className="text-center text-xs leading-5 text-muted-foreground">
                    {m.login_first_visit()}
                  </p>
                </div>
              )}

              <Button variant="ghost" className="self-start -ml-3" render={<Link to="/" />}>
                <IconArrowLeft data-icon="inline-start" aria-hidden="true" />
                {m.login_back()}
              </Button>
            </div>
            <p className="px-4 pb-2 text-xs text-muted-foreground">
              Sainoa · {m.home_brand_meaning()}
            </p>
          </section>

          <BrandBackground className="relative hidden min-h-[36rem] rounded-3xl lg:block" />
        </div>
      </main>
    </ScrollArea>
  );
}
