document.addEventListener("DOMContentLoaded", () => {
  const revealItems = document.querySelectorAll(".reveal");

  if (revealItems.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { threshold: 0.16 }
    );

    revealItems.forEach((item) => observer.observe(item));
  }

  const coverPhoto = document.querySelector(".cover-photo");
  const coverRoute = document.querySelector(".cover-route-line");

  function updateCoverMotion() {
    const offset = window.scrollY;

    if (coverPhoto) {
      coverPhoto.style.transform = `scale(1.04) translateY(${offset * 0.06}px)`;
    }

    if (coverRoute) {
      coverRoute.style.transform = `translateY(${offset * 0.03}px)`;
    }
  }

  const openingSection = document.querySelector(".opening-page-turn");
  const openingLayer = document.querySelector(".opening-page-layer");

  function updateOpeningPageTurn() {
    if (!openingSection || !openingLayer) return;

    const rect = openingSection.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const total = rect.height - viewportHeight;
    const progressed = Math.min(Math.max(-rect.top / total, 0), 1);

    const lift = progressed * -36;
    const scale = 1 - progressed * 0.035;
    const rotateX = progressed * 5;

    openingLayer.style.transform =
      `perspective(1200px) translateY(${lift}px) rotateX(${rotateX}deg) scale(${scale})`;

    if (progressed > 0.08) {
      openingLayer.classList.add("is-turning");
    } else {
      openingLayer.classList.remove("is-turning");
    }
  }

  function updateScrollEffects() {
    updateCoverMotion();
    updateOpeningPageTurn();
  }

  updateScrollEffects();

  window.addEventListener("scroll", updateScrollEffects, { passive: true });
  window.addEventListener("resize", updateScrollEffects);
});
