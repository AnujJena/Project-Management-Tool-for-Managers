# Trackline — AI Project Console (Construction, Marketing Research & Consulting)

A project console built for construction, marketing research, and consulting projects. Everything below is fully unlocked — there's no paid tier or locked feature, since this is your own free, self-hosted build.

**Industries:** when you create a project, you pick a type — Residential, Commercial, or Infrastructure (all Construction), or Marketing Research, or Consulting. That choice drives three things automatically:
1. **Terminology** — five modules relabel themselves for the industry: Submittals/RFI → "Deliverables & Reviews" (Marketing Research) / "Deliverables & Sign-offs" (Consulting); Punch List → "Action Items"; Site Ops → "Fieldwork Ops" / "Engagement Ops"; Floor Plan → "Research Design Map" / "Engagement Map" (its "rooms" become study phases or engagement workstreams); Inventory → "Incentives & Materials" / "Resource Library". Field labels inside each (e.g. "Ball-in-Court" → "Pending With") adapt too.
2. **Extra modules** — Marketing Research projects get a **Research Findings** tab (insights logged with theme, evidence, and implication); Consulting projects get a **Billable Hours** tab (hours logged per consultant/workstream, split billable vs. non-billable, with computed utilization % and $ billed). These only appear for their matching industry.
3. **Visual theme** — Construction keeps the industrial hazard-stripe look; Marketing Research and Consulting switch to a neutral professional blue theme (no hazard stripes) across the whole app, including modals and the floating chat.

The AI assistant is briefed on all of this — ask it to draft a submittal on a Consulting project and it'll write a client deliverable, not an RFI.

**Access:** you sign up / sign in with an email and password. Once signed in, the app opens to a **home page** where you pick which kind of project you're working on: Construction, Marketing Research, or Consulting. Each card shows how many projects you have of that type and takes you to a filtered project list; "All Projects" in the header shows everything at once. The ⚙ Trackline logo always takes you back to this home page. Your email and a "Log out" link/button appear in the landing header and the app's top bar.

