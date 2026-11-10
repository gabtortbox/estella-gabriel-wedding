# Wedding RSVP: Setup And Everyday Guide

These changes are LOCAL until you update Apps Script and publish the website.
Do not paste the older script from chat. Use the current `rsvp-handler.gs` beside this guide.
No real spreadsheet, Apps Script deployment or GitHub repository was changed by Codex.

## 1. Make A Backup First

1. In Google Sheets, choose File > Make a copy. Keep a dated, private backup of the whole workbook.
2. Keep a separate copy for testing. Do not test with your live response records.
3. Save the existing Apps Script text and deployment URL privately before replacing the code.
4. Do not delete Guestlist or RSVP Responses, regenerate all codes, or change existing guest/group IDs.

## 2. Test The Upgrade On A Copy

1. Open the TEST workbook, then Extensions > Apps Script.
2. Replace the old RSVP gateway with ALL of the current `rsvp-handler.gs`. Do not leave duplicate functions in another script file.
3. At the top, check `RSVP_CONFIG.WEBSITE_URL`. It is already your existing GitHub Pages address.
4. Set `DINNER_CAPACITY` to your actual maximum allocated dinner seats, including family and yourselves if you list them as guests. The default `0` disables only the numerical capacity check, not released-seat approval. Set this before launch.
5. Confirm `DEADLINE` is 31 January 2027, 11.59 pm Singapore time. Leave `REVIEW_ALL_CHANGES: false` unless you want new Yes replies and other changes held for review now.
6. Save. Choose `setupRsvp` in the function selector and Run. Authorise only your own script with your own account. If permissions or a warning look unfamiliar, stop and check them rather than bypassing a browser security warning.
7. Return to the spreadsheet and reload it. A **Wedding RSVP** menu appears.
8. Read any setup alert. Resolve reported problems and run setup again; it is safe to rerun. Do not delete unmatched old responses to silence a migration warning.
9. Choose Wedding RSVP > Validate guest list. It should pass before deployment.
10. For an end-to-end Google test, deploy the TEST workbook's script as its own test web app. Duplicate the website folder locally, change `RSVP_ENDPOINT` only in that duplicate to the TEST `/exec` URL, and open the duplicate's `index.html` with fictional invitations. Do not publish that duplicate or put its test endpoint into the original site. The original site's endpoint should remain your LIVE deployment URL.

Setup retains all existing codes, creates long codes only where missing, adds permanent IDs, and imports existing replies (including manually entered Yes/No in Guestlist where no response exists). It does not invent dates for undated old replies. Ambiguous names, duplicate codes and unexpected response columns stop migration rather than deleting records. Your backup remains important because Google Sheets does not provide a multi-tab transaction.
The gateway stays unavailable until setup finishes successfully. A failed setup must be resolved and rerun before guests can reply; do not bypass it by editing the readiness marker.

### If Two Groups Share A Code

If two separate groups share the same URL Code, setup deliberately stops. Do not clear their codes or hidden IDs by hand, especially if responses already exist.

1. Back up the workbook and replace the script with this latest version, keeping your actual DINNER_CAPACITY setting.
2. Run **repairDuplicateGroupLink** from the Apps Script function selector (or Wedding RSVP > Repair shared code before setup).
3. Enter the group that should receive a NEW link. For example, when groups 50 and 51 share one code, enter **51** to keep group 50's existing link.
4. Confirm the repair. It retains Guest IDs, binds old responses before changing their code, and stops if an old response cannot be matched uniquely. Other groups' links and reply answers are not changed.
5. Run **setupRsvp**, then Validate guest list. Only after setup succeeds, update the existing deployment and publish the current website.
6. Copy the NEW Invitation Link for the repaired group. Their old shared link still belongs to the other group and must not be sent to the repaired group again.

Uninvited planning rows with no group/code/Invitation ID can remain on the sheet without blocking setup. Invited rows or rows with an existing invitation identity still require a group. Test rows with blank Invite Intent remain ineligible until you explicitly set Yes and Active.

## 3. Understand Your Columns

Existing column order is fine, including Save the Date Sent Out?. Match header names, not column letters.

