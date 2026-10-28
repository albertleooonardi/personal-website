// Runs the ocean on a canvas: the frame loop, stirring the water with the
// pointer, touching it with a click, reduced motion, and keeping the
// jellyfish clear of the page's text.

import { Renderer } from './renderer';
import { type Box, World } from './world';

const STEP = 1 / 60;
/** With reduced motion the ocean keeps drifting, slowly, and clicks stay quiet. */
const CALM = 0.35;

export interface Stats {
  jellies: number;
  glowing: number;
}

// Merge nearby boxes so the jellyfish go around a paragraph, not between lines.
function mergeBoxes(boxes: Box[]) {
  const merged: Box[] = [];
  for (const b of [...boxes].sort((a, c) => a.top - c.top)) {
    const m = merged.find((o) => b.top - o.bottom < 160 && b.left - o.right < 160 && o.left - b.right < 160);
    if (!m) {
      merged.push({ ...b });
      continue;
    }
    m.left = Math.min(m.left, b.left);
    m.right = Math.max(m.right, b.right);
    m.bottom = Math.max(m.bottom, b.bottom);
  }
  return merged;
}

export class Ocean {
  private world = new World();
  private renderer: Renderer;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private frames = 0;
  private lastPointerTime = 0;
  private visible = true;
  private disposed = false;
  private reported: Stats = { jellies: -1, glowing: -1 };
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private resizeObserver = new ResizeObserver(() => this.resize());
  private intersectionObserver: IntersectionObserver;

  constructor(
    private canvas: HTMLCanvasElement,
    private onStats: (s: Stats) => void,
  ) {
    this.renderer = new Renderer(canvas);
    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      this.schedule();
    });
    this.resizeObserver.observe(canvas);
    this.intersectionObserver.observe(canvas);
    this.reducedMotion.addEventListener('change', this.schedule);
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    window.addEventListener('click', this.onClick);
    document.documentElement.addEventListener('pointerleave', this.onPointerLeave);
    window.addEventListener('blur', this.onPointerLeave);
    this.resize();
    this.schedule();
  }

  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    this.reducedMotion.removeEventListener('change', this.schedule);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('click', this.onClick);
    document.documentElement.removeEventListener('pointerleave', this.onPointerLeave);
    window.removeEventListener('blur', this.onPointerLeave);
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    this.renderer.resize(rect.width, rect.height, Math.min(window.devicePixelRatio || 1, 2));
    this.world.resize(rect.width, rect.height);
    this.measureContent();
    this.renderer.render(this.world);
    this.report();
  }

  private measureContent() {
    const origin = this.canvas.getBoundingClientRect();
    const boxes = Array.from(document.querySelectorAll('[data-sea-avoid]'), (el) => {
      const r = el.getBoundingClientRect();
      return {
        left: r.left - origin.left,
        top: r.top - origin.top,
        right: r.right - origin.left,
        bottom: r.bottom - origin.top,
      };
    }).filter((b) => b.right > b.left && b.bottom > b.top);
    const merged = mergeBoxes(boxes);
    this.renderer.setDimBoxes(merged);
    this.world.avoid = merged;
  }

  private report() {
    const stats = { jellies: this.world.jellies.length, glowing: this.world.glowing };
    if (stats.jellies !== this.reported.jellies || stats.glowing !== this.reported.glowing) {
      this.reported = stats;
      this.onStats(stats);
    }
  }

  private schedule = () => {
    cancelAnimationFrame(this.raf);
    if (this.disposed || !this.visible) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  };

  private frame = (now: number) => {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.acc += dt * (this.reducedMotion.matches ? CALM : 1);
    let steps = 0;
    while (this.acc >= STEP && steps < 4) {
      this.world.step(STEP);
      this.acc -= STEP;
      steps++;
    }
    if (steps === 4) this.acc = 0;
    if (++this.frames % 30 === 0) this.measureContent();
    this.renderer.render(this.world);
    this.report();
    this.raf = requestAnimationFrame(this.frame);
  };

  private toLocal(e: PointerEvent | MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { x, y, inside: x >= 0 && y >= 0 && x <= rect.width && y <= rect.height };
  }

  private onPointerMove = (e: PointerEvent) => {
    const { x, y, inside } = this.toLocal(e);
    const p = this.world.pointer;
    const elapsed = Math.max(1, e.timeStamp - this.lastPointerTime) / 1000;
    const vx = Math.max(-3000, Math.min(3000, (x - p.x) / elapsed));
    const vy = Math.max(-3000, Math.min(3000, (y - p.y) / elapsed));
    // A pointer that just arrived hasn't stirred anything yet.
    const fresh = !p.active || elapsed > 0.2;
    p.vx += ((fresh ? 0 : vx) - p.vx) * 0.5;
    p.vy += ((fresh ? 0 : vy) - p.vy) * 0.5;
    p.speed += ((fresh ? 0 : Math.hypot(vx, vy)) - p.speed) * 0.5;
    this.lastPointerTime = e.timeStamp;
    p.x = x;
    p.y = y;
    p.active = inside && e.pointerType !== 'touch';
  };

  private onClick = (e: MouseEvent) => {
    if (this.reducedMotion.matches) return;
    const interactive = e
      .composedPath()
      .some(
        (el) =>
          el instanceof Element &&
          el.matches("a, button, input, textarea, select, label, [role='button'], [data-sea-ignore]"),
      );
    if (interactive) return;
    if (window.getSelection()?.toString()) return;
    const { x, y, inside } = this.toLocal(e);
    if (!inside) return;
    this.world.touch(x, y);
    this.report();
  };

  private onPointerLeave = () => {
    const p = this.world.pointer;
    p.active = false;
    p.vx = p.vy = p.speed = 0;
  };
}
