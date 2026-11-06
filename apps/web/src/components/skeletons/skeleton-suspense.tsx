import { Suspense, use, useLayoutEffect, useState } from "react";
import type { ReactNode } from "react";
import { skeletonMinVisibleMs } from "@/hooks/use-skeleton-phase";

function VisibleFallback({
  children,
  holdUntil,
}: {
  children: ReactNode;
  holdUntil: (promise: Promise<null>) => void;
}) {
  useLayoutEffect(() => {
    // 用骨架实际挂载的时间开始计时。 Start the timer when the fallback mounts.
    // oxlint-disable-next-line promise/avoid-new -- Suspense 等待定时器。 Suspense waits for the timer.
    const promise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), skeletonMinVisibleMs);
    });
    holdUntil(promise);
  }, [holdUntil]);
  return children;
}

function RevealGate({ until }: { until: Promise<null> | null }) {
  if (until) {
    use(until);
  }
  return null;
}

export function SkeletonSuspense({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: ReactNode;
}) {
  const [gate, setGate] = useState<Promise<null> | null>(null);
  return (
    <Suspense fallback={<VisibleFallback holdUntil={setGate}>{fallback}</VisibleFallback>}>
      {children}
      <RevealGate until={gate} />
    </Suspense>
  );
}
