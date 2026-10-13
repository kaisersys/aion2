# Atreia Street — Aion 2 Guild Codex

An independent, noncommercial Aion 2 guild guide website built with React, TypeScript, and Vite. Not affiliated with or endorsed by NCSOFT.

## Local development

```bash
npm install
npm run dev
npm run build
```

Only `dist/` is uploaded to production. Do **not** place the React source files or GitHub ZIP archive in the website's public directory.

## Artwork

Two optimized images are required (the build checks for both):

- `public/assets/branding/aion-logo.avif` — transparent Aion logo.
- `public/assets/hero/aion-hero-purple.avif` — purple winged-character backdrop.

Image usage is the responsibility of the site owner; check the source asset licensing/fan-content terms before publishing modified promotional artwork.

## GitHub → hosting.com deployment

The workflow `.github/workflows/build.yml` builds the Vite site, saves a downloadable ZIP, and **optionally deploys** the `dist/` folder over encrypted FTPS. Pull requests run the build only. A push or manually triggered workflow on `main` attempts the deploy **only once all four deployment secrets are present**.

### One-time setup

1. In hosting.com, create or identify a dedicated **FTPS** account. Prefer an account limited to the public website's document root (the folder containing `index.html`). Verify **explicit FTPS on port 21** is supported for this account. If the plan only supports SFTP/SSH, **do not use this FTPS workflow**; change the workflow to SFTP before enabling deployments.
2. In GitHub, open **Settings → Secrets and variables → Actions → New repository secret**.
3. Create these four repository secrets:
   - `FTP_HOST`: actual hostname/IP from hosting.com's **FTP connection details** (not automatically the webserver IP).
   - `FTP_USER`: dedicated FTP account username.
   - `FTP_PASSWORD`: FTP password.
   - `FTP_REMOTE_DIR`: FTP-visible directory containing `index.html`, **ending in a slash**. Use `./` if the FTP login lands directly in `public_html`; otherwise it could be `public_html/` relative to the FTP login directory. Check in an FTP client before deploying. Don't guess.
4. In **Actions → Build, package and (when configured) deploy → Run workflow**, choose `main` and run once. Review the deployment step and confirm the site. After this, new merges/pushes to `main` automatically build and deploy.

**Important:** The workflow won't deploy until images are committed and all four secrets are configured. Never paste credentials into a GitHub issue, commit, public action log, or chat.

The FTPS action keeps its own sync state on the webserver. Before the first run, back up any unrelated files in the document root.

## Guide Studio setup

Atreia Street includes a Tiptap WYSIWYG editor with previews, image uploads, draft/publish workflow, category assignment, featured guides, and a protected staff dashboard. Supabase stores articles and assets. **The editor will show a setup notice until the following one-time steps are completed.**

1. Create a project at https://supabase.com/dashboard. Keep your Supabase database password private.
2. Open **SQL Editor** in your Supabase project. Run the entire file `supabase/migrations/20261012_guide_studio.sql`. This creates the guides table, image storage bucket, administrator membership, and restrictive **row-level security** policies.
3. Open **Authentication → Users** in Supabase. Create your editor account with an email address and password. There is intentionally no public sign-up on the website.
4. Grant *only that account* publishing access: in the **Supabase SQL Editor** run the following, replacing the email address with your editor email:
   ```sql
   insert into public.admin_users (user_id)
   select id from auth.users where email = 'your-email@example.com'
   on conflict (user_id) do nothing;
   ```
   If no row is inserted, confirm the user exists in Authentication → Users. Do not give everyone admin access.
5. In the Supabase dashboard, open **Project Settings → API** (depending on the dashboard version, **Connect → Project URL and publishable key**).
   Find the **Project URL** and **publishable key** or legacy **anon/public key**. These are intended for browser use; do **not** use a secret/service_role key.
6. In the GitHub repository open **Settings → Secrets and variables → Actions → New repository secret**. Add:
   - `VITE_SUPABASE_URL` — your Supabase project URL, e.g. `https://example.supabase.co`.
   - `VITE_SUPABASE_ANON_KEY` — the project **publishable** or **anon** key. Never the service_role key.
7. Open **Actions → Build, package and (when configured) deploy → Run workflow**, select **main**, then run it. These variables are injected **at build time** by Vite. Ensure the build and FTPS deployment both pass.
8. Visit **https://atreiastreet.com/#admin**, sign in, select **New Guide**, draft your guide, and click **Publish**. Published guides appear to visitors without another GitHub deployment.

### Important security details

- Supabase Auth validates logins; there is no hard-coded username/password.
- Anyone can read only `published` guide rows. Drafts are readable only by approved staff.
- Write and image-upload policies verify membership in `public.admin_users` **on the database server**. Client checks alone do not provide authorization.
- All images are publicly readable once uploaded; use public images only, not sensitive documents. Upload size limit is 10 MB per image.
- The `service_role` key **must never be used** in frontend code, GitHub Actions, a commit, or a public website. It bypasses RLS.
- The `VITE_...` values above are embedded into the browser bundle; that is safe *only for the Supabase publishable/anon key*.
- GitHub's existing `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD`, and `FTP_REMOTE_DIR=public_html/` secrets remain unchanged. GitHub builds and deploys the editor frontend; actual article edits save to Supabase immediately and do not require redeployment.
- The six starter/example articles remain visible and are read-only examples. Newly published guides take priority if a matching slug exists; create fresh guides through the Studio.
- There is no public user registration. Add other trusted guild editors manually through Supabase Authentication and the `admin_users` table.

