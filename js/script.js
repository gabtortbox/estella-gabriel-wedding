const targetDate = new Date("2027-07-11T18:00:00").getTime();

function updateCountdown() {
  const now = new Date().getTime();
  const diff = targetDate - now;

  if (diff <= 0) {
    document.getElementById("days").textContent = "000";
    document.getElementById("hours").textContent = "00";
    document.getElementById("minutes").textContent = "00";
    document.getElementById("seconds").textContent = "00";
    return;
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  document.getElementById("days").textContent = String(days).padStart(3, "0");
  document.getElementById("hours").textContent = String(hours).padStart(2, "0");
  document.getElementById("minutes").textContent = String(minutes).padStart(2, "0");
  document.getElementById("seconds").textContent = String(seconds).padStart(2, "0");
}

updateCountdown();
setInterval(updateCountdown, 1000);

const secretButton = document.getElementById("secretButton");
const secretMessage = document.getElementById("secretMessage");

if (secretButton && secretMessage) {
  secretButton.addEventListener("click", () => {
    secretMessage.classList.toggle("hidden");
  });
}

const accessTabs = document.querySelectorAll(".access-tab");
const accessPanels = document.querySelectorAll(".access-panel");

accessTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.tab;

    accessTabs.forEach((item) => item.classList.remove("active"));
    accessPanels.forEach((panel) => panel.classList.remove("active"));

    tab.classList.add("active");
    const targetPanel = document.getElementById(target);
    if (targetPanel) {
      targetPanel.classList.add("active");
    }
  });
});
