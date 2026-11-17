import { useHydrated } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const BrandShader = lazy(() => import("./brand-shader"));

/**
 * 品牌着色器的延迟加载与降级容器，在水合和着色器准备期间保留静态背景。
 * Lazy-loading brand shader container retaining a static backdrop during hydration and shader loading.
 */
export function BrandBackground({
  className,
  animated = false,
  deferUntilFirstPaint = false,
}: {
  className?: string;
  animated?: boolean;
  deferUntilFirstPaint?: boolean;
}) {
  const hydrated = useHydrated();
  const [firstContentPainted, setFirstContentPainted] = useState(false);

  useEffect(() => {
    if (!deferUntilFirstPaint) {
      return;
    }

    // 首次内容绘制可能早于水合，因此也读取浏览器已记录的绘制条目。
    // Read buffered paint entries because first contentful paint can precede hydration.
    const observer = new PerformanceObserver((entries) => {
      if (entries.getEntriesByName("first-contentful-paint").length > 0) {
        setFirstContentPainted(true);
        observer.disconnect();
      }
    });
    observer.observe({ buffered: true, type: "paint" });
    return () => observer.disconnect();
  }, [deferUntilFirstPaint]);

  return (
    <div
      aria-hidden="true"
      className={cn("brand-background pointer-events-none overflow-hidden", className)}
    >
      {hydrated && (!deferUntilFirstPaint || firstContentPainted) && (
        <Suspense fallback={null}>
          <BrandShader animated={animated} />
        </Suspense>
      )}
    </div>
  );
}
