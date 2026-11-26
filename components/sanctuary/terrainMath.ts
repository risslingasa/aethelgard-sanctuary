// Deterministic math, noise, and analytical multi-tiered island heightfield
// Shared across terrain, water, bridge, observatory, trees, mushrooms, and flora
// so every structure sits flush on the ground with zero floating or awkward clipping.

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix: number, iz: number): number {
  const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

export function noise2D(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);

  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);

  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

export function fbm2D(x: number, z: number, octaves = 4): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    val += amp * noise2D(x * freq, z * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.04;
  }
  return val / norm;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Organic island outer rim radius as a function of polar angle atan2(z, x)
export function getIslandRimRadius(angle: number): number {
  const base = 7.9;
  const lobes =
    Math.cos(angle * 2 - 0.5) * 0.72 +
    Math.sin(angle * 3 + 0.4) * 0.58 +
    Math.cos(angle * 5 - 1.1) * 0.28 +
    Math.sin(angle * 7 + 0.9) * 0.14;
  // Slightly elongate east-west and gently taper south waterfall lip
  const southLip = Math.exp(-Math.pow(angle - Math.PI * 0.47, 2) / 0.14) * 0.42;
  return base + lobes - southLip;
}

// Normalized radial distance from island center (0 at center, 1 at cliff rim)
export function getNormalizedRadius(x: number, z: number): number {
  const angle = Math.atan2(z, x);
  const r = Math.hypot(x, z);
  return r / getIslandRimRadius(angle);
}

// Winding glowing turquoise stream centerline X(z), running from spring pool (z=-1.6) to cliff edge (z=6.95)
export function getStreamCenterX(z: number): number {
  const t = Math.max(0, Math.min(1, (z + 1.8) / 8.8));
  return 1.35 * (1 - t) + 0.55 * t - Math.sin(t * Math.PI * 1.45) * 0.72;
}

// Stream half-width along z (widens at the upper spring pool, narrows gently beneath bridge & lip)
export function getStreamHalfWidth(z: number): number {
  const poolBoost = Math.exp(-Math.pow((z + 1.35) / 1.15, 2)) * 0.92;
  const lipTighten = smoothstep(5.4, 7.1, z) * 0.16;
  return 0.72 + poolBoost - lipTighten;
}

// Water surface elevation along z (two serene cascades from upper spring down through the meadow to cliff rim)
export function getStreamWaterY(z: number): number {
  const upperDrop = smoothstep(-0.35, 0.75, z);
  const lowerSlope = smoothstep(0.75, 6.9, z);
  return 1.24 - upperDrop * 0.54 - lowerSlope * 0.16;
}

// Distance from stream channel (0 inside channel center, 1 at outer bank)
export function getStreamInfluence(x: number, z: number): number {
  if (z < -2.9 || z > 7.6) return 0;
  const cx = getStreamCenterX(z);
  const hw = getStreamHalfWidth(z);
  const dx = Math.abs(x - cx);
  // Smooth spring basin tail cap around z = -1.6
  const northCap = smoothstep(-2.85, -1.65, z);
  const bankFade = 1 - smoothstep(hw * 0.55, hw * 1.65, dx);
  return northCap * bankFade;
}

// Primary multi-tiered mossy terrain heightfield
export function getTerrainHeight(x: number, z: number): number {
  const nr = getNormalizedRadius(x, z);

  // Base meadow elevation gently domed toward center, rolling off gracefully at the cliff lip
  let h = 0.92 + (1 - smoothstep(0.0, 0.95, nr)) * 0.28;

  // Tier 1: Upper Sanctuary Observatory Plateau (NW: centered around x=-2.3, z=-1.75)
  const dTower = Math.hypot((x + 2.35) * 0.95, (z + 1.75) * 1.05);
  const towerPlateau = 1 - smoothstep(2.45, 4.05, dTower);
  h += towerPlateau * 1.55;

  // Tier 2: Eastern Blossom & Shrine Terrace (NE/E: centered around x=3.4, z=-0.9)
  const dEast = Math.hypot((x - 3.35) * 0.9, (z + 0.75) * 0.95);
  const eastTerrace = 1 - smoothstep(1.9, 3.65, dEast);
  h += eastTerrace * 0.85;

  // Tier 2b: Western Garden Knoll (SW: centered around x=-3.9, z=2.3)
  const dWest = Math.hypot((x + 3.85) * 0.95, (z - 2.3) * 0.95);
  const westKnoll = 1 - smoothstep(1.3, 2.95, dWest);
  h += westKnoll * 0.42;

  // Gentle organic moss undulations (suppressed right under the observatory tower foundation)
  const flatUnderTower = smoothstep(1.6, 2.55, dTower);
  const undulation = (fbm2D(x * 0.32 + 11.4, z * 0.32 - 7.1, 4) - 0.5) * 0.46;
  h += undulation * flatUnderTower;

  // Carve the glowing turquoise stream gorge and spring basin cleanly
  const streamInf = getStreamInfluence(x, z);
  if (streamInf > 0.001) {
    const waterY = getStreamWaterY(z);
    const bedY = waterY - 0.36;
    h = h * (1 - streamInf) + bedY * streamInf;
  }

  // Slight organic lip bevel right at the outer cliff edge (except waterfall notch)
  const rimBevel = smoothstep(0.84, 1.02, nr);
  const waterfallNotch =
    z > 5.0 ? Math.exp(-Math.pow((x - getStreamCenterX(z)) / 1.1, 2)) : 0;
  h -= rimBevel * 0.36 * (1 - waterfallNotch * 0.6);

  return h;
}

// Cliff underside depth profile (jagged tapered rock keel dropping to ~ -7.0)
export function getUndersideDepth(x: number, z: number): number {
  const nr = getNormalizedRadius(x, z);
  const clamped = Math.min(1, nr);
  // Deepest rock spire offset slightly under the heavy Observatory Tower for architectural balance
  const distCore = Math.hypot((x + 0.65) * 0.95, (z + 0.45) * 0.95) / 8.2;
  const coneProfile = Math.pow(Math.max(0, 1 - clamped * 0.96), 0.72) * 5.9;
  const secondarySpire = Math.exp(-Math.pow(distCore * 2.1, 2)) * 1.85;
  const strataCrags = (fbm2D(x * 0.48 + 3.2, z * 0.48 + 9.7, 4) - 0.5) * 2.25 * (1 - clamped * 0.5);
  const ridged = Math.abs(fbm2D(x * 0.85 - 5.1, z * 0.85 + 2.4, 3) - 0.5) * 1.9 * (1 - clamped * 0.35);

  return -(0.38 + coneProfile + secondarySpire + strataCrags + ridged);
}
