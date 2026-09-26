"use client";

import { useReducedMotion } from "@/src/lib/useReducedMotion";
import { useEffect, useRef, type ReactNode } from "react";
import {
  LinearMipmapLinearFilter,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
  WebGLRenderer,
} from "three";
// Copied from overlay-site/components/image-arc.tsx.
// Original projection, geometry, shaders and motion are preserved.
// Integration changes: local diptychs, paired assignment, load/cleanup guards.
const PHOTOS = ['liberty', 'times-square', 'brooklyn'] as const;
type PhotoId = typeof PHOTOS[number];
const photoUrl = (id: PhotoId) => `/images/time-machine/${id}.jpg`;

const ASPECT = 1;

const SEAM_HEIGHT = 0.085;

const SEAM_MAX = 0.35;

const EXIT_HEIGHT = 0.48;

const EXIT_WIDTH = 0.7;

const PERIOD = 26;

const TILT = (62 * Math.PI) / 180;

const BEND = 0.6;

const EXPOSURE = 1.14;
const LIFT = 0.04;

const EMERGE_DELAY = 0.1;
const EMERGE_S = 2.8;

const BIRTH = 0.02;

const STAGE_U = 12;

const OVERSHOOT = 0.35;

const MAX_POOL = 64;

const FOCAL_MIN_U = 64;
const FOCAL_PER_HALF = 1.4;

const overlapAt = (s: number): number => {
  const t = Math.min(1, s);
  return 0.56 - 0.7 * t * (1 - t) + 0.1 * t;
};

const yawAt = (s: number): number =>
  TILT * (1 - Math.pow(1 - Math.min(s, 1), 1.6));
const bendAt = (s: number): number => BEND * Math.pow(Math.min(s, 1), 1.4);

interface Geometry {
  density: number;
  pool: number;
  sEnd: number;
  distAt: (s: number) => number;
  axAt: (s: number) => number;
}

const LUT_N = 4096;

function solveGeometry(halfU: number, heroU: number, focalU: number): Geometry {
  const target = Math.min(EXIT_HEIGHT * heroU, EXIT_WIDTH * halfU);
  const h0 = Math.min(SEAM_HEIGHT * heroU, SEAM_MAX * target);
  const growth = target / h0;
  const sizeAt = (s: number): number => h0 * Math.pow(growth, s);
  const widthAt = (s: number): number =>
    sizeAt(s) * ASPECT * Math.cos(yawAt(s));

  const N1 = 1024;
  let cover = 0;
  for (let i = 0; i < N1; i++) {
    const s = (i + 0.5) / N1;
    cover += widthAt(s) * (1 - overlapAt(s));
  }
  cover /= N1;

  const innerEdgeAt = (ax: number, s: number): number => {
    const size = sizeAt(s);
    const dist = focalU / size;
    const halfW = ASPECT / 2;
    const yaw = yawAt(s);
    const X = (ax * dist) / focalU - halfW * Math.cos(yaw);
    const Z = dist + halfW * Math.sin(yaw);
    return (focalU * X) / Z;
  };

  let lo = 1;
  let hi = MAX_POOL;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (innerEdgeAt(mid * cover, 1) < halfU) lo = mid;
    else hi = mid;
  }
  const density = Math.max(2, hi);
  const pool = Math.min(MAX_POOL, Math.ceil(density * (1 + OVERSHOOT)));
  const sEnd = pool / density;

  const lut = new Float32Array(LUT_N + 1);
  const ds = sEnd / LUT_N;
  let ax = 0;
  for (let i = 1; i <= LUT_N; i++) {
    const s = (i - 0.5) * ds;
    ax += density * widthAt(s) * (1 - overlapAt(s)) * ds;
    lut[i] = ax;
  }
  const axAt = (s: number): number => {
    const f = (Math.min(Math.max(s, 0), sEnd) / sEnd) * LUT_N;
    const i = Math.floor(f);
    const a = lut[i] ?? 0;
    const b = lut[Math.min(i + 1, LUT_N)] ?? a;
    return a + (b - a) * (f - i);
  };
  const distAt = (s: number): number => focalU / sizeAt(s);
  return { density, pool, sEnd, distAt, axAt };
}

const emergeEase = (t: number): number =>
  t >= 1 ? 1 : 1 - Math.pow(2, -9 * t) * (1 - t * 0.35);

