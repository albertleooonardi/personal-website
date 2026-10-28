// Progressive motion: page content remains visible when JavaScript is absent.
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const active = new Set<Animation>();

function reveal(element: HTMLElement) {
  if (reduced.matches || document.hidden) return;
  const animation = element.animate(
    [
      { opacity: 0, transform: 'translateY(14px)', filter: 'blur(4px)' },
      { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' },
    ],
    {
      duration: 650,
      delay: Number(element.dataset.revealDelay || 0),
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'backwards',
    },
  );
  active.add(animation);
  animation.finished.then(() => active.delete(animation), () => active.delete(animation));
}

const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    observer.unobserve(entry.target);
    reveal(entry.target as HTMLElement);
  }
}, { threshold: 0.08 });

for (const element of document.querySelectorAll<HTMLElement>(
  '[data-reveal], .case > header, .case > .poster, .story > *, .wall > figure, .posts > li, .soon',
)) observer.observe(element);

function settle() {
  for (const animation of active) animation.cancel();
  active.clear();
}

reduced.addEventListener('change', () => { if (reduced.matches) settle(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) settle(); });
window.addEventListener('pagehide', settle);
