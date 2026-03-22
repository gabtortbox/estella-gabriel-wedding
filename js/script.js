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

  if (coverPhoto || coverRoute) {
    window.addEventListener("scroll", () => {
      const offset = window.scrollY;

      if (coverPhoto) {
        coverPhoto.style.transform = `scale(1.04) translateY(${offset * 0.06}px)`;
      }

      if (coverRoute) {
        coverRoute.style.transform = `translateY(${offset * 0.03}px)`;
      }
    });
  }
});
