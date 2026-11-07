import { Link } from "@tanstack/react-router";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

import * as m from "@/paraglide/messages";

import { LanguageSwitcher } from "@/components/i18n/language-switcher";

/**
 * 公共未找到页面，提供品牌、语言切换和返回入口。
 * Public not-found page with branding, language switching and return navigation.
 */
export function NotFoundPage() {
  return (
    <div className="relative mx-auto min-h-svh w-full max-w-[105rem] px-4 sm:px-8 lg:px-16">
      <header className="absolute inset-x-0 top-0 flex items-center justify-between px-4 py-5 sm:px-8 lg:px-16">
        <Link to="/" className="flex items-center gap-2.5 font-medium">
          <BrandMark />
          Sainoa
        </Link>
        <LanguageSwitcher />
      </header>
      <main className="not-found-page">
        <p className="text-7xl leading-none font-bold tracking-tight sm:text-8xl">404</p>
        <h1>{m.app_not_found_title()}</h1>
        <Button className="home-button primary" render={<Link to="/" />}>
          {m.app_back_home()}
        </Button>
      </main>
    </div>
  );
}
