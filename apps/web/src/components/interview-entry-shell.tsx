import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { InterviewEntryBackground } from "@/components/interview-entry-background";

/**
 * 候选人面试的独立页面外壳，统一点阵背景、语言和主题入口及居中内容区。
 * Standalone candidate-interview shell sharing the dot background, language/theme controls and centered content.
 */
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
        className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-5 py-24 text-center"
      >
        {children}
      </main>
    </div>
  );
}
