import * as THREE from 'three';
import { mulberry32 } from './terrainMath';

export interface ProceduralTextureSet {
  mossMap: THREE.CanvasTexture;
  mossBump: THREE.CanvasTexture;
  cliffMap: THREE.CanvasTexture;
  cliffBump: THREE.CanvasTexture;
  masonryMap: THREE.CanvasTexture;
  masonryBump: THREE.CanvasTexture;
  timberMap: THREE.CanvasTexture;
  timberBump: THREE.CanvasTexture;
  slateMap: THREE.CanvasTexture;
  slateBump: THREE.CanvasTexture;
  stainedGlassMap: THREE.CanvasTexture;
  barkMap: THREE.CanvasTexture;
  barkBump: THREE.CanvasTexture;
  softGlowMap: THREE.CanvasTexture;
  dispose: () => void;
}

function configureTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  isColor: boolean,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = Math.max(1, Math.min(8, maxAnisotropy));
  tex.needsUpdate = true;
  return tex;
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

export function createProceduralTextureSet(maxAnisotropy = 4): ProceduralTextureSet {
  const rand = mulberry32(4219);

  // 1. Lush Mossy Terrain Texture & Bump
  const [mossCanvas, mCtx] = makeCanvas(512);
  const [mossBumpCanvas, mbCtx] = makeCanvas(512);
  mCtx.fillStyle = '#4f7a3d';
  mCtx.fillRect(0, 0, 512, 512);
  mbCtx.fillStyle = '#808080';
  mbCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 3200; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const r = 2 + rand() * 14;
    const pick = rand();
    if (pick < 0.35) mCtx.fillStyle = 'rgba(62, 104, 46, 0.32)';
    else if (pick < 0.72) mCtx.fillStyle = 'rgba(104, 146, 66, 0.28)';
    else if (pick < 0.92) mCtx.fillStyle = 'rgba(42, 74, 38, 0.28)';
    else mCtx.fillStyle = 'rgba(148, 174, 82, 0.22)';
    mCtx.beginPath();
    mCtx.arc(x, y, r, 0, Math.PI * 2);
    mCtx.fill();

    const v = Math.floor(95 + rand() * 90);
    mbCtx.fillStyle = `rgba(${v},${v},${v},0.35)`;
    mbCtx.beginPath();
    mbCtx.arc(x, y, r * 0.75, 0, Math.PI * 2);
    mbCtx.fill();
  }
  // Fine velvety moss blades
  for (let i = 0; i < 4500; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    mCtx.fillStyle = rand() > 0.5 ? 'rgba(130, 168, 78, 0.35)' : 'rgba(34, 62, 32, 0.35)';
    mCtx.fillRect(x, y, 2, 4);
    mbCtx.fillStyle = rand() > 0.5 ? 'rgba(215,215,215,0.28)' : 'rgba(50,50,50,0.28)';
    mbCtx.fillRect(x, y, 2, 4);
  }

  // 2. Stratified Cliff Rock Texture & Bump
  const [cliffCanvas, cCtx] = makeCanvas(512);
  const [cliffBumpCanvas, cbCtx] = makeCanvas(512);
  cCtx.fillStyle = '#6d6965';
  cCtx.fillRect(0, 0, 512, 512);
  cbCtx.fillStyle = '#7c7c7c';
  cbCtx.fillRect(0, 0, 512, 512);

  for (let row = 0; row < 48; row++) {
    const y = (row / 48) * 512;
    const h = 6 + rand() * 16;
    const shade = Math.floor(86 + rand() * 44);
    const warm = Math.floor(rand() * 14);
    cCtx.fillStyle = `rgba(${shade + warm}, ${shade + 4}, ${shade - 4}, 0.45)`;
    cCtx.fillRect(0, y, 512, h);

    const bv = Math.floor(65 + rand() * 120);
    cbCtx.fillStyle = `rgba(${bv},${bv},${bv},0.48)`;
    cbCtx.fillRect(0, y, 512, h);
  }
  for (let i = 0; i < 1600; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const w = 8 + rand() * 34;
    const h = 3 + rand() * 10;
    const dark = rand() > 0.5;
    cCtx.fillStyle = dark ? 'rgba(48, 46, 48, 0.28)' : 'rgba(154, 148, 138, 0.24)';
    cCtx.fillRect(x, y, w, h);
    cbCtx.fillStyle = dark ? 'rgba(30,30,30,0.4)' : 'rgba(220,220,220,0.32)';
    cbCtx.fillRect(x, y, w, h);
  }
  // Subtle mossy lichen flecks on rock
  for (let i = 0; i < 240; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    cCtx.fillStyle = 'rgba(84, 118, 66, 0.22)';
    cCtx.beginPath();
    cCtx.arc(x, y, 4 + rand() * 10, 0, Math.PI * 2);
    cCtx.fill();
  }

  // 3. Hand-Laid Ashlar Stone Masonry (Observatory Tower & Bridge)
  const [masonryCanvas, sCtx] = makeCanvas(512);
  const [masonryBumpCanvas, sbCtx] = makeCanvas(512);
  sCtx.fillStyle = '#55514b';
  sCtx.fillRect(0, 0, 512, 512);
  sbCtx.fillStyle = '#282828';
  sbCtx.fillRect(0, 0, 512, 512);

  const rows = 12;
  const rowH = 512 / rows;
  for (let r = 0; r < rows; r++) {
    const cols = 6 + (r % 2);
    const offset = (r % 2) * 38;
    const colW = 512 / cols;
    for (let c = -1; c <= cols; c++) {
      const bx = c * colW + offset;
      const by = r * rowH;
      const pad = 3;
      const base = 126 + Math.floor(rand() * 38);
      const warmShift = Math.floor((rand() - 0.4) * 16);
      sCtx.fillStyle = `rgb(${base + warmShift}, ${base + 2}, ${base - 8})`;
      sCtx.fillRect(bx + pad, by + pad, colW - pad * 2, rowH - pad * 2);

      // Subtle stone highlight & shadow
      sCtx.fillStyle = 'rgba(255,248,235,0.12)';
      sCtx.fillRect(bx + pad, by + pad, colW - pad * 2, 4);
      sCtx.fillStyle = 'rgba(30,28,26,0.18)';
      sCtx.fillRect(bx + pad, by + rowH - pad - 4, colW - pad * 2, 4);

      const bv = 165 + Math.floor(rand() * 65);
      sbCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
      sbCtx.fillRect(bx + pad, by + pad, colW - pad * 2, rowH - pad * 2);
    }
  }
  // Stone weathering speckles
  for (let i = 0; i < 1800; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    sCtx.fillStyle = rand() > 0.5 ? 'rgba(42,38,34,0.14)' : 'rgba(215,208,195,0.12)';
    sCtx.fillRect(x, y, 3, 3);
  }

  // 4. Aged Oak Timber Planks
  const [timberCanvas, tCtx] = makeCanvas(512);
  const [timberBumpCanvas, tbCtx] = makeCanvas(512);
  tCtx.fillStyle = '#5c3d28';
  tCtx.fillRect(0, 0, 512, 512);
  tbCtx.fillStyle = '#808080';
  tbCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 900; i++) {
    const y = rand() * 512;
    const h = 1 + rand() * 4;
    tCtx.fillStyle = rand() > 0.5 ? 'rgba(42, 26, 15, 0.28)' : 'rgba(128, 92, 62, 0.22)';
    tCtx.fillRect(0, y, 512, h);
    tbCtx.fillStyle = rand() > 0.5 ? 'rgba(55,55,55,0.35)' : 'rgba(195,195,195,0.3)';
    tbCtx.fillRect(0, y, 512, h);
  }
  // Plank seams
  for (let p = 0; p < 8; p++) {
    const y = p * 64;
    tCtx.fillStyle = 'rgba(26, 16, 10, 0.65)';
    tCtx.fillRect(0, y, 512, 3);
    tbCtx.fillStyle = 'rgba(15, 15, 15, 0.85)';
    tbCtx.fillRect(0, y, 512, 3);
  }

  // 5. Overlapping Blue-Slate Roof Shingles
  const [slateCanvas, slCtx] = makeCanvas(512);
  const [slateBumpCanvas, slbCtx] = makeCanvas(512);
  slCtx.fillStyle = '#2d3b54';
  slCtx.fillRect(0, 0, 512, 512);
  slbCtx.fillStyle = '#404040';
  slbCtx.fillRect(0, 0, 512, 512);

  const sRows = 16;
  const sCols = 12;
  const sw = 512 / sCols;
  const sh = 512 / sRows;
  for (let r = 0; r < sRows; r++) {
    const off = (r % 2) * (sw * 0.5);
    for (let c = -1; c <= sCols; c++) {
      const sx = c * sw + off;
      const sy = r * sh;
      const tint = Math.floor(rand() * 24);
      slCtx.fillStyle = `rgb(${44 + tint}, ${60 + tint}, ${88 + tint})`;
      slCtx.beginPath();
      slCtx.moveTo(sx + 2, sy);
      slCtx.lineTo(sx + sw - 2, sy);
      slCtx.lineTo(sx + sw - 2, sy + sh * 0.72);
      slCtx.quadraticCurveTo(sx + sw * 0.5, sy + sh + 3, sx + 2, sy + sh * 0.72);
      slCtx.closePath();
      slCtx.fill();
      slCtx.strokeStyle = 'rgba(18, 24, 38, 0.55)';
      slCtx.lineWidth = 2;
      slCtx.stroke();

      const bv = 150 + Math.floor(rand() * 70);
      slbCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
      slbCtx.fillRect(sx + 2, sy + 2, sw - 4, sh - 4);
    }
  }

  // 6. Ornate Warm Stained-Glass Window Texture (Albedo & Emissive)
  const [glassCanvas, gCtx] = makeCanvas(256);
  const grad = gCtx.createRadialGradient(128, 110, 12, 128, 128, 150);
  grad.addColorStop(0, '#fff4cf');
  grad.addColorStop(0.45, '#ffba52');
  grad.addColorStop(0.8, '#e87a3d');
  grad.addColorStop(1, '#8c3c4f');
  gCtx.fillStyle = grad;
  gCtx.fillRect(0, 0, 256, 256);

  // Jewel-toned stained panes
  const paneColors = ['#ffd97d', '#ff9f43', '#f7b267', '#ffe8a3', '#5cc8c4', '#e37b8e'];
  for (let gy = 0; gy < 6; gy++) {
    for (let gx = 0; gx < 4; gx++) {
      gCtx.fillStyle = paneColors[(gx * 3 + gy * 2) % paneColors.length];
      gCtx.globalAlpha = 0.52;
      gCtx.fillRect(gx * 64 + 6, gy * 42 + 6, 52, 30);
    }
  }
  gCtx.globalAlpha = 1;
  // Rose rosette medallion
  gCtx.fillStyle = '#fff5cc';
  gCtx.beginPath();
  gCtx.arc(128, 86, 36, 0, Math.PI * 2);
  gCtx.fill();
  gCtx.strokeStyle = '#241b18';
  gCtx.lineWidth = 6;
  gCtx.stroke();

  // Dark lead cames grid
  gCtx.strokeStyle = '#1f1816';
  gCtx.lineWidth = 5;
  for (let gx = 1; gx < 4; gx++) {
    gCtx.beginPath();
    gCtx.moveTo(gx * 64, 0);
    gCtx.lineTo(gx * 64, 256);
    gCtx.stroke();
  }
  for (let gy = 1; gy < 6; gy++) {
    gCtx.beginPath();
    gCtx.moveTo(0, gy * 42.6);
    gCtx.lineTo(256, gy * 42.6);
    gCtx.stroke();
  }
  gCtx.strokeRect(4, 4, 248, 248);

  // 7. Cherry Tree Bark Texture & Bump
  const [barkCanvas, bCtx] = makeCanvas(256);
  const [barkBumpCanvas, bbCtx] = makeCanvas(256);
  bCtx.fillStyle = '#4a342c';
  bCtx.fillRect(0, 0, 256, 256);
  bbCtx.fillStyle = '#7a7a7a';
  bbCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 420; i++) {
    const x = rand() * 256;
    const y = rand() * 256;
    const w = 10 + rand() * 44;
    const h = 2 + rand() * 4;
    bCtx.fillStyle = rand() > 0.4 ? 'rgba(34, 21, 18, 0.35)' : 'rgba(116, 86, 74, 0.25)';
    bCtx.fillRect(x, y, w, h);
    bbCtx.fillStyle = rand() > 0.5 ? 'rgba(38,38,38,0.45)' : 'rgba(200,200,200,0.4)';
    bbCtx.fillRect(x, y, w, h);
  }

  // 8. Smooth Radial Glow Texture (for fireflies, mana motes, and contact shadows)
  const [glowCanvas, glCtx] = makeCanvas(128);
  const glGrad = glCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
  glGrad.addColorStop(0, 'rgba(255,255,255,1)');
  glGrad.addColorStop(0.28, 'rgba(255,255,255,0.68)');
  glGrad.addColorStop(0.65, 'rgba(255,255,255,0.16)');
  glGrad.addColorStop(1, 'rgba(255,255,255,0)');
  glCtx.fillStyle = glGrad;
  glCtx.fillRect(0, 0, 128, 128);

  const mossMap = configureTexture(mossCanvas, 4, 4, true, maxAnisotropy);
  const mossBump = configureTexture(mossBumpCanvas, 4, 4, false, maxAnisotropy);
  const cliffMap = configureTexture(cliffCanvas, 3, 3, true, maxAnisotropy);
  const cliffBump = configureTexture(cliffBumpCanvas, 3, 3, false, maxAnisotropy);
  const masonryMap = configureTexture(masonryCanvas, 2, 2, true, maxAnisotropy);
  const masonryBump = configureTexture(masonryBumpCanvas, 2, 2, false, maxAnisotropy);
  const timberMap = configureTexture(timberCanvas, 2, 2, true, maxAnisotropy);
  const timberBump = configureTexture(timberBumpCanvas, 2, 2, false, maxAnisotropy);
  const slateMap = configureTexture(slateCanvas, 3, 2, true, maxAnisotropy);
  const slateBump = configureTexture(slateBumpCanvas, 3, 2, false, maxAnisotropy);
  const stainedGlassMap = configureTexture(glassCanvas, 1, 1, true, maxAnisotropy);
  const barkMap = configureTexture(barkCanvas, 2, 4, true, maxAnisotropy);
  const barkBump = configureTexture(barkBumpCanvas, 2, 4, false, maxAnisotropy);
  const softGlowMap = configureTexture(glowCanvas, 1, 1, true, 1);
  softGlowMap.wrapS = THREE.ClampToEdgeWrapping;
  softGlowMap.wrapT = THREE.ClampToEdgeWrapping;

  const all = [
    mossMap,
    mossBump,
    cliffMap,
    cliffBump,
    masonryMap,
    masonryBump,
    timberMap,
    timberBump,
    slateMap,
    slateBump,
    stainedGlassMap,
    barkMap,
    barkBump,
    softGlowMap,
  ];

  return {
    mossMap,
    mossBump,
    cliffMap,
    cliffBump,
    masonryMap,
    masonryBump,
    timberMap,
    timberBump,
    slateMap,
    slateBump,
    stainedGlassMap,
    barkMap,
    barkBump,
    softGlowMap,
    dispose: () => {
      for (const t of all) t.dispose();
    },
  };
}
