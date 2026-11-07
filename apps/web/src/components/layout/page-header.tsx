import { createMagicPortal } from "foxact/magic-portal";

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
