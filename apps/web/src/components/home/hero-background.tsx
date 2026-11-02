import { useHydrated } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const HeroShader = lazy(() => import("@/components/shaders/hero-shader"));

export function HeroBackground() {
  const hydrated = useHydrated();

  return (
    <div aria-hidden="true" className="home-hero-background">
      {hydrated && (
        <Suspense fallback={null}>
          <HeroShader />
        </Suspense>
      )}
    </div>
  );
}
