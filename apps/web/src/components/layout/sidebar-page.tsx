import { createMagicPortal } from "foxact/magic-portal";

/**
 * 页面专属侧栏内容插槽，让 Agent 等页面向工作区主侧栏提供局部内容。
 * Page-specific sidebar slot letting pages such as Agent supply content to the workspace sidebar.
 */
export const [SidebarPageProvider, SidebarPageTarget, SidebarPageContent] =
  createMagicPortal("SidebarPage");
