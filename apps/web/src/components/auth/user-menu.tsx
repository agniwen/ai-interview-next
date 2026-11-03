import { useState } from "react";
import { IconChevronDown, IconLogin, IconLogout, IconUser } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuGroup,
  MenuItem,
  MenuPopup,
  MenuTrigger,
  MenuSeparator,
} from "@/components/ui/menu";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages";
import { localizeHref } from "@/paraglide/runtime";

function userMenuLayout(sidebar: boolean, collapsed: boolean, iconOnly: boolean) {
  const triggerClassName = cn(
    "min-w-0",
    iconOnly ? "shrink-0" : "shrink",
    sidebar && "h-10 w-full justify-start gap-0 overflow-hidden px-[7px] sm:h-10",
  );
  const iconSlotClassName = sidebar
    ? "flex size-6 shrink-0 items-center justify-center"
    : "contents";
  const labelClassName = cn(
    "min-w-0 truncate",
    sidebar
      ? "flex-1 pl-2 pr-6 text-left transition-opacity duration-200 ease-linear motion-reduce:transition-none"
      : "max-w-20 sm:max-w-40",
    collapsed && "opacity-0",
  );

  const avatarClassName = iconOnly
    ? "size-4.5 [--avatar-size:1.125rem] sm:size-4 sm:[--avatar-size:1rem]"
    : "size-6 [--avatar-size:1.5rem]";
  return { avatarClassName, iconSlotClassName, labelClassName, triggerClassName };
}

function AccountMenuItem({ workspaceId }: { workspaceId?: string }) {
  return (
    <MenuItem
      render={
        workspaceId ? (
          <Link to="/w/$workspaceId/account" params={{ workspaceId }} />
        ) : (
          <Link to="/account" />
        )
      }
    >
      <IconUser aria-hidden="true" />
      {m.account_title()}
    </MenuItem>
  );
}

export function UserMenu({
  variant = "header",
  collapsed = false,
  iconOnly = false,
  workspaceId,
}: {
  variant?: "header" | "sidebar";
  collapsed?: boolean;
  iconOnly?: boolean;
  workspaceId?: string;
}) {
  const { data: session, isPending } = authClient.useSession();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const sidebar = variant === "sidebar";
  const { triggerClassName, iconSlotClassName, labelClassName, avatarClassName } = userMenuLayout(
    sidebar,
    collapsed,
    iconOnly,
  );
  const buttonSize = iconOnly ? "icon" : "default";

  async function signOut() {
    setPending(true);
    setFailed(false);
    try {
      const { error } = await authClient.signOut();
      setFailed(Boolean(error));
      if (!error) {
        window.location.assign(localizeHref("/sign-in"));
      }
    } catch {
      setFailed(true);
    }
    setPending(false);
  }

  if (isPending) {
    return (
      <Button
        className={triggerClassName}
        variant="ghost"
        size={buttonSize}
        disabled
        aria-busy="true"
        aria-label={m.auth_loading()}
      >
        <span className={iconSlotClassName}>
          <Spinner />
        </span>
      </Button>
    );
  }

  if (!session) {
    return (
      <Button
        className={triggerClassName}
        variant="ghost"
        size={buttonSize}
        aria-label={m.login_title()}
        render={<Link to="/sign-in" />}
      >
        {(sidebar || iconOnly) && (
          <span className={iconSlotClassName}>
            <IconLogin className="size-4" aria-hidden="true" />
          </span>
        )}
        {!iconOnly && <span className={labelClassName}>{m.login_title()}</span>}
      </Button>
    );
  }

  return (
    <Menu>
      <MenuTrigger
        aria-label={session.user.name}
        render={<Button variant="ghost" className={triggerClassName} size={buttonSize} />}
      >
        <span className={iconSlotClassName}>
          <Avatar className={avatarClassName}>
            <AvatarImage
              src={session.user.image ?? undefined}
              alt=""
              referrerPolicy="no-referrer"
            />
            <AvatarFallback>
              <IconUser className="size-4" aria-hidden="true" />
            </AvatarFallback>
          </Avatar>
        </span>
        {!iconOnly && <span className={labelClassName}>{session.user.name}</span>}
        {!iconOnly && (
          <IconChevronDown
            className={cn(
              "size-3.5",
              sidebar &&
                "absolute right-3 top-1/2 -translate-y-1/2 transition-opacity duration-200 ease-linear motion-reduce:transition-none",
              collapsed && "opacity-0",
            )}
            aria-hidden="true"
          />
        )}
      </MenuTrigger>
      <MenuPopup
        align={sidebar ? "start" : "end"}
        side={sidebar ? "top" : "bottom"}
        className="w-52"
      >
        <MenuGroup>
          <AccountMenuItem workspaceId={workspaceId} />
        </MenuGroup>
        <MenuSeparator />
        <MenuGroup>
          <MenuItem disabled={pending} closeOnClick={false} onClick={signOut}>
            {pending ? (
              <Spinner className="size-4" />
            ) : (
              <IconLogout className="size-4" aria-hidden="true" />
            )}
            {pending ? m.login_signing_out() : m.login_sign_out()}
          </MenuItem>
        </MenuGroup>
        {failed && (
          <p role="alert" className="px-2 py-1.5 text-sm text-destructive-foreground">
            {m.auth_sign_out_error()}
          </p>
        )}
      </MenuPopup>
    </Menu>
  );
}
