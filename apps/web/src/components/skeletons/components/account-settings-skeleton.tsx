import { SettingsGroupSkeleton } from "./settings-group-skeleton";
import * as m from "@/paraglide/messages";

/**
 * 账号资料和偏好设置的内容骨架，通过设置分组骨架保留头像及字段布局。
 * Profile and preference content skeleton retaining avatar and field layout through settings-group placeholders.
 */
export function AccountSettingsSkeleton() {
  return (
    <output aria-label={m.auth_loading()} aria-busy="true" className="flex min-w-0 flex-col gap-7">
      <SettingsGroupSkeleton rows={5} avatar />
      <SettingsGroupSkeleton rows={2} />
    </output>
  );
}
