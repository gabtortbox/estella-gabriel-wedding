# Gabriel & Estella Wedding Website

Published site: https://gabtortbox.github.io/estella-gabriel-wedding/

## Current Files

- `index.html`: the complete website, including styles, animations and RSVP form.
- `rsvp-handler.gs`: Google Apps Script source for guest lookup and RSVP storage.
- `RSVP-SETUP.md`: backup, migration, deployment and everyday RSVP instructions.
- `scripts/build-site.cjs`: allowlisted public site build (no private records).
- `assets/photos/`: the current hero, venue, logo and dress-code artwork.
- `assets/photos/optimized/`: the 33 images used for story strips and helpers.

The hero uses `hero-cutout.webp`, with `hero-cutout.png` as a fallback. Dress-code
colour previews use `dresscode-transparent.png` with inline SVG garment fills.
The older PNG masks are no longer loaded. The venue artwork is
`OasiaSketch-cropped.png`; the navigation logo is `logo.jpeg`.

## Personalised Invitations

Invitation links use `?inv=<URL Code>`. The Apps Script lookup reads the guest
group's Category from the Google Sheet and returns the events they are invited to.
Family sees the tea ceremony at 5:30 pm and the dinner schedule,
with a separate RSVP choice for tea. Solemnisation is no longer shown; older saved
answers remain compatible with the existing response sheet. Friends sees arrival from 6 pm
and the dinner schedule, with a dinner RSVP choice.

All of these views are handled by `index.html`; separate RSVP, confirmation,
directions, helpers and advisory pages are no longer used.

## Saved Replies

The RSVP section shows a permanent "Your saved reply" summary after a successful
save and on returning visits. Editing the form does not alter this summary until
the gateway confirms another save. Unsaved edits are marked separately.

The gateway uses protocol 2 with permanent guest IDs, server-side guest checks,
optimistic revisions, retry-safe request IDs and append-only Reply History.
The existing Responses tab and master RSVP columns are rebuildable tracking views.
Pending change requests never overwrite confirmed replies. Released-seat returns,
capacity conflicts and post-deadline changes can be reviewed from the sheet menu.
Existing codes and replies are migrated by setup; ambiguous matches stop migration.
The website requires the matching gateway upgrade. See `RSVP-SETUP.md` before deployment.

Run the focused checks with `node --test tests/*.test.cjs`.

## Dress Code Colours

The dress-code illustration has separate Her outfit and His outfit controls
and one shared colour palette. Selecting a piece or finish, or clicking its
dropdown, activates that outfit; the outfit radio choices also switch the
palette target. Keyboard focus alone does not switch it.
The Colour for label identifies the current piece. Every piece remembers a
Plain, Polka dots or Stripes finish. Selecting its active swatch clears only
that piece's colour; Reset outfits clears both colours and patterns. These
choices are kept only while the page is open and are not part of an RSVP.

The original PNG is unchanged. Inline SVG silhouettes supply the colour below
the ink, including the dress ruffles. The older PNG tint masks are not loaded.
Heel fills cover shoe straps, soles and heels, leaving exposed feet clear.

## Schedule and Directions

The illustrated schedule keeps the family and friends sequences distinct, with
The Fun Begins at 9 pm in both views. Existing ceremony and seating times stay
the same. The hero leads into the vision statement without an additional day
summary. Directions retain all four route maps and their step-by-step notes,
with Lucide transport symbols and no duplicate venue heading. Their licence
is in `assets/icons/LUCIDE-LICENSE.txt`.

## Publishing

The GitHub Actions workflow builds and publishes only `dist`, containing the
website and its referenced assets. Select GitHub Actions in repository Settings >
Pages. The workflow targets the GitHub repository's `main` branch. The removed root `guestlist.json` must not
be republished; its local backup is in the ignored `.private-rsvp` folder.
Old public codes may require reissuing because Git history is not erased by this change.
Changes to `rsvp-handler.gs` still need a separate Apps Script deployment update.

For GitHub's drag-and-drop upload, run `node scripts/prepare-github-upload.cjs`.
It creates `github-upload/UPLOAD-THESE-CONTENTS` plus a local START-HERE guide.
Upload the contents, including hidden `.github` and `.gitignore`, not the outer folder.
This excludes all private guest data and does not delete older remote files.

`assets/photos/sentosa-qr.png` is still pending. The site displays a placeholder
until that image is supplied.
