import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { LoginPage } from "@/components/auth/login-page";
import * as m from "@/paraglide/messages";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ error: z.string().optional() }),
  head: () => ({
    meta: [
      { title: `${m.login_title()} — Sainoa` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  // Named component keeps React hook detection intact in the route definition.
  // oxlint-disable-next-line func-name-matching
  component: function Login() {
    const { error } = Route.useSearch();
    return <LoginPage hasCallbackError={Boolean(error)} />;
  },
});
