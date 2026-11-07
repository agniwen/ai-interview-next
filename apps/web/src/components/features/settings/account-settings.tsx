import { LocalTime } from "@/components/local-time";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import { AccountSettingsSkeleton } from "@/components/skeletons/components/account-settings-skeleton";
import { useTheme } from "next-themes";
import { useHydrated } from "@tanstack/react-router";
import { IconUser } from "@tabler/icons-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { authClient } from "@/lib/auth/client";
import { authData } from "@/lib/workspaces/actions";
import { SettingsGroup, SettingsRow } from "./settings-group";
import { AutoSaveInput } from "./auto-save-input";
import * as m from "@/paraglide/messages";

function ThemeSelect() {
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const items = [
    { label: m.theme_system(), value: "system" },
    { label: m.theme_light(), value: "light" },
    { label: m.theme_dark(), value: "dark" },
  ];
  return (
    <Select<string>
      value={hydrated ? theme : "system"}
      items={items}
      onValueChange={(value) => {
        if (value) {
          setTheme(value);
        }
      }}
    >
      <SelectTrigger aria-label={m.theme_label()}>
        <SelectValue />
      </SelectTrigger>
      <SelectPopup>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectPopup>
    </Select>
  );
}

/**
 * 当前账号资料与偏好设置，包含姓名保存、身份信息、主题和语言切换。
 * Current-account profile and preferences, including name saving, identity details, theme and language.
 */
export function AccountSettings() {
  const { data: session, isPending } = authClient.useSession();
  const phase = useSkeletonPhase(isPending && !session);
  if (phase === "skeleton") {
    return <AccountSettingsSkeleton />;
  }
  if (phase === "pending") {
    return null;
  }
  if (!session) {
    return null;
  }
  const { user } = session;
  return (
    <div className="flex min-w-0 flex-col gap-7">
      <SettingsGroup title={m.account_profile()}>
        <SettingsRow title={m.account_avatar()}>
          <Avatar className="size-12 [--avatar-size:3rem]">
            <AvatarImage src={user.image ?? undefined} alt="" referrerPolicy="no-referrer" />
            <AvatarFallback>
              <IconUser aria-hidden="true" />
            </AvatarFallback>
          </Avatar>
        </SettingsRow>
        <SettingsRow title={m.account_name()} stackOnMobile>
          <AutoSaveInput
            key={user.id}
            id="account-name"
            label={m.account_name()}
            value={user.name}
            onSave={async (name) => authData(await authClient.updateUser({ name }))}
          />
        </SettingsRow>
        <SettingsRow title={m.ws_email()} description={m.account_email_description()} stackOnMobile>
          <span className="break-all text-sm">{user.email}</span>
        </SettingsRow>
        <SettingsRow title={m.account_provider()}>
          <span className="text-sm">Google</span>
        </SettingsRow>
        <SettingsRow title={m.account_created()}>
          <span className="text-sm">
            <LocalTime value={user.createdAt} format="date" />
          </span>
        </SettingsRow>
      </SettingsGroup>
      <SettingsGroup title={m.account_preferences()}>
        <SettingsRow title={m.theme_label()}>
          <ThemeSelect />
        </SettingsRow>
        <SettingsRow title={m.language_switcher_label()}>
          <LanguageSwitcher />
        </SettingsRow>
      </SettingsGroup>
    </div>
  );
}
