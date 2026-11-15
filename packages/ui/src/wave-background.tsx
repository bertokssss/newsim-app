"use client";

import { useRef, useEffect } from "react";
import { Renderer, Program, Mesh, Triangle, Vec2 } from "ogl";

const vertex = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

// Flowing wave fragment shader
const fragment = `
#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 uResolution;
uniform float uTime;
uniform int uDarkTheme;

#define PI 3.14159265359

// Palette for light theme
vec3 lightPalette(float t) {
  return mix(
    vec3(0.9, 0.95, 1.0),
    vec3(0.2, 0.4, 0.8),
    0.5 + 0.5 * sin(6.2831 * t)
  );
}

// Premium Maritime Dark Palette
vec3 darkPalette(float t) {
  return mix(
    vec3(0.015, 0.05, 0.1),  // Deep Navy (#040d1a approx)
    vec3(0.05, 0.25, 0.45), // Subdued Ocean Blue
    0.5 + 0.5 * cos(6.2831 * t)
  );
}

// Flowing wave function
float wave(vec2 uv, float speed, float offset) {
  return sin(uv.x * 2.0 + uTime * speed + offset) * 0.3 +
         cos(uv.y * 1.5 - uTime * speed * 0.5 + offset) * 0.2;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  uv = uv * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Slower, more elegant waves
  float w1 = wave(uv, 0.4, 0.0);
  float w2 = wave(uv, 0.3, 2.0);
  float w3 = wave(uv, 0.5, 4.0);
  float pattern = (w1 + w2 + w3) * 0.5;

  vec3 col;
  if (uDarkTheme == 1) {
    col = darkPalette(pattern + uTime * 0.02);
  } else {
    col = lightPalette(pattern + uTime * 0.02);
  }

  gl_FragColor = vec4(col, 1.0);
}
`;

type Props = {
  darkTheme?: boolean;
  resolutionScale?: number;
};

export function WaveBackground({
  darkTheme = true, // Default to true for NEWSIM maritime theme
  resolutionScale = 1.0,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    try {
      const canvas = ref.current as HTMLCanvasElement;
      if (!canvas) return;
      const parent = canvas.parentElement as HTMLElement;
      if (!parent) return;

      const renderer = new Renderer({
        dpr: Math.min(window.devicePixelRatio || 1, 1),
        canvas,
        alpha: true,
      });

      const gl = renderer.gl;
      if (!gl) return;

      const geometry = new Triangle(gl);

      const program = new Program(gl, {
        vertex,
        fragment,
        uniforms: {
          uTime: { value: 0 },
          uResolution: { value: new Vec2() },
          uDarkTheme: { value: darkTheme ? 1 : 0 },
        },
      });

      const mesh = new Mesh(gl, { geometry, program });

      const resize = () => {
        if (!parent || !program.uniforms.uResolution) return;
        const w = parent.clientWidth || window.innerWidth,
          h = parent.clientHeight || window.innerHeight;
        renderer.setSize(w * resolutionScale, h * resolutionScale);
        program.uniforms.uResolution.value.set(w, h);
      };

      window.addEventListener("resize", resize);
      resize();

      const start = performance.now();
      let frame = 0;

      const loop = () => {
        if (typeof document === "undefined" || !document.hidden) {
          program.uniforms.uTime.value = (performance.now() - start) / 1000;
          program.uniforms.uDarkTheme.value = darkTheme ? 1 : 0;
          renderer.render({ scene: mesh });
        }
        frame = requestAnimationFrame(loop);
      };

      loop();

      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", resize);
      };
    } catch (e) {
      console.warn("WebGL WaveBackground initialization skipped:", e);
    }
  }, [darkTheme, resolutionScale]);

  return <canvas ref={ref} className="absolute inset-0 w-full h-full block opacity-70" style={{ zIndex: 0 }} />;
}

export default WaveBackground;
