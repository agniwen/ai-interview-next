import { IconCheck, IconCopy } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AuthPageLayout } from "@/components/features/auth/auth-page-layout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import * as m from "@/paraglide/messages";

function McpIntro() {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  async function copyPrompt() {
    const endpoint = new URL("/api/mcp", window.location.origin).href;
    try {
      await navigator.clipboard.writeText(m.mcp_intro_prompt({ endpoint }));
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  return (
    <AuthPageLayout contentClassName="max-w-lg">
      <div className="grid gap-2">
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">{m.mcp_intro_title()}</h1>
        <p className="text-sm leading-6 text-muted-foreground">{m.mcp_intro_description()}</p>
      </div>
      <div className="flex flex-col items-start gap-3">
        <Button onClick={copyPrompt}>
          {copyState === "copied" ? (
            <IconCheck aria-hidden="true" data-icon="inline-start" />
          ) : (
            <IconCopy aria-hidden="true" data-icon="inline-start" />
          )}
          {copyState === "copied" ? m.mcp_intro_copied() : m.mcp_intro_copy()}
        </Button>
        <output className="sr-only">{copyState === "copied" ? m.mcp_intro_copied() : ""}</output>
        {copyState === "error" && (
          <Alert variant="error">
            <AlertDescription>{m.mcp_intro_copy_error()}</AlertDescription>
          </Alert>
        )}
      </div>
    </AuthPageLayout>
  );
}

export const Route = createFileRoute("/mcp/")({
  component: McpIntro,
  head: () => ({
    meta: [
      { title: `${m.mcp_intro_menu()} — Sainoa` },
      { name: "description", content: m.mcp_intro_description() },
    ],
  }),
});
