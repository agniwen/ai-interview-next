import { createMagicPortal } from "foxact/magic-portal";

export const pageHeaderFadeClassName =
  "isolate z-10 after:pointer-events-none after:absolute after:inset-0 after:-bottom-6 after:-z-1 after:bg-linear-to-b after:from-background after:from-20% after:via-background/85 after:via-50% after:to-transparent";

/**
 * 页面标题及顶栏插槽：页面通过 Content 提供操作内容，由外层 Target 放入共用顶栏。
 * Page title and header slot: pages supply actions through Content for the shell's Target to render.
 */
export const [PageHeaderProvider, PageHeaderTarget, PageHeaderContent] =
  createMagicPortal("PageHeader");

/**
 * 渲染内容区内的标题与说明；顶栏操作使用同模块的 PageHeaderContent 插槽。
 * Renders the content-area heading and description; top-bar actions use this module's PageHeaderContent slot.
 */
export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="flex min-w-0 flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight wrap-anywhere">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </header>
  );
}
