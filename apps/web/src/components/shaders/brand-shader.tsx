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
import { useReducedMotion } from "@/components/home/support/reduced-motion";

const BEAM_GROUP_ID = "sainoa_brand_beams";

export default function BrandShader({ animated = false }: { animated?: boolean }) {
  const reducedMotion = useReducedMotion();
  return (
    <Shader className="absolute inset-0 size-full" disableTelemetry>
      <SolidColor color="#fdfcfa" />
      <Group id={BEAM_GROUP_ID}>
        <Beam
          endPosition={{ x: 0.73, y: 0.4 }}
          endSoftness={14.26}
          endThickness={0.6}
          insideColor="#b8a68a"
          outsideColor="#c9baa2"
          startPosition={{ x: 0.22, y: 0.5 }}
          startSoftness={27.22}
          startThickness={0.33}
        />
        <Beam
          endPosition={{ x: 0.78, y: 0.66 }}
          endSoftness={2.97}
          endThickness={0.7}
          insideColor="#ded1ba"
          outsideColor="#e9dfce"
          startPosition={{ x: 0.19, y: 0.69 }}
          startSoftness={27.67}
          startThickness={0.21}
        />
      </Group>
      <Swirl
        blend={67}
        blendMode="normal-oklab"
        colorA="#fdfcfa"
        colorB="#ffffff00"
        colorSpace="oklab"
        detail={1.5}
        maskSource={BEAM_GROUP_ID}
        opacity={0.55}
        speed={animated && !reducedMotion ? 0.12 : 0}
      />
      <DiffuseBlur intensity={20} />
      <Liquify intensity={reducedMotion ? 0 : 5} radius={2} />
      <ChromaFlow
        baseColor="#c4b397"
        downColor="#f5f1e9"
        intensity={reducedMotion ? 0 : 0.28}
        leftColor="#ded1ba61"
        rightColor="#b8a68a66"
        upColor="#d3c3a7"
      />
    </Shader>
  );
}
