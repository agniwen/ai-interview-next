import type { ComponentPropsWithoutRef } from "react";
import { useEffect, useEffectEvent, useRef } from "react";
import { useReducedMotion } from "motion/react";

type Uniform = { type: "1f"; value: number } | { type: "3fv"; value: number[] };
type Uniforms = Record<string, Uniform>;
const vertexSource = `attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/**
 * 迁入旧版 Aura 的 WebGL 渲染路径，仅保留它实际使用的浮点和颜色 uniform。
 * Ports the legacy Aura WebGL renderer, retaining only its float and color uniforms.
 */
export function ReactShaderToy({
  fs,
  uniforms,
  devicePixelRatio = 1,
  style,
  ...props
}: {
  fs: string;
  uniforms: Uniforms;
  devicePixelRatio?: number;
} & ComponentPropsWithoutRef<"canvas">) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useReducedMotion();
  // 动画帧读取最新音量参数，不随每次音量变化重新编译 shader。
  // Animation frames read current audio uniforms without recompiling the shader on volume changes.
  const paintUniforms = useEffectEvent((gl: WebGLRenderingContext, program: WebGLProgram) => {
    for (const [name, uniform] of Object.entries(uniforms)) {
      const location = gl.getUniformLocation(program, name);
      if (uniform.type === "1f") {
        gl.uniform1f(location, uniform.value);
      } else {
        gl.uniform3fv(location, uniform.value);
      }
    }
  });
  const declarations = Object.entries(uniforms)
    .map(([name, uniform]) => `uniform ${uniform.type === "1f" ? "float" : "vec3"} ${name};`)
    .join("\n");
  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl", { alpha: true });
    if (!canvas || !gl) {
      return;
    }
    const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragment = compileShader(
      gl,
      gl.FRAGMENT_SHADER,
      `precision highp float;
      uniform float iTime;
      uniform vec2 iResolution;
      ${declarations}
      ${fs}
      void main() { mainImage(gl_FragColor, gl_FragCoord.xy); }`,
    );
    if (!vertex || !fragment) {
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      return;
    }
    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      return;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      return;
    }
    // WebGL 方法用于绑定 shader，不是 React Hook。
    // oxlint-disable-next-line react/hooks -- WebGL useProgram binds a shader program, not a React Hook.
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const time = gl.getUniformLocation(program, "iTime");
    const resolution = gl.getUniformLocation(program, "iResolution");
    const startedAt = performance.now();
    let frame = 0;
    const resize = () => {
      canvas.width = Math.round(canvas.clientWidth * devicePixelRatio);
      canvas.height = Math.round(canvas.clientHeight * devicePixelRatio);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    const draw = (now: number) => {
      gl.uniform1f(time, reducedMotion ? 0 : (now - startedAt) / 1000);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      paintUniforms(gl, program);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, [declarations, devicePixelRatio, fs, reducedMotion]);
  return <canvas ref={canvasRef} style={{ height: "100%", width: "100%", ...style }} {...props} />;
}
