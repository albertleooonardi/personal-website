// The ocean's simulation: jellyfish swimming by pulsing their bells, their
// trailing tentacles, drifting marine snow, rising bubbles, and the sparkle of
// plankton when the water is touched. Positions are in CSS pixels; nothing here
// touches the canvas.

export const TAU = Math.PI * 2;

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function smoothstep(e0: number, e1: number, x: number) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function angleDiff(from: number, to: number) {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type Kind = 'moon' | 'crystal' | 'nettle';

interface Anatomy {
  tentacles: number;
  nodes: number;
  /** Segment length as a fraction of the bell size. */
  seg: number;
  arms: number;
  armNodes: number;
  armSeg: number;
  /** Pulses per second. */
  rate: [number, number];
}

// Moon jellies: a short fringe and four arms. Crystal jellies: many long, fine
// tentacles. Sea nettles: a few very long tentacles and long arms.
const ANATOMY: Record<Kind, Anatomy> = {
  moon:    { tentacles: 16, nodes: 10, seg: 0.08,  arms: 4, armNodes: 12, armSeg: 0.10, rate: [0.62, 0.80] },
  crystal: { tentacles: 12, nodes: 16, seg: 0.09,  arms: 0, armNodes:  0, armSeg: 0,    rate: [0.70, 0.92] },
  nettle:  { tentacles:  8, nodes: 20, seg: 0.095, arms: 4, armNodes: 14, armSeg: 0.10, rate: [0.48, 0.62] },
};

const KINDS: [Kind, number][] = [
  ['moon', 3],
  ['crystal', 2],
  ['nettle', 2],
];

/** A tentacle or oral arm: a chain of points hanging from the bell. */
export interface Chain {
  /** Where it hangs from, across the bell: -1 is the left rim, 1 the right. */
  anchor: number;
  seg: number;
  pos: Float32Array;
  prev: Float32Array;
}

export interface Jelly {
  id: number;
  kind: Kind;
  /** The middle of the bell's opening, where the tentacles hang from. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Tilt of the bell; 0 points straight up. */
  angle: number;
  size: number;
  /** 0.55 is far away and dim, 1 is close. */
  depth: number;
  phase: number;
  rate: number;
  contract: number;
  glow: number;
  /** Raised when touched or startled; brightens the glow and quickens the pulse. */
  excite: number;
  /** A burst of quick strokes it takes now and then, all on its own. */
  dash: number;
  nextDash: number;
  wander: number;
  /** The depth it likes to drift at, for a while. */
  homeY: number;
  nextHome: number;
  tentacles: Chain[];
  arms: Chain[];
}

export interface Mote {
  x: number;
  y: number;
  vy: number;
  phase: number;
  size: number;
}

export interface Bubble {
  x: number;
  y: number;
  vy: number;
  /** 0 small, 1 medium, 2 large. */
  r: number;
  phase: number;
  /** Height at which it pops. */
  pop: number;
}

export interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  life: number;
}

export interface Ripple {
  x: number;
  y: number;
  born: number;
}

/** The part of a pulse spent squeezing, which is when the bell pushes. */
const SQUEEZE = 0.22;

/** How far the bell is squeezed through one pulse: a quick squeeze, a release
 * that springs past rest so the bell flares open, then settles. */
export function contraction(phase: number) {
  if (phase < SQUEEZE) return Math.sin(((phase / SQUEEZE) * Math.PI) / 2);
  const s = (phase - SQUEEZE) / (1 - SQUEEZE);
  return 1 - smoothstep(0, 0.45, s) - 0.16 * Math.sin(Math.PI * clamp((s - 0.3) / 0.7, 0, 1));
}

/** Half-width and height of a bell, which narrows and lengthens as it squeezes. */
export function bell(j: Jelly) {
  return { rx: j.size * (1 - 0.3 * j.contract), ry: j.size * 1.0 * (1 + 0.26 * j.contract) };
}

const scratch = { x: 0, y: 0 };
const NONE = { x: 0, y: 0 };

// Move the whole animal together, including the previous Verlet positions,
// so crossing an edge or resizing never stretches or whips its tentacles.
function translateJelly(j: Jelly, dx: number, dy: number) {
  j.x += dx;
  j.y += dy;
  for (const chain of [...j.tentacles, ...j.arms]) {
    for (let i = 0; i < chain.pos.length; i += 2) {
      chain.pos[i] += dx;
      chain.pos[i + 1] += dy;
      chain.prev[i] += dx;
      chain.prev[i + 1] += dy;
    }
  }
}