## Rich Guide Studio authoring

Open `https://atreiastreet.com/#admin` and log in with a confirmed Supabase Authentication user who is present in `public.admin_users`.

- **Private full-page preview:** `Full-page preview` uses the exact reader article layout (hero, title, category, contents sidebar, custom blocks, footer) with the current **unsaved** editor content. It is an in-browser modal; it does not publish the draft or create a publicly accessible preview link.
- **Permanent guide links:** When published, a guide is reachable at `https://atreiastreet.com/#/guides/YOUR-SLUG`. These hash URLs work without server rewrite rules. Copy the public URL with `Copy guide link`. Links to unpublished guides will not show a private draft to visitors.
- **Inline links:** Highlight text, click the Link icon, and paste either a regular `https://...` URL or an internal guide link like `#/guides/ranger-pve`. Internal links navigate in the same tab.
- **Automatic table of contents:** Use Heading 1/2/3 tools to create sections. The published article and full-page preview generate clickable section navigation; duplicate headings receive unique IDs. Readers can copy/share a link to a section via a `?section=...` suffix in the hash URL.
- **Image gallery:** Click the Gallery tool or `Image gallery` button, choose up to 12 JPG/PNG/WebP/AVIF/GIF files of up to 10 MB each, and upload. Visitors can click images to enlarge, use arrow buttons or keyboard arrows, and press Escape to close. Use each image's `Edit caption` control in the editor to add captions and accessible descriptions, and `Edit block` to change between two and three columns.
- **Reusable blocks:** The toolbar inserts Link Button, Info/Tip/Warning, and Skill/Gear cards. Each one displays a form for its details. After inserting it, use the visible `Edit block` button to change its content or `Remove` to delete it. Skill cards accept an optional icon image URL and related-guide link.
- **Existing content remains compatible:** Previous published/draft guide JSON is still supported; no new Supabase schema migration is necessary.

**Important:** Uploaded images are placed in the public `guide-images` Supabase Storage bucket even when the article remains a draft. Don't upload confidential images. The article content and preview themselves remain private until published. Images added through the editor are not automatically deleted if you later remove them from an article.

### Quality and deployment safety

Production build checks both Supabase configuration values, validates the project URL, and asks the project's Auth API to accept the publishable/anon key before FTP upload. Invalid configuration stops a new deployment instead of replacing the working site. The public website also tolerates an unavailable or malformed Supabase client without blanking the homepage.


## Editing website text (without deploying)

After signing in at `https://atreiastreet.com/#admin`, choose **Site Content → Edit website text**. Edit the relevant text fields (homepage, hero buttons, guide finder, category tiles, navigation, library, featured section, guild banner, footer), choose **Preview changes**, then select **Publish changes**. The live site picks up the new text on refresh. Your own admin session refreshes when you publish.

Under **History & reset**, select **Restore version** for an earlier saved version, or **Reset to defaults** for the initial website wording. Both load values into the editor; neither changes the public site until you publish again. Up to 12 previous saved versions are retained.

**No new Supabase migration or service-role secret is necessary.** Website copy lives in a single reserved published `guides` row with slug `site-content-settings`, using the existing `admin_users` permission/RLS policies. The reserved row is excluded from the guide directory and hidden from the guide management list, and cannot be created as a guide from the editor. On a new setup, the site's current hardcoded wording remains the default until the first Site Content publish. The version history also uses the existing row's JSONB `content` field.


## Upcoming AION 2 news on the homepage

The former **Discover Your Destiny** four-tile category section has been replaced with **Upcoming AION 2 News**. The old guide categories remain accessible from the hero topic finder, site navigation, and full Guide Library.

The news calendar starts with **officially sourced Global announcements**: October 13–20 Early Access server transfers, October 20–27 launch-server transfers, and the December 15 attendance deadline. All use links to NC official announcements. Headlines and summaries are curated and **do not automatically fetch or claim to represent live news**.

From `https://atreiastreet.com/#admin`, open **Site Content → Homepage · Upcoming news** to edit heading text and manage up to eight scheduled announcements. For each, enter the start date, last day it should appear, category, headline, short summary, and an HTTPS official source link. Use **Add announcement** or **Remove**, choose **Preview changes**, then **Publish changes**. This uses the existing admin-protected site settings row and version history: no extra Supabase migration or build is required to publish news changes.

Only items whose last visible date has not passed (in **Pacific time**) appear to visitors. An empty state and a link to the official AION 2 site appear once no scheduled items remain. Check dates and source links when adding new notices. The calendar is not an automated news scraper or push-notification service.
