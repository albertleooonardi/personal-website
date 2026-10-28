// Seeded night-garden illustrations, rendered to an SVG string at build time.
// They fill any slot that has no image yet: project thumbs, covers, story
// shots and gallery works. Same seed, same picture.

export type Variant = 'meadow' | 'bloom' | 'fence' | 'canopy';

export interface ArtOptions {
  seed: number;
  width?: number;
  height?: number;
  variant?: Variant;
  /** Set in the serif over the top-left of the picture, like a title card. */
  label?: string;
  /** Accessible description. Without one the SVG is decorative. */
  alt?: string;
}

const VARIANTS: Variant[] = ['meadow', 'bloom', 'fence', 'canopy'];

const SKIES = [
  { top: '#0a1026', mid: '#18214a', low: '#2b3b5e', hill: '#0b1220', ground: '#05090f', haze: '#c9d6ff' },
  { top: '#06151a', mid: '#0e2b31', low: '#1c4847', hill: '#081816', ground: '#030b0b', haze: '#c8f0e2' },
  { top: '#110b1d', mid: '#281735', low: '#45304f', hill: '#120c18', ground: '#07050b', haze: '#e8d6ff' },
  { top: '#07120e', mid: '#11261d', low: '#21402e', hill: '#0a1a12', ground: '#030705', haze: '#dff5c8' },
];

const GLOW = '#d7f36b';
const CORE = '#fbffd6';
const PETAL = '#e6e1ff';

function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => Math.round(n * 10) / 10;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

let counter = 0;

