import { createFileRoute } from "@tanstack/react-router";

import { HomePage } from "@/components/home/home-page";
import * as m from "@/paraglide/messages";
import { localizeHref, locales } from "@/paraglide/runtime";

export const Route = createFileRoute("/")({
  head: () => ({
    links: locales.map((locale) => ({
      href: localizeHref("/", { locale }),
      hrefLang: locale,
      rel: "alternate",
    })),
    meta: [
      { title: `Sainoa — ${m.home_hero_tagline()}` },
      { content: m.home_document_description(), name: "description" },
    ],
  }),
  component: HomePage,
});
