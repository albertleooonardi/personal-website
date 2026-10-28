const strip = document.querySelector<HTMLElement>('[data-strip]');
const desktop = matchMedia('(min-width: 1024px)');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

if (strip) {
  let target = strip.scrollLeft;
  let raf = 0;
  let drag: { id: number; x: number; left: number; moved: boolean } | null = null;
  let suppressClick = false;
  const max = () => Math.max(0, strip.scrollWidth - strip.clientWidth);
  const clamp = (n: number) => Math.max(0, Math.min(max(), n));
  const stop = () => { cancelAnimationFrame(raf); raf = 0; target = strip.scrollLeft; };
  const ease = () => {
    const delta = target - strip.scrollLeft;
    if (Math.abs(delta) < 0.5) {
      strip.scrollLeft = target;
      raf = 0;
      return;
    }
    strip.scrollLeft += delta * 0.18;
    raf = requestAnimationFrame(ease);
  };
  const move = (delta: number) => {
    if (!raf) target = strip.scrollLeft;
    target = clamp(target + delta);
    if (reduced.matches) { stop(); strip.scrollLeft = clamp(strip.scrollLeft + delta); }
    else if (!raf) raf = requestAnimationFrame(ease);
  };

  try {
    const slug = sessionStorage.getItem('projects-last-viewed');
    const card = slug && strip.querySelector<HTMLElement>(`[data-slug="${CSS.escape(slug)}"]`);
    if (card && desktop.matches) strip.scrollLeft += card.getBoundingClientRect().left - strip.getBoundingClientRect().left - parseFloat(getComputedStyle(strip).paddingLeft);
  } catch {}

  window.addEventListener('wheel', (event) => {
    if (!desktop.matches || event.ctrlKey || max() < 1) return;
    const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    if (horizontal && strip.contains(event.target as Node)) return stop();
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? strip.clientWidth : 1;
    move((horizontal ? event.deltaX : event.deltaY) * unit);
  }, { passive: false });

  window.addEventListener('keydown', (event) => {
    if (!desktop.matches || max() < 1 || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    if ((event.target as HTMLElement)?.closest('input, textarea, select, [contenteditable="true"], [role="slider"]')) return;
    const steps: Record<string, number> = { ArrowRight: 0.1, ArrowDown: 0.1, ArrowLeft: -0.1, ArrowUp: -0.1, PageDown: 0.8, PageUp: -0.8, ' ': event.shiftKey ? -0.8 : 0.8 };
    if (event.key === ' ' && (event.target as HTMLElement)?.closest('button')) return;
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      move(event.key === 'Home' ? -max() : max());
    } else if (event.key in steps) {
      event.preventDefault();
      move(steps[event.key] * strip.clientWidth);
    }
  });

  strip.addEventListener('pointerdown', (event) => {
    if (!desktop.matches || max() < 1 || event.pointerType !== 'mouse' || event.button !== 0 || event.metaKey || event.ctrlKey) return;
    stop();
    suppressClick = false;
    drag = { id: event.pointerId, x: event.clientX, left: strip.scrollLeft, moved: false };
  });
  strip.addEventListener('pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    if (!drag.moved && Math.abs(event.clientX - drag.x) <= 6) return;
    drag.moved = true;
    strip.setPointerCapture(event.pointerId);
    strip.classList.add('dragging');
    event.preventDefault();
    strip.scrollLeft = clamp(drag.left + drag.x - event.clientX);
    target = strip.scrollLeft;
  });
  const endDrag = () => {
    if (!drag) return;
    suppressClick = drag.moved;
    if (strip.hasPointerCapture(drag.id)) strip.releasePointerCapture(drag.id);
    drag = null;
    strip.classList.remove('dragging');
    setTimeout(() => { suppressClick = false; }, 0);
  };
  window.addEventListener('pointerup', endDrag);
  strip.addEventListener('pointercancel', endDrag);
  strip.addEventListener('dragstart', (event) => event.preventDefault());
  strip.addEventListener('click', (event) => {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClick = false;
  }, true);
  strip.addEventListener('focusin', () => { stop(); requestAnimationFrame(stop); });
  desktop.addEventListener('change', () => { endDrag(); stop(); });
  reduced.addEventListener('change', stop);
  window.addEventListener('pagehide', stop);
}
