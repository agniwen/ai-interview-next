import { IconArrowLeft } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { BrandBackground } from "@/components/shaders/brand-background";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages";

export function AuthPageLayout({
  children,
  contentClassName,
}: {
  children: ReactNode;
  contentClassName?: string;
}) {
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
            <div
              className={cn(
                "mx-auto flex w-full min-w-0 max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16 sm:py-24",
                contentClassName,
              )}
            >
              {children}
            </div>
          </section>
          <BrandBackground className="relative hidden min-h-[36rem] rounded-3xl lg:sticky lg:top-6 lg:block lg:h-[calc(100dvh-3rem)]" />
        </div>
      </main>
    </ScrollArea>
  );
}
