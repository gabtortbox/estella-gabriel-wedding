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

  const journeySection = document.querySelector(".journey-timeline-section");
  const journeyTrack = document.getElementById("journeyTrack");
  const journeyDots = document.querySelectorAll(".journey-dot");
  const bgLayers = document.querySelectorAll(".journey-bg-layer");

  function updateJourneyTimeline() {
    if (!journeySection || !journeyTrack) return;
    if (window.innerWidth <= 980) return;

    const rect = journeySection.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const totalScroll = rect.height - viewportHeight;
    const progressed = Math.min(Math.max(-rect.top / totalScroll, 0), 1);

    const panels = 4;
    const maxTranslate = (panels - 1) * window.innerWidth;
    const translateX = progressed * maxTranslate;

    journeyTrack.style.transform = `translateX(-${translateX}px)`;

    const activeIndex = Math.min(panels - 1, Math.floor(progressed * panels));

    journeyDots.forEach((dot, index) => {
      dot.classList.toggle("is-active", index === activeIndex);
    });

    bgLayers.forEach((layer, index) => {
      layer.classList.toggle("is-active", index === activeIndex);
    });
  }

  function jumpToJourneyPanel(index) {
    if (!journeySection || window.innerWidth <= 980) return;

    const sectionTop = window.scrollY + journeySection.getBoundingClientRect().top;
    const viewportHeight = window.innerHeight;
    const totalScroll = journeySection.offsetHeight - viewportHeight;
    const progress = index / 4;
    const targetY = sectionTop + totalScroll * progress;

    window.scrollTo({
      top: targetY,
      behavior: "smooth"
    });
  }

  journeyDots.forEach((dot) => {
    dot.addEventListener("click", () => {
      const index = Number(dot.dataset.index || 0);
      jumpToJourneyPanel(index);
    });
  });

  function updateAllScrollEffects() {
    updateCoverMotion();
    updateJourneyTimeline();
  }

  updateAllScrollEffects();

  window.addEventListener("scroll", updateAllScrollEffects, { passive: true });
  window.addEventListener("resize", updateAllScrollEffects);
});
