document.addEventListener("DOMContentLoaded", () => {
  // ---------------------------
  // Countdown
  // ---------------------------
  const daysEl = document.getElementById("days");
  const hoursEl = document.getElementById("hours");
  const minutesEl = document.getElementById("minutes");
  const secondsEl = document.getElementById("seconds");

  if (daysEl && hoursEl && minutesEl && secondsEl) {
    const targetDate = new Date("2027-07-11T18:00:00").getTime();

    function updateCountdown() {
      const now = new Date().getTime();
      const diff = targetDate - now;

      if (diff <= 0) {
        daysEl.textContent = "000";
        hoursEl.textContent = "00";
        minutesEl.textContent = "00";
        secondsEl.textContent = "00";
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      daysEl.textContent = String(days).padStart(3, "0");
      hoursEl.textContent = String(hours).padStart(2, "0");
      minutesEl.textContent = String(minutes).padStart(2, "0");
      secondsEl.textContent = String(seconds).padStart(2, "0");
    }

    updateCountdown();
    setInterval(updateCountdown, 1000);
  }

  // ---------------------------
  // Hidden stamp message
  // ---------------------------
  const secretButton = document.getElementById("secretButton");
  const secretMessage = document.getElementById("secretMessage");

  if (secretButton && secretMessage) {
    secretButton.addEventListener("click", () => {
      secretMessage.classList.toggle("hidden");
    });
  }

  // ---------------------------
  // Passenger Access tabs
  // ---------------------------
  const accessTabs = document.querySelectorAll(".access-tab");
  const accessPanels = document.querySelectorAll(".access-panel");

  if (accessTabs.length && accessPanels.length) {
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
  }

  // ---------------------------
  // RSVP form logic
  // ---------------------------
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
          <label for="guestFirstName${i}" class="label-with-tag">
            <span>First Name</span>
            <span class="required-tag">Required</span>
          </label>
          <input type="text" id="guestFirstName${i}" name="guestFirstName${i}" />
        </div>

        <div class="form-group">
          <label for="guestLastName${i}" class="label-with-tag">
            <span>Last Name</span>
            <span class="required-tag">Required</span>
          </label>
          <input type="text" id="guestLastName${i}" name="guestLastName${i}" />
        </div>
      </div>

      <div class="form-group">
        <label for="guestAttendance${i}" class="label-with-tag">
          <span>Attendance</span>
          <span class="required-tag">Required</span>
        </label>
        <select id="guestAttendance${i}" name="guestAttendance${i}">
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
          placeholder="Example: shellfish allergy, vegetarian, no beef"
        ></textarea>
      </div>
    `;

    guestFieldsContainer.appendChild(guestCard);
  }
}
  
  function updateGuestVisibility() {
    if (!guestCountGroup || !guestCountSelect) return;

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
    if (!attendanceSelect || !attendingFields || !guestCountSelect) return;

    if (attendanceSelect.value === "Regretfully unable to attend") {
      attendingFields.classList.add("hidden");
      guestCountSelect.value = "0";
      renderGuestFields(0);
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
      const count = Number(guestCountSelect.value || 0);
      renderGuestFields(count);
    });
  }

  if (rsvpForm && formMessage) {
    rsvpForm.addEventListener("submit", (event) => {
      event.preventDefault();
      formMessage.textContent = "";

      const firstName = document.getElementById("firstName")?.value.trim();
      const lastName = document.getElementById("lastName")?.value.trim();
      const attendance = attendanceSelect?.value;
      const bringingGuests =
        document.querySelector('input[name="bringingGuests"]:checked')?.value || "No";
      const guestCount = Number(guestCountSelect?.value || 0);

      if (!firstName || !lastName || !attendance) {
        formMessage.textContent = "Please complete first name, last name, and attendance.";
        return;
      }

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

      formMessage.textContent = "Form looks good. Next we’ll connect this to Google Sheets.";
    });
  }
});
