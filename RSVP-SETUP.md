# Simple RSVP Setup

No invitations have been sent. This is the final pre-launch cleanup, not a
migration that promises old draft links will keep working.

## 1. Check The Master Sheet

Keep your full workbook backup. The active tab must be named exactly `Guestlist`.
`Guestlist [Test]` is ignored. Do not rename it to Guestlist or copy test data over
real people. Old History/Dashboard/test tabs can stay archived; they are not used.

Keep columns in this order:

| Column | Meaning | Who changes it |
| --- | --- | --- |
| A | URL Code (do not edit) | Script |
| B | RSVP Group | You |
| C | Whose side? | You |
| D | Category | You, Family or other category |
| E | Relationship | You |
| F | Name | You |
| G | Invite Intent | You, Yes/No |
| H | Save the Date Sent Out? | You only |
| I | RSVP Sent Out? | You only |
| J | RSVP | You only |
| K | Table | You only |
| L | Driving | You |

Give everyone who should answer together the SAME B value. Different groups must
have different B values, including groups on different sides of the family.
Use plain values, not formulas, in A/B. Do not merge cells in A:G.

Set G = Yes only for people actually invited. Blank G can prepare a code, but will
not show that person on the website. For every G = Yes, fill in B and the final F
name. Because nothing has been sent, keep I = No/blank until you send invitations.
Do not change J just to activate an invitation; J does not control website access.

Within a group, all invited people should have the same Family/non-Family schedule.
Separate groups if different schedules are needed. Names must be distinguishable.
Existing `Guest ID (do not edit)` columns from the previous version are read only
and retained; do not delete or copy those IDs between people.

## 2. Replace The Script Once

1. From the REAL master workbook choose Extensions > Apps Script.
2. Replace the old RSVP code with the complete current `rsvp-handler.gs`.
   Remove other old RSVP `.gs` files from this script project if they define the
   same handlers. Keep unrelated automation. Save.
3. In the script editor's Triggers page, remove any retired RSVP-only scheduled
   or installed triggers that call old setup/tracking functions. Do not add an
   installed onEdit trigger: the new built-in onEdit handler is sufficient.
4. Choose `updateInvitationCodes` in the function menu and click Run. Authorise
   access to your own spreadsheet. Never manually run onEdit, doPost or doGet.
5. Return to the spreadsheet and reload. You should see one menu item:
   Wedding RSVP > Update invitation codes.

That first run creates new 7-character codes for unsent groups, repairs shared
legacy codes by assigning different codes to different B groups, and clears A/B
where G = No. It never changes C-L or existing extra master columns.
An invited row with blank B gets blank A and is reported in the toast, not guessed.
The same command also flags groups with missing/duplicate names or mixed schedules.
Correct those before sending; their prepared codes are retained when you rerun it.

The script creates `RSVP Responses`. If the old response layout exists it is
renamed to `RSVP Responses (Previous)` and preserved intact. Old draft responses
are not imported as real guest confirmations. No other tabs are deleted.

## 3. Update The Existing Web App

1. Deploy > Manage deployments.
2. Edit the existing Web app deployment (pencil).
3. Version > New version. Execute as: Me. Who has access: Anyone.
4. Deploy. Keep the SAME existing `/exec` URL, so the website needs no endpoint edit.
5. Open that URL in a private browser window. It should return JSON with
   `"ok":true`, `"protocol":3` and `"configured":true`.

If you create a completely NEW deployment instead, its URL changes and must be
changed in the website before launch. Editing the existing deployment avoids that.
Uploading `.gs` to GitHub alone does not deploy it to Google.

## 4. Publish And Test Before Sending

Follow `GITHUB-UPLOAD.md`, then every item in `LAUNCH-CHECKLIST.md`. Both the
website and Apps Script must be protocol 3; older versions intentionally refuse
to save rather than risk writing to your manual columns.

An invitation is:

```text
https://gabtortbox.github.io/estella-gabriel-wedding/?inv=CODE_FROM_COLUMN_A
```

Replace CODE_FROM_COLUMN_A with the actual code, no spaces or angle brackets.
There is no `test=1` mode. Do not send any old test, 6-character or long draft link.

## Everyday Management, No Code Editing

- New person: add F name, D category, B group and G = Yes. Use an existing group B
  if they answer together, or a new unique B for a separate invitation. A updates.
- B/G edits update A/B automatically. After a bulk import or if a trigger misses
  an edit, run the single Update invitation codes menu item. Existing links stay.
- Guest declines on website: reply is saved as No in RSVP Responses. Their G and
  A/B are NOT changed. You decide what to enter manually in J and K.
- Guest changes their mind: reopen the same link, edit and save. Latest reply
  replaces the visible answers; a private backing record retains earlier saves.
- Withdraw invitation / release a declined seat: set that person's G = No. Only
  their A/B are cleared. Other people in the group keep their link and answers.
- Replace a declined guest: keep the old row as your record, set its G = No, add
  the new person on a new row with G = Yes and their chosen B. Never overwrite
  one person's name with a different person's name to reuse a response/seat.
- Reinstate a G = No person: set G = Yes AND re-enter B. B was intentionally
  cleared, so the script cannot guess their previous group.
- Reorganise a group: change B and use the code now in A. A moved person no
  longer appears on the old invitation. Tell affected guests which link to use.
- Reply by phone: use that group's own link to record their exact choices after
  confirming them. Editing J alone does not change the website's saved reply.
- Late change: guests can still update, with a note to contact you directly after
  31 January. There is no automatic deadline block, seat limit or approval queue.
  Confirm late additions against your venue headcount before accepting them.

## Keep Stable After Launch

Finalise names and groups first. A name correction without an existing permanent
Guest ID is treated as a changed guest and needs a fresh reply. IDs are independent
of row position, so sorting/inserting entire guest rows is safe. Never sort a
single column separately from its row.

Do not edit A, rename Guestlist, delete Script Properties, or replace the script
project/workbook after sending. Do not reuse a group for an unrelated household:
an old group link would otherwise show that new household. Treat each link like
a private invitation key. Anyone holding it can read/edit that group's RSVP, so
do not publish or forward it broadly. This is not an identity/login system.

`RSVP Responses` columns A-H show the latest submitted answers. Hidden I and N-R
are internal identifiers/backing records. Do not edit, delete, or sort those hidden
columns. If you need to sort replies, use a separate copied view/export. Run Update
invitation codes to rebuild the visible response view after withdrawing people.
Never delete the current response tab after launch. Back up the workbook regularly.

The final QR can later replace `assets/photos/sentosa-qr.png` without code changes.
Google hosting/permissions and GitHub Pages remain external dependencies; test
their real deployment before launch and keep a direct contact fallback for guests.

References:
- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/guides/triggers
- https://developers.google.com/apps-script/guides/properties
