import { ScrollArea } from "@/components/ui/scroll-area";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { BrandMark } from "@/components/brand-mark";
import { CapabilityGrid } from "./capability-grid";
import { Faq } from "./faq";
import { FeatureBlocks } from "./feature-blocks";
import { HomeFooter } from "./footer";
import { Hero } from "./hero";
import { HeroBackground } from "./hero-background";
import { CtaSection } from "./cta-section";
import { ProductShot } from "./product-shot";
import { RoleTabs } from "./role-tabs";
import { SectionDivider } from "./section";
import { TrustBoundaries } from "./trust-boundaries";
import * as m from "@/paraglide/messages";
import { UserMenu } from "@/components/auth/user-menu";

export function HomePage() {
  return (
    <ScrollArea className="h-dvh">
      <div className="home-page" id="top">
        <a className="skip-link" href="#main-content">
          {m.home_skip()}
        </a>
        <header className="fixed inset-x-0 top-0 z-40 mx-auto flex w-full max-w-[105rem] flex-wrap items-center justify-between gap-2 px-4 py-5 sm:px-8 lg:px-16">
          <a href="#top" className="flex items-center gap-2.5 font-medium">
            <BrandMark />
            Sainoa
          </a>
          <div className="ml-auto flex max-w-full items-center gap-1 sm:gap-3">
            <UserMenu />
            <ThemeSwitcher />
            <LanguageSwitcher />
          </div>
        </header>
        <main id="main-content" className="pt-28 sm:pt-20">
          <div className="relative isolate">
            <HeroBackground />
            <div className="mx-auto w-full max-w-[105rem] px-6 pt-14 pb-8 sm:px-8 sm:pt-20 lg:px-16">
              <Hero />
            </div>
            <ProductShot />
          </div>
          <FeatureBlocks />
          <SectionDivider />
          <CapabilityGrid />
          <SectionDivider />
          <RoleTabs />
          <SectionDivider />
          <TrustBoundaries />
          <SectionDivider />
          <Faq />
          <SectionDivider />
          <CtaSection />
        </main>
        <HomeFooter />
      </div>
    </ScrollArea>
  );
}
