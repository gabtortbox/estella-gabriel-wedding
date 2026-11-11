# Gabriel & Estella Wedding Website

The original ivory wedding design is the active site. Draft themes are not published.

## Current Files

- `index.html`: complete website, styling and guest form.
- `assets/`: photos and illustrations. The build copies only referenced public assets.
- `rsvp-handler.gs`: simplified private Google Apps Script, protocol 3.
- `RSVP-SETUP.md`: one-time setup and everyday guest-list rules.
- `LAUNCH-CHECKLIST.md`: checks to complete before sending invitations.
- `GITHUB-UPLOAD.md`: drag-and-drop publishing steps.

The private Guestlist stays in Google Sheets. Never publish a guest list, invitation
export or `.private-rsvp/`. Existing public `guestlist.json` files must be removed
separately from GitHub, including any published copy left by the old deployment.

## RSVP Rules

One manually assigned B group gets one stable 7-character A code. G = No clears
only that row's A/B. Only G = Yes guests appear on an invitation. H-K stay manual,
including J. Website replies are saved separately in `RSVP Responses` and shown
back to the guests. D = Family gets tea ceremony plus dinner; other categories
get dinner only. One menu: Wedding RSVP > Update invitation codes.

The first update replaces unsent legacy codes. After setup, codes are retained in
the script's private register. Do not delete Script Properties, rename Guestlist,
or replace the workbook/script after invitations are sent.

## Local Checks

Requires Node.js, no installation or external packages:

```sh
node --test tests/*.test.cjs
node scripts/build-site.cjs
node scripts/prepare-github-upload.cjs
```

For an interactive fictional-only preview:

```sh
node scripts/preview-rsvp.cjs
```

Open the printed localhost links. That preview cannot submit to Google.
It is not a replacement for the real Google/GitHub launch checks.

GitHub Actions tests the source then deploys `dist/`. It does not deploy Apps Script.

## Later QR Update

Replace/add `assets/photos/sentosa-qr.png` with the final directions QR image.
Keep the filename. Upload that image at the same path and let Pages deploy again.
No HTML or Apps Script change is needed. Test the QR destination on a second phone.

Old backend files are kept locally in `.private-rsvp/pre-simple-rsvp/`, not published.
