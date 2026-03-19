document.addEventListener("DOMContentLoaded", () => {
  // Scroll reveal
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

  // Hero parallax
  const heroImage = document.querySelector(".hero-image");

  if (heroImage) {
    window.addEventListener("scroll", () => {
      const offset = window.scrollY * 0.08;
      heroImage.style.transform = `scale(1.04) translateY(${offset}px)`;
    });
  }

  // Existing RSVP logic should stay below this line if needed on rsvp.html
});
