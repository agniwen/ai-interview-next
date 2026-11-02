import { useHydrated } from "@tanstack/react-router";
import { useReducedMotion as useMotionReducedMotion } from "motion/react";

export function useReducedMotion() {
  const hydrated = useHydrated();
  const reducedMotion = useMotionReducedMotion();
  // Match SSR on the first render before applying the browser's motion preference.
  return hydrated && reducedMotion;
}
