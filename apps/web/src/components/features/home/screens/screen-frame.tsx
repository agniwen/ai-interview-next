import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const DEMO_CANVAS_WIDTH = 1440;
export const DEMO_CANVAS_HEIGHT = 856;

interface ScreenFrameProps {
  children: ReactNode;
  className?: string;
}

// 不再模仿 macOS 窗口：去掉标题栏与内边距，把高度留给演示内容。
// No faux macOS chrome: the title bar and padding go, leaving the height to the demo.
/**
 * 将固定 1440×856 的演示画布缩放到容器宽度，保持内部桌面布局比例。
 * Scales a fixed 1440x856 demo canvas to its container width while preserving the internal desktop layout.
 */
export function ScreenFrame({ children, className }: ScreenFrameProps) {
  return (
    <div
      data-slot="screen-frame"
      className={cn(
        "relative overflow-hidden rounded-[12px] bg-background shadow-extra-large select-none",
        className,
      )}
    >
      <div
        data-slot="screen-frame-content"
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: `${DEMO_CANVAS_WIDTH} / ${DEMO_CANVAS_HEIGHT}`,
          containerType: "inline-size",
        }}
      >
        <div
          className="absolute top-0 left-0"
          style={{
            height: DEMO_CANVAS_HEIGHT,
            transform: `scale(calc(100cqi / ${DEMO_CANVAS_WIDTH}px))`,
            transformOrigin: "top left",
            width: DEMO_CANVAS_WIDTH,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
