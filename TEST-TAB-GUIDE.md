# Previous Test-Tab Setup Retired

This file replaces the old instructions so an outdated test guide is not left
in the GitHub repository. Do not run setupTestRsvp or use test=1 links.

The current simple workflow uses Guestlist only. Guestlist [Test] is ignored.
Old test tabs can remain archived and are never read by the website.

For a Google trial, use a disposable COPY OF THE ENTIRE WORKBOOK, with the active
source tab named Guestlist, fictional names, G = Yes, B filled and I = No. Replace
its copied script and run updateInvitationCodes from that trial workbook. Do not
deploy it over the REAL master deployment. Use a separate trial web app/website
only if you need a completely independent real-Google trial.

For the final deployment check, use clearly fictional rows in the actual master
Guestlist, as described in LAUNCH-CHECKLIST.md. Remove them from eligibility before
invitations are sent. Never test through a real guest's invitation.

For local testing with no Google access, run `node scripts/preview-rsvp.cjs` and
use its printed fictional-only links. Current setup: see RSVP-SETUP.md.
