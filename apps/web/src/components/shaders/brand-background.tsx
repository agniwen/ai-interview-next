import { useHydrated } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { cn } from "@/lib/utils";

const BrandShader = lazy(() => import("./brand-shader"));

/**
 * 品牌着色器的延迟加载与降级容器，在水合和着色器准备期间保留静态背景。
 * Lazy-loading brand shader container retaining a static backdrop during hydration and shader loading.
 */
export function BrandBackground({
  className,
  animated = false,
}: {
  className?: string;
  animated?: boolean;
}) {
  const hydrated = useHydrated();

  return (
    <div
      aria-hidden="true"
      className={cn("brand-background pointer-events-none overflow-hidden", className)}
    >
      {hydrated && (
        <Suspense fallback={null}>
          <BrandShader animated={animated} />
        </Suspense>
      )}
    </div>
  );
}
