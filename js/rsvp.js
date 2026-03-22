document.addEventListener("DOMContentLoaded", () => {
  const rsvpForm = document.getElementById("rsvpForm");
  const attendanceSelect = document.getElementById("attendance");
  const guestCountGroup = document.getElementById("guestCountGroup");
  const guestCountSelect = document.getElementById("guestCount");
  const guestFieldsContainer = document.getElementById("guestFields");
  const attendingFields = document.getElementById("attendingFields");
  const bringingGuestsRadios = document.querySelectorAll('input[name="bringingGuests"]');
  const formMessage = document.getElementById("formMessage");

  if (!rsvpForm) return;

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

    if (attendanceSelect.value === "Joyfully attending") {
      attendingFields.classList.remove("hidden");
      updateGuestVisibility();
    } else {
      attendingFields.classList.add("hidden");
      guestCountGroup.classList.add("hidden");
      guestCountSelect.value = "0";
      renderGuestFields(0);

      const noRadio = document.querySelector('input[name="bringingGuests"][value="No"]');
      if (noRadio) noRadio.checked = true;
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
  }

  if (guestCountSelect) {
    guestCountSelect.addEventListener("change", () => {
      const count = Number(guestCountSelect.value || 0);
      renderGuestFields(count);
    });
  }

  rsvpForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (formMessage) formMessage.textContent = "";

    const firstName = document.getElementById("firstName")?.value.trim();
    const lastName = document.getElementById("lastName")?.value.trim();
    const phone = document.getElementById("phone")?.value.trim();
    const attendance = attendanceSelect?.value || "";
    const dietary = document.getElementById("dietary")?.value.trim() || "";
    const note = document.getElementById("note")?.value.trim() || "";
    const bringingGuests =
      document.querySelector('input[name="bringingGuests"]:checked')?.value || "No";
    const guestCount = Number(guestCountSelect?.value || 0);

    if (!firstName || !lastName || !phone || !attendance) {
      if (formMessage) {
        formMessage.textContent = "Please complete first name, last name, phone number, and attendance.";
      }
      return;
    }

    if (attendance === "Joyfully attending" && bringingGuests === "Yes" && guestCount < 1) {
      if (formMessage) {
        formMessage.textContent = "Please select the number of additional guests.";
      }
      return;
    }

    const additionalGuests = [];

    if (attendance === "Joyfully attending" && bringingGuests === "Yes") {
      for (let i = 1; i <= guestCount; i += 1) {
        const guestFirstName = document.getElementById(`guestFirstName${i}`)?.value.trim();
        const guestLastName = document.getElementById(`guestLastName${i}`)?.value.trim();
        const guestAttendance = document.getElementById(`guestAttendance${i}`)?.value || "";
        const guestDietary = document.getElementById(`guestDietary${i}`)?.value.trim() || "";

        if (!guestFirstName || !guestLastName || !guestAttendance) {
          if (formMessage) {
            formMessage.textContent = `Please complete all required details for Additional Guest ${i}.`;
          }
          return;
        }

        additionalGuests.push({
          firstName: guestFirstName,
          lastName: guestLastName,
          attendance: guestAttendance,
          dietary: guestDietary
        });
      }
    }

    const payload = {
      firstName,
      lastName,
      phone,
      attendance,
      dietary,
      bringingGuests,
      guestCount,
      note,
      additionalGuests
    };

    const scriptUrl = "https://script.google.com/macros/s/AKfycbxc49phWZDv8t3q2k6mn-7A9xB6WbnyY5orVR-TxFzlQkmF0uQO_i5KSDJ-YAdcmgQ/exec";

    try {
      if (formMessage) formMessage.textContent = "Submitting your RSVP...";

      await fetch(scriptUrl, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload)
      });

      const params = new URLSearchParams({
        firstName,
        lastName,
        phone,
        attendance,
        bringingGuests,
        guestCount: String(guestCount)
      });

      window.location.href = `confirmed.html?${params.toString()}`;
    } catch (error) {
      console.error(error);
      if (formMessage) {
        formMessage.textContent = "There was an issue submitting your RSVP.";
      }
    }
  });
});