| Column | What you do |
|---|---|
| URL Code (do not edit) | Generated. Existing links stay unchanged. Never paste a different person's code here. |
| RSVP Group | One household/couple/group answering together. Assign a group to every invited row or row with an existing code/Invitation ID. Uninvited planning rows with no code/Invitation ID may stay ungrouped and are left untouched. For existing guests, use the Move guests menu to regroup. |
| Category | `Family` gets tea at 5.30 pm plus dinner. Any other nonblank category gets dinner and arrival from 6 pm. One group cannot mix those schedule types. |
| Name | Actual guest-facing name, required. Spelling can change without losing the reply. Never replace a declined guest's name with a new person's name. |
| Relationship / Whose side? | Your internal planning fields; not sent to guests. |
| Invite Intent | Only `Yes` permits access. `No` and blank do not. This is NOT their RSVP answer. |
| Invitation Status | `Active` permits access if Invite Intent is also Yes. `Draft`, `Waitlist` and `Retired` do not. Setup initially makes existing Yes rows Active and other rows Draft. |
| Seat Status | `Reserved` until you deliberately release a declined seat. A later Yes from a Released seat needs approval. |
| Invitation Name | Optional greeting, e.g. Alex & Jamie. Use the same text within the group, or leave blank for a name-based greeting. |
| Invitation Link | Automatically generated full link to send. Every guest in the group shares it. |
| RSVP / Tea Ceremony | Automatically refreshed from confirmed replies. Do not type over these after setup; use Record a reply for selected guest. |
| Last Reply At / Reply Source | Automatic. Old replies without a known date stay undated. |
| Table / send-out columns | Your manual planning fields, retained. Sent Out is tracking only; it is not an access switch. |
| Guest ID / Invitation ID | Generated and hidden. Never edit or copy these into a new guest row. |

Only assign one link to people who are comfortable replying together. Everyone with that link can view or edit the group's attendance, dietary notes and messages. This is link-based access, not individual identity verification. Keep your workbook private; do not share a public spreadsheet link with guests.

## 4. Deploy The Live Upgrade

1. Once the test copy looks correct, repeat sections 1-2 in your LIVE workbook, including setup and validation.
2. In its Apps Script editor choose Deploy > Manage deployments > select your EXISTING web app > Edit (pencil).
3. Choose **New version**, keep Execute as **Me** and access **Anyone**, then Deploy. Updating the existing deployment retains its `/exec` URL. Merely saving the script does not update the live version.
4. Check `RSVP_ENDPOINT` in the website's `index.html` matches that `/exec` URL. Do not use the `/dev` URL. The website deliberately refuses the old gateway protocol instead of using a public guest-list fallback.
5. In your Git client, include `index.html`, `rsvp-handler.gs`, this guide, README, `.gitignore`, `scripts/`, `tests/`, `.github/workflows/pages.yml`, the removal of ROOT `guestlist.json`, and the original site's current required assets. Do not select `.private-rsvp`, `dist`, parked drafts or unrelated changes. The backend file is your versioned source; Google still requires step 3 separately.
6. In GitHub repository Settings > Pages, set Source to **GitHub Actions**. The supplied workflow targets your GitHub repository's `main` branch. Your local branch may still be named `master`; do not accidentally upload to a different remote branch. If you rename the default branch, update the workflow too.
7. Push the selected changes. In GitHub Actions, run **Wedding website** manually if necessary and wait for the build and deployment to turn green.
8. The workflow tests the site, builds `dist`, and publishes ONLY `index.html`, `.nojekyll`, and referenced images/licences. It does not publish the guest list, backups, Apps Script, tests or parked drafts.

During the deployment transition, older open forms cannot save until refreshed onto the matching website. Complete both updates before sending invitations, and avoid upgrading during active replies. If your Google account does not offer access for Anyone, do not make the spreadsheet public as a workaround; check the account's deployment restrictions first. Rollback requires restoring the backed-up sheet AND a matching script/website version, not just selecting an old Apps Script deployment against the new schema.

## 5. Verify Before Sending Invitations

Use fictional guests in the test workbook, not a real guest's link. Check:

- A two-person friend invitation shows exactly those names, no tea questions, arrival from 6 pm, seating at 6.30 pm and fun at 9 pm.
- A three-person family invitation shows tea at 5.30 pm and separate tea/dinner choices for each person, no solemnisation.
- Save mixed Yes/No answers and a dietary note. Reopen the link and check both the saved summary and the Guestlist RSVP column.
- Open the same invitation twice, save in one window, then attempt to save the older window. It should ask to reload rather than overwrite silently.
- Submit a change from a released seat and check it says **Request received**, not confirmed. Approve/decline it from Reply History and reopen the link.
- Check a wrong code and an inactive invitation show no guest names. Confirm `/guestlist.json` is not available on the published site.
- Test on a phone, including a slow connection. A failed save must retain answers and allow a safe retry.

