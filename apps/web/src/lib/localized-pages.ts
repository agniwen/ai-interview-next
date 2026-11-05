export const publicPages = ["/", "/sign-in"] as const;

export function localizedAssetPath(path: (typeof publicPages)[number], locale: string) {
  return `/_localized/${locale}/${path === "/" ? "home" : "sign-in"}.html`;
}
