import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { InterviewEntryBackground } from "@/components/interview-entry-background";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * 候选人面试的独立页面外壳，统一点阵背景、语言和主题入口及居中内容区。
 * Standalone candidate-interview shell sharing the dot background, language/theme controls and centered content.
 */
export function InterviewEntryShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate h-dvh overflow-hidden bg-background">
      <InterviewEntryBackground />
      <header className="fixed inset-x-0 top-0 z-10 flex items-center justify-between gap-3 bg-linear-to-b from-background via-background/95 to-transparent px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-6 sm:px-6">
        <span className="text-sm font-medium">Sainoa</span>
        <div className="flex items-center gap-1">
          <LanguageSwitcher iconOnly />
          <ThemeSwitcher />
        </div>
      </header>
      <ScrollArea fill>
        <main
          id="main-content"
          className="relative mx-auto flex min-h-full w-full max-w-7xl flex-col items-center justify-center px-5 py-24 text-center"
        >
          {children}
        </main>
      </ScrollArea>
    </div>
  );
}
