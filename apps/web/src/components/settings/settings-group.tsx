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

export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label={title}>
      <h2 className="px-1 text-sm font-medium text-muted-foreground">{title}</h2>
      <List className="rounded-xl bg-muted px-4 [&>[data-slot=list-item]]:py-4">{children}</List>
    </section>
  );
}

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
