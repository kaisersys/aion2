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

## Admin area

The public guide pages are currently sample content. The admin page is intentionally a placeholder: editing, logins, and live publishing require a database and authentication layer and aren't enabled yet.

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
