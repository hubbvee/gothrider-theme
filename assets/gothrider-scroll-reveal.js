/**
 * GothRider Scroll Reveal
 * Triggers .is-visible class on elements with .gr-reveal
 * Uses IntersectionObserver for performance
 */
if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
    }
  );

  document.querySelectorAll('.gr-reveal').forEach((el) => {
    revealObserver.observe(el);
  });

  // Re-observe on section re-render (Shopify editor)
  if (Shopify.designMode) {
    document.addEventListener('shopify:section:load', () => {
      document.querySelectorAll('.gr-reveal:not(.is-visible)').forEach((el) => {
        revealObserver.observe(el);
      });
    });
  }
}
