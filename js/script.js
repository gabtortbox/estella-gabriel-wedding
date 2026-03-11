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

const rsvpForm = document.getElementById("rsvpForm");
const attendanceSelect = document.getElementById("attendance");
const guestCountGroup = document.getElementById("guestCountGroup");
const guestCountSelect = document.getElementById("guestCount");
const guestFieldsContainer = document.getElementById("guestFields");
const attendingFields = document.getElementById("attendingFields");
const bringingGuestsRadios = document.querySelectorAll('input[name="bringingGuests"]');
const formMessage = document.getElementById("formMessage");

function renderGuestFields(count) {
  if (!guestFieldsContainer) return;
  guestFieldsContainer.innerHTML = "";

  for (let i = 1; i <= count; i += 1) {
    const guestCard = document.createElement("div");
    guestCard.className = "guest-field-card";
    guestCard.innerHTML = `
      <h4>Additional Guest ${i}</h4>
      <div class="form-grid">
        <div class="form-group">
          <label for="guestFirstName${i}">First Name</label>
          <input type="text" id="guestFirstName${i}" name="guestFirstName${i}" required />
        </div>
        <div class="form-group">
          <label for="guestLastName${i}">Last Name</label>
          <input type="text" id="guestLastName${i}" name="guestLastName${i}" required />
        </div>
      </div>

      <div class="form-group">
        <label for="guestAttendance${i}">Attendance</label>
        <select id="guestAttendance${i}" name="guestAttendance${i}" required>
          <option value="">Select one</option>
          <option value="Attending">Attending</option>
          <option value="Not attending">Not attending</option>
        </select>
      </div>

      <div class="form-group">
        <label for="guestDietary${i}">Dietary Restrictions</label>
        <textarea
          id="guestDietary${i}"
          name="guestDietary${i}"
          rows="3"
          placeholder="Please let us know of any dietary requirements."
        ></textarea>
      </div>
    `;
    guestFieldsContainer.appendChild(guestCard);
  }
}

function updateGuestVisibility() {
  const selectedRadio = document.querySelector('input[name="bringingGuests"]:checked');
  const bringingGuests = selectedRadio ? selectedRadio.value : "No";

  if (bringingGuests === "Yes") {
    guestCountGroup.classList.remove("hidden");
    const selectedCount = Number(guestCountSelect.value || 0);
    renderGuestFields(selectedCount);
  } else {
    guestCountGroup.classList.add("hidden");
    guestCountSelect.value = "0";
    renderGuestFields(0);
  }
}

function updateAttendanceVisibility() {
  if (!attendanceSelect || !attendingFields) return;

  if (attendanceSelect.value === "Regretfully unable to attend") {
    attendingFields.classList.add("hidden");
    renderGuestFields(0);
    guestCountSelect.value = "0";
  } else {
    attendingFields.classList.remove("hidden");
    updateGuestVisibility();
  }
}

if (attendanceSelect) {
  attendanceSelect.addEventListener("change", updateAttendanceVisibility);
  updateAttendanceVisibility();
}

if (bringingGuestsRadios.length) {
  bringingGuestsRadios.forEach((radio) => {
    radio.addEventListener("change", updateGuestVisibility);
  });
  updateGuestVisibility();
}

if (guestCountSelect) {
  guestCountSelect.addEventListener("change", () => {
    renderGuestFields(Number(guestCountSelect.value || 0));
  });
}

if (rsvpForm) {
  rsvpForm.addEventListener("submit", (event) => {
    event.preventDefault();

    formMessage.textContent = "";

    const firstName = document.getElementById("firstName")?.value.trim();
    const lastName = document.getElementById("lastName")?.value.trim();
    const attendance = attendanceSelect?.value;

    if (!firstName || !lastName || !attendance) {
      formMessage.textContent = "Please complete all required main guest details.";
      return;
    }

    const selectedRadio = document.querySelector('input[name="bringingGuests"]:checked');
    const bringingGuests = selectedRadio ? selectedRadio.value : "No";
    const guestCount = Number(guestCountSelect?.value || 0);

    if (attendance !== "Regretfully unable to attend" && bringingGuests === "Yes" && guestCount < 1) {
      formMessage.textContent = "Please select the number of additional guests.";
      return;
    }

    if (attendance !== "Regretfully unable to attend" && bringingGuests === "Yes") {
      for (let i = 1; i <= guestCount; i += 1) {
        const guestFirstName = document.getElementById(`guestFirstName${i}`)?.value.trim();
        const guestLastName = document.getElementById(`guestLastName${i}`)?.value.trim();
        const guestAttendance = document.getElementById(`guestAttendance${i}`)?.value;

        if (!guestFirstName || !guestLastName || !guestAttendance) {
          formMessage.textContent = `Please complete all required details for Additional Guest ${i}.`;
          return;
        }
      }
    }

    formMessage.textContent = "Form looks good. Next we will connect this to Google Sheets.";
  });
}
