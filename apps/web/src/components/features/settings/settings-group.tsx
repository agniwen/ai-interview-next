import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  List,
  ListItem,
  ListContent,
  ListTitle,
  ListDescription,
  ListActions,
} from "@/components/ui/list";

/**
 * 将一组设置条目放入带标题的分区，条目布局由 SettingsRow 提供。
 * Groups settings under a section heading; SettingsRow supplies each item's layout.
 */
export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label={title}>
      <h2 className="px-1 text-sm font-medium text-muted-foreground">{title}</h2>
      <List className="rounded-xl bg-muted px-4 [&>[data-slot=list-item]]:py-4">{children}</List>
    </section>
  );
}

/**
 * 排列单项设置的标题、说明和操作区，可在移动端将操作放到下一行。
 * Arranges a setting's title, description and actions, optionally stacking actions on mobile.
 */
export function SettingsRow({
  title,
  description,
  children,
  stackOnMobile = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  stackOnMobile?: boolean;
}) {
  return (
    <ListItem className={cn("sm:gap-8", !stackOnMobile && "flex-row items-center")}>
      <ListContent>
        <ListTitle>{title}</ListTitle>
        {description && <ListDescription className="break-normal">{description}</ListDescription>}
      </ListContent>
      <ListActions
        className={cn("sm:w-auto sm:max-w-[55%]", stackOnMobile ? "w-full" : "max-w-[55%]")}
      >
        {children}
      </ListActions>
    </ListItem>
  );
}
