import { useHydrated } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { cn } from "@/lib/utils";

const BrandShader = lazy(() => import("./brand-shader"));

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
