import { IconChevronDown as ChevronDown, IconLanguage as Languages } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Menu, MenuTrigger, MenuPopup, MenuRadioGroup, MenuRadioItem } from "@/components/ui/menu";

import * as m from "@/paraglide/messages";
import { getLocale, setLocale, locales } from "@/paraglide/runtime";

const languageNames = { en: "English", ja: "日本語", ko: "한국어", "zh-CN": "简体中文" };

/**
 * 语言切换菜单，通过 Paraglide 修改当前语言，支持完整按钮与仅图标入口。
 * Language menu changing the active Paraglide locale, with full-button and icon-only variants.
 */
export function LanguageSwitcher({ iconOnly = false }: { iconOnly?: boolean }) {
  return (
    <Menu>
      <MenuTrigger
        aria-label={m.language_switcher_label()}
        render={<Button variant="ghost" size={iconOnly ? "icon" : "default"} />}
      >
        <Languages aria-hidden="true" />
        {!iconOnly && (
          <>
            <span>{languageNames[getLocale()]}</span>
            <ChevronDown aria-hidden="true" className="size-3.5 text-muted-foreground" />
          </>
        )}
      </MenuTrigger>
      <MenuPopup align="end" className="w-44" aria-label={m.language_switcher_label()}>
        <MenuRadioGroup value={getLocale()} onValueChange={(locale) => setLocale(locale)}>
          {locales.map((locale) => (
            <MenuRadioItem value={locale} key={locale} lang={locale}>
              {languageNames[locale]}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuPopup>
    </Menu>
  );
}