// Push away from any box within `reach`, strongest at the edge of the box.
function avoidBoxes(boxes: Box[], x: number, y: number, reach: number, out: { x: number; y: number }) {
  out.x = 0;
  out.y = 0;
  for (const b of boxes) {
    let dx = x - clamp(x, b.left, b.right);
    let dy = y - clamp(y, b.top, b.bottom);
    let d = Math.hypot(dx, dy);
    if (d > reach) continue;
    if (d < 0.001) {
      const sides = [b.left - x, x - b.right, b.top - y, y - b.bottom];
      const i = sides.indexOf(Math.max(...sides));
      dx = i === 0 ? -1 : i === 1 ? 1 : 0;
      dy = i === 2 ? -1 : i === 3 ? 1 : 0;
      d = 0;
    }
    const len = Math.hypot(dx, dy) || 1;
    out.x += (dx / len) * (1 - d / reach);
    out.y += (dy / len) * (1 - d / reach);
  }
}

export class World {
  width = 0;
  height = 0;
  time = 0;
  jellies: Jelly[] = [];
  snow: Mote[] = [];
  bubbles: Bubble[] = [];
  sparks: Spark[] = [];
  ripples: Ripple[] = [];
  /** Velocity is in px/s, smoothed; it is how hard the pointer is stirring. */
  pointer = { x: 0, y: 0, vx: 0, vy: 0, speed: 0, active: false };
  avoid: Box[] = [];

  resize(width: number, height: number) {
    const first = this.width === 0;
    this.width = width;
    this.height = height;
    if (first) this.seedJellies();
    for (const j of this.jellies) {
      translateJelly(j, clamp(j.x, -j.size, width + j.size) - j.x, clamp(j.y, -j.size, height + j.size) - j.y);
    }
    this.seedSnow();
  }

  seedJellies() {
    const { width: w, height: h } = this;
    // Leave a little more open water, including on small screens.
    const count = clamp(Math.round((w * h) / 160000), 4, 9);
    // Wider size range — a mix of large background ones and small foreground ones.
    const base = clamp(Math.min(w, h) * 0.11, 40, 110);
    const total = KINDS.reduce((sum, [, n]) => sum + n, 0);
    this.jellies = [];
    for (let i = 0; i < count; i++) {
      let pick = Math.random() * total;
      let kind: Kind = 'moon';
      for (const [k, n] of KINDS) {
        if ((pick -= n) <= 0) {
          kind = k;
          break;
        }
      }
      const depth = rand(0.4, 1);
      const size = base * rand(0.55, 1.4) * (0.6 + 0.4 * depth);
      const a = ANATOMY[kind];
      // Sample the whole screen, rather than assigning each jelly a column.
      // If space is tight, keep the least crowded of a bounded set of tries.
      const padX = Math.min(size + 12, w * 0.2);
      const padTop = Math.min(size * 1.25 + 12, h * 0.3);
      const padBottom = Math.min(size * 0.6 + 12, h * 0.2);
      let x = w / 2;
      let y = h / 2;
      let bestSpace = -1;
      for (let attempt = 0; attempt < 24; attempt++) {
        const px = rand(padX, w - padX);
        const py = rand(padTop, h - padBottom);
        const space = this.jellies.reduce(
          (nearest, other) => Math.min(nearest, Math.hypot(px - other.x, py - other.y) / (size + other.size)),
          Infinity,
        );
        if (space > bestSpace) {
          x = px;
          y = py;
          bestSpace = space;
        }
        if (space >= 1.15) break;
      }
      const j: Jelly = {
        id: i + 1,
        kind,
        x,
        y,
        vx: 0,
        vy: 0,
        angle: rand(-0.5, 0.5),
        size,
        depth,
        phase: Math.random(),
        rate: rand(...a.rate),
        contract: 0,
        glow: 0.3,
        excite: 0,
        dash: 0,
        nextDash: rand(3, 12),
        wander: rand(-0.5, 0.5),
        homeY: rand(0.25, 0.86) * h,
        nextHome: rand(8, 20),
        tentacles: [],
        arms: [],
      };
      const chain = (anchor: number, nodes: number, seg: number): Chain => {
        const pos = new Float32Array(nodes * 2);
        for (let k = 0; k < nodes; k++) {
          pos[2 * k] = j.x + anchor * size * 0.9;
          pos[2 * k + 1] = j.y + k * seg * size;
        }
        return { anchor, seg: seg * size, pos, prev: pos.slice() };
      };
      for (let k = 0; k < a.tentacles; k++) {
        j.tentacles.push(chain(-1 + (2 * k) / (a.tentacles - 1), a.nodes, a.seg * rand(0.75, 1.25)));
      }
      for (let k = 0; k < a.arms; k++) {
        j.arms.push(chain(-1 + (2 * k) / Math.max(1, a.arms - 1), a.armNodes, a.armSeg * rand(0.85, 1.15)));
      }
      this.jellies.push(j);
    }
  }