const VERT = `
uniform float uBend;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  p.z += uBend * p.x * p.x;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const FRAG = `
precision highp float;
uniform sampler2D uMap;
uniform vec2 uRepeat;
uniform vec2 uOffset;
uniform float uOpacity;
uniform float uRadius;
uniform float uAspect;
uniform float uExposure;
uniform float uLift;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  vec2 half_ = vec2(uAspect, 1.0) * 0.5 - uRadius;
  vec2 q = abs(p) - half_;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
  float aa = fwidth(d);
  float mask = 1.0 - smoothstep(-aa, aa, d);
  vec4 c = texture2D(uMap, vUv * uRepeat + uOffset);
  vec3 rgb = clamp(c.rgb * uExposure + uLift, 0.0, 1.0);
  gl_FragColor = vec4(rgb, c.a * mask * uOpacity);
}`;

interface Card {
  mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  side: -1 | 1;
  index: number;
  phase: number;
  lap: number;
  slot: number;

  pending: boolean;
}

interface Pool {
  ids: readonly PhotoId[];
  textures: (Texture | null)[];

  serial: number;
  lastUsed: number[];
}

function createRibbon(
  host: HTMLDivElement,
  stage: HTMLElement,
  reducedMotion: boolean,
  onSettled: () => void
): () => void {
  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.sortObjects = true;
  const canvas = renderer.domElement;
  canvas.className = "absolute inset-0 block size-full";
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 0.05, 400);
  const geometry = new PlaneGeometry(ASPECT, 1, 24, 1);
  const anisotropy = renderer.capabilities.getMaxAnisotropy();

  let disposed = false;
  const loader = new TextureLoader();
  loader.setCrossOrigin("anonymous");
  const photos: Pool = {
    ids: PHOTOS,
    textures: PHOTOS.map(() => null),
    serial: 0,
    lastUsed: [],
  };
  const loadTexture = (side: Pool, index: number): Promise<Texture> =>
    new Promise((resolve, reject) => {
      const id = side.ids[index];
      if (!id) return reject(new Error("no image"));
      loader.load(
        photoUrl(id),
        (tex) => {
          if (disposed) { tex.dispose(); resolve(tex); return; }
          tex.colorSpace = SRGBColorSpace;
          tex.minFilter = LinearMipmapLinearFilter;
          tex.generateMipmaps = true;
          tex.anisotropy = anisotropy;
          side.textures[index] = tex;
          resolve(tex);
        },
        undefined,
        reject
      );
    });

  const applyTexture = (card: Card, tex: Texture): void => {
    const img = tex.image as { width?: number; height?: number } | undefined;
    const ia = img?.width && img?.height ? img.width / 2 / img.height : ASPECT;
    const repeat = new Vector2(1, 1);
    const offset = new Vector2(0, 0);
    if (ia > ASPECT) {
      repeat.x = ASPECT / ia;
      offset.x = (1 - repeat.x) / 2;
    } else {
      repeat.y = ia / ASPECT;
      offset.y = (1 - repeat.y) / 2;
    }
    // Each texture is a two-panel past/current diptych. Apply the original
    // cover crop inside the selected half, retaining the reference's square frame.
    repeat.x *= 0.5;
    offset.x = offset.x * 0.5 + (card.side === -1 ? 0 : 0.5);
    const m = card.mesh.material;
    if (m.uniforms.uMap) m.uniforms.uMap.value = tex;
    if (m.uniforms.uRepeat) m.uniforms.uRepeat.value = repeat;
    if (m.uniforms.uOffset) m.uniforms.uOffset.value = offset;
  };

  const cards: Card[] = [];

  const assign = (card: Card, side: Pool): boolean => {
    // Opposite cards share an index and lap; loading order cannot unpair them.
    const index = (card.index + card.lap) % side.ids.length;
    const tex = side.textures[index];
    if (!tex) return false;
    card.slot = index;
    applyTexture(card, tex);
    return true;
  };

  for (const dir of [-1, 1] as const) {
    for (let i = 0; i < MAX_POOL; i++) {
      const material = new ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uMap: { value: null },
          uRepeat: { value: new Vector2(1, 1) },
          uOffset: { value: new Vector2(0, 0) },
          uOpacity: { value: 0 },
          uRadius: { value: 0.03 },
          uAspect: { value: ASPECT },
          uBend: { value: 0 },
          uExposure: { value: EXPOSURE },
          uLift: { value: LIFT },
        },
      });
      const mesh = new Mesh(geometry, material);
      scene.add(mesh);

      const card: Card = {
        mesh,
        side: dir,
        index: i,
        phase: 0,
        lap: -1,
        slot: -1,
        pending: false,
      };
      cards.push(card);
    }
  }

  const loads = photos.ids.map((_, i) => loadTexture(photos, i));
  const ready = Promise.allSettled(loads);

  let u = 1;
  let width = 1;
  let height = 1;
  let focalU = FOCAL_MIN_U;
  let geo: Geometry = solveGeometry(50, 62, focalU);
  const fit = (): void => {
    const rect = host.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    u = stageRect.height / STAGE_U;
    const halfU = width / 2 / u;
    focalU = Math.max(FOCAL_MIN_U, halfU * FOCAL_PER_HALF);
    geo = solveGeometry(halfU, height / u, focalU);

    for (const card of cards) {
      card.mesh.visible = card.index < geo.pool;
      card.phase = card.index / geo.pool;
    }
    const cy = stageRect.top - rect.top + stageRect.height / 2;
    const focal = focalU * u;
    const fullH = Math.max(2 * cy, 2);
    camera.fov = (2 * Math.atan(fullH / 2 / focal) * 180) / Math.PI;
    camera.aspect = width / fullH;
    camera.setViewOffset(width, fullH, 0, 0, width, height);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };

  const place = (card: Card, s: number): void => {
    const { mesh, side } = card;
    const dist = geo.distAt(s);
    const yaw = yawAt(s);

    const x = (geo.axAt(s) * dist) / focalU;
    mesh.position.set(side * x, 0, -dist);
    mesh.rotation.y = -side * yaw;
    const m = mesh.material;
    if (m.uniforms.uBend) m.uniforms.uBend.value = bendAt(s);
    const born = Math.min(1, s / BIRTH);
    if (m.uniforms.uOpacity) {
      m.uniforms.uOpacity.value = card.pending ? 0 : born;
    }
  };

  let settled = false;
  const layout = (t: number): void => {
    const tE = Math.min(1, Math.max(0, (t - EMERGE_DELAY) / EMERGE_S));
    const emerge = emergeEase(tE);
    if (!settled && tE >= 0.3) {
      settled = true;
      onSettled();
    }
    const flow = t / (PERIOD * geo.sEnd);
    for (const card of cards) {
      if (!card.mesh.visible) continue;
      const raw = card.phase + flow;
      const lap = Math.floor(raw);
      if (lap !== card.lap) {
        card.lap = lap;
        card.slot = -1;
        card.pending = !assign(card, photos);
      } else if (card.pending) {
        card.pending = !assign(card, photos);
      }
      place(card, (raw - lap) * geo.sEnd * emerge);
    }
  };

  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(host);
  ro.observe(stage);

  let elapsed = 0;
  let last = 0;
  let raf = 0;
  let visible = true;

  const render = (): void => renderer.render(scene, camera);
  const frame = (now: number): void => {
    raf = requestAnimationFrame(frame);
    elapsed += Math.min(now - last, 100) / 1000;
    last = now;
    layout(elapsed);
    render();
  };
  const stop = (): void => {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const play = (): void => {
    if (raf || !visible || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  if (reducedMotion) {
    const still = (): void => {
      layout(PERIOD * 0.6 + EMERGE_S + 1);
      render();
    };
    still();
    ready.then(() => { if (!disposed) still(); });
    onSettled();
    const tick = window.setInterval(still, 400);
    const stopTick = window.setTimeout(() => window.clearInterval(tick), 8000);
    const ro2 = new ResizeObserver(still);
    ro2.observe(host);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(stopTick);
      ro.disconnect();
      ro2.disconnect();
      dispose();
    };
  }

  let started = false;
  const begin = (): void => {
    if (started || disposed) return;
    started = true;
    play();
  };
  ready.then(begin);
  const grace = window.setTimeout(begin, 1500);

  const io = new IntersectionObserver(
    (entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) {
        if (started) play();
      } else stop();
    },
    { rootMargin: "80px" }
  );
  io.observe(host);
  const onVis = (): void => {
    if (document.hidden) stop();
    else if (started) play();
  };
  document.addEventListener("visibilitychange", onVis);

  function dispose(): void {
    disposed = true;
    geometry.dispose();
    for (const card of cards) card.mesh.material.dispose();
    for (const tex of photos.textures) tex?.dispose();
    renderer.dispose();
    canvas.remove();
  }

  return () => {
    stop();
    window.clearTimeout(grace);
    ro.disconnect();
    io.disconnect();
    document.removeEventListener("visibilitychange", onVis);
    dispose();
  };
}

export function ImageArc({
  stageId,
  className,
  onSettled,
}: {
  stageId: string;
  className?: string;

  onSettled?: (() => void) | undefined;
}): ReactNode {
  const hostRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const settledRef = useRef(onSettled);
  useEffect(() => {
    settledRef.current = onSettled;
  }, [onSettled]);

  useEffect(() => {
    const host = hostRef.current;
    const stage = document.getElementById(stageId);
    if (!host || !stage) return;
    return createRibbon(host, stage, reducedMotion, () =>
      settledRef.current?.()
    );
  }, [stageId, reducedMotion]);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}
    />
  );
}
