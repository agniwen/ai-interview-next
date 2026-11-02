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
      className={cn(
        "pointer-events-none overflow-hidden bg-[radial-gradient(ellipse_at_65%_45%,#c9baa2_0%,#e9dfce_35%,#fdfcfa_75%)]",
        className,
      )}
    >
      {hydrated && (
        <Suspense fallback={null}>
          <BrandShader animated={animated} />
        </Suspense>
      )}
    </div>
  );
}