**Navigation:** all 17 modules live in a collapsible left sidebar (not a top tab bar), labeled "TRACKLINE" in its header. Click the ☰ button to pin it open or collapsed; collapsed shows icons only, and hovering over it temporarily pops it open without changing the pinned state — a dedicated pin button (next to the label) appears during that preview so you can lock it open without having to first move your mouse away. It remembers your last choice across visits (via this browser's local storage) and defaults to collapsed the very first time you open the app. If there are more items than fit vertically, the icon list scrolls on its own. The header block above the content (brand, project selector, status ticker) auto-hides when you scroll down within a tab and reappears when you scroll back up, to reclaim vertical space.

**Core field modules** — each can be filled in manually (a "+ Add" button opens a form), by the AI assistant, or imported from a spreadsheet (every tab has "⬇ Template" / "⬆ Upload" buttons):
- **Project Schedule** — Gantt-style task timeline; scrolls horizontally on long schedules
- **Site Task Board** — Kanban board for day-to-day/week-to-week site tasks
- **Schedule Burndown** — planned vs. actual progress over the job
- **RAID Log** — Risks, Assumptions, Issues, Dependencies. Status is a click-to-update radio group right in the table.
- **Daily Log** — site reports: weather, crew, work performed, delays
- **Submittals & RFIs** — number, subject, ball-in-court, due date, status (inline radio-button status)
- **Punch List** — by location, trade, assigned sub, and status (inline radio-button status)

**Run-the-job modules:**
- **Dashboard** — a live snapshot of the project: a computed **Project Health Score** (0–100, weighted from schedule/budget/RAID/punch-list health), schedule/budget/open-item stats, four charts (task status, budget comparison, RAID by status, attendance trend), crew workload, and the Site Ops live view. A 15-second auto-refresh toggle is available.
- **Team & Timesheets** — crew roster, logged hours, weekly workload view
- **Site Ops** — Materials (with unit of measurement and usage %), Attendance (inline radio status), Machinery (inline radio status)
- **Budget & Cost** — line items with estimated vs. actual and running variance
- **Calendar** — every dated item across schedule, daily log, and submittals in one view
- **Portfolio** — an all-projects overview (from the landing page nav)

**Planning & analysis modules:**
- **Project Charter** (highlighted tab, marked with a star) — a single-record form: purpose, objectives, scope, stakeholders, sponsor, milestones, success criteria, sign-off
- **Project Crashing** — enter each task's normal vs. crash duration/cost; Trackline computes cost-per-day-saved and flags the three cheapest tasks to compress first
- **WBS** — a two-level Work Breakdown Structure (phases → work packages) with standard WBS numbering
- **Inventory** — stock on hand with reorder levels; low-stock items are flagged automatically
- **Floor Plan** — upload one or more floor plan images (per level/unit), ask the assistant to sketch a schematic room layout with real-world dimensions in feet, or build a **blank schematic manually** ("Build a blank schematic" option when adding a plan, then "＋ Add Room" on the card — no AI needed). AI-generated and manually-added rooms both show their computed size (e.g. "14.2' × 11.0'") and can be dragged to reposition, resized via a corner handle, double-clicked to rename, or deleted with the × in their corner — all directly on the page. Click anywhere on either plan type to drop a labeled pin (e.g. a punch item or RFI location); click a pin to remove it. Image upload has no AI drafting, dimensions, or spreadsheet import (it's a photo, not structured data).

Every row/card has a small "×" to delete it, and every tab has a "⟳ Refresh" button that reloads the tab from saved data. **The Dashboard has a "🚀 Set Up Entire Project" button** that populates every AI-draftable module (schedule, site tasks, burndown, RAID, daily log, submittals, punch list, team, budget, materials, attendance, machinery, charter, crashing, WBS, inventory) in one click — it runs as 7 small sequential requests rather than one giant reply, both because a single request covering everything risks tripping Vercel's free-tier 10-second serverless timeout, and because it's more reliable than hoping one AI reply remembers all 17 modules. You can also ask the assistant in chat to update several specific tabs at once (e.g. "update the schedule and budget together") — it can include multiple JSON blocks in a single reply for smaller requests like that.

**Cross-tab AI propagation:** any manual edit you make directly in the app — adding or deleting an item, changing a status, dragging a Kanban card, dragging a Gantt bar, resizing a floor plan room, importing a spreadsheet — triggers a background check where the assistant looks at what changed and flags anything elsewhere in the project that might need updating for consistency (e.g. deleting a schedule task that a WBS work package was named after). Nothing applies automatically: you'll see a **"Related Updates Found"** dialog listing each suggestion with a checkbox, and only what you tick and click "Apply Selected" actually changes. Most edits won't have any cross-module implications, so this is often a no-op — that's expected. Each check is its own small API call, so this does add a little cost and a couple of seconds of delay after each edit.

**Direct visual editing (no typing required):**
- **Schedule** — drag a task bar to move it, drag its left/right edge to resize the duration, drag the filled portion to set progress %
- **Floor Plan** (AI-generated schematic rooms only) — drag a room to reposition it, drag its bottom-right corner handle to resize it

The in-workspace assistant is a collapsible floating chat window (bottom-right corner, Messenger-style) — click the "PM Assistant" bubble to open it, and the minimize button to collapse it back; this stays remembered across visits too. Its status ("Assistant online" / "API key missing" / "Server unreachable") and a typing indicator while it's generating a reply both live inside the chat window itself rather than in the top bar. A separate dedicated full-page chat (with a "previous chats" sidebar) is still reachable from the landing page's AI Assistant card, for a larger conversation view.

Every project has a **type** (Residential / Commercial / Infrastructure) picked when you create it, which the assistant uses to tailor its advice.

Everything runs as static files plus one serverless function (`/api/chat.js`), so it fits Vercel's free Hobby tier with no build step. Accounts and projects are stored in a free [Supabase](https://supabase.com) Postgres database (see setup step 3 below); a copy of your active project is also cached in your browser's local storage for speed and offline resilience. The AI assistant is capped to a limited number of messages per account per day (default 20, configurable) so usage can't run away with your API budget while this is a work in progress.

---

## 1. Get an Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com) and create an account if you don't have one.
2. Add a small amount of billing credit — usage-based, typically a few cents per conversation with everyday use.
3. Create an API key under **API Keys** and copy it. You'll paste this into Vercel in step 3 below — never into the code itself.

## 2. Put the project on GitHub

1. Create a new empty repository on [github.com](https://github.com/new) (e.g. `trackline`).
2. Upload all the files in this folder (keeping `api/chat.js` inside an `api` folder) via **Add file → Upload files**, or via git:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/trackline.git
   git push -u origin main
   ```

## 3. Set up accounts (Supabase)

1. Go to [supabase.com](https://supabase.com), sign up, and create a new free project.
2. Open **SQL Editor → New query**, paste in the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it. This creates the `projects` table (where accounts' project data lives), the `chat_usage` table, and the rate-limit function.
3. Go to **Project Settings → API** and copy three values:
   - **Project URL**
   - **anon public** key
   - **service_role** key (keep this one secret — never put it in client-side code)
4. Open `auth.js` and fill in `SUPABASE_URL` and `SUPABASE_ANON_KEY` at the top with the Project URL and anon key from step 3 (the anon key is safe to embed in client code — it only grants what the schema's Row Level Security policies allow).
5. While this is a work in progress, it's simplest to turn off email confirmation so sign-up works immediately: **Authentication → Providers → Email**, turn off **Confirm email**. (Turn it back on later if you want verified emails before launch.)

## 4. Deploy on Vercel (free)

1. Go to [vercel.com](https://vercel.com) and sign up (the free Hobby plan is enough).
2. **Add New → Project** → import the GitHub repo.
3. Framework preset: **Other** (no build step needed).
4. Under **Environment Variables**, add:
   - `ANTHROPIC_API_KEY` = *(your key from step 1)*
   - `SUPABASE_URL` = *(Project URL from step 3)*
   - `SUPABASE_SERVICE_ROLE_KEY` = *(service_role key from step 3 — server-side only)*
   - Optional: `ANTHROPIC_MODEL` = `claude-sonnet-5` (default) or `claude-haiku-4-5-20251001` for a cheaper/faster model
   - Optional: `CHAT_DAILY_LIMIT` = number of AI assistant messages allowed per account per day (default `20` if unset)
5. Click **Deploy**.

You'll get a free URL like `https://trackline-yourname.vercel.app`.

## Notes

- The Anthropic API key and the Supabase service role key only ever live on the server (`api/chat.js`) — never sent to the browser, so it's safe to deploy publicly. The Supabase anon key in `auth.js` is meant to be public.
- Floor plan images are resized to a max width of 1600px and compressed before being stored — this keeps things reasonable, but browsers cap localStorage at roughly 5–10MB per site, so avoid uploading many large images.
- To change the assistant's tone or the construction knowledge it draws on, edit `BASE_SYSTEM_PROMPT` in `api/chat.js`.
- Free-tier Vercel functions have a 10-second timeout; if you raise `max_tokens` a lot, very long replies could occasionally hit that limit.
- Costs: Anthropic bills per API call based on tokens used, and Supabase's free tier covers auth + a small Postgres database at this scale; Vercel static hosting + serverless functions are also free at this scale.
- Cross-tab propagation checks add roughly one extra API call (and one AI-assistant usage count) per manual edit, so active editing sessions will use more of the daily message allowance than just chatting. There's no batching/debouncing on this yet — rapid-fire edits each get their own check.
- The daily chat limit is enforced server-side and checked *before* calling Anthropic, so a capped user never costs you a token — they just see a message saying they've hit the limit for the day.
- Row Level Security on the `projects` table means a signed-in user can only ever read or write their own projects, even though the client talks to Supabase directly with the public anon key.
