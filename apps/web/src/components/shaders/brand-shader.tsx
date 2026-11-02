import {
  Beam,
  ChromaFlow,
  DiffuseBlur,
  Group,
  Liquify,
  Shader,
  SolidColor,
  Swirl,
} from "shaders/react";
import { useTheme } from "next-themes";
import { useReducedMotion } from "@/components/home/support/reduced-motion";

const BEAM_GROUP_ID = "sainoa_brand_beams";

export default function BrandShader({ animated = false }: { animated?: boolean }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const reducedMotion = useReducedMotion();
  const autoFlow = animated && !reducedMotion;
  return (
    <Shader className="absolute inset-0 size-full" disableTelemetry>
      <SolidColor color={dark ? "#1c1b19" : "#fdfcfa"} />
      <Group id={BEAM_GROUP_ID}>
        <Beam
          endPosition={{ x: 0.73, y: 0.4 }}
          endSoftness={14.26}
          endThickness={
            autoFlow
              ? {
                  easing: "sine",
                  mode: "ping-pong",
                  outputMax: 0.82,
                  outputMin: 0.42,
                  speed: 0.055,
                  type: "auto-animate",
                }
              : 0.6
          }
          insideColor={dark ? "#665b49" : "#b8a68a"}
          outsideColor={dark ? "#514a3e" : "#c9baa2"}
          startPosition={{ x: 0.22, y: 0.5 }}
          startSoftness={27.22}
          startThickness={
            autoFlow
              ? {
                  easing: "sine",
                  mode: "ping-pong",
                  outputMax: 0.2,
                  outputMin: 0.42,
                  speed: 0.045,
                  type: "auto-animate",
                }
              : 0.33
          }
        />
        <Beam
          endPosition={{ x: 0.78, y: 0.66 }}
          endSoftness={2.97}
          endThickness={
            autoFlow
              ? {
                  easing: "sine",
                  mode: "ping-pong",
                  outputMax: 0.48,
                  outputMin: 0.88,
                  speed: 0.04,
                  type: "auto-animate",
                }
              : 0.7
          }
          insideColor={dark ? "#80715a" : "#ded1ba"}
          outsideColor={dark ? "#665d4f" : "#e9dfce"}
          startPosition={{ x: 0.19, y: 0.69 }}
          startSoftness={27.67}
          startThickness={0.21}
        />
      </Group>
      <Swirl
        blend={67}
        blendMode="normal-oklab"
        colorA={dark ? "#1c1b19" : "#fdfcfa"}
        colorB="#ffffff00"
        colorSpace="oklab"
        detail={1.5}
        maskSource={BEAM_GROUP_ID}
        opacity={0.55}
        speed={autoFlow ? 0.4 : 0}
      />
      <DiffuseBlur intensity={20} />
      <Liquify intensity={reducedMotion ? 0 : 5} radius={2} />
      <ChromaFlow
        baseColor={dark ? "#71634d" : "#c4b397"}
        downColor={dark ? "#24221e" : "#f5f1e9"}
        intensity={reducedMotion ? 0 : 0.28}
        leftColor={dark ? "#80715a61" : "#ded1ba61"}
        rightColor={dark ? "#665b4966" : "#b8a68a66"}
        upColor={dark ? "#968468" : "#d3c3a7"}
      />
    </Shader>
  );
}
