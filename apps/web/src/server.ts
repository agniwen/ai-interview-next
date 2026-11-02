import handler from "@tanstack/react-start/server-entry";

import { paraglideMiddleware } from "./paraglide/server";

export default {
  fetch(request: Request) {
    // Keep the original URL: the router owns locale-prefix rewriting.
    return paraglideMiddleware(request, () => handler.fetch(request));
  },
};
