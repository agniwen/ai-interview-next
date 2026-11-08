import type { AnimationPlaybackControlsWithThen, ValueAnimationTransition } from "motion/react";
import { animate, useMotionValue, useMotionValueEvent } from "motion/react";
import { useCallback, useRef, useState } from "react";

/**
 * 让 Aura 的多个参数复用同一种 Motion 数值动画与 React 更新方式。
 * Shares Motion animation and React updates across Aura's numeric parameters.
 */
export function useAnimatedValue<T>(initialValue: T) {
  const [value, setValue] = useState(initialValue);
  const motionValue = useMotionValue(initialValue);
  const controlsRef = useRef<AnimationPlaybackControlsWithThen | null>(null);

  useMotionValueEvent(motionValue, "change", (next) => setValue(next as T));

  const animateFn = useCallback(
    (targetValue: T | T[], transition: ValueAnimationTransition) => {
      controlsRef.current = animate(motionValue, targetValue, transition);
    },
    [motionValue],
  );

  return { animate: animateFn, controls: controlsRef, motionValue, value };
}
