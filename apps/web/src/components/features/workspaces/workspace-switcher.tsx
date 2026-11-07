import { IconBuilding, IconSelector, IconCheck } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import {
  Menu,
  MenuGroup,
  MenuItem,
  MenuPopup,
  MenuTrigger,
  MenuSeparator,
} from "@/components/ui/menu";
import { Button } from "@/components/ui/button";
import * as m from "@/paraglide/messages";

export function WorkspaceSwitcher({
  workspaceId,
  workspaces,
}: {
  workspaceId: string;
  workspaces: { id: string; name: string }[];
}) {
  const current = workspaces.find((workspace) => workspace.id === workspaceId);
  return (
    <Menu>
      <MenuTrigger
        render={<Button variant="ghost" className="max-w-44" />}
        aria-label={m.ws_switch()}
        title={current?.name}
      >
        <IconBuilding aria-hidden="true" />
        <span className="hidden truncate sm:block">{current?.name}</span>
        <IconSelector aria-hidden="true" />
      </MenuTrigger>
      <MenuPopup align="end" className="w-64">
        <MenuGroup>
          {workspaces.map((workspace) => (
            <MenuItem
              key={workspace.id}
              render={<Link to="/w/$workspaceId/agent" params={{ workspaceId: workspace.id }} />}
            >
              <span className="truncate">{workspace.name}</span>
              {workspace.id === workspaceId && <IconCheck className="ml-auto" aria-hidden="true" />}
            </MenuItem>
          ))}
        </MenuGroup>
        <MenuSeparator />
        <MenuGroup>
          <MenuItem render={<Link to="/w/$workspaceId/settings" params={{ workspaceId }} />}>
            {m.ws_manage()}
          </MenuItem>
        </MenuGroup>
      </MenuPopup>
    </Menu>
  );
}
