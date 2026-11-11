# Upload The Final Simple RSVP Version

This updates the original ivory website, not either draft theme.
Keep your private workbook and `.private-rsvp/` backup off GitHub.

## Before Upload

Update the Apps Script using RSVP-SETUP.md first. The new website requires the
protocol 3 script, so do not send invitations while either half is still old.

## Drag And Drop

1. Open `github-upload/UPLOAD-THESE-CONTENTS` in Finder.
2. Press Command + Shift + period to show hidden files. Include `.github` and
   `.gitignore`; do not select `.DS_Store` if Finder creates one.
3. Open GitHub > gabtortbox/estella-gabriel-wedding > main > repository root.
   Choose Add file / + > Upload files.
4. Drag the CONTENTS of UPLOAD-THESE-CONTENTS into GitHub, not the enclosing folder.
   The proposed paths should be `index.html`, `assets/...`, `scripts/...`,
   `tests/...` and `.github/workflows/pages.yml`, without an upload-folder prefix.
5. Commit to main: `Simplify and test wedding RSVP before launch`.
   If a branch is required, merge its pull request into main.
6. Settings > Pages > Source = GitHub Actions. Actions > Wedding website must
   finish successfully before you check the public site in a private window.
7. Complete LAUNCH-CHECKLIST.md. Do not use old draft invitation codes.

Uploading rsvp-handler.gs to GitHub does NOT update Google Apps Script. The script
must separately be saved, run once, and redeployed using the existing deployment.

## Old Public Files

Uploads overwrite matching paths but do not remove old files.

PRIORITY: remove any ROOT `guestlist.json` from the public GitHub repository.
It is excluded from the current public build but files in a public source repository
remain readable. Keep your private local backup. Deletion does not erase old commits.
The new short codes replace unsent legacy codes; never publish new codes/guest data.

Retired files can be deleted separately from GitHub after checking they are the
old versions: advisory.html, confirmed.html, directions.html, helpers.html,
rsvp.html, css/ and js/. Do not delete the entire assets folder.

Open an old file in GitHub > ... > Delete file, then commit the deletion.
The current tests and old-named test files in this upload are deliberately all
updated, so the existing workflow will not pick up obsolete backend tests.

## Later Directions QR

Add/replace `assets/photos/sentosa-qr.png` at that exact repository path and commit.
After the Pages run succeeds, scan it on a second phone. No code changes needed.

## Regenerate The Upload Snapshot

The upload folder is a snapshot, not the source project. After any local edit:

```sh
node scripts/prepare-github-upload.cjs
```

This rebuilds only marked generated folders. It does not change your source/drafts.

References:
- https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
