import { useState } from "react";
import { IconChevronDown, IconLogout, IconUser } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/client";
import * as m from "@/paraglide/messages";

export function UserMenu() {
  const { data: session, isPending } = authClient.useSession();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut() {
    setPending(true);
    setFailed(false);
    try {
      const { error } = await authClient.signOut();
      setFailed(Boolean(error));
    } catch {
      setFailed(true);
    }
    setPending(false);
  }

  if (isPending) {
    return (
      <Button variant="ghost" disabled aria-busy="true" aria-label={m.auth_loading()}>
        <Spinner />
      </Button>
    );
  }

  if (!session) {
    return (
      <Button variant="ghost" render={<Link to="/sign-in" />}>
        {m.login_title()}
      </Button>
    );
  }

  return (
    <Menu>
      <MenuTrigger render={<Button variant="ghost" className="min-w-0 shrink" />}>
        <Avatar className="size-6 [--avatar-size:1.5rem]">
          <AvatarImage src={session.user.image ?? undefined} alt="" referrerPolicy="no-referrer" />
          <AvatarFallback>
            <IconUser className="size-4" aria-hidden="true" />
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 max-w-20 truncate sm:max-w-40">{session.user.name}</span>
        <IconChevronDown className="size-3.5" aria-hidden="true" />
      </MenuTrigger>
      <MenuPopup align="end" className="w-52">
        <MenuItem disabled={pending} closeOnClick={false} onClick={signOut}>
          {pending ? (
            <Spinner className="size-4" />
          ) : (
            <IconLogout className="size-4" aria-hidden="true" />
          )}
          {pending ? m.login_signing_out() : m.login_sign_out()}
        </MenuItem>
        {failed && (
          <p role="alert" className="px-2 py-1.5 text-sm text-destructive-foreground">
            {m.auth_sign_out_error()}
          </p>
        )}
      </MenuPopup>
    </Menu>
  );
}
