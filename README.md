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

- `public/assets/branding/aion-logo.webp` — transparent Aion logo.
- `public/assets/hero/aion-hero-purple.webp` — purple winged-character backdrop.

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
