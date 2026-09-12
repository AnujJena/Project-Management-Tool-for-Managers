# Trackline — AI Construction Project Console

A project console built specifically for construction project management. Everything below is fully unlocked — there's no paid tier or locked feature, since this is your own free, self-hosted build.

**Access:** the app sits behind a simple login screen (username `admin`, password `admin`). This is a demo-only gate, not real security — the credentials are visible in the front-end source and there's no server-side check, so anyone with the URL can bypass it via browser dev tools. Use it only to keep casual visitors out, not to protect sensitive data. After logging in, you land directly on the **Dashboard** of your most recent project — the marketing/landing page (with the feature cards, Portfolio link, and "Add New Project") is still there, reachable via the ⚙ Trackline logo in the top-left.

**Navigation:** all 17 modules live in a collapsible left sidebar (not a top tab bar). Click the ☰ button to pin it open or collapsed; collapsed shows icons only, and hovering over it temporarily pops it open without changing the pinned state. It remembers your last choice across visits (via this browser's local storage) and defaults to collapsed the very first time you open the app. If there are more items than fit vertically, the icon list scrolls on its own.

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

Everything is also reachable both as an embedded copilot inside the workspace and as a dedicated full-page chat with a "previous chats" sidebar.

Every project has a **type** (Residential / Commercial / Infrastructure) picked when you create it, which the assistant uses to tailor its advice.

Everything runs as static files plus one serverless function (`/api/chat.js`), so it fits Vercel's free Hobby tier with no database and no build step. All project data is saved in your browser's local storage — private to that browser/device.

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

## 3. Deploy on Vercel (free)

1. Go to [vercel.com](https://vercel.com) and sign up (the free Hobby plan is enough).
2. **Add New → Project** → import the GitHub repo.
3. Framework preset: **Other** (no build step needed).
4. Under **Environment Variables**, add:
   - `ANTHROPIC_API_KEY` = *(your key from step 1)*
   - Optional: `ANTHROPIC_MODEL` = `claude-sonnet-5` (default) or `claude-haiku-4-5-20251001` for a cheaper/faster model
5. Click **Deploy**.

You'll get a free URL like `https://trackline-yourname.vercel.app`.

## Notes

- The API key only ever lives on the server (`api/chat.js`) — never sent to the browser, so it's safe to deploy publicly.
- The `admin`/`admin` login is a front-end-only gate. Do not rely on it to protect anything sensitive.
- Floor plan images are resized to a max width of 1600px and compressed before being stored in localStorage — this keeps things reasonable, but browsers cap localStorage at roughly 5–10MB per site, so avoid uploading many large images.
- To change the assistant's tone or the construction knowledge it draws on, edit `BASE_SYSTEM_PROMPT` in `api/chat.js`.
- Free-tier Vercel functions have a 10-second timeout; if you raise `max_tokens` a lot, very long replies could occasionally hit that limit.
- Costs: Anthropic bills per API call based on tokens used, not Vercel (static hosting + serverless functions are free at this scale).
- Cross-tab propagation checks add roughly one extra API call per manual edit, so active editing sessions will use more tokens than just chatting. There's no batching/debouncing on this yet — rapid-fire edits each get their own check.
- All of this still runs on the same architecture as before: static files, one serverless function, and browser localStorage — no database, no real user accounts beyond the demo login. That was an explicit choice to keep this free and simple rather than production-grade in the traditional sense.
