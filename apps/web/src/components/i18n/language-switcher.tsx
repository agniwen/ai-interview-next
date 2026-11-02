import { useHydrated, useLocation } from "@tanstack/react-router";
import {
  IconCheck as Check,
  IconChevronDown as ChevronDown,
  IconLanguage as Languages,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Menu, MenuTrigger, MenuPopup, MenuLinkItem } from "@/components/ui/menu";

import * as m from "@/paraglide/messages";
import { getLocale, localizeHref, locales } from "@/paraglide/runtime";

const languageNames = { en: "English", ja: "日本語", ko: "한국어", "zh-CN": "简体中文" };

export function LanguageSwitcher() {
  const location = useLocation();
  const hydrated = useHydrated();
  // Fragments are not sent to the server; add them after hydration.
  const href = hydrated ? location.href : location.href.split("#")[0];
  return (
    <Menu>
      <MenuTrigger aria-label={m.language_switcher_label()} render={<Button variant="ghost" />}>
        <Languages aria-hidden="true" className="size-4" />
        <span>{languageNames[getLocale()]}</span>
        <ChevronDown aria-hidden="true" className="size-3.5 text-muted-foreground" />
      </MenuTrigger>
      <MenuPopup align="end" className="w-44" aria-label={m.language_switcher_label()}>
        {locales.map((locale) => (
          <MenuLinkItem
            className="justify-between"
            aria-current={getLocale() === locale ? "true" : undefined}
            href={localizeHref(href, { locale })}
            hrefLang={locale}
            key={locale}
            lang={locale}
          >
            {languageNames[locale]}
            {getLocale() === locale && <Check aria-hidden="true" className="size-4" />}
          </MenuLinkItem>
        ))}
      </MenuPopup>
    </Menu>
  );
}
