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


## Full-bleed About Me background and separate portrait

The homepage **About Me** section now has two independent image layers: a full-bleed atmospheric backdrop and a smaller 4:5 portrait alongside the bio. The bio sits on a dark translucent panel with silver edging for readability. The layout remains responsive on mobile. The current hero painting is used only as a **default background** until the owner uploads another landscape; it is not a second uploaded picture.

Edit at **Admin → Site Content → Homepage · About me**. Use **Upload background** for an optional wide 16:9 or 21:9 JPG/PNG/WebP/AVIF up to 8 MB, and **Upload photo** for a separate portrait/avatar up to 5 MB. You may replace either independently, preview both together, or reset the background to the default artwork without removing the portrait. The existing portrait remains saved; no migration or new storage bucket is needed. Choose **Publish changes** to update the public homepage.

Both uploads use the existing admin-protected public `guide-images` bucket. **Uploaded images are publicly accessible immediately**, even before publishing the new site content; unused files are not removed automatically. The saved settings contain only public image URLs and reuse the existing Supabase RLS and version history.


## Homepage section order

The public landing page is intentionally limited to four sections, followed immediately by the site footer:

1. **Landing hero** with the guide finder and topic shortcuts.
2. **About Me** with the full-bleed scene, individual portrait, and biography.
3. **Upcoming AION 2 News** with owner-curated announcements and official source links.
4. **Recently Updated** showing the newest published guides.

The previous Start Here, Featured Guides, About the Codex, and final Join banner sections no longer appear on the homepage. Their old text remains in saved content and defaults for compatibility with the version history, but their inactive panels are hidden from **Admin → Site Content**. The Site Content unsaved preview now follows the public homepage order.

The full **Guide Library**, individual article routes, category navigation, and Guide Studio are unchanged and still accessible. These sections were removed from homepage presentation only; guide content was not deleted.


## Player accounts and personal dashboard (public beta)

The website includes a separate, public **Log in / Join** entry point at `/#/account`.
Players can register with email/password, sign in, request a password-reset email,
choose a display name/class/faction, complete personal daily and weekly tasks,
bookmark guides, and receive simple **class/category-based** reading recommendations.
Recommendations are rule-based (not AI) and activity completion is **manual**:
Atreia Street does not access game characters or the AION 2 API.

### REQUIRED activation before inviting testers

**The website deploy does not automatically create Supabase database tables or
change Supabase Auth settings.** Complete these steps once before a friend's test:

1. Open your existing Supabase project at https://supabase.com/dashboard.
   Navigate to **SQL Editor → New query**. Copy and run the entire
   [player accounts migration](supabase/migrations/20261013_player_accounts.sql).
   It adds `public.player_profiles`, `public.player_task_completions` and
   `public.player_saved_guides`, all with **row-level security**. Never run
   it as a browser/API query or expose secret/database credentials.
2. In Supabase **Authentication → Providers → Email**, ensure the email provider
   is enabled and user sign-ups are allowed (the setting may be under Auth settings).
   **Keep email verification enabled** for publicly created accounts.
3. In **Authentication → URL Configuration**, set Site URL to
   `https://atreiastreet.com/` and allow redirects to:
   `https://atreiastreet.com/**`. Email verification returns to
   `/?welcome=1` and password recovery to `/?password-reset=1`.
   If you serve both `www` and bare domain, configure allowed URLs accordingly.
4. Confirm existing GitHub Actions build secrets `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` still point to **the same** Supabase project as
   the SQL migration. Do not use a service-role key.
5. Test in a private browser window:
   - Open `https://atreiastreet.com/#/account`, choose **Create an account**.
   - Submit a *new* email/password/display name; check email confirmation.
   - Sign in, save character details, tick a checklist item and bookmark a guide.
   - Refresh and log in again; your progress should persist.
   - Try accessing `/#admin` as the test player: **Access Restricted** should
     display because only explicit `admin_users` members can publish.
   - As another test account, verify you cannot see the first user's progress.

The UI shows a setup warning instead of pretending to save if the player
database tables are missing. Sign-up may work before the migration, but
checklists, bookmarks, and profiles cannot persist until it is applied.
Auth emails depend on Supabase's configured mail delivery and rate limits.
For broader public use, set up proper SMTP and abuse protection in Supabase.

**Privacy:** only signed-in users can read/write their own profile, task
completion, and bookmarks. No public access policies, and no admin privilege
is granted by sign-up. User-created records are removed by foreign-key cascade
if their Supabase Auth user is deleted. Avoid using a game-account password for
this independent guide website.

