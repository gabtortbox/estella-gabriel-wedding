document.addEventListener("DOMContentLoaded", () => {
  const siteHeader = document.querySelector(".site-header");

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
     Header state
  --------------------------------- */
  function updateHeaderState() {
    if (!siteHeader) return;
    siteHeader.classList.toggle("is-scrolled", window.scrollY > 24);
  }

  /* ---------------------------------
     Cover motion
  --------------------------------- */
  const coverPhoto = document.querySelector(".cover-photo");
  const coverRoute = document.querySelector(".cover-route-line");

  function updateCoverMotion() {
    const offset = window.scrollY;

    if (coverPhoto) {
      coverPhoto.style.transform = `scale(1.06) translateY(${offset * 0.045}px)`;
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
     Section 4: Guest tabs
  --------------------------------- */
  const guestTabButtons = document.querySelectorAll(".guest-tab-btn");
  const guestTabPanels = document.querySelectorAll(".guest-tab-panel");

  function setGuestTab(tabName) {
    guestTabButtons.forEach((button) => {
      const isActive = button.dataset.guestTab === tabName;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    guestTabPanels.forEach((panel) => {
      const isActive = panel.dataset.guestPanel === tabName;
      panel.classList.toggle("is-active", isActive);
    });
  }

  if (guestTabButtons.length) {
    guestTabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const tabName = button.dataset.guestTab;
        if (tabName) setGuestTab(tabName);
      });
    });
  }

  /* ---------------------------------
     Combined scroll updates
  --------------------------------- */
  let ticking = false;

  function runScrollEffects() {
    updateHeaderState();
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
    updateHeaderState();
    updateCoverMotion();
    updateJourneyTimeline();
  }

  updateHeaderState();
  updateCoverMotion();
  updateJourneyTimeline();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
});
