# Drag-And-Drop Upload To GitHub

This package updates the original wedding website. The repository in your screenshot
uses the main branch. The workflow has been corrected to publish from main.
Your working project, private guest backup and drafts remain separate.

## What To Upload

Open the folder named UPLOAD-THESE-CONTENTS.
It contains the current website, referenced assets, backend source, tests,
publishing workflow, README and RSVP setup instructions. It contains NO guest list.

Do NOT drag the enclosing github-upload or UPLOAD-THESE-CONTENTS folder into GitHub.
Drag the files and folders INSIDE UPLOAD-THESE-CONTENTS together. Otherwise GitHub
will put the site in an unwanted subfolder instead of updating the existing site.

## Upload Steps

1. In GitHub, open gabtortbox/estella-gabriel-wedding and select main.
2. At the repository root (where your current index.html appears), choose
   the + / Add file menu, then Upload files.
3. Open UPLOAD-THESE-CONTENTS in Finder. Press Command + Shift + period (.)
   to show hidden files. You MUST include .github and .gitignore.
4. Select EVERYTHING INSIDE that folder, including the hidden items, and drag
   those selected items onto GitHub's upload area. If Finder creates a hidden
   .DS_Store file, leave that one unselected.
5. Check the proposed paths BEFORE committing. You should see index.html,
   assets/photos/..., .github/workflows/pages.yml, scripts/... and tests/...
   at their original paths. There must NOT be a github-upload/ or
   UPLOAD-THESE-CONTENTS/ prefix. Older files with the same paths are updated.
6. Use the commit message: Update wedding website and RSVP system.
   Commit to main if your repository allows it. If GitHub requires a new branch,
   create the pull request and merge it into main before expecting deployment.
7. Go to Settings > Pages. Set the publishing Source to GitHub Actions.
8. Go to Actions > Wedding website and wait for success. If the first run failed
   before the Pages setting was changed, use Run workflow on main or rerun the job.
9. Open the published site in a private/incognito window. Check the schedule now
   says seating at 6.30 pm and The Fun Begins at 9 pm. A working RSVP additionally
   requires the separate Apps Script setup below.

The .github folder is essential for this publishing method. If it is missing from
the uploaded list, cancel the upload, show hidden files and select the contents again.

## Old Files Need Separate Deletion

Uploading files DOES NOT remove old files already on GitHub.

PRIORITY: remove the existing ROOT guestlist.json from the public repository.
Make sure your private local backup is retained first. Never upload it again.
Deleting the current file does not erase old commits or previously shared codes.
Reissue affected group links if real invitation codes were previously public.

The following old pages and folders are no longer used by the current website:

  advisory.html
  confirmed.html
  directions.html
  helpers.html
  rsvp.html
  css/
  js/

Remove those separately on GitHub after checking they are the retired versions.
The old image files outside the new upload are not required by the public build;
do not delete the whole assets folder, because current assets share that folder.
The new publishing workflow includes only the current public build, but a public
GitHub repository still exposes files left in its source tree.

To remove an old root file: open it in GitHub, choose the ... menu > Delete file,
and commit the deletion to main (or merge its pull request). Keep the private
backup; you do not need to delete it from your computer.

## Apps Script Is A Separate Update

Uploading rsvp-handler.gs to GitHub does NOT deploy it to Google.

1. Follow RSVP-SETUP.md in the upload folder, beginning with a private workbook backup.
2. Replace the Apps Script code with the current rsvp-handler.gs. Preserve your
   actual DINNER_CAPACITY setting; its source default is zero (no numerical limit).
3. For the duplicated code in your sheet, run repairDuplicateGroupLink and enter
   51. Group 50 retains its original link; group 51 gets its own link.
4. Run setupRsvp, then validate the guest list. Uninvited ungrouped planning rows
   are allowed. Fictional test rows need Invite Intent = Yes and Status = Active.
5. Deploy > Manage deployments > edit the existing web app > New version > Deploy.
   Keep Execute as Me and access Anyone. Its existing /exec URL remains the same.

Do not submit test answers through real guests' links. Complete the fictional
tests in RSVP-SETUP.md before sending invitations.

## Rebuilding This Package Later

The upload folder is a snapshot, not your working project. After making more
changes, run node scripts/prepare-github-upload.cjs from the original project.
It regenerates only the marked upload/build folders and leaves source files alone.

References:
https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
