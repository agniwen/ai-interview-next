import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { InterviewEntryBackground } from "@/components/interview-entry-background";

export function InterviewEntryShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-svh flex-1 flex-col bg-background">
      <InterviewEntryBackground />
      <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 px-5 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <span className="text-sm font-medium">Sainoa</span>
        <div className="flex items-center gap-1">
          <LanguageSwitcher iconOnly />
          <ThemeSwitcher />
        </div>
      </header>
      <main
        id="main-content"
        className="relative mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-5 py-24 text-center"
      >
        {children}
      </main>
    </div>
  );
}
