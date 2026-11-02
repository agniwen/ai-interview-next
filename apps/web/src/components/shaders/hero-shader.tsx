import { ContourLines, FilmGrain, Shader, Swirl } from "shaders/react";
import { useReducedMotion } from "@/components/home/support/reduced-motion";

export default function HeroShader() {
  const reducedMotion = useReducedMotion();

  return (
    <Shader className="absolute inset-0 size-full" disableTelemetry>
      <Swirl
        colorA="#fdfcfa"
        colorB="#e7dfd2"
        colorSpace="oklab"
        blend={36}
        detail={1.4}
        speed={reducedMotion ? 0 : 0.06}
      />
      <ContourLines
        colorMode="custom"
        backgroundColor="#fdfcfa"
        lineColor="#c5b9a8"
        levels={48}
        lineWidth={0.8}
        softness={0.65}
        gamma={1}
        opacity={0.3}
      />
      <FilmGrain strength={0.1} bias={0} animated={false} />
    </Shader>
  );
}
