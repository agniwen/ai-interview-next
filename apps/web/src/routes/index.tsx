import { createFileRoute } from "@tanstack/react-router";

import { HomePage } from "@/components/features/home/home-page";
import * as m from "@/paraglide/messages";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `Sainoa — ${m.home_hero_tagline()}` },
      { content: m.home_document_description(), name: "description" },
    ],
  }),
  component: HomePage,
});