For a completely offline fictional preview, run `node scripts/preview-rsvp.cjs`. It prints friend, family and approval-test links. It uses an isolated in-memory mock of the real gateway and cannot write to Google. Stop it with Ctrl+C. `node --test tests/*.test.cjs` runs the automated checks; `node scripts/build-site.cjs` checks the public build.

## 6. Everyday Management

**New guests:** insert NEW blank rows; fill Name, Group, Category, Invite Intent. Run Set up / add missing links. Set Status to Active and Seat to Reserved only when you intend to invite them. Validate and check reserved capacity, then send Invitation Link. Existing-group additions retain that link and old answers; the added guest begins unanswered.

**Someone declines:** their No updates Guestlist and Dashboard. Keep the row. If you want to offer their seat elsewhere, select their row and choose Release selected declined seats. A later Yes from that guest becomes a request for your approval. Create replacement guests as new rows, never rename old guests.

**Waitlist:** set Invitation Status to Waitlist. It is private and its link does not load guest names. When ready, set Invite Intent to Yes, Status to Active and Seat to Reserved, then validate capacity before sending the link.

**Phone/WhatsApp replies:** select ONE guest row and choose Record a reply for selected guest. Enter dinner, tea (family only) and dietary needs. The history identifies Host as the source, and the same link shows the updated reply.
If that group already has a pending request, decide it first. Individual host entry will not silently discard an outstanding group request.

**Requests:** Dashboard lists the request's history row. Select that row in Reply History, then choose Approve selected history request or Decline selected history request. A stale request cannot overwrite a newer one. Changed guest lists require a refreshed guest reply or individual host entry. Approval checks capacity. Message the guest yourself after deciding; this version does not send emails or WhatsApp messages automatically.

**Deadline:** after 31 January 2027, increases and other non-cancellation changes require review. Cancellations remain recordable immediately. `REVIEW_ALL_CHANGES: true` applies this review policy early too. A pending request never changes the last confirmed count or grants a calendar confirmation.

**Move/split/merge:** select the guest row(s), choose Move selected guests to another group, and enter the destination group number (existing or new). Answers follow Guest IDs. Send moved guests their destination link; other members keep their old link. Do not mix family and friend schedule access in one group.

**Lost/leaked link:** select one member, choose Reissue link for selected group, then send the NEW link to the whole group. The old link stops working and replies remain. Do not retire an invitation just to replace a leaked link: Retire disables the whole invitation and removes it from active planning totals.

**Table, category or other manual changes:** run Refresh tracking and dashboard afterwards. No edit trigger, automatic reminders or background notifications are installed. Do not manually edit RSVP Responses or Reply History. Use filter views, not partial-column sorts; History has its own sequence so whole-row sorting cannot change which reply is latest.

## 7. Privacy And Recovery

- The old local fallback was moved to `.private-rsvp/guestlist.json`, which is ignored by Git. Its contents were not inspected or changed. Keep it private or archive it securely.
- Removing it from the next deployment does NOT remove copies from old Git commits, past deployments, screenshots or forwarded messages. If real codes were already public, treat them as exposed: reissue affected group links and resend them. This is the exception to preserving existing links.
- Preserve Reply History. It is the authoritative record. If a cache update fails after a save, the guest's reply still exists; run Refresh tracking and dashboard to rebuild the visible views. A history failure does not delete the earlier reply.
- No software can guarantee recovery after manual deletion of History. Keep dated workbook backups, especially before large guest-list or seating changes.
- Capacity checks protect the configured seat allocation, not your venue contract. Keep DINNER_CAPACITY and reserved seats accurate. A value of zero means no numerical capacity enforcement.

Reference: [Apps Script deployments](https://developers.google.com/apps-script/concepts/deployments), [script locks](https://developers.google.com/apps-script/reference/lock/lock-service), [spreadsheet values](https://developers.google.com/apps-script/reference/spreadsheet/range#setvaluesvalues), [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
