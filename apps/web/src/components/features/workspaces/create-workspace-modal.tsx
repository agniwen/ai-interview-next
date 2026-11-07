import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { CreateWorkspace } from "./create-workspace";
import * as m from "@/paraglide/messages";

export function CreateWorkspaceModal({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title={m.ws_create()}
      description={m.ws_create_description()}
      closeLabel={m.ws_cancel()}
      trigger={<Button variant="outline">{m.ws_create()}</Button>}
    >
      <CreateWorkspace />
    </Modal>
  );
}