export function nightArt(opts: ArtOptions): string {
  const { seed, width: W = 1200, height: H = 800, label, alt } = opts;
  const rnd = mulberry32(seed * 9973 + 17);
  const r = (a: number, b: number) => a + rnd() * (b - a);
  const variant = opts.variant ?? VARIANTS[seed % VARIANTS.length];
  const sky = SKIES[Math.floor(rnd() * SKIES.length)];
  const id = `na${seed}x${counter++}`;
  const area = Math.sqrt((W * H) / (1200 * 800));
  const out: string[] = [];

  const horizon = H * (variant === 'bloom' ? r(0.74, 0.84) : variant === 'canopy' ? r(0.7, 0.78) : r(0.58, 0.7));

  // Sky, haze and stars
  out.push(`<rect width="${W}" height="${H}" fill="url(#${id}s)"/>`);
  const hx = r(0.15, 0.85) * W;
  const hy = r(0.05, 0.35) * H;
  out.push(`<circle cx="${f(hx)}" cy="${f(hy)}" r="${f(Math.max(W, H) * 0.55)}" fill="url(#${id}h)"/>`);
  if (rnd() < 0.55) {
    const mr = Math.min(W, H) * r(0.018, 0.03);
    out.push(
      `<circle cx="${f(hx)}" cy="${f(hy)}" r="${f(mr * 3)}" fill="${sky.haze}" opacity=".12" filter="url(#${id}b)"/>`,
      `<circle cx="${f(hx)}" cy="${f(hy)}" r="${f(mr)}" fill="#f4f1e6" opacity=".85"/>`,
    );
  }
  const stars = Math.round(70 * area * area);
  for (let i = 0; i < stars; i++) {
    out.push(
      `<circle cx="${f(r(0, W))}" cy="${f(r(0, horizon * 0.9))}" r="${f(r(0.5, 1.3) * area)}" fill="#eef2ff" opacity="${f(r(0.12, 0.6))}"/>`,
    );
  }

  // Hills: a far ridge and the near ground
  const ridge = (base: number, amp: number, fill: string) => {
    const n = 6;
    let d = `M0 ${f(base)}`;
    for (let i = 1; i <= n; i++) {
      const x = (W / n) * i;
      const cx = x - W / n / 2;
      d += ` Q${f(cx)} ${f(base + r(-amp, amp))} ${f(x)} ${f(base + r(-amp, amp) * 0.5)}`;
    }
    out.push(`<path d="${d} L${W} ${H} L0 ${H}Z" fill="${fill}"/>`);
  };
  ridge(horizon - H * 0.04, H * 0.05, sky.hill);

  if (variant === 'canopy') {
    // A trunk at one side, with branches reaching across the top. The foliage
    // is many small leaves clustered along each branch, so the edge is ragged.
    const side = rnd() < 0.5 ? -1 : 1;
    const tx = side < 0 ? W * r(0.04, 0.16) : W * r(0.84, 0.96);
    const unit = Math.min(W, H);
    out.push(
      `<path d="M${f(tx - unit * 0.02)} ${H} C${f(tx - unit * 0.015)} ${f(H * 0.6)} ${f(tx + side * unit * 0.02)} ${f(H * 0.35)} ${f(tx + side * unit * 0.01)} ${f(H * 0.15)} L${f(tx + side * unit * 0.04)} ${f(H * 0.15)} C${f(tx + side * unit * 0.05)} ${f(H * 0.4)} ${f(tx + unit * 0.025)} ${f(H * 0.6)} ${f(tx + unit * 0.03)} ${H}Z" fill="${sky.ground}"/>`,
    );
    let leaves = '';
    for (let b = 0; b < 5; b++) {
      const by = H * r(0.04, 0.3);
      const reach = W * r(0.25, 0.6);
      const ex = tx - side * reach;
      const ey = by + H * r(-0.08, 0.06);
      const sx = tx + side * unit * 0.02;
      const sy = H * r(0.15, 0.32);
      out.push(
        `<path d="M${f(sx)} ${f(sy)} Q${f((sx + ex) / 2)} ${f(by - H * 0.06)} ${f(ex)} ${f(ey)}" stroke="${sky.ground}" stroke-width="${f(unit * r(0.006, 0.014))}" fill="none" stroke-linecap="round"/>`,
      );
      for (let l = 0; l < 70; l++) {
        const t = Math.pow(rnd(), 0.6);
        const x = sx + (ex - sx) * t + r(-1, 1) * unit * 0.05 * (0.4 + t);
        const y = sy + (ey - sy) * t - Math.sin(t * Math.PI) * H * 0.06 + r(-1, 1) * unit * 0.045 * (0.4 + t);
        const lr = unit * r(0.006, 0.02);
        const a = r(0, 180);
        leaves += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(lr * 1.6)}" ry="${f(lr)}" transform="rotate(${f(a)} ${f(x)} ${f(y)})"/>`;
      }
    }
    out.push(`<g fill="${sky.ground}">${leaves}</g>`);
  }

  ridge(horizon + H * 0.03, H * 0.03, sky.ground);

  if (variant === 'fence') {
    const y0 = horizon + H * r(0.02, 0.06);
    const tilt = r(-0.06, 0.06) * H;
    const posts = 7;
    for (let i = 0; i <= posts; i++) {
      const x = (W / posts) * i + r(-10, 10);
      const y = y0 + (tilt * i) / posts;
      out.push(`<rect x="${f(x - 5 * area)}" y="${f(y - H * 0.16)}" width="${f(10 * area)}" height="${f(H * 0.4)}" fill="${sky.ground}"/>`);
    }
    for (const k of [0.1, 0.05]) {
      out.push(
        `<path d="M0 ${f(y0 - H * k)} L${W} ${f(y0 - H * k + tilt)}" stroke="${sky.ground}" stroke-width="${f(5 * area)}"/>`,
      );
    }
  }

  // Grass
  const blades = Math.round((W / 7) * (variant === 'bloom' ? 0.6 : 1));
  const tall = variant === 'meadow' || variant === 'fence' ? 0.24 : 0.14;
  let grass = '';
  for (let i = 0; i < blades; i++) {
    const x = r(-10, W + 10);
    const h = r(0.04, tall) * H;
    const bend = r(-0.35, 0.35) * h;
    const w = r(1.2, 2.6) * area;
    grass += `M${f(x - w)} ${H} Q${f(x + bend * 0.3)} ${f(H - h * 0.6)} ${f(x + bend)} ${f(H - h)} Q${f(x + bend * 0.3 + w)} ${f(H - h * 0.6)} ${f(x + w)} ${H}Z `;
  }
  out.push(`<path d="${grass}" fill="${sky.ground}"/>`);

  // Flowers
  const flower = (cx: number, cy: number, len: number, petals: number, opacity: number) => {
    const rot = r(0, 360);
    for (let p = 0; p < petals; p++) {
      const a = rot + (360 / petals) * p;
      out.push(
        `<ellipse cx="${f(cx)}" cy="${f(cy - len / 2)}" rx="${f(len * 0.3)}" ry="${f(len / 2)}" transform="rotate(${f(a)} ${f(cx)} ${f(cy)})" fill="url(#${id}p)" opacity="${f(opacity)}"/>`,
      );
    }
    out.push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(len * 0.16)}" fill="${GLOW}" opacity=".7"/>`);
  };

  if (variant === 'bloom') {
    const cx = W * r(0.35, 0.65);
    const cy = H * r(0.38, 0.55);
    const len = Math.min(W, H) * r(0.17, 0.23);
    out.push(
      `<path d="M${f(cx)} ${f(cy)} C${f(cx + len * 0.4)} ${f(cy + H * 0.2)} ${f(cx - len * 0.3)} ${f(H * 0.8)} ${f(cx + r(-20, 20))} ${H}" stroke="${sky.ground}" stroke-width="${f(6 * area)}" fill="none"/>`,
    );
    for (let i = 0; i < 4; i++) {
      const ly = cy + H * r(0.12, 0.4);
      const dir = i % 2 ? 1 : -1;
      out.push(
        `<path d="M${f(cx)} ${f(ly)} q${f(dir * len * 0.9)} ${f(-len * 0.5)} ${f(dir * len * 1.6)} ${f(len * 0.1)} q${f(-dir * len * 0.8)} ${f(len * 0.25)} ${f(-dir * len * 1.6)} ${f(-len * 0.1)}Z" fill="${sky.ground}"/>`,
      );
    }
    out.push(`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(len * 1.6)}" fill="${PETAL}" opacity=".08" filter="url(#${id}b)"/>`);
    flower(cx, cy, len, 5, 0.92);
  } else if (variant === 'meadow') {
    for (let i = 0; i < 6; i++) {
      const x = r(0.05, 0.95) * W;
      const top = H - r(0.12, 0.3) * H;
      out.push(
        `<path d="M${f(x)} ${H} Q${f(x + r(-20, 20))} ${f((H + top) / 2)} ${f(x + r(-14, 14))} ${f(top)}" stroke="${sky.ground}" stroke-width="${f(2 * area)}" fill="none"/>`,
      );
      flower(x, top, r(10, 18) * area, 5, r(0.5, 0.8));
    }
  }

  // Fireflies: halos, J-shaped streaks and bright cores
  const counts: Record<Variant, number> = { meadow: 42, fence: 30, bloom: 16, canopy: 34 };
  const n = Math.round(counts[variant] * area);
  const streakOdds = variant === 'fence' ? 0.7 : variant === 'meadow' ? 0.4 : 0.2;
  for (let i = 0; i < n; i++) {
    const x = r(0.02, 0.98) * W;
    const y = H * (0.18 + Math.pow(rnd(), 0.7) * 0.72);
    const s = r(0.35, 1);
    if (rnd() < streakOdds) {
      const L = r(16, 58) * s * area;
      const dx = r(-0.5, 0.5) * L;
      const d = `M${f(x)} ${f(y)} C${f(x + dx * 0.2)} ${f(y + L * 0.4)} ${f(x + dx * 0.7)} ${f(y + L * 0.35)} ${f(x + dx)} ${f(y - L * 0.9)}`;
      out.push(
        `<path d="${d}" stroke="${GLOW}" stroke-width="${f(6 * s * area)}" fill="none" opacity=".35" stroke-linecap="round" filter="url(#${id}g)"/>`,
        `<path d="${d}" stroke="${CORE}" stroke-width="${f((0.9 + s) * area)}" fill="none" opacity="${f(0.55 + s * 0.4)}" stroke-linecap="round"/>`,
      );
    } else {
      out.push(
        `<circle cx="${f(x)}" cy="${f(y)}" r="${f((8 + 16 * s) * area)}" fill="${GLOW}" opacity="${f(0.18 + s * 0.22)}" filter="url(#${id}b)"/>`,
        `<circle cx="${f(x)}" cy="${f(y)}" r="${f((1.2 + 1.8 * s) * area)}" fill="${CORE}"/>`,
      );
    }
  }

  // Grain
  out.push(`<rect width="${W}" height="${H}" filter="url(#${id}n)" opacity=".5"/>`);

  if (label) {
    const size = Math.min(W, H) * 0.075;
    out.push(
      `<circle cx="${f(W * 0.06 + size * 0.28)}" cy="${f(H * 0.1 + size * 0.42)}" r="${f(size * 0.6)}" fill="${GLOW}" opacity=".3" filter="url(#${id}b)"/>`,
      `<circle cx="${f(W * 0.06 + size * 0.28)}" cy="${f(H * 0.1 + size * 0.42)}" r="${f(size * 0.16)}" fill="${CORE}"/>`,
      `<text x="${f(W * 0.06 + size * 0.85)}" y="${f(H * 0.1 + size * 0.75)}" font-family="'Newsreader Variable', Georgia, serif" font-size="${f(size)}" font-weight="500" fill="#f2f4ea" letter-spacing="-0.01em">${esc(label)}</text>`,
    );
  }

  const defs = `<defs>
<linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky.top}"/><stop offset=".6" stop-color="${sky.mid}"/><stop offset="1" stop-color="${sky.low}"/></linearGradient>
<radialGradient id="${id}h"><stop offset="0" stop-color="${sky.haze}" stop-opacity=".2"/><stop offset="1" stop-color="${sky.haze}" stop-opacity="0"/></radialGradient>
<radialGradient id="${id}p" cx=".5" cy=".85" r=".9"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="${PETAL}" stop-opacity=".75"/></radialGradient>
<filter id="${id}b" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="${f(6 * area)}"/></filter>
<filter id="${id}g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${f(3 * area)}"/></filter>
<filter id="${id}n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".09"/></feComponentTransfer></filter>
</defs>`;

  const a11y = alt ? `role="img" aria-label="${esc(alt)}"` : 'aria-hidden="true"';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" ${a11y}>${defs}${out.join('')}</svg>`;
}
