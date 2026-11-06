import { useEffect, useLayoutEffect, useRef, useState } from "react";

export const skeletonDelayMs = 150;
export const skeletonMinVisibleMs = 1000;

export function useSkeletonPhase(loading: boolean) {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);

  useLayoutEffect(() => {
    if (visible) {
      shownAt.current = performance.now();
    }
  }, [visible]);

  useEffect(() => {
    if (loading === visible) {
      return;
    }
    const delay = loading
      ? skeletonDelayMs
      : Math.max(0, skeletonMinVisibleMs - (performance.now() - shownAt.current));
    const timeout = setTimeout(() => setVisible(loading), delay);
    return () => clearTimeout(timeout);
  }, [loading, visible]);

  if (visible) {
    return "skeleton";
  }
  return loading ? "pending" : "ready";
}