**Tracking cadence:** daily items refresh at midnight in
`America/Los_Angeles`, and weekly items refresh Monday at midnight Pacific.
These are **Atreia Street tracking periods**, *not* claims about AION 2's
official game reset time. Tasks are friendly sample prompts and will be
customizable in a future iteration.


## Multi-character dashboard (character tabs and Global reset timers)

**One-time database setup after deployment:** since the player-accounts migration
was already run for the previous dashboard, open your existing Supabase project
**SQL Editor** and run the new, additive migration
[`supabase/migrations/20261013_character_dashboard.sql`](supabase/migrations/20261013_character_dashboard.sql).
It creates three player-owned RLS tables: `player_characters`,
`player_character_task_completions`, and `player_server_task_completions`.
It creates an initial main character from each player's existing profile,
backfills old checklist rows, and **does not remove previous tables, change
guide permissions, or require a new account**. Re-running the migration is
idempotent. Until the new tables exist, players get a setup notice rather
than silently storing checkmarks on the wrong character.

The signed-in `/#/account` dashboard flows top to bottom: account details,
character tabs (up to eight, with editable name/class/faction/server and
scenic theme), **live daily and weekly countdowns**, large two-column
checklist canvases, and tabbed **Recommended / Saved** guides.

### Reset logic

Current AION 2 **Global community-reported** schedule:
- **Daily**: every day at **07:00 UTC** (16:00 on the UTC+9 Global server clock).
- **Weekly**: **Wednesday at 07:00 UTC**.
- The browser presents a one-second countdown and the next reset in the
  user's local time. Changing between daylight/summer and standard time
  does **not** alter the UTC boundary.
- Every checkmark is keyed to the most recent reset. When the window changes,
  the old period's checkmarks automatically disappear from the live checklist,
  without erasing historical database records or affecting other characters.
- **Some activity limits are server-shared**, such as Duty Missions, while
  others are per character. Players must enter the **same server name**
  for main and alt to share server-wide marks. Server names are editable.
- Checklist marks indicate the user's manual tracking only. Some in-game
  reward tickets **accumulate** rather than disappear at reset; a cleared
  checklist does not mean unused in-game items are wiped.
