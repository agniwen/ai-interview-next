import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { ThemeProvider } from "next-themes";
import { NotFoundPage } from "@/components/home/not-found";
import { getLocale } from "@/paraglide/runtime";

import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";

import appCss from "../styles.css?url";
import homeCss from "../components/home/home.css?url";

import type { QueryClient } from "@tanstack/react-query";

interface MyRouterContext {
  queryClient: QueryClient;
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang={getLocale()} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="relative">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          storageKey="sainoa-theme"
        >
          <div className="isolate relative flex min-h-svh flex-col">
            {children}
            <TanStackDevtools
              config={{
                position: "bottom-right",
              }}
              plugins={[
                {
                  name: "Tanstack Router",
                  render: <TanStackRouterDevtoolsPanel />,
                },
                TanStackQueryDevtools,
              ]}
            />
          </div>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Sainoa",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.ico",
        type: "image/x-icon",
        media: "(prefers-color-scheme: light)",
      },
      {
        rel: "icon",
        href: "/favicon-dark.ico",
        type: "image/x-icon",
        media: "(prefers-color-scheme: dark)",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "stylesheet", href: homeCss },
    ],
  }),
  notFoundComponent: NotFoundPage,
  shellComponent: RootDocument,
});
