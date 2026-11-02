import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

import * as m from "@/paraglide/messages";

import { LanguageSwitcher } from "@/components/i18n/language-switcher";

export function NotFoundPage() {
  return (
    <main className="not-found-page">
      <LanguageSwitcher />
      <p className="eyebrow">404</p>
      <h1>{m.app_not_found_title()}</h1>
      <p>{m.app_not_found_description()}</p>
      <Button className="home-button primary" render={<Link to="/" />}>
        {m.app_back_home()}
      </Button>
    </main>
  );
}
