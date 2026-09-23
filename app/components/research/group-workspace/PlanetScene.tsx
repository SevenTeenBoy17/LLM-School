"use client";

import { Component, memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Color, Mesh, RepeatWrapping, SRGBColorSpace, Texture, type ShaderMaterial } from "three";
import { createPlanetGeometry, createStarField, PLANET } from "./planetModel";

const surfaceVertex = `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const surfaceFragment = `
  uniform sampler2D uSurface;
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 clouds = texture2D(uSurface, vUv).rgb;
    float light = max(dot(n, normalize(vec3(0.7, 0.65, 1.0))), 0.0);
    vec3 color = clouds * (0.46 + 0.67 * light);
    float rim = pow(1.0 - max(n.z, 0.0), 3.8);
    vec3 atmosphere = mix(vec3(0.12, 0.75, 1.0), vec3(1.0, 0.65, 0.49), smoothstep(-0.5, 0.55, n.x));
    color += atmosphere * rim * 0.82;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
const haloFragment = `
  varying vec3 vNormal;
  void main() {
    vec3 n = normalize(vNormal);
    float r = sqrt(max(0.0, 1.0 - n.z * n.z));
    float glow = exp(-pow((r - 0.88) * 13.0, 2.0)) * (1.0 - smoothstep(0.91, 1.0, r));
    vec3 tint = mix(vec3(0.17, 0.67, 0.94), vec3(1.0, 0.57, 0.61), smoothstep(-0.5, 0.5, n.x));
    gl_FragColor = vec4(tint, glow * 0.38);
    #include <colorspace_fragment>
  }
`;
const starVertex = `
  attribute float aPhase;
  attribute float aScale;
  uniform float uTime;
  uniform float uSize;
  varying float vTwinkle;
  varying float vStar;
  varying float vTint;
  void main() {
    vTwinkle = 0.62 + 0.38 * sin(uTime * 1.1 + aPhase);
    vStar = step(8.0, aScale);
    vTint = sin(aPhase) * 0.5 + 0.5;
    vec3 p = position;
    float drift = uTime * 0.013;
    p.xy = mat2(cos(drift), -sin(drift), sin(drift), cos(drift)) * p.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = aScale * uSize;
  }
`;
const starFragment = `
  varying float vTwinkle;
  varying float vStar;
  varying float vTint;
  void main() {
    vec2 p = abs(gl_PointCoord - 0.5) * 2.0;
    float radius = length(p);
    float core = exp(-radius * radius * 24.0);
    float glow = exp(-radius * radius * 4.2) * 0.30;
    float rays = (exp(-p.x * 25.0) * pow(1.0 - p.y, 3.0) + exp(-p.y * 25.0) * pow(1.0 - p.x, 3.0)) * vStar;
    float alpha = max(core + glow, rays * 0.7) * vTwinkle * (1.0 - smoothstep(0.8, 1.0, radius));
    if (alpha < 0.015) discard;
    vec3 tint = mix(vec3(0.31, 0.60, 0.91), vec3(1.0, 0.48, 0.45), vTint);
    gl_FragColor = vec4(mix(tint, vec3(1.0, 0.88, 0.66), core * 0.55), alpha);
    #include <colorspace_fragment>
  }
`;

class PlanetBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function PlanetObjects({ texture, diameter, running, low, onReady, onSlow }: {
  texture: Texture; diameter: number; running: boolean; low: boolean; onReady: () => void; onSlow: () => void;
}) {
  const { gl, invalidate, size } = useThree();
  const body = useRef<Mesh>(null);
  const stars = useRef<ShaderMaterial>(null);
  const clock = useRef({ elapsed: 0, frames: 0, reported: 0, slow: 0, ready: false });
  const geometry = useMemo(() => createPlanetGeometry(low), [low]);
  const field = useMemo(() => createStarField(), []);
  const bodyUniforms = useMemo(() => ({ uSurface: { value: texture } }), [texture]);
  const starUniforms = useMemo(() => ({ uTime: { value: 0 }, uSize: { value: 1 } }), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => { invalidate(); }, [running, diameter, low, size.width, size.height, invalidate]);
  useEffect(() => {
    if (!running) return;
    // Demand rendering bounds GPU work on high-refresh displays and stops entirely when hidden.
    const interval = 1000 / (low ? 30 : 60);
    let next = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      if (now >= next) {
        invalidate();
        next = Math.max(next + interval, now + interval / 2);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, low, invalidate]);
  useFrame((_state, delta) => {
    const state = clock.current;
    if (running) state.elapsed += Math.min(delta, 0.05);
    if (body.current) body.current.rotation.y = 0.45 + state.elapsed * PLANET.rotationSpeed;
    if (stars.current) {
      stars.current.uniforms.uTime.value = state.elapsed;
      stars.current.uniforms.uSize.value = gl.getPixelRatio() * Math.max(0.7, diameter / 296);
    }
    state.frames++;
    if (!state.ready) { state.ready = true; onReady(); }
    if (state.frames > 20 && running && !low) {
      state.slow = delta > 1 / 35 ? state.slow + 1 : Math.max(0, state.slow - 1);
      if (state.slow > 45) onSlow();
    }
    if (performance.now() - state.reported > 700 || !running || state.frames === 1) {
      // Bounded DOM diagnostics report the actual renderer, never synthetic progress/FPS.
      Object.assign(gl.domElement.dataset, {
        frames: String(state.frames), rotation: String(body.current?.rotation.y ?? 0),
        drawCalls: String(gl.info.render.calls), triangles: String(gl.info.render.triangles),
        quality: low ? "low" : "high", points: String(gl.info.render.points),
      });
      state.reported = performance.now();
    }
  });
  return <group scale={diameter / 200}>
    <mesh ref={body} geometry={geometry} rotation={[0.08, 0.45, 0.24]} name="DreamPlanet">
      <shaderMaterial vertexShader={surfaceVertex} fragmentShader={surfaceFragment} uniforms={bodyUniforms} />
    </mesh>
    <mesh scale={1.12} renderOrder={1} name="Atmosphere">
      <sphereGeometry args={[1, low ? 32 : 48, low ? 20 : 28]} />
      <shaderMaterial vertexShader={surfaceVertex} fragmentShader={haloFragment} transparent depthWrite={false} />
    </mesh>
    <points renderOrder={2} frustumCulled={false} name="Starlight">
      <bufferGeometry drawRange={{ start: 0, count: low ? 64 : PLANET.stars }}>
        <bufferAttribute attach="attributes-position" args={[field.positions, 3]} />
        <bufferAttribute attach="attributes-aPhase" args={[field.phases, 1]} />
        <bufferAttribute attach="attributes-aScale" args={[field.scales, 1]} />
      </bufferGeometry>
      <shaderMaterial ref={stars} vertexShader={starVertex} fragmentShader={starFragment} uniforms={starUniforms} transparent depthWrite={false} />
    </points>
  </group>;
}

export const PlanetScene = memo(function PlanetScene({ diameter, running, onReady, onError }: {
  diameter: number; running: boolean; onReady: () => void; onError: () => void;
}) {
  const [texture, setTexture] = useState<Texture | null>(null);
  const [low, setLow] = useState(false);
  const onSlow = useCallback(() => setLow(true), []);
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    let loaded: Texture | undefined;
    let bitmap: ImageBitmap | undefined;
    const timeout = setTimeout(() => { cancelled = true; controller.abort(); onError(); }, 15000);
    const load = async () => {
      try {
        const response = await fetch(PLANET.texture, { signal: controller.signal });
        if (!response.ok) throw new Error(`Planet surface: ${response.status}`);
        const decoded = await createImageBitmap(await response.blob(), { imageOrientation: "flipY", premultiplyAlpha: "none" });
        if (cancelled) { decoded.close(); return; }
        bitmap = decoded;
        loaded = new Texture(decoded);
        loaded.colorSpace = SRGBColorSpace;
        loaded.wrapS = RepeatWrapping;
        loaded.flipY = false;
        loaded.anisotropy = 2;
        loaded.needsUpdate = true;
        setTexture(loaded);
      } catch { if (!cancelled) onError(); }
      finally { clearTimeout(timeout); }
    };
    void load();
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); loaded?.dispose(); bitmap?.close(); };
  }, [onError]);
  if (!texture) return null;
  return <PlanetBoundary onError={onError}>
    <Canvas flat orthographic camera={{ position: [0, 0, 10], zoom: 100 }} dpr={low ? 1 : [1, PLANET.maxDpr]} frameloop="demand" resize={{ scroll: false }}
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }} fallback={<span />}
      onCreated={({ gl }) => gl.setClearColor(new Color(0x000000), 0)}>
      <PlanetObjects texture={texture} diameter={diameter} running={running} low={low} onReady={onReady} onSlow={onSlow} />
    </Canvas>
  </PlanetBoundary>;
});