- The extensive categories are guided by [Aion2Data's Global checklist](https://aion2data.com/checklist),
  checked against the October 9, 2026 client data; the game may revise
  caps after patches. In-game timers take priority.

### Checklist background images

Daily and weekly trackers use separate cropped compositions of the locally
hosted AION hero artwork (no external image downloads). Each character can
choose **Twilight, Moonlit, or Dusk** visual treatments. This is an artwork
preset selector, **not** a user-upload feature yet; it requires no player
storage bucket or publicly accessible user photo files.

### Smoke-testing a main and an alt

1. After applying the migration, sign in using an existing player account.
   The previously stored display name/class/faction should appear as
   the initial **MAIN** character.
2. Add an alt, select it, mark a character-specific task, then switch
   back to MAIN. The main's item should remain unchecked.
3. Ensure both characters use the same server name. Check Duty Missions
   on one, switch to the other; Duty Missions should also be checked.
4. Select another server for the alt and save. Shared progress must
   no longer carry over to that alt.
5. Refresh. Tabs, character properties, guide bookmarks, and current-period
   checkmarks must persist.
6. Verify the daily/weekly countdown shows the fixed UTC schedule translated
   to your own zone; checkmarks reset on the next matching UTC boundary.
7. Open `/#admin` as an ordinary player and confirm Guide Studio is
   still restricted.


## Editable player checklists and ticket tracker

**Admin:** Sign into `https://atreiastreet.com/#admin`, then choose
**Player Checklist Editor → Edit player checklists**. You can add, delete,
reorder, regroup and rename daily or weekly tasks, choose per-character or
per-server sharing, restrict an entry to Elyos or Asmodian, and optionally
turn on **Track rechargeable tickets** with an admin-defined recharge
amount (per daily/weekly reset) and maximum cap. Click **Publish checklist**
to make the curated catalog live for visitors without a new GitHub build.

Checklist configuration is stored in the existing admin-only Site Content
record using the original `admin_users` RLS rules and version history.
Regular users cannot publish checklists, and they see published changes
when reloading their dashboard. Task IDs stay constant across renames;
removing tasks does not purge unrelated progress. A new task gets a stable
random ID. The default catalog is editable, so the owner can remove
entries based on Korea data that do not apply to AION 2 Global.

**One extra Supabase SQL setup for player ticket saving:** Open the existing
Supabase project SQL Editor and run
[`supabase/migrations/20261013_player_ticket_balances.sql`](supabase/migrations/20261013_player_ticket_balances.sql).
This creates an additive `player_ticket_balances` table with RLS.
Neither accounts nor existing checkmarks nor saved guides are reset.
If the migration is missing, the normal checklists still work; the
optional ticket tracker displays a setup warning rather than claiming
ticket counts were saved.

**Player:** Under a rechargeable activity (initially Nightmare), optionally
enter your in-game current ticket count and click **Save balance**. The
account stores that exact user-reported number and the last reset key.
The tracker projects +N tickets per matching reset up to the published cap,
whether the player was online or offline. It updates across dates and
across devices using an anchored snapshot and never wipes banked tickets
just because a checkbox cleared. Press **− 1 used** after spending a
ticket, or enter a fresh in-game count to correct any discrepancies.
An activity shared by server uses the same count across alts on the
same server; character-scoped resources remain independent.

This is a **manual projection**, not an integration with NCSoft or a live
read of in-game inventory. It assumes the configured rate/cap remains
unchanged and the player records ticket spending; official game counters
take priority. Global sources disagree about certain other dungeon
refill rules, so recharge is opt-in per activity instead of assigning
unverified values globally. Nightmare's starter rate is +2 per daily
reset, cap 14.

### Test checklist

1. As admin, open Checklist Editor, rename a task, save, refresh the
   player dashboard, and verify the new title appears. Remove any
   non-Global rows and verify they disappear for all players.
2. Add a test task, reorder it, enable recharge, adjust rate/cap,
   publish, and check the player portal.
3. As a player, enter Nightmare = 4, save, refresh, and confirm 4
   persists. Adjust by −1, refresh, and verify 3 persists.
4. After the next daily reset the projection should increase by 2,
   never above 14; daily checkmarks should reset *without* resetting
   banked tickets. The weekly recharge mode works similarly on Wednesday.
5. Switch main and alt. Character-scoped balances must be independent;
   server-scoped balances must be shared when server names match.
6. Confirm a regular player still cannot access Guide Studio.

## Market Watch (mobile-first market companion)

The public website has a new **Market** route at `https://atreiastreet.com/#/market`, reachable from the main navigation. Visitors can search a curated starter catalog, choose a region and type their world/server, and open Aion2.exchange to check current listings. On a device, users can save a watchlist, enter their own observed asking prices, see 7/30-day price charts with **real** observations, and set per-server target prices. Signed-in accounts sync their watchlist, personal price notes and targets via **Supabase Auth user metadata** under `atreia_market_v1`; this version needs **no SQL migration**. Anonymous preferences remain in that browser.

**Important:** There is no live price feed preconfigured. Aion2.exchange has not been confirmed to offer public reuse rights or a documented third-party API. Never scrape its market or mirror its item PNGs without permission. Market Watch explicitly labels missing quotes and does not invent live prices, history, icons or notifications. The initial catalog is just a compact set of factual item names and IDs, not a copy of a provider's listings.

### Optional approved market data feed

After obtaining explicit approval and a provider endpoint, set `VITE_MARKET_FEED_URL` as a GitHub Actions production environment secret or variable. This is a **public browser-readable** HTTPS JSON endpoint: no API key, cookies, game credentials or privileged token may be included in the URL. It must permit cross-origin reads (CORS) from `https://atreiastreet.com`. The frontend validates incoming records; it does not discover provider APIs automatically.

Example JSON (illustrative shape only — prices are NOT sample data to publish):
```json
{
  "items": [
    {
      "item_id": "610610014",
      "name": "Fine Odyle",
      "category": "Materials",
      "region": "NA East",
      "server": "Your world name",
      "price": 1,
      "listings": 3,
      "observed_at": "2026-10-26T12:00:00Z",
      "icon_url": "https://licensed-assets.example/item.png",
      "history": [
        {"at": "2026-10-25T12:00:00Z", "price": 2},
        {"at": "2026-10-26T12:00:00Z", "price": 1}
      ]
    }
  ]
}
```
Replace the illustrative placeholder amounts and URLs with provider-supplied actual observations. `image_url` is also recognized in place of `icon_url`. The main build workflow passes the optional variable to Vite. When feed access is approved, credit and follow the provider's stated terms, frequency limits, and permitted icon usage.

**Alerts:** Thresholds are evaluated in the Market UI against an existing observation when the page is open. No email, browser push, periodic backend checks or automatic notifications are implemented yet. A missing price never triggers an alert. The data source and current observation time are shown.

**Account caveat:** For the intended lightweight use, preferences are stored in user-editable auth metadata rather than a new database table. This is not a substitute for a production-scale alert engine or a high-volume item history service; cap the user's notes and items and migrate to an RLS-backed Supabase table if usage grows.
