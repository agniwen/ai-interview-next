"use client";

import { SkeletonSuspense } from "@/components/skeletons/skeleton-suspense";
import { useInView } from "motion/react";
import { lazy, useRef } from "react";
import { useHydrated } from "@tanstack/react-router";
import { DemoWindowSkeleton } from "@/components/skeletons/components/demo-window-skeleton";
import { ScreenFrame } from "./screens/screen-frame";

const ResumesScreen = lazy(async () => {
  const { ResumesScreen: Screen } = await import("./screens/resumes-screen");
  return { default: Screen };
});

/** SSR 与加载期间的同尺寸骨架窗口，结构对齐演示 UI，避免布局跳动。 Same-size skeleton window for SSR and loading. */
function DemoWindowPlaceholder() {
  return (
    <ScreenFrame>
      <DemoWindowSkeleton />
    </ScreenFrame>
  );
}

/**
 * 首屏产品舞台：透出首屏天空背景，演示窗口居中、四周留白，随断点收放留白而非放大内容。
 * Product stage over the hero sky with the demo window centered; breakpoints change the breathing room.
 */
export function ProductShot() {
  const hydrated = useHydrated();
  const stageRef = useRef<HTMLElement>(null);
  const nearViewport = useInView(stageRef, { margin: "120px 0px", once: true });

  return (
    <section
      className="relative isolate mx-auto w-full max-w-[105rem]"
      data-slot="home-product-stage"
      ref={stageRef}
    >
      <div className="mx-auto w-full max-w-[calc(1280px+8rem)] px-4 pt-2 pb-12 sm:pb-14 lg:px-16 lg:pb-16">
        {hydrated && nearViewport ? (
          <SkeletonSuspense fallback={<DemoWindowPlaceholder />}>
            <ResumesScreen />
          </SkeletonSuspense>
        ) : (
          <DemoWindowPlaceholder />
        )}
      </div>
    </section>
  );
}
