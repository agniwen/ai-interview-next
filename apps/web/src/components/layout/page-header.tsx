import { createMagicPortal } from "foxact/magic-portal";

export const [PageHeaderProvider, PageHeaderTarget, PageHeaderContent] =
  createMagicPortal("PageHeader");

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="flex min-w-0 flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight wrap-anywhere">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </header>
  );
}
