import { useTheme } from "next-themes";
import { useHydrated } from "@tanstack/react-router";
import { IconSun, IconMoon, IconDeviceDesktop } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Menu, MenuTrigger, MenuPopup, MenuRadioGroup, MenuRadioItem } from "@/components/ui/menu";
import * as m from "@/paraglide/messages";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const selected = hydrated ? theme : "system";
  let Icon = IconDeviceDesktop;
  if (selected === "light") {
    Icon = IconSun;
  }
  if (selected === "dark") {
    Icon = IconMoon;
  }

  return (
    <Menu>
      <MenuTrigger aria-label={m.theme_label()} render={<Button variant="ghost" size="icon" />}>
        <Icon aria-hidden="true" />
      </MenuTrigger>
      <MenuPopup align="end" aria-label={m.theme_label()}>
        <MenuRadioGroup value={selected} onValueChange={setTheme}>
          <MenuRadioItem value="light">
            <span className="flex items-center gap-2">
              <IconSun aria-hidden="true" />
              {m.theme_light()}
            </span>
          </MenuRadioItem>
          <MenuRadioItem value="dark">
            <span className="flex items-center gap-2">
              <IconMoon aria-hidden="true" />
              {m.theme_dark()}
            </span>
          </MenuRadioItem>
          <MenuRadioItem value="system">
            <span className="flex items-center gap-2">
              <IconDeviceDesktop aria-hidden="true" />
              {m.theme_system()}
            </span>
          </MenuRadioItem>
        </MenuRadioGroup>
      </MenuPopup>
    </Menu>
  );
}
