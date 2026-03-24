document.addEventListener("DOMContentLoaded", () => {
  /* ---------------------------------
     Reveal-on-scroll
  --------------------------------- */
  const revealItems = document.querySelectorAll(".reveal");

  if (revealItems.length) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      {
        threshold: 0.16
      }
    );

    revealItems.forEach((item) => revealObserver.observe(item));
  }

  /* ---------------------------------
     Cover motion
  --------------------------------- */
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

  /* ---------------------------------
     Section 2: Horizontal journey timeline
  --------------------------------- */
  const journeySection = document.querySelector(".journey-timeline-section");
  const journeyTrack = document.getElementById("journeyTrack");
  const journeyDots = document.querySelectorAll(".journey-dot");
  const bgLayers = document.querySelectorAll(".journey-bg-layer");

  const JOURNEY_PANELS = 4;
  let currentJourneyIndex = 0;

  function getJourneyProgress() {
    if (!journeySection) return 0;

    const rect = journeySection.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const totalScrollable = journeySection.offsetHeight - viewportHeight;

    if (totalScrollable <= 0) return 0;

    const rawProgress = -rect.top / totalScrollable;
    return Math.min(Math.max(rawProgress, 0), 1);
  }

  function getJourneyActiveIndex(progress) {
    const safeProgress = Math.min(progress, 0.999999);
    return Math.floor(safeProgress * JOURNEY_PANELS);
  }

  function updateJourneyDots(activeIndex) {
    journeyDots.forEach((dot, index) => {
      dot.classList.toggle("is-active", index === activeIndex);
    });
  }

  function updateJourneyBackgrounds(activeIndex) {
    bgLayers.forEach((layer, index) => {
      layer.classList.toggle("is-active", index === activeIndex);
    });
  }

  function updateJourneyTimeline() {
    if (!journeySection || !journeyTrack) return;

    if (window.innerWidth <= 980) {
      journeyTrack.style.transform = "none";
      return;
    }

    const progress = getJourneyProgress();
    const maxTranslate = (JOURNEY_PANELS - 1) * window.innerWidth;
    const translateX = progress * maxTranslate;

    journeyTrack.style.transform = `translateX(-${translateX}px)`;

    const activeIndex = getJourneyActiveIndex(progress);
    currentJourneyIndex = activeIndex;

    updateJourneyDots(activeIndex);
    updateJourneyBackgrounds(activeIndex);
  }

  function jumpToJourneyPanel(index) {
    if (!journeySection) return;
    if (window.innerWidth <= 980) return;

    const clampedIndex = Math.max(0, Math.min(index, JOURNEY_PANELS - 1));
    const sectionTop = window.scrollY + journeySection.getBoundingClientRect().top;
    const viewportHeight = window.innerHeight;
    const totalScrollable = journeySection.offsetHeight - viewportHeight;

    if (totalScrollable <= 0) return;

    const targetProgress = clampedIndex / JOURNEY_PANELS;
    const targetY = sectionTop + totalScrollable * targetProgress;

    window.scrollTo({
      top: targetY,
      behavior: "smooth"
    });
  }

  if (journeyDots.length) {
    journeyDots.forEach((dot) => {
      dot.addEventListener("click", () => {
        const index = Number(dot.dataset.index || 0);
        jumpToJourneyPanel(index);
      });
    });
  }

  /* ---------------------------------
     Combined scroll updates
  --------------------------------- */
  let ticking = false;

  function runScrollEffects() {
    updateCoverMotion();
    updateJourneyTimeline();
    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(runScrollEffects);
      ticking = true;
    }
  }

  function onResize() {
    updateCoverMotion();
    updateJourneyTimeline();
  }

  updateCoverMotion();
  updateJourneyTimeline();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
});
