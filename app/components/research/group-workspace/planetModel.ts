import { SphereGeometry } from "three";

export const PLANET = {
  texture: "/art/research-groups/planet-surface.webp",
  poster: "/art/research-groups/planet-poster.webp",
  rotationSpeed: 0.075,
  stars: 112,
  starRadius: 1.24,
  maxDpr: 1.5,
} as const;

export function createPlanetGeometry(low = false) {
  return new SphereGeometry(1, low ? 48 : 64, low ? 28 : 40);
}

export function createStarField(count = PLANET.stars) {
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const scales = new Float32Array(count);
  let seed = 873;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 1.055 + random() * (PLANET.starRadius - 1.055);
    positions.set([Math.cos(angle) * radius, Math.sin(angle) * radius, (random() - 0.5) * 0.45], i * 3);
    phases[i] = random() * Math.PI * 2;
    scales[i] = i % 9 === 0 ? 9 + random() * 3 : 2 + random() * 4;
  }
  return { positions, phases, scales };
}

export function shouldAnimate(paused: boolean, reduced: boolean, visible: boolean) {
  return !paused && !reduced && visible;
}