  seedSnow() {
    const { width: w, height: h } = this;
    this.snow = [];
    const motes = Math.round((w * h) / 9000);
    for (let i = 0; i < motes; i++) {
      this.snow.push({ x: rand(0, w), y: rand(0, h), vy: rand(3, 11), phase: rand(0, TAU), size: Math.random() });
    }
  }

  /** Touching the water: plankton sparkle, bubbles rise, and nearby jellyfish light up and dart away. */
  touch(x: number, y: number) {
    const t = this.time;
    this.ripples.push({ x, y, born: t });
    for (let i = 0; i < 46; i++) {
      const a = rand(0, TAU);
      const s = rand(20, 140);
      this.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.8, born: t, life: rand(1.2, 2.6) });
    }
    for (let i = Math.floor(rand(6, 12)); i > 0; i--) {
      const big = Math.random();
      this.bubbles.push({
        x: x + rand(-14, 14),
        y: y + rand(-6, 10),
        vy: 0,
        r: big < 0.25 ? 2 : big < 0.6 ? 1 : 0,
        phase: rand(0, TAU),
        pop: Math.max(6, y - rand(180, 480)),
      });
    }
    for (const j of this.jellies) {
      const dx = j.x - x;
      const dy = j.y - j.size * 0.4 - y;
      const d = Math.hypot(dx, dy);
      if (d < 360) {
        j.excite = 1;
        const k = ((1 - d / 360) * 60) / (d || 1);
        j.vx += dx * k;
        j.vy += dy * k;
      }
    }
    if (this.sparks.length > 400) this.sparks.splice(0, this.sparks.length - 400);
    if (this.bubbles.length > 160) this.bubbles.splice(0, this.bubbles.length - 160);
  }

  get glowing() {
    let n = 0;
    for (const j of this.jellies) if (j.excite > 0.2) n++;
    return n;
  }

  step(dt: number) {
    this.time += dt;
    const p = this.pointer;
    const fade = Math.exp(-6 * dt);
    p.vx *= fade;
    p.vy *= fade;
    p.speed *= Math.exp(-8 * dt);
    for (const j of this.jellies) this.stepJelly(j, dt);
    this.stepParticles(dt);
  }

  /** The current the pointer is stirring up at a point, in px/s. */
  private current(x: number, y: number, reach: number) {
    const p = this.pointer;
    if (!p.active) return NONE;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d > reach) return NONE;
    const f = (1 - d / reach) ** 2;
    return { x: p.vx * f, y: p.vy * f };
  }

  private stepJelly(j: Jelly, dt: number) {
    const h = this.height;

    j.excite = Math.max(0, j.excite - 0.28 * dt);
    j.dash = Math.max(0, j.dash - 0.45 * dt);
    // A preferred depth varies its pace, but never acts as a viewport wall:
    // even above that depth it keeps swimming and can leave the screen.
    if (this.time > j.nextHome) {
      j.homeY = rand(0.25, 0.86) * h;
      j.nextHome = this.time + rand(7, 16);
    }
    // Now and then it sets off somewhere in a hurry.
    if (this.time > j.nextDash) {
      j.dash = rand(0.6, 1);
      j.wander = Math.sign(Math.random() - 0.5) * rand(0.6, 1);
      j.nextDash = this.time + rand(8, 18);
    }
    const low = j.y > j.homeY + j.size * 1.5;
    const above = j.y < j.homeY - j.size;
    const effort = Math.max(above ? 0.7 : low ? 1.1 : 0.85, 0.9 * j.excite, 0.8 * j.dash);
    const rate = j.rate * (1 + 1.5 * j.excite + 0.9 * j.dash) * (0.45 + 0.55 * Math.min(1, effort));
    j.phase = (j.phase + rate * dt) % 1;
    j.contract = contraction(j.phase);
    j.glow = Math.min(1, 0.3 + 0.18 * Math.max(0, j.contract) + 0.6 * j.excite);

    // Each squeeze kicks the bell along its axis; between squeezes it coasts and sinks.
    const ax = Math.sin(j.angle);
    const ay = -Math.cos(j.angle);
    if (j.phase < SQUEEZE) {
      const thrust = (230 + 120 * j.excite + 90 * j.dash) * effort * Math.sqrt(j.size / 60);
      j.vx += ax * thrust * dt;
      j.vy += ay * thrust * dt;
    }
    j.vy += 30 * dt;
    const drag = Math.exp(-1.7 * dt);
    j.vx *= drag;
    j.vy *= drag;

    // Steer by tilting the bell, meandering in slow S-curves.
    j.wander = clamp(j.wander + (Math.random() - 0.5) * dt * 2.6, -1, 1);
    let want = j.wander * 0.9 + 0.3 * Math.sin(this.time * 0.6 + j.id * 2.3);
    if (low) want *= 0.3;

    avoidBoxes(this.avoid, j.x, j.y - j.size * 0.4, j.size * 1.4 + 30, scratch);
    want += clamp(scratch.x, -1, 1) * 0.9;
    j.vx += scratch.x * 30 * dt;
    j.vy += scratch.y * 30 * dt;

    for (const o of this.jellies) {
      if (o === j) continue;
      const dx = j.x - o.x;
      const dy = j.y - o.y;
      const d = Math.hypot(dx, dy);
      const min = (j.size + o.size) * 1.5;
      if (d < min && d > 0.001) {
        const k = (1 - d / min) * 90 * dt;
        j.vx += (dx / d) * k;
        j.vy += (dy / d) * k;
      }
    }

    // Stirred water carries the bell along; a fast swipe right past it startles it.
    const c = this.current(j.x, j.y - j.size * 0.4, 200);
    j.vx += c.x * 0.6 * dt;
    j.vy += c.y * 0.6 * dt;
    const p = this.pointer;
    if (p.active) {
      const dx = p.x - j.x;
      const dy = p.y - (j.y - j.size * 0.4);
      const d = Math.hypot(dx, dy);
      if (p.speed > 1400 && d < j.size * 1.4) j.excite = Math.max(j.excite, 0.8);
      // A slow pointer nearby makes it curious: it turns towards it and swims a little harder.
      else if (p.speed < 500 && d < 320 && d > j.size) {
        const pull = 1 - d / 320;
        want += clamp(dx / d, -1, 1) * 0.7 * pull;
        j.dash = Math.max(j.dash, 0.35 * pull);
      }
    }

    j.angle += clamp(angleDiff(j.angle, want), -1.1 * dt, 1.1 * dt);
    j.angle = clamp(j.angle, -1.35, 1.35);
    j.x += j.vx * dt;
    j.y += j.vy * dt;

    const { rx, ry } = bell(j);
    const cx = Math.cos(j.angle);
    const cy = Math.sin(j.angle);
    for (const ch of j.tentacles) {
      // Tentacles hang from closer to the centre of the bell opening,
      // not spread all the way to the rim — they cluster naturally.
      const along = ch.anchor * rx * 0.62;
      const drop = ry * (0.04 + 0.12 * ch.anchor * ch.anchor);
      this.stepChain(ch, j.x + cx * along - ax * drop, j.y + cy * along - ay * drop, j, dt);
    }
    for (const ch of j.arms) {
      const along = ch.anchor * rx * 0.28;
      this.stepChain(ch, j.x + cx * along, j.y + cy * along, j, dt);
    }
    this.wrapJelly(j);
  }

  private wrapJelly(j: Jelly) {
    // Wait for the bell and every trailing tip to clear the edge before
    // bringing the animal back just beyond the opposite edge.
    const reach = j.size * 1.6;
    let left = j.x - reach;
    let right = j.x + reach;
    let top = j.y - reach;
    let bottom = j.y + reach;
    for (const chain of [...j.tentacles, ...j.arms]) {
      for (let i = 0; i < chain.pos.length; i += 2) {
        left = Math.min(left, chain.pos[i]);
        right = Math.max(right, chain.pos[i]);
        top = Math.min(top, chain.pos[i + 1]);
        bottom = Math.max(bottom, chain.pos[i + 1]);
      }
    }
    const pad = 24;
    const dx = right < -pad ? this.width + pad - left : left > this.width + pad ? -pad - right : 0;
    const dy = bottom < -pad ? this.height + pad - top : top > this.height + pad ? -pad - bottom : 0;
    if (dx || dy) translateJelly(j, dx, dy);
  }

  // Verlet: each point keeps its momentum, is pulled by a slow sway, gravity
  // and the stirred current, then is held at a fixed distance from the one above.
  private stepChain(c: Chain, bx: number, by: number, j: Jelly, dt: number) {
    const { pos, prev, seg } = c;
    const n = pos.length / 2;
    const t = this.time;
    pos[0] = prev[0] = bx;
    pos[1] = prev[1] = by;
    const cur = this.current(bx, by + seg * n * 0.5, 220);
    const dt2 = dt * dt;
    for (let i = 1; i < n; i++) {
      const k = 2 * i;
      const x = pos[k];
      const y = pos[k + 1];
      // Higher damping bleeds off sideways momentum so tentacles don't keep swinging.
      const vx = (x - prev[k]) * 0.93;
      const vy = (y - prev[k + 1]) * 0.93;
      prev[k] = x;
      prev[k + 1] = y;
      // Gentle undulation: small amplitude wave travelling down the tentacle.
      // Amplitude grows toward the tip (i/n) so the base stays anchored.
      const undulate =
        (Math.sin(t * 1.4 - i * 0.55 + j.id * 1.7 + c.anchor * 2.5) * 18 +
          Math.sin(j.phase * TAU - i * 0.6) * 10) *
        (i / n);
      // Soft lateral spring: nudges each node back toward its anchor's
      // horizontal offset so tentacles stay spread across the bell opening
      // rather than collapsing into one column.
      const anchorX = bx + c.anchor * (j.size * 0.35) * (1 - i / n);
      const spring = (anchorX - x) * 1.2 * dt;
      // Gravity pulls straight down in world space.
      pos[k] = x + vx + (undulate + spring + cur.x * 0.15) * dt2;
      pos[k + 1] = y + vy + (90 + cur.y * 0.15) * dt2;
    }
    for (let i = 1; i < n; i++) {
      const k = 2 * i;
      const dx = pos[k] - pos[k - 2];
      const dy = pos[k + 1] - pos[k - 1];
      const f = seg / (Math.hypot(dx, dy) || 1);
      pos[k] = pos[k - 2] + dx * f;
      pos[k + 1] = pos[k - 1] + dy * f;
    }
  }

  private stepParticles(dt: number) {
    const { width: w, height: h, time: t } = this;

    for (const m of this.snow) {
      const c = this.current(m.x, m.y, 140);
      m.x += (Math.sin(t * 0.4 + m.phase) * 5 + c.x * 0.05) * dt;
      m.y += (m.vy + c.y * 0.05) * dt;
      if (m.y > h) {
        m.y = 0;
        m.x = rand(0, w);
      } else if (m.y < 0) m.y = h;
      if (m.x < 0) m.x += w;
      else if (m.x > w) m.x -= w;
    }

    for (const b of this.bubbles) {
      b.vy += (-(36 + 22 * b.r) - b.vy) * Math.min(1, dt * 2);
      b.y += b.vy * dt;
      b.x += Math.sin(t * 3 + b.phase) * (10 + 6 * b.r) * dt;
    }
    // Bubbles pop after rising a while, with a little spray.
    this.bubbles = this.bubbles.filter((b) => {
      if (b.y > b.pop) return true;
      this.sparks.push({ x: b.x, y: b.y, vx: rand(-20, 20), vy: rand(-30, -10), born: t, life: 0.5 });
      return false;
    });

    const drag = Math.exp(-2.4 * dt);
    for (const s of this.sparks) {
      s.vx *= drag;
      s.vy *= drag;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
    this.sparks = this.sparks.filter((s) => t - s.born < s.life);
    this.ripples = this.ripples.filter((r) => t - r.born < 2.4);
  }
}
