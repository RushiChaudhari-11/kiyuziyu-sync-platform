// collection-animations.js
// Lightweight intersection observer + stagger reveal + optional global micro-tilt.
// Use: import initCollectionAnimations from './collection-animations';
// then call initCollectionAnimations('.jc-collections-grid');

export default function initCollectionAnimations(rootSelector = '.jc-collections-grid') {
  if (typeof window === 'undefined') return null;
  const grid = document.querySelector(rootSelector);
  if (!grid) return null;

  const cards = Array.from(grid.querySelectorAll('.jc-card'));
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const el = entry.target;
        if (entry.isIntersecting) {
          const idx = Number(el.dataset.jcIndex || 0);
          setTimeout(() => {
            el.classList.add('jc-visible');
            // small aria/polish: remove transform inline if set earlier
            el.style.willChange = '';
          }, idx * 90);
          observer.unobserve(el);
        }
      });
    },
    {
      threshold: 0.16,
      rootMargin: '0px 0px -6% 0px',
    }
  );

  cards.forEach((c, i) => {
    c.dataset.jcIndex = i;
    observer.observe(c);
  });

  // Optional: global micro-tilt on pointermove for larger screens
  function globalPointerMove(e) {
    const card = e.target.closest('.jc-card');
    // only run for pointer devices and on large screens
    if (!card || window.innerWidth < 700) return;
    const rect = card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    const rx = dy * 4; // rotateX
    const ry = -dx * 6; // rotateY
    card.style.transform = `perspective(900px) translateY(-10px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.01)`;
    card.classList.add('jc-tilted');
  }

  function globalPointerLeave(e) {
    const card = e.target.closest('.jc-card');
    if (!card) return;
    card.style.transform = '';
    card.classList.remove('jc-tilted');
  }

  grid.addEventListener('pointermove', globalPointerMove);
  grid.addEventListener('pointerleave', globalPointerLeave);

  // cleanup fn
  return function cleanup() {
    observer.disconnect();
    grid.removeEventListener('pointermove', globalPointerMove);
    grid.removeEventListener('pointerleave', globalPointerLeave);
  };
}
