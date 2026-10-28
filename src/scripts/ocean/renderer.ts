// Draws the ocean onto a grid of character cells. Each jellyfish is shaded
// like a lit dome and every cell inside it gets a tinted tile and a glyph
// picked by brightness, densest where the light falls. The brightest cells
// invert: a light tile with a dark glyph. Snow, bubbles and sparks share the
// same grid, which is drawn faintly across the whole background.

import { TAU, bell, clamp, smoothstep, type Box, type Chain, type Jelly, type Kind, type World } from './world';

type RGB = [number, number, number];

interface Palette {
  bg: RGB;
  /** What the glyph highlights blend toward. */
  lift: RGB;
  grid: RGB;
  gridAlpha: number;
  snow: RGB;
  bubble: RGB;
  spark: RGB;
  tone: Record<Kind, RGB>;
  glow: Record<Kind, RGB>;
  bloomAlpha: number;
}

const DEEP: Palette = {
  bg: [7, 12, 18],
  lift: [255, 255, 255],
  grid: [150, 190, 215],
  gridAlpha: 0.045,
  snow: [120, 150, 172],
  bubble: [190, 236, 244],
  spark: [130, 240, 230],
  tone: { moon: [190, 172, 255], crystal: [140, 236, 228], nettle: [200, 220, 245] },
  glow: { moon: [150, 130, 255], crystal: [90, 230, 220], nettle: [150, 190, 255] },
  bloomAlpha: 0.16,
};

// Glyphs ordered strictly by visual density (faint → dense).
// Using dot/colon/curve chars keeps the surface looking like lit translucent
// glass rather than typed text. No block letters — they break the smooth gradient.
const RAMP = " .`',:;i+o0";

const pack = (c: RGB) => (c[0] << 16) | (c[1] << 8) | c[2];
const mix = (a: RGB, b: RGB, t: number): RGB => [
  (a[0] + (b[0] - a[0]) * t) | 0,
  (a[1] + (b[1] - a[1]) * t) | 0,
  (a[2] + (b[2] - a[2]) * t) | 0,
];

/** A stable pseudo-random value in [0, 1). */
const hash = (a: number, b: number, c: number) => {
  const s = Math.sin(a * 91.7 + b * 12.9898 + c * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** A line glyph for a direction. */
function dirGlyph(dx: number, dy: number) {
  const len = Math.hypot(dx, dy) || 1;
  if (Math.abs(dy) < 0.38 * len) return '-';
  if (Math.abs(dx) < 0.38 * len) return '|';
  return dx * dy > 0 ? '\\' : '/';
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private readonly palette = DEEP;
  private dpr = 1;
  private styles = new Map<number, string>();
  fontFamily = "'Spline Sans Mono Variable', ui-monospace, Menlo, monospace";

  cw = 10;
  ch = 12;
  cols = 0;
  rows = 0;

  private glyph = new Uint16Array(0);
  private color = new Uint32Array(0);
  private alpha = new Float32Array(0);
  private tint = new Uint32Array(0);
  private tintAlpha = new Float32Array(0);
  private light = new Float32Array(0);
  private dim = new Float32Array(0);
  /** A fixed random value per cell, for texture. */
  private noise = new Float32Array(0);

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
  }

  resize(width: number, height: number, dpr: number) {
    this.dpr = dpr;
    // Tighter cell size: more columns → pixel-art quality closer to the reference.
    this.cw = clamp(Math.round(width / 160), 7, 10);
    this.ch = this.cw + 2;
    this.cols = Math.ceil(width / this.cw);
    this.rows = Math.ceil(height / this.ch);
    this.ctx.canvas.width = Math.round(width * dpr);
    this.ctx.canvas.height = Math.round(height * dpr);
    const n = this.cols * this.rows;
    this.glyph = new Uint16Array(n);
    this.color = new Uint32Array(n);
    this.alpha = new Float32Array(n);
    this.tint = new Uint32Array(n);
    this.tintAlpha = new Float32Array(n);
    this.light = new Float32Array(n);
    this.dim = new Float32Array(n).fill(1);
    this.noise = new Float32Array(n);
    for (let i = 0; i < n; i++) this.noise[i] = Math.random();
  }

  /** Fade the ocean near text so it never fights with what you are reading. */
  setDimBoxes(boxes: Box[]) {
    const { cols, rows, cw, ch, dim } = this;
    dim.fill(1);
    const reach = 4 * cw;
    for (const b of boxes) {
      const c0 = Math.max(0, Math.floor((b.left - reach) / cw));
      const c1 = Math.min(cols - 1, Math.floor((b.right + reach) / cw));
      const r0 = Math.max(0, Math.floor((b.top - reach) / ch));
      const r1 = Math.min(rows - 1, Math.floor((b.bottom + reach) / ch));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const x = c * cw + cw / 2;
          const y = r * ch + ch / 2;
          const d = Math.hypot(Math.max(b.left - x, 0, x - b.right), Math.max(b.top - y, 0, y - b.bottom));
          const i = r * cols + c;
          dim[i] = Math.min(dim[i], 0.15 + 0.85 * smoothstep(0, reach, d));
        }
      }
    }
  }

  render(world: World) {
    const { ctx, dpr, cols } = this;
    if (cols === 0) return;

    this.glyph.fill(0);
    this.tintAlpha.fill(0);
    this.light.fill(0);
    this.lightFrom(world);

    this.layerSnow(world);
    for (const j of [...world.jellies].sort((a, b) => a.depth - b.depth)) this.layerJelly(j, world.time);
    this.layerBubbles(world);
    this.layerSparks(world);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawGrid();
    this.drawBlooms(world);
    ctx.font = `600 ${Math.round(0.72 * this.ch)}px ${this.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    this.drawCells();
    this.drawRipples(world);
    ctx.globalAlpha = 1;
  }

  private cellIndex(x: number, y: number) {
    const c = Math.floor(x / this.cw);
    const r = Math.floor(y / this.ch);
    return c < 0 || r < 0 || c >= this.cols || r >= this.rows ? -1 : r * this.cols + c;
  }

  private put(i: number, g: string, color: RGB, alpha: number) {
    if (i < 0) return;
    this.glyph[i] = g.charCodeAt(0);
    this.color[i] = pack(color);
    this.alpha[i] = Math.min(1, alpha) * this.dim[i];
  }

  /**
   * One shaded cell of a jellyfish: a tinted tile and a glyph picked by
   * brightness. Bright cells invert to a light tile with a dark glyph.
   * `tiles` scales the tile, so thin parts like tentacles stay airy.
   */
  private cell(i: number, b: number, tone: RGB, vis: number, tiles: number) {
    if (i < 0 || b < 0.04) return;
    const p = this.palette;
    b = Math.min(1, b);
    // Pure brightness → glyph index, no per-cell noise jitter.
    // Smooth gradient reads like pixel art instead of speckled text.
    const k = clamp(Math.floor(b * RAMP.length), 0, RAMP.length - 1);
    this.tint[i] = pack(mix(p.bg, tone, 0.15 + 0.75 * b));
    this.tintAlpha[i] = (0.08 + 0.82 * Math.pow(b, 1.4)) * vis * tiles * this.dim[i];
    // The deep sea inverts its brightest cells.
    if (b > 0.85 && tiles >= 1) this.put(i, RAMP[k], mix(p.bg, tone, 0.2), 0.9 * vis);
    else this.put(i, RAMP[k], mix(tone, p.lift, 0.25 * b), (0.25 + 0.75 * b) * vis);
  }

  // ── Light ────────────────────────────────────────────

  private lightFrom(world: World) {
    for (const j of world.jellies) {
      const { ry } = bell(j);
      const g = (0.25 + 0.75 * j.glow) * (0.6 + 0.4 * j.depth);
      this.addLight(j.x + Math.sin(j.angle) * ry * 0.45, j.y - Math.cos(j.angle) * ry * 0.45, g, j.size * 2.6);
    }
    for (const r of world.ripples) {
      const k = 1 - (world.time - r.born) / 1.2;
      if (k > 0) this.addLight(r.x, r.y, k, 150);
    }
  }

  private addLight(x: number, y: number, g: number, radius: number) {
    const { cw, ch, cols, rows, light } = this;
    const c0 = Math.max(0, Math.floor((x - radius) / cw));
    const c1 = Math.min(cols - 1, Math.floor((x + radius) / cw));
    const r0 = Math.max(0, Math.floor((y - radius) / ch));
    const r1 = Math.min(rows - 1, Math.floor((y + radius) / ch));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const d = Math.hypot(c * cw + cw / 2 - x, r * ch + ch / 2 - y);
        if (d < radius) {
          const k = 1 - d / radius;
          light[r * cols + c] += g * k * k;
        }
      }
    }
  }

  // ── Layers, back to front ────────────────────────────

  private layerSnow(world: World) {
    const p = this.palette;
    for (const m of world.snow) {
      const i = this.cellIndex(m.x, m.y);
      if (i < 0) continue;
      const L = Math.min(1, this.light[i]);
      const g = m.size < 0.6 ? '.' : m.size < 0.9 ? '-' : "'";
      const a = (0.07 + 0.15 * m.size) * (0.7 + 0.3 * Math.sin(world.time + m.phase)) + L * 0.4;
      this.put(i, g, mix(p.snow, p.spark, L * 0.5), a);
    }
  }

  private layerJelly(j: Jelly, t: number) {
    const { cw, ch, cols, rows, noise, palette: p } = this;
    const tone = p.tone[j.kind];
    const { rx, ry } = bell(j);
    const ax = Math.sin(j.angle);
    const ay = -Math.cos(j.angle);
    const cx = Math.cos(j.angle);
    const cy = Math.sin(j.angle);
    const vis = 0.5 + 0.5 * j.depth;
    const glow = j.glow;

    // Tentacles and arms first, so the bell covers where they join it.
    j.tentacles.forEach((c, k) => this.layerChain(c, tone, glow, vis, false, j.id * 17 + k, t));
    j.arms.forEach((c, k) => this.layerChain(c, tone, glow, vis, true, j.id * 31 + k, t));

    // The bell, in its own frame: u runs up the axis, v across it.
    const mx = j.x + ax * ry * 0.4;
    const my = j.y + ay * ry * 0.4;
    const reach = Math.max(rx, ry) + cw;
    const c0 = Math.max(0, Math.floor((mx - reach) / cw));
    const c1 = Math.min(cols - 1, Math.floor((mx + reach) / cw));
    const r0 = Math.max(0, Math.floor((my - reach) / ch));
    const r1 = Math.min(rows - 1, Math.floor((my + reach) / ch));

    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const dx = c * cw + cw / 2 - j.x;
        const dy = r * ch + ch / 2 - j.y;
        const u = dx * ax + dy * ay;
        const v = dx * cx + dy * cy;
        const vn = v / rx;
        if (Math.abs(vn) > 1.02) continue;
        // Curved skirt: the opening hangs lower at the sides, giving a
        // scalloped bell edge rather than a flat cut.
        const skirt = 0.18 * ry * vn * vn;
        // Gentle ripple along the hem — only ±2% of radius, not 3.5%.
        const ripple = Math.sin(vn * TAU * 1.5 + j.phase * TAU) * 0.02 * ry;
        const margin = -0.10 * ry + skirt + ripple;
        if (u < margin) continue;
        const un = u / ry;
        const rr = Math.hypot(vn, Math.max(0, un));
        if (rr > 1) continue;
        const i = r * cols + c;

        // Shade the dome as if lit from above-left.
        const nz = Math.sqrt(Math.max(0, 1 - rr * rr));
        const nx = cx * vn + ax * Math.max(0, un);
        const ny = cy * vn + ay * Math.max(0, un);
        const lambert = Math.max(0, -0.4 * nx - 0.6 * ny + 0.72 * nz);
        // Soft rim highlight where the dome curves away.
        const rim = smoothstep(0.72, 1, rr) * 0.22;
        // The open underside fades quickly — dark inner cavity.
        const under = un < 0.18 ? 0.15 + 0.85 * smoothstep(-0.05, 0.18, un) : 1;
        // Very subtle shimmer — just enough to feel alive, not enough to speckle.
        const shimmer = 0.04 * Math.sin(t * 1.4 + noise[i] * 6 + j.id * 2);
        const b = ((0.1 + 0.82 * lambert + rim) * under + shimmer) * (0.72 + 0.5 * glow);
        this.cell(i, b, tone, vis, 1);
      }
    }
  }

  // Tentacles are dotted trails that twinkle; oral arms are denser ribbons.
  private layerChain(chain: Chain, tone: RGB, glow: number, vis: number, ribbon: boolean, seed: number, t: number) {
    const { pos } = chain;
    const n = pos.length / 2;
    for (let i = 1; i < n; i++) {
      const k = 2 * i;
      const x = pos[k];
      const y = pos[k + 1];
      const idx = this.cellIndex(x, y);
      if (idx < 0) continue;
      const h = hash(seed, i, chain.anchor);
      const fade = Math.pow(1 - i / n, 0.7);
      if (ribbon) {
        const b = (0.3 + 0.38 * fade) * (0.75 + 0.4 * glow) + (h - 0.5) * 0.2;
        this.cell(idx, b, tone, vis, 0.7);
        const a = 2 * Math.max(0, i - 1);
        const z = 2 * Math.min(n - 1, i + 1);
        const dx = pos[z] - pos[a];
        const dy = pos[z + 1] - pos[a + 1];
        const len = Math.hypot(dx, dy) || 1;
        const side = Math.sin(t * 2 + i * 0.6 + seed) > 0 ? 1 : -1;
        const off = this.cw * side;
        this.cell(this.cellIndex(x - (dy / len) * off, y + (dx / len) * off), b * 0.55, tone, vis, 0.5);
      } else {
        // Skip fewer nodes (h < 0.18 instead of 0.3) so the trail is denser.
        if (h < 0.18) continue;
        const b = (0.18 + 0.45 * fade) * (0.75 + 0.5 * glow) * (0.7 + 0.3 * Math.sin(t * 2.2 + h * 30));
        this.cell(idx, b, tone, vis, 0.55);
      }
    }
  }

  private layerBubbles(world: World) {
    const p = this.palette;
    for (const b of world.bubbles) {
      const i = this.cellIndex(b.x, b.y);
      if (i < 0) continue;
      const L = Math.min(1, this.light[i]);
      this.put(i, b.r === 2 ? 'O' : b.r === 1 ? 'o' : '.', p.bubble, 0.5 + 0.12 * b.r + L * 0.3);
    }
  }

  private layerSparks(world: World) {
    const p = this.palette;
    const t = world.time;
    for (const s of world.sparks) {
      const i = this.cellIndex(s.x, s.y);
      if (i < 0) continue;
      const age = (t - s.born) / s.life;
      const twinkle = 0.6 + 0.4 * Math.sin(t * 20 + s.x);
      this.put(i, age < 0.3 ? '*' : age < 0.65 ? '+' : '.', p.spark, Math.pow(1 - age, 1.2) * twinkle);
    }
  }

  // ── Drawing ──────────────────────────────────────────

  private style(rgb: number) {
    let s = this.styles.get(rgb);
    if (!s) {
      s = `rgb(${rgb >>> 16},${(rgb >>> 8) & 255},${rgb & 255})`;
      this.styles.set(rgb, s);
    }
    return s;
  }

  // The faint cell grid across the whole sea.
  private drawGrid() {
    const { ctx, cw, ch, cols, rows, dpr, palette: p } = this;
    const [r, g, b] = p.grid;
    const w = cols * cw;
    const h = rows * ch;
    const half = 0.5 / dpr;
    ctx.globalAlpha = 1;
    ctx.strokeStyle = `rgba(${r},${g},${b},${p.gridAlpha})`;
    ctx.lineWidth = 1 / dpr;
    ctx.beginPath();
    for (let c = 0; c <= cols; c++) {
      ctx.moveTo(c * cw + half, 0);
      ctx.lineTo(c * cw + half, h);
    }
    for (let row = 0; row <= rows; row++) {
      ctx.moveTo(0, row * ch + half);
      ctx.lineTo(w, row * ch + half);
    }
    ctx.stroke();
  }

  // Soft light under the grid, so a bell glows rather than just tints squares.
  private drawBlooms(world: World) {
    const { ctx, palette: p } = this;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1;
    const bloom = (x: number, y: number, color: RGB, k: number, radius: number) => {
      const [r, g, b] = color;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, `rgba(${r},${g},${b},${p.bloomAlpha * k})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    };
    for (const j of world.jellies) {
      const { ry } = bell(j);
      const x = j.x + Math.sin(j.angle) * ry * 0.4;
      const y = j.y - Math.cos(j.angle) * ry * 0.4;
      bloom(x, y, p.glow[j.kind], j.glow * (0.5 + 0.5 * j.depth), j.size * (2 + 1.2 * j.glow));
    }
    for (const r of world.ripples) {
      const k = 1 - (world.time - r.born) / 1.2;
      if (k > 0) bloom(r.x, r.y, p.spark, k * 1.4, 130);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawCells() {
    const { ctx, cw, ch, cols, glyph, color, alpha, tint, tintAlpha } = this;
    for (let i = 0; i < glyph.length; i++) {
      const x = (i % cols) * cw;
      const y = ((i / cols) | 0) * ch;
      if (tintAlpha[i] > 0.005) {
        ctx.globalAlpha = Math.min(1, tintAlpha[i]);
        ctx.fillStyle = this.style(tint[i]);
        ctx.fillRect(x + 1, y + 1, cw - 1, ch - 1);
      }
      if (glyph[i] && alpha[i] > 0.01) {
        ctx.globalAlpha = alpha[i];
        ctx.fillStyle = this.style(color[i]);
        ctx.fillText(String.fromCharCode(glyph[i]), x + cw / 2, y + ch / 2 + 1);
      }
    }
  }

  // A touch sends out a ring through the water.
  private drawRipples(world: World) {
    const { ctx, cw, ch, cols, rows, glyph, dim, palette: p } = this;
    for (const rp of world.ripples) {
      const age = world.time - rp.born;
      for (let ring = 0; ring < 2; ring++) {
        const radius = 64 * Math.max(0, age - 0.35 * ring);
        if (radius < 4) continue;
        const a = Math.pow(1 - age / 2.4, 1.5) * (ring === 0 ? 0.5 : 0.28);
        if (a < 0.02) continue;
        const band = cw * 0.6;
        const c0 = Math.max(0, Math.floor((rp.x - radius - cw) / cw));
        const c1 = Math.min(cols - 1, Math.floor((rp.x + radius + cw) / cw));
        const r0 = Math.max(0, Math.floor((rp.y - radius - ch) / ch));
        const r1 = Math.min(rows - 1, Math.floor((rp.y + radius + ch) / ch));
        ctx.fillStyle = this.style(pack(p.spark));
        for (let r = r0; r <= r1; r++) {
          for (let c = c0; c <= c1; c++) {
            const i = r * cols + c;
            if (glyph[i]) continue;
            const x = c * cw + cw / 2 - rp.x;
            const y = r * ch + ch / 2 - rp.y;
            if (Math.abs(Math.hypot(x, y) - radius) > band) continue;
            ctx.globalAlpha = a * dim[i];
            ctx.fillText(ring === 1 ? '.' : dirGlyph(-y, x), c * cw + cw / 2, r * ch + ch / 2 + 1);
          }
        }
      }
    }
  }
}
