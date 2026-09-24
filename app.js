// ===== Constants =====
const STORAGE_KEY = "trackline_projects_v1";
const ACTIVE_KEY = "trackline_active_project_v1";
const MAX_API_HISTORY = 10;
const PAGES = ["landingView", "appView", "browseView", "chatPageView", "portfolioView"];

// ===== State =====
let state = {
  gantt: null, burndown: null, kanban: null, raid: null,
  dailylog: null, submittals: null, punchlist: null,
  team: null, timesheets: null, budget: null,
  materials: null, attendance: null, machinery: null,
  charter: null, crashing: null, wbs: null, inventory: null, floorplan: null,
  findings: null, billing: null,
};
let history = [];
let chatLogData = [];
let burndownChartInstance = null;
let materialChartInstance = null;
let dashAutoRefreshTimer = null;
let activeProjectId = null;
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

function todayISO() { return new Date().toISOString().slice(0, 10); }

function chatRequestHeaders() {
  const headers = { "Content-Type": "application/json" };
  const token = window.TracklineAuth && window.TracklineAuth.getAccessToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

// ===== Boot straight into the home page (no login gate) =====
function boot() {
  showLanding();
  renderIndustryCounts();
}

// ===== Sample data (construction-flavored) =====
// ===== Industry support (Construction / Marketing Research / Consulting) =====
function industryFromType(type) {
  if (type === "Marketing Research") return "marketing_research";
  if (type === "Consulting") return "consulting";
  return "construction"; // Residential, Commercial, Infrastructure, or unset
}
function currentIndustry() {
  const projects = loadAllProjects();
  const p = projects[activeProjectId];
  return industryFromType(p && p.type);
}
const INDUSTRY_LABELS = {
  construction: {
    submittals: { tabLabel: "Submittals/RFI", h1: "Submittals & RFIs", sub: "Ask the assistant, or log a submittal or RFI manually. Click a status dot to update it inline.", numberLabel: "Number", typeLabel: "Type", typeOptions: ["RFI", "Submittal"], ballLabel: "Ball-in-Court", addTitle: "Add Submittal / RFI" },
    punchlist: { tabLabel: "Punch List", h1: "Punch List", sub: "Ask the assistant, or add a punch list item manually. Click a status dot to update it inline.", locationLabel: "Location", tradeLabel: "Trade", addTitle: "Add Punch List Item" },
    siteops: { tabLabel: "Site Ops", h1: "Site Ops", sub: "Materials, attendance, and machinery — add manually, ask the assistant, or import a spreadsheet.", materialsLabel: "Materials", materialsAdd: "Add Material", attendanceLabel: "Attendance", machineryLabel: "Machinery", machineryAdd: "Add Machine" },
    floorplan: { tabLabel: "Floor Plan", h1: "Floor Plan", unitNoun: "Room", unitNounPlural: "Rooms" },
    inventory: { tabLabel: "Inventory", h1: "Inventory", sub: "Ask the assistant, or add stock items manually. Low-stock items are flagged." },
    kanban: { tabLabel: "Site Tasks" },
    dailylog: { tabLabel: "Daily Log", h1: "Daily Log", sub: "Ask the assistant, or log today's site report manually.", entryNoun: "site report", weatherLabel: "Weather", weatherPlaceholder: "e.g. Clear, 75°F", crewLabel: "Crew", crewPlaceholder: "e.g. 10 (Framing crew)", delaysLabel: "Delays" },
    dashboard: { sub: "A live snapshot of this project — schedule, budget, open items, crew workload, materials, attendance, and machinery.", crewHoursLabel: "Crew Hours (7 days)" },
  },
  marketing_research: {
    submittals: { tabLabel: "Deliverables & Reviews", h1: "Deliverables & Reviews", sub: "Ask the assistant, or log a deliverable manually. Click a status dot to update it inline.", numberLabel: "Ref #", typeLabel: "Type", typeOptions: ["Discussion Guide", "Survey Instrument", "Report Draft", "Topline", "Full Report"], ballLabel: "Pending With", addTitle: "Add Deliverable" },
    punchlist: { tabLabel: "Action Items", h1: "Action Items", sub: "Ask the assistant, or add an action item manually. Click a status dot to update it inline.", locationLabel: "Category", tradeLabel: "Area", addTitle: "Add Action Item" },
    siteops: { tabLabel: "Fieldwork Ops", h1: "Fieldwork Ops", sub: "Recruitment, field attendance, and equipment — add manually, ask the assistant, or import a spreadsheet.", materialsLabel: "Recruitment & Incentives", materialsAdd: "Add Incentive/Item", attendanceLabel: "Field Team Attendance", machineryLabel: "Field Equipment", machineryAdd: "Add Equipment" },
    floorplan: { tabLabel: "Research Design Map", h1: "Research Design Map", unitNoun: "Phase", unitNounPlural: "Phases" },
    inventory: { tabLabel: "Incentives & Materials", h1: "Incentives & Materials", sub: "Ask the assistant, or add stock items manually. Low-stock items are flagged." },
    kanban: { tabLabel: "Study Tasks" },
    dailylog: { tabLabel: "Field Notes", h1: "Field Notes", sub: "Ask the assistant, or log today's fieldwork notes manually.", entryNoun: "field note", weatherLabel: "Field Conditions", weatherPlaceholder: "e.g. High foot traffic, mall entrance B", crewLabel: "Team On", crewPlaceholder: "e.g. 2 interviewers, 1 note-taker", delaysLabel: "Issues / Blockers" },
    dashboard: { sub: "A live snapshot of this project — schedule, budget, open items, team workload, resources, attendance, and equipment.", crewHoursLabel: "Team Hours (7 days)" },
  },
  consulting: {
    submittals: { tabLabel: "Deliverables & Sign-offs", h1: "Deliverables & Sign-offs", sub: "Ask the assistant, or log a deliverable manually. Click a status dot to update it inline.", numberLabel: "Ref #", typeLabel: "Type", typeOptions: ["Proposal", "Interim Report", "Final Deck", "Recommendation Memo"], ballLabel: "Pending With", addTitle: "Add Deliverable" },
    punchlist: { tabLabel: "Action Items", h1: "Action Items", sub: "Ask the assistant, or add an action item manually. Click a status dot to update it inline.", locationLabel: "Workstream", tradeLabel: "Area", addTitle: "Add Action Item" },
    siteops: { tabLabel: "Engagement Ops", h1: "Engagement Ops", sub: "Resources, team attendance, and tools — add manually, ask the assistant, or import a spreadsheet.", materialsLabel: "Resources & Licenses", materialsAdd: "Add Resource", attendanceLabel: "Team Attendance", machineryLabel: "Tools & Software", machineryAdd: "Add Tool" },
    floorplan: { tabLabel: "Engagement Map", h1: "Engagement Map", unitNoun: "Workstream", unitNounPlural: "Workstreams" },
    inventory: { tabLabel: "Resource Library", h1: "Resource Library", sub: "Ask the assistant, or add resources manually. Low-stock items are flagged." },
    kanban: { tabLabel: "Engagement Tasks" },
    dailylog: { tabLabel: "Engagement Notes", h1: "Engagement Notes", sub: "Ask the assistant, or log today's engagement notes manually.", entryNoun: "engagement note", weatherLabel: "Location", weatherPlaceholder: "e.g. Onsite at client HQ, remote", crewLabel: "Team On", crewPlaceholder: "e.g. 2 consultants, 1 analyst", delaysLabel: "Issues / Blockers" },
    dashboard: { sub: "A live snapshot of this project — schedule, budget, open items, team workload, resources, attendance, and tools.", crewHoursLabel: "Team Hours (7 days)" },
  },
};
function labelsFor(module) { return INDUSTRY_LABELS[currentIndustry()][module]; }

function applyIndustryLabels(industry) {
  if (industry === "construction") document.body.removeAttribute("data-theme");
  else document.body.setAttribute("data-theme", "neutral");

  const L = INDUSTRY_LABELS[industry];

  const setTab = (view, text) => { const el = document.querySelector(`.tab[data-view="${view}"] .tab-label`); if (el) el.textContent = text; };
  setTab("submittals", L.submittals.tabLabel);
  setTab("punchlist", L.punchlist.tabLabel);
  setTab("siteops", L.siteops.tabLabel);
  setTab("floorplan", L.floorplan.tabLabel);
  setTab("inventory", L.inventory.tabLabel);
  setTab("kanban", L.kanban.tabLabel);
  setTab("dailylog", L.dailylog.tabLabel);

  document.querySelectorAll(".construction-only-tab").forEach((tab) => {
    tab.classList.toggle("industry-hidden", industry !== "construction");
  });

  const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  setText("submittalsH1", L.submittals.h1);
  setText("submittalsSub", L.submittals.sub);
  setText("punchlistH1", L.punchlist.h1);
  setText("punchlistSub", L.punchlist.sub);
  setText("siteopsH1", L.siteops.h1);
  setText("siteopsSub", L.siteops.sub);
  setText("siteopsLiveTitle", `${L.siteops.tabLabel} Live View`);
  setText("inventoryH1", L.inventory.h1);
  setText("inventorySub", L.inventory.sub);
  setText("dailylogH1", L.dailylog.h1);
  setText("dailylogSub", L.dailylog.sub);
  setText("dashboardSub", L.dashboard.sub);
  setText("floorplanH1", L.floorplan.h1);
  setText("btnAddFloorPlan", `＋ Add ${L.floorplan.tabLabel}`);
  setText("btnAddMaterial", `＋ ${L.siteops.materialsAdd}`);
  setText("btnAddMachine", `＋ ${L.siteops.machineryAdd}`);

  document.querySelectorAll(".industry-tab").forEach((tab) => {
    tab.classList.toggle("industry-visible", tab.dataset.industry === industry);
  });
  const findingsView = document.getElementById("view-findings");
  const billingView = document.getElementById("view-billing");
  if (findingsView) findingsView.style.display = industry === "marketing_research" ? "" : "none";
  if (billingView) billingView.style.display = industry === "consulting" ? "" : "none";
  // If the currently active view is one that just got hidden, fall back to Dashboard
  const activeView = document.querySelector(".view.active");
  if (activeView && (
    (activeView.id === "view-findings" && industry !== "marketing_research") ||
    (activeView.id === "view-billing" && industry !== "consulting") ||
    (activeView.id === "view-crashing" && industry !== "construction")
  )) {
    switchView("dashboard");
  }
}

const SAMPLES = {
  gantt: [
    { id: 1, name: "Mobilization & permits", start: "2026-08-03", end: "2026-08-09", progress: 100 },
    { id: 2, name: "Sitework & excavation", start: "2026-08-10", end: "2026-08-23", progress: 70 },
    { id: 3, name: "Foundation & footings", start: "2026-08-24", end: "2026-09-06", progress: 30 },
    { id: 4, name: "Framing", start: "2026-09-07", end: "2026-09-27", progress: 0 },
    { id: 5, name: "MEP rough-in", start: "2026-09-21", end: "2026-10-11", progress: 0 },
    { id: 6, name: "Insulation & drywall", start: "2026-10-12", end: "2026-10-25", progress: 0 },
    { id: 7, name: "Interior finishes", start: "2026-10-26", end: "2026-11-15", progress: 0 },
    { id: 8, name: "Final inspections & punch list", start: "2026-11-16", end: "2026-11-22", progress: 0 },
  ],
  burndown: {
    days: Array.from({ length: 11 }, (_, i) => ({
      day: i, ideal: 60 - i * 6,
      actual: i === 0 ? 60 : i <= 4 ? 60 - i * 5 : i <= 7 ? 40 - (i - 4) * 7 : 19 - (i - 7) * 6,
    })),
  },
  kanban: {
    columns: [
      { name: "To Do", cards: [{ id: "c1", title: "Order rooftop HVAC units" }, { id: "c2", title: "Schedule electrical rough-in inspection" }] },
      { name: "In Progress", cards: [{ id: "c3", title: "Frame 2nd floor east wing" }] },
      { name: "Done", cards: [{ id: "c4", title: "Pour foundation slab" }, { id: "c5", title: "Backfill & compact" }] },
    ],
  },
  raid: {
    items: [
      { id: "r1", type: "Risk", description: "Steel delivery could slip past framing start date", owner: "PM", impact: "High", status: "Open" },
      { id: "r2", type: "Assumption", description: "Local AHJ will complete foundation inspection within 48 hours of request", owner: "Site Super", impact: "Medium", status: "Monitoring" },
      { id: "r3", type: "Issue", description: "Existing utility line not shown on civil drawings", owner: "Civil Engineer", impact: "Medium", status: "Open" },
      { id: "r4", type: "Dependency", description: "Framing cannot start until foundation passes inspection", owner: "Site Super", impact: "High", status: "Open" },
    ],
  },
  dailylog: {
    entries: [
      { id: "d1", date: "2026-08-24", weather: "Clear, 78°F", crew: "12 (Concrete crew of 8, Laborers 4)", workPerformed: "Set foundation forms, placed rebar for footings", delays: "None" },
      { id: "d2", date: "2026-08-25", weather: "Partly cloudy, 74°F", crew: "10 (Concrete crew of 8, PM on site)", workPerformed: "Poured footings north side", delays: "1hr delay waiting on concrete truck" },
      { id: "d3", date: "2026-08-26", weather: "Rain, 65°F", crew: "4 (Laborers only)", workPerformed: "Site cleanup, material staging under cover", delays: "Concrete pour postponed due to rain" },
    ],
  },
  submittals: {
    items: [
      { id: "s1", number: "RFI-014", type: "RFI", subject: "Beam-to-column connection detail at grid line C-4 unclear on S-201", ballInCourt: "Structural Engineer", dueDate: "2026-09-02", status: "Open" },
      { id: "s2", number: "SUB-022", type: "Submittal", subject: "Rooftop HVAC unit shop drawings", ballInCourt: "Architect", dueDate: "2026-09-05", status: "Revise & Resubmit" },
      { id: "s3", number: "RFI-013", type: "RFI", subject: "Confirm waterproofing membrane at below-grade wall", ballInCourt: "Contractor", dueDate: "2026-08-28", status: "Answered" },
      { id: "s4", number: "SUB-021", type: "Submittal", subject: "Structural steel mill certificates", ballInCourt: "Architect", dueDate: "2026-08-20", status: "Approved" },
    ],
  },
  punchlist: {
    items: [
      { id: "p1", location: "Unit 204 — Kitchen", description: "Touch up paint around window trim", trade: "Painting", assignedTo: "ABC Painting Co.", status: "Open" },
      { id: "p2", location: "Lobby", description: "Adjust misaligned entry door closer", trade: "Doors & Hardware", assignedTo: "XYZ Door Systems", status: "In Progress" },
      { id: "p3", location: "Unit 108 — Bathroom", description: "Re-caulk tub surround", trade: "Plumbing", assignedTo: "Reliable Plumbing", status: "Complete" },
      { id: "p4", location: "Roof", description: "Confirm flashing seal at HVAC curb", trade: "Roofing", assignedTo: "Summit Roofing", status: "Verified" },
    ],
  },
  budget: {
    items: [
      { id: "b1", category: "Sitework", description: "Excavation & grading", estimated: 38000, actual: 41200 },
      { id: "b2", category: "Concrete", description: "Foundation & footings", estimated: 62000, actual: 59800 },
      { id: "b3", category: "Framing", description: "Rough carpentry labor & material", estimated: 95000, actual: 0 },
      { id: "b4", category: "MEP", description: "Mechanical, electrical, plumbing rough-in", estimated: 110000, actual: 0 },
    ],
  },
  materials: {
    items: [
      { id: "mt1", name: "Concrete", unit: "cu yd", delivered: 500, used: 410 },
      { id: "mt2", name: "Structural steel", unit: "tons", delivered: 40, used: 18 },
      { id: "mt3", name: "Framing lumber", unit: "board ft", delivered: 12000, used: 10800 },
      { id: "mt4", name: "Drywall", unit: "sheets", delivered: 600, used: 180 },
      { id: "mt5", name: "Insulation", unit: "sq ft", delivered: 8000, used: 5040 },
    ],
  },
  attendance: {
    records: [
      { id: "at1", date: "2026-08-25", memberName: "John Smith", status: "Present" },
      { id: "at2", date: "2026-08-25", memberName: "Maria Lopez", status: "Present" },
      { id: "at3", date: "2026-08-25", memberName: "Dave Chen", status: "Absent" },
    ],
  },
  machinery: {
    items: [
      { id: "mc1", name: "EX-102", type: "Excavator", status: "In Use" },
      { id: "mc2", name: "CR-01", type: "Tower Crane", status: "In Use" },
      { id: "mc3", name: "DT-04", type: "Dump Truck", status: "Available" },
      { id: "mc4", name: "FL-02", type: "Forklift", status: "Down" },
    ],
  },
  crashing: {
    items: [
      { id: "cx1", taskName: "Sitework & excavation", normalDuration: 14, crashDuration: 10, normalCost: 38000, crashCost: 47000 },
      { id: "cx2", taskName: "Foundation & footings", normalDuration: 14, crashDuration: 11, normalCost: 62000, crashCost: 71000 },
      { id: "cx3", taskName: "Framing", normalDuration: 20, crashDuration: 14, normalCost: 95000, crashCost: 122000 },
      { id: "cx4", taskName: "MEP rough-in", normalDuration: 21, crashDuration: 17, normalCost: 110000, crashCost: 128000 },
    ],
  },
  wbs: {
    phases: [
      { id: "ph1", code: "1", name: "Pre-Construction", items: [{ id: "wi1", code: "1.1", name: "Permitting" }, { id: "wi2", code: "1.2", name: "Site mobilization" }] },
      { id: "ph2", code: "2", name: "Structure", items: [{ id: "wi3", code: "2.1", name: "Foundation" }, { id: "wi4", code: "2.2", name: "Framing" }] },
      { id: "ph3", code: "3", name: "Finishes", items: [{ id: "wi5", code: "3.1", name: "Drywall & paint" }, { id: "wi6", code: "3.2", name: "Flooring" }] },
    ],
  },
  inventory: {
    items: [
      { id: "iv1", name: "2x4 Studs", category: "Lumber", quantity: 340, unit: "pieces", reorderLevel: 100, location: "Yard A" },
      { id: "iv2", name: "Portland Cement", category: "Concrete", quantity: 12, unit: "bags", reorderLevel: 20, location: "Storage 2" },
      { id: "iv3", name: "Romex 12-2 Wire", category: "Electrical", quantity: 900, unit: "ft", reorderLevel: 500, location: "Trailer" },
    ],
  },
  findings: {
    items: [
      { id: "fnd1", finding: "Price sensitivity is highest among first-time buyers", theme: "Pricing", evidence: "68% of Q3 respondents cited price as the top barrier", implication: "Consider a lower-priced entry tier" },
      { id: "fnd2", finding: "Word-of-mouth outperforms paid channels for trust", theme: "Channels", evidence: "Referred respondents converted at 2.3x the rate of paid-ad respondents", implication: "Invest in a referral program" },
      { id: "fnd3", finding: "Mobile checkout drop-off spikes at the payment step", theme: "UX", evidence: "41% of mobile sessions abandoned at payment entry", implication: "Simplify mobile payment flow" },
    ],
  },
  billing: {
    entries: [
      { id: "bh1", date: todayISO(), consultant: "J. Alvarez", workstream: "Market sizing", hours: 6, billable: true, rate: 150 },
      { id: "bh2", date: todayISO(), consultant: "R. Chen", workstream: "Client workshop prep", hours: 3, billable: true, rate: 175 },
      { id: "bh3", date: todayISO(), consultant: "J. Alvarez", workstream: "Internal team sync", hours: 1, billable: false, rate: 150 },
    ],
  },
};

// ===== Page navigation =====
function showPage(id) { PAGES.forEach((pid) => { document.getElementById(pid).style.display = pid === id ? "" : "none"; }); }
function showApp() { showPage("appView"); }
function showLanding() { document.body.setAttribute("data-theme", "neutral"); showPage("landingView"); }

// ===== New Project modal =====
let modalCallback = null;
function promptNewProject(onCreate, defaultType) {
  document.getElementById("modalProjectName").value = "";
  document.getElementById("modalProjectType").value = defaultType || "Residential";
  document.getElementById("newProjectModalOverlay").style.display = "flex";
  document.getElementById("modalProjectName").focus();
  modalCallback = onCreate;
}
function closeNewProjectModal() { document.getElementById("newProjectModalOverlay").style.display = "none"; modalCallback = null; }
document.getElementById("modalCancel").addEventListener("click", closeNewProjectModal);
document.getElementById("modalCreate").addEventListener("click", () => {
  const name = document.getElementById("modalProjectName").value.trim();
  const type = document.getElementById("modalProjectType").value;
  if (!name) { alert("Please enter a project name."); return; }
  const cb = modalCallback;
  closeNewProjectModal();
  if (cb) cb(name, type);
});
document.getElementById("modalProjectName").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); document.getElementById("modalCreate").click(); }
});

// ===== Add Item modal (manual entry, all modules) =====
function fieldRow(label, inputHtml) { return `<label>${label}</label>${inputHtml}`; }

function ensureCollection(type) {
  if (type === "gantt" && !state.gantt) state.gantt = [];
  if (type === "kanban" && !state.kanban) state.kanban = { columns: [{ name: "To Do", cards: [] }, { name: "In Progress", cards: [] }, { name: "Done", cards: [] }] };
  if (type === "raid" && !state.raid) state.raid = { items: [] };
  if (type === "dailylog" && !state.dailylog) state.dailylog = { entries: [] };
  if (type === "submittals" && !state.submittals) state.submittals = { items: [] };
  if (type === "punchlist" && !state.punchlist) state.punchlist = { items: [] };
  if (type === "burndown" && !state.burndown) state.burndown = { days: [] };
  if (type === "teammember" && !state.team) state.team = { members: [] };
  if (type === "timesheet") {
    if (!state.team) state.team = { members: [] };
    if (!state.timesheets) state.timesheets = { entries: [] };
  }
  if (type === "budget" && !state.budget) state.budget = { items: [] };
  if (type === "material" && !state.materials) state.materials = { items: [] };
  if (type === "attendance") {
    if (!state.team) state.team = { members: [] };
    if (!state.attendance) state.attendance = { records: [] };
  }
  if (type === "machine" && !state.machinery) state.machinery = { items: [] };
  if (type === "crashing" && !state.crashing) state.crashing = { items: [] };
  if (type === "wbsphase" && !state.wbs) state.wbs = { phases: [] };
  if (type === "wbsitem" && !state.wbs) state.wbs = { phases: [] };
  if (type === "inventory" && !state.inventory) state.inventory = { items: [] };
  if (type === "floorplan" && !state.floorplan) state.floorplan = { plans: [] };
  if (type === "findings" && !state.findings) state.findings = { items: [] };
  if (type === "billing" && !state.billing) state.billing = { entries: [] };
}

const ADD_TITLES = {
  gantt: "Add Task", kanban: "Add Card", raid: "Add RAID Item", dailylog: "Add Daily Log Entry",
  submittals: "Add Submittal / RFI", punchlist: "Add Punch List Item", burndown: "Add Day",
  teammember: "Add Team Member", timesheet: "Log Hours", budget: "Add Budget Line Item",
  material: "Add Material", attendance: "Add Attendance Record", machine: "Add Machine",
  crashing: "Add Task to Crashing Analysis", wbsphase: "Add WBS Phase", wbsitem: "Add Work Package",
  inventory: "Add Inventory Item", findings: "Add Finding", billing: "Log Hours",
};
function addTitleFor(type) {
  const L = INDUSTRY_LABELS[currentIndustry()];
  if (type === "submittals") return L.submittals.addTitle;
  if (type === "punchlist") return L.punchlist.addTitle;
  if (type === "material") return `Add ${L.siteops.materialsAdd.replace(/^Add /, "")}`;
  if (type === "machine") return `Add ${L.siteops.machineryAdd.replace(/^Add /, "")}`;
  if (type === "inventory") return `Add ${L.inventory.h1.replace(/s$/, "")} Item`;
  if (type === "dailylog") return `Add ${L.dailylog.h1} Entry`;
  return ADD_TITLES[type];
}

const FIELD_BUILDERS = {
  gantt: () => `
    ${fieldRow("Task name", `<input type="text" id="af-name" placeholder="e.g. Rough-in electrical">`)}
    ${fieldRow("Start date", `<input type="date" id="af-start">`)}
    ${fieldRow("End date", `<input type="date" id="af-end">`)}
    ${fieldRow("Progress (%)", `<input type="number" id="af-progress" min="0" max="100" value="0">`)}
  `,
  kanban: () => {
    const cols = state.kanban.columns.map((c) => c.name);
    return `${fieldRow("Card title", `<input type="text" id="af-title" placeholder="e.g. Pour footings">`)}
    ${fieldRow("Column", `<select id="af-column">${cols.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}</select>`)}`;
  },
  raid: () => `
    ${fieldRow("Type", `<select id="af-type"><option>Risk</option><option>Assumption</option><option>Issue</option><option>Dependency</option></select>`)}
    ${fieldRow("Description", `<textarea id="af-description" rows="3" placeholder="e.g. Steel delivery could slip past framing start"></textarea>`)}
    ${fieldRow("Owner", `<input type="text" id="af-owner" placeholder="e.g. PM">`)}
    ${fieldRow("Impact", `<select id="af-impact"><option>Low</option><option selected>Medium</option><option>High</option></select>`)}
    ${fieldRow("Status", `<select id="af-status"><option selected>Open</option><option>Monitoring</option><option>Mitigated</option><option>Closed</option></select>`)}
  `,
  dailylog: () => {
    const L = labelsFor("dailylog");
    return `
    ${fieldRow("Date", `<input type="date" id="af-date" value="${todayISO()}">`)}
    ${fieldRow(L.weatherLabel, `<input type="text" id="af-weather" placeholder="${escapeHtml(L.weatherPlaceholder)}">`)}
    ${fieldRow(L.crewLabel, `<input type="text" id="af-crew" placeholder="${escapeHtml(L.crewPlaceholder)}">`)}
    ${fieldRow("Work performed", `<textarea id="af-workPerformed" rows="3"></textarea>`)}
    ${fieldRow(L.delaysLabel, `<input type="text" id="af-delays" value="None">`)}
  `;
  },
  submittals: () => {
    const L = labelsFor("submittals");
    return `
    ${fieldRow(L.numberLabel, `<input type="text" id="af-number" placeholder="e.g. RFI-015 or SUB-010">`)}
    ${fieldRow(L.typeLabel, `<select id="af-type">${L.typeOptions.map((o) => `<option>${escapeHtml(o)}</option>`).join("")}</select>`)}
    ${fieldRow("Subject", `<textarea id="af-subject" rows="3"></textarea>`)}
    ${fieldRow(L.ballLabel, `<input type="text" id="af-ballInCourt" placeholder="e.g. Architect">`)}
    ${fieldRow("Due date", `<input type="date" id="af-dueDate">`)}
    ${fieldRow("Status", `<select id="af-status"><option selected>Open</option><option>Answered</option><option>Approved</option><option>Rejected</option><option>Revise &amp; Resubmit</option></select>`)}
  `;
  },
  punchlist: () => {
    const L = labelsFor("punchlist");
    return `
    ${fieldRow(L.locationLabel, `<input type="text" id="af-location" placeholder="e.g. Unit 204 — Kitchen">`)}
    ${fieldRow("Description", `<textarea id="af-description" rows="3"></textarea>`)}
    ${fieldRow(L.tradeLabel, `<input type="text" id="af-trade" placeholder="e.g. Painting">`)}
    ${fieldRow("Assigned to", `<input type="text" id="af-assignedTo" placeholder="e.g. ABC Painting Co.">`)}
    ${fieldRow("Status", `<select id="af-status"><option selected>Open</option><option>In Progress</option><option>Complete</option><option>Verified</option></select>`)}
  `;
  },
  findings: () => `
    ${fieldRow("Finding", `<textarea id="af-finding" rows="2" placeholder="e.g. Price sensitivity is highest among first-time buyers"></textarea>`)}
    ${fieldRow("Theme / Category", `<input type="text" id="af-theme" placeholder="e.g. Pricing">`)}
    ${fieldRow("Supporting evidence", `<textarea id="af-evidence" rows="2" placeholder="e.g. 68% of Q3 respondents cited price as the top barrier"></textarea>`)}
    ${fieldRow("Implication / recommendation", `<textarea id="af-implication" rows="2"></textarea>`)}
  `,
  billing: () => `
    ${fieldRow("Date", `<input type="date" id="af-date">`)}
    ${fieldRow("Consultant", `<input type="text" id="af-consultant" placeholder="e.g. J. Alvarez">`)}
    ${fieldRow("Workstream / task", `<input type="text" id="af-workstream" placeholder="e.g. Market sizing">`)}
    ${fieldRow("Hours", `<input type="number" id="af-hours" min="0" step="0.25" value="1">`)}
    ${fieldRow("Billable?", `<select id="af-billable"><option value="yes" selected>Billable</option><option value="no">Non-billable</option></select>`)}
    ${fieldRow("Rate ($/hr)", `<input type="number" id="af-rate" min="0" value="0">`)}
  `,
  burndown: () => {
    const nextDay = state.burndown.days.length;
    const lastActual = nextDay > 0 ? state.burndown.days[nextDay - 1].actual : 0;
    const lastIdeal = nextDay > 0 ? state.burndown.days[nextDay - 1].ideal : 0;
    return `${fieldRow("Day #", `<input type="number" id="af-day" value="${nextDay}">`)}
    ${fieldRow("Planned remaining", `<input type="number" id="af-ideal" value="${lastIdeal}">`)}
    ${fieldRow("Actual remaining", `<input type="number" id="af-actual" value="${lastActual}">`)}`;
  },
  teammember: () => `
    ${fieldRow("Name", `<input type="text" id="af-name" placeholder="e.g. John Smith">`)}
    ${fieldRow("Role", `<input type="text" id="af-role" placeholder="e.g. Site Superintendent">`)}
  `,
  timesheet: () => {
    const members = state.team.members;
    const options = members.length
      ? members.map((m) => `<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`).join("")
      : `<option value="">Add a team member first</option>`;
    return `${fieldRow("Team member", `<select id="af-memberName">${options}</select>`)}
    ${fieldRow("Date", `<input type="date" id="af-date" value="${todayISO()}">`)}
    ${fieldRow("Task / activity", `<input type="text" id="af-taskName" placeholder="e.g. Framing 2nd floor">`)}
    ${fieldRow("Hours", `<input type="number" id="af-hours" min="0" max="24" step="0.5" value="8">`)}`;
  },
  budget: () => `
    ${fieldRow("Category", `<input type="text" id="af-category" placeholder="e.g. Concrete">`)}
    ${fieldRow("Description", `<input type="text" id="af-description" placeholder="e.g. Foundation & footings">`)}
    ${fieldRow("Estimated ($)", `<input type="number" id="af-estimated" min="0" step="1" value="0">`)}
    ${fieldRow("Actual ($)", `<input type="number" id="af-actual" min="0" step="1" value="0">`)}
  `,
  material: () => `
    ${fieldRow("Material name", `<input type="text" id="af-name" placeholder="e.g. Concrete">`)}
    ${fieldRow("Unit of measurement", `<input type="text" id="af-unit" placeholder="e.g. cu yd, tons, sheets, sq ft">`)}
    ${fieldRow("Delivered", `<input type="number" id="af-delivered" min="0" step="0.1" value="0">`)}
    ${fieldRow("Used", `<input type="number" id="af-used" min="0" step="0.1" value="0">`)}
  `,
  attendance: () => {
    const members = (state.team && state.team.members) || [];
    const options = members.length
      ? members.map((m) => `<option value="${escapeHtml(m.name)}">${escapeHtml(m.name)}</option>`).join("")
      : `<option value="">Add a team member first</option>`;
    return `${fieldRow("Date", `<input type="date" id="af-date" value="${todayISO()}">`)}
    ${fieldRow("Team member", `<select id="af-memberName">${options}</select>`)}
    ${fieldRow("Status", `<select id="af-status"><option selected>Present</option><option>Absent</option></select>`)}`;
  },
  machine: () => `
    ${fieldRow("Name / ID", `<input type="text" id="af-name" placeholder="e.g. EX-102">`)}
    ${fieldRow("Type", `<input type="text" id="af-type" placeholder="e.g. Excavator">`)}
    ${fieldRow("Status", `<select id="af-status"><option selected>Available</option><option>In Use</option><option>Down</option></select>`)}
  `,
  crashing: () => `
    ${fieldRow("Task name", `<input type="text" id="af-taskName" placeholder="e.g. Framing">`)}
    ${fieldRow("Normal duration (days)", `<input type="number" id="af-normalDuration" min="0" value="10">`)}
    ${fieldRow("Crash duration (days)", `<input type="number" id="af-crashDuration" min="0" value="7">`)}
    ${fieldRow("Normal cost ($)", `<input type="number" id="af-normalCost" min="0" value="0">`)}
    ${fieldRow("Crash cost ($)", `<input type="number" id="af-crashCost" min="0" value="0">`)}
  `,
  wbsphase: () => `
    ${fieldRow("Phase name", `<input type="text" id="af-name" placeholder="e.g. Structure">`)}
  `,
  wbsitem: () => {
    const phases = (state.wbs && state.wbs.phases) || [];
    const options = phases.length
      ? phases.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.code)} ${escapeHtml(p.name)}</option>`).join("")
      : `<option value="">Add a phase first</option>`;
    return `${fieldRow("Phase", `<select id="af-phaseId">${options}</select>`)}
    ${fieldRow("Work package name", `<input type="text" id="af-name" placeholder="e.g. Foundation">`)}`;
  },
  inventory: () => `
    ${fieldRow("Item name", `<input type="text" id="af-name" placeholder="e.g. 2x4 Studs">`)}
    ${fieldRow("Category", `<input type="text" id="af-category" placeholder="e.g. Lumber">`)}
    ${fieldRow("Quantity on hand", `<input type="number" id="af-quantity" min="0" value="0">`)}
    ${fieldRow("Unit", `<input type="text" id="af-unit" placeholder="e.g. pieces, bags, ft">`)}
    ${fieldRow("Reorder level", `<input type="number" id="af-reorderLevel" min="0" value="0">`)}
    ${fieldRow("Location", `<input type="text" id="af-location" placeholder="e.g. Yard A">`)}
  `,
};

function openAddModal(type) {
  ensureCollection(type);
  document.getElementById("addItemModalTitle").textContent = addTitleFor(type);
  document.getElementById("addItemModalFields").innerHTML = FIELD_BUILDERS[type]();
  document.getElementById("addItemModalOverlay").dataset.type = type;
  document.getElementById("addItemModalOverlay").style.display = "flex";
  const firstInput = document.querySelector("#addItemModalFields input, #addItemModalFields select, #addItemModalFields textarea");
  if (firstInput) firstInput.focus();
}
function closeAddModal() { document.getElementById("addItemModalOverlay").style.display = "none"; }
document.getElementById("addItemCancel").addEventListener("click", closeAddModal);
document.querySelectorAll("[data-add-type]").forEach((btn) => { btn.addEventListener("click", () => openAddModal(btn.dataset.addType)); });

document.getElementById("addItemSubmit").addEventListener("click", () => {
  const type = document.getElementById("addItemModalOverlay").dataset.type;
  const val = (id) => { const el = document.getElementById(`af-${id}`); return el ? el.value.trim() : ""; };

  if (type === "gantt") {
    const name = val("name"), start = val("start"), end = val("end");
    if (!name || !start || !end) { alert("Please fill in task name, start date, and end date."); return; }
    const nextId = state.gantt.length ? Math.max(...state.gantt.map((t) => Number(t.id) || 0)) + 1 : 1;
    state.gantt.push({ id: nextId, name, start, end, progress: Number(val("progress")) || 0 });
    renderGantt(state.gantt);
  } else if (type === "kanban") {
    const title = val("title"), columnName = val("column");
    if (!title) { alert("Please enter a card title."); return; }
    const col = state.kanban.columns.find((c) => c.name === columnName) || state.kanban.columns[0];
    col.cards.push({ id: "c" + Date.now(), title });
    renderKanban(state.kanban);
  } else if (type === "raid") {
    const description = val("description");
    if (!description) { alert("Please enter a description."); return; }
    state.raid.items.push({ id: "r" + Date.now(), type: val("type"), description, owner: val("owner"), impact: val("impact"), status: val("status") });
    renderRaid(state.raid);
  } else if (type === "dailylog") {
    const date = val("date");
    if (!date) { alert("Please choose a date."); return; }
    state.dailylog.entries.push({ id: "d" + Date.now(), date, weather: val("weather"), crew: val("crew"), workPerformed: val("workPerformed"), delays: val("delays") || "None" });
    renderDailyLog(state.dailylog);
  } else if (type === "submittals") {
    const number = val("number"), subject = val("subject");
    if (!number || !subject) { alert("Please enter a number and subject."); return; }
    state.submittals.items.push({ id: "s" + Date.now(), number, type: val("type"), subject, ballInCourt: val("ballInCourt"), dueDate: val("dueDate"), status: val("status") });
    renderSubmittals(state.submittals);
  } else if (type === "punchlist") {
    const location = val("location"), description = val("description");
    if (!location || !description) { alert("Please enter a location and description."); return; }
    state.punchlist.items.push({ id: "p" + Date.now(), location, description, trade: val("trade"), assignedTo: val("assignedTo"), status: val("status") });
    renderPunchlist(state.punchlist);
  } else if (type === "burndown") {
    const day = Number(val("day")), ideal = Number(val("ideal")), actual = Number(val("actual"));
    state.burndown.days = state.burndown.days.filter((d) => d.day !== day);
    state.burndown.days.push({ day, ideal, actual });
    state.burndown.days.sort((a, b) => a.day - b.day);
    renderBurndown(state.burndown);
  } else if (type === "teammember") {
    const name = val("name");
    if (!name) { alert("Please enter a name."); return; }
    state.team.members.push({ id: "m" + Date.now(), name, role: val("role") });
    renderTeam();
  } else if (type === "timesheet") {
    const memberName = val("memberName"), date = val("date");
    if (!memberName) { alert("Add a team member first."); return; }
    if (!date) { alert("Please choose a date."); return; }
    state.timesheets.entries.push({ id: "t" + Date.now(), memberName, date, taskName: val("taskName"), hours: Number(val("hours")) || 0 });
    renderTeam();
  } else if (type === "budget") {
    const description = val("description");
    if (!description) { alert("Please enter a description."); return; }
    state.budget.items.push({ id: "b" + Date.now(), category: val("category"), description, estimated: Number(val("estimated")) || 0, actual: Number(val("actual")) || 0 });
    renderBudget(state.budget);
  } else if (type === "material") {
    const name = val("name");
    if (!name) { alert("Please enter a material name."); return; }
    state.materials.items.push({ id: "mt" + Date.now(), name, unit: val("unit") || "units", delivered: Number(val("delivered")) || 0, used: Number(val("used")) || 0 });
    renderSiteOps();
    renderSiteOpsLive();
  } else if (type === "attendance") {
    const memberName = val("memberName"), date = val("date");
    if (!memberName) { alert("Add a team member first."); return; }
    if (!date) { alert("Please choose a date."); return; }
    state.attendance.records.push({ id: "at" + Date.now(), date, memberName, status: val("status") });
    renderSiteOps();
    renderSiteOpsLive();
  } else if (type === "machine") {
    const name = val("name");
    if (!name) { alert("Please enter a name or ID."); return; }
    state.machinery.items.push({ id: "mc" + Date.now(), name, type: val("type"), status: val("status") });
    renderSiteOps();
    renderSiteOpsLive();
  } else if (type === "crashing") {
    const taskName = val("taskName");
    if (!taskName) { alert("Please enter a task name."); return; }
    state.crashing.items.push({
      id: "cx" + Date.now(), taskName,
      normalDuration: Number(val("normalDuration")) || 0, crashDuration: Number(val("crashDuration")) || 0,
      normalCost: Number(val("normalCost")) || 0, crashCost: Number(val("crashCost")) || 0,
    });
    renderCrashing();
  } else if (type === "wbsphase") {
    const name = val("name");
    if (!name) { alert("Please enter a phase name."); return; }
    const nextNum = state.wbs.phases.length + 1;
    state.wbs.phases.push({ id: "ph" + Date.now(), code: String(nextNum), name, items: [] });
    renderWbs();
  } else if (type === "wbsitem") {
    const phaseId = val("phaseId"), name = val("name");
    if (!phaseId) { alert("Add a phase first."); return; }
    if (!name) { alert("Please enter a work package name."); return; }
    const phase = state.wbs.phases.find((p) => p.id === phaseId);
    if (phase) {
      const nextNum = phase.items.length + 1;
      phase.items.push({ id: "wi" + Date.now(), code: `${phase.code}.${nextNum}`, name });
    }
    renderWbs();
  } else if (type === "inventory") {
    const name = val("name");
    if (!name) { alert("Please enter an item name."); return; }
    state.inventory.items.push({
      id: "iv" + Date.now(), name, category: val("category"),
      quantity: Number(val("quantity")) || 0, unit: val("unit") || "units",
      reorderLevel: Number(val("reorderLevel")) || 0, location: val("location"),
    });
    renderInventory();
  } else if (type === "findings") {
    const finding = val("finding");
    if (!finding) { alert("Please enter the finding."); return; }
    state.findings.items.push({
      id: "fnd" + Date.now(), finding, theme: val("theme"),
      evidence: val("evidence"), implication: val("implication"),
    });
    renderFindings();
  } else if (type === "billing") {
    const consultant = val("consultant");
    if (!consultant) { alert("Please enter the consultant's name."); return; }
    state.billing.entries.push({
      id: "bh" + Date.now(), date: val("date") || todayISO(), consultant,
      workstream: val("workstream"), hours: Number(val("hours")) || 0,
      billable: val("billable") === "yes", rate: Number(val("rate")) || 0,
    });
    renderBilling();
  }

  persistActiveProject();
  closeAddModal();
  triggerPropagationCheck(`Added a new entry to ${MODULE_LABEL_FOR_TYPE[type] || type}.`);
});

// ===== Delete row/card (event delegation) =====
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-del]");
  if (!btn) return;
  const sep = btn.dataset.del.indexOf(":");
  const type = btn.dataset.del.slice(0, sep);
  const id = btn.dataset.del.slice(sep + 1);
  if (type === "floorplanpin" && !confirm("Remove this pin?")) return;
  if (type === "floorplanroom" && !confirm("Delete this room?")) return;
  deleteItem(type, id);
});
function deleteItem(type, id) {
  if (type === "gantt") { state.gantt = state.gantt.filter((t) => String(t.id) !== id); renderGantt(state.gantt); }
  else if (type === "kanban") { state.kanban.columns.forEach((col) => { col.cards = col.cards.filter((c) => c.id !== id); }); renderKanban(state.kanban); }
  else if (type === "raid") { state.raid.items = state.raid.items.filter((i) => i.id !== id); renderRaid(state.raid); }
  else if (type === "dailylog") { state.dailylog.entries = state.dailylog.entries.filter((i) => i.id !== id); renderDailyLog(state.dailylog); }
  else if (type === "submittals") { state.submittals.items = state.submittals.items.filter((i) => i.id !== id); renderSubmittals(state.submittals); }
  else if (type === "punchlist") { state.punchlist.items = state.punchlist.items.filter((i) => i.id !== id); renderPunchlist(state.punchlist); }
  else if (type === "burndown") { state.burndown.days = state.burndown.days.filter((d) => String(d.day) !== id); renderBurndown(state.burndown); }
  else if (type === "teammember") { state.team.members = state.team.members.filter((m) => m.id !== id); renderTeam(); }
  else if (type === "timesheet") { state.timesheets.entries = state.timesheets.entries.filter((t) => t.id !== id); renderTeam(); }
  else if (type === "budget") { state.budget.items = state.budget.items.filter((i) => i.id !== id); renderBudget(state.budget); }
  else if (type === "material") { state.materials.items = state.materials.items.filter((i) => i.id !== id); renderSiteOps(); renderSiteOpsLive(); }
  else if (type === "attendance") { state.attendance.records = state.attendance.records.filter((r) => r.id !== id); renderSiteOps(); renderSiteOpsLive(); }
  else if (type === "machine") { state.machinery.items = state.machinery.items.filter((i) => i.id !== id); renderSiteOps(); renderSiteOpsLive(); }
  else if (type === "crashing") { state.crashing.items = state.crashing.items.filter((i) => i.id !== id); renderCrashing(); }
  else if (type === "wbsphase") { state.wbs.phases = state.wbs.phases.filter((p) => p.id !== id); renderWbs(); }
  else if (type === "wbsitem") { state.wbs.phases.forEach((p) => { p.items = p.items.filter((i) => i.id !== id); }); renderWbs(); }
  else if (type === "inventory") { state.inventory.items = state.inventory.items.filter((i) => i.id !== id); renderInventory(); }
  else if (type === "findings") { state.findings.items = state.findings.items.filter((i) => i.id !== id); renderFindings(); }
  else if (type === "billing") { state.billing.entries = state.billing.entries.filter((i) => i.id !== id); renderBilling(); }
  else if (type === "floorplan") { state.floorplan.plans = state.floorplan.plans.filter((p) => p.id !== id); renderFloorPlan(); }
  else if (type === "floorplanpin") { state.floorplan.plans.forEach((p) => { p.pins = p.pins.filter((pin) => pin.id !== id); }); renderFloorPlan(); }
  else if (type === "floorplanroom") {
    const [planId, roomId] = id.split("::");
    const plan = state.floorplan.plans.find((p) => p.id === planId);
    if (plan) plan.rooms = plan.rooms.filter((r) => r.id !== roomId);
    renderFloorPlan();
  }
  persistActiveProject();
  if (type !== "floorplanpin") triggerPropagationCheck(`Deleted an item from ${MODULE_LABEL_FOR_TYPE[type] || type}.`);
}

// ===== Projects (localStorage, mirrored to Supabase when signed in) =====
function loadAllProjects() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; } }
function saveAllProjectsLocal(projects) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); } catch (e) { console.error("Storage save failed", e); } }

// Thin cloud-sync layer: every save pushes the current project set to Supabase
// (fire-and-forget) so it survives across devices/browsers. localStorage stays
// the fast local cache and the only thing the rest of this file reads from.
const TracklineCloud = (function () {
  let lastIds = new Set();
  function setInitialIds(ids) { lastIds = new Set(ids); }
  async function syncProjects(projects) {
    const auth = window.TracklineAuth;
    const session = auth && auth.getSession();
    if (!session) return;
    const client = auth.client;
    const userId = session.user.id;
    const nextIds = new Set(Object.keys(projects));

    const deletedIds = [...lastIds].filter((id) => !nextIds.has(id));
    for (const id of deletedIds) {
      client.from("projects").delete().eq("id", id).eq("user_id", userId).then(({ error }) => {
        if (error) console.error("Cloud delete failed", error);
      });
    }

    const rows = Object.entries(projects).map(([id, p]) => ({
      id, user_id: userId, name: p.name || "Untitled Project", type: p.type || "",
      data: p, updated_at: new Date().toISOString(),
    }));
    if (rows.length) {
      client.from("projects").upsert(rows).then(({ error }) => {
        if (error) console.error("Cloud save failed", error);
      });
    }
    lastIds = nextIds;
  }
  return { setInitialIds, syncProjects };
})();
window.TracklineCloud = TracklineCloud;

function saveAllProjects(projects) {
  saveAllProjectsLocal(projects);
  TracklineCloud.syncProjects(projects);
}
function newProjectState(name, type) {
  return {
    name, type: type || "",
    charts: {
      gantt: null, burndown: null, kanban: null, raid: null, dailylog: null, submittals: null, punchlist: null,
      team: null, timesheets: null, budget: null, materials: null, attendance: null, machinery: null,
      charter: null, crashing: null, wbs: null, inventory: null, floorplan: null,
      findings: null, billing: null,
    },
    apiHistory: [], chatLog: [], updatedAt: Date.now(),
  };
}
function initProjects() {
  let projects = loadAllProjects();
  let active = localStorage.getItem(ACTIVE_KEY);
  if (!active || !projects[active]) {
    const id = "p_" + Date.now();
    projects[id] = newProjectState("My Project", "Residential");
    saveAllProjects(projects);
    localStorage.setItem(ACTIVE_KEY, id);
    active = id;
  }
  activeProjectId = active;
  loadProjectIntoApp(projects[active]);
  renderProjectSelector();
}
function loadProjectIntoApp(project) {
  state.gantt = project.charts.gantt;
  state.burndown = project.charts.burndown;
  state.kanban = project.charts.kanban;
  state.raid = project.charts.raid;
  state.dailylog = project.charts.dailylog || null;
  state.submittals = project.charts.submittals || null;
  state.punchlist = project.charts.punchlist || null;
  state.team = project.charts.team || null;
  state.timesheets = project.charts.timesheets || null;
  state.budget = project.charts.budget || null;
  state.materials = project.charts.materials || null;
  state.attendance = project.charts.attendance || null;
  state.machinery = project.charts.machinery || null;
  state.charter = project.charts.charter || null;
  state.crashing = project.charts.crashing || null;
  state.wbs = project.charts.wbs || null;
  state.inventory = project.charts.inventory || null;
  state.floorplan = project.charts.floorplan || null;
  state.findings = project.charts.findings || null;
  state.billing = project.charts.billing || null;
  history = project.apiHistory ? [...project.apiHistory] : [];
  chatLogData = project.chatLog ? [...project.chatLog] : [];

  applyIndustryLabels(industryFromType(project.type));

  renderGantt(state.gantt);
  renderBurndown(state.burndown);
  renderKanban(state.kanban);
  renderRaid(state.raid);
  renderDailyLog(state.dailylog);
  renderSubmittals(state.submittals);
  renderPunchlist(state.punchlist);
  renderTeam();
  renderBudget(state.budget);
  renderSiteOps();
  renderCharter();
  renderCrashing();
  renderWbs();
  renderInventory();
  renderFloorPlan();
  renderFindings();
  renderBilling();
  renderDashboard();
  renderSiteOpsLive();
  renderCalendar();
  rebuildChatLogDom();

  const badge = document.getElementById("projectTypeBadge");
  if (badge) badge.textContent = project.type || "";
}
function persistActiveProject() {
  const projects = loadAllProjects();
  if (!activeProjectId || !projects[activeProjectId]) return;
  projects[activeProjectId].charts = {
    gantt: state.gantt, burndown: state.burndown, kanban: state.kanban, raid: state.raid,
    dailylog: state.dailylog, submittals: state.submittals, punchlist: state.punchlist,
    team: state.team, timesheets: state.timesheets, budget: state.budget,
    materials: state.materials, attendance: state.attendance, machinery: state.machinery,
    charter: state.charter, crashing: state.crashing, wbs: state.wbs, inventory: state.inventory, floorplan: state.floorplan,
    findings: state.findings, billing: state.billing,
  };
  projects[activeProjectId].apiHistory = history;
  projects[activeProjectId].chatLog = chatLogData;
  projects[activeProjectId].updatedAt = Date.now();
  saveAllProjects(projects);
}
function renderProjectSelector() {
  const projects = loadAllProjects();
  const select = document.getElementById("projectSelect");
  select.innerHTML = Object.entries(projects)
    .sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0))
    .map(([id, p]) => `<option value="${id}" ${id === activeProjectId ? "selected" : ""}>${escapeHtml(p.name)}</option>`)
    .join("");
}
function switchActiveProject(id) {
  persistActiveProject();
  activeProjectId = id;
  localStorage.setItem(ACTIVE_KEY, id);
  const projects = loadAllProjects();
  loadProjectIntoApp(projects[id]);
  renderProjectSelector();
}

document.getElementById("projectSelect").addEventListener("change", (e) => { switchActiveProject(e.target.value); setTicker("SYSTEM READY · SWITCHED PROJECT"); });
document.getElementById("btnNewProject").addEventListener("click", () => {
  const currentTab = document.querySelector(".tab.active")?.dataset.view || "dashboard";
  promptNewProject((name, type) => createProjectAndOpen(name, type, currentTab, false));
});
document.getElementById("btnRenameProject").addEventListener("click", () => {
  const projects = loadAllProjects();
  const current = projects[activeProjectId];
  if (!current) return;
  const name = prompt("Rename project:", current.name);
  if (!name) return;
  current.name = name;
  saveAllProjects(projects);
  renderProjectSelector();
});
document.getElementById("btnDeleteProject").addEventListener("click", () => {
  const projects = loadAllProjects();
  const ids = Object.keys(projects);
  if (ids.length <= 1) { alert("You need at least one project — create a new one before deleting this."); return; }
  if (!confirm(`Delete "${projects[activeProjectId].name}"? This can't be undone.`)) return;
  delete projects[activeProjectId];
  saveAllProjects(projects);
  const nextId = Object.keys(projects)[0];
  activeProjectId = nextId;
  localStorage.setItem(ACTIVE_KEY, nextId);
  loadProjectIntoApp(projects[nextId]);
  renderProjectSelector();
});

function createProjectAndOpen(name, type, tab, goToApp = true) {
  persistActiveProject();
  const projects = loadAllProjects();
  const id = "p_" + Date.now();
  projects[id] = newProjectState(name, type);
  saveAllProjects(projects);
  activeProjectId = id;
  localStorage.setItem(ACTIVE_KEY, id);
  loadProjectIntoApp(projects[id]);
  renderProjectSelector();
  if (goToApp) { showApp(); switchView(tab); }
}

// ===== Tabs =====
document.querySelectorAll(".tab").forEach((tab) => { tab.addEventListener("click", () => switchView(tab.dataset.view)); });
function switchView(name) {
  document.querySelectorAll(".tab").forEach((t) => {
    const active = t.dataset.view === name;
    t.classList.toggle("active", active);
    t.setAttribute("aria-selected", active);
  });
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${name}`));
  if (name === "dashboard") { renderDashboard(); renderSiteOpsLive(); }
  if (name === "calendar") renderCalendar();
  if (name === "siteops") renderSiteOps();
  if (name === "charter") renderCharter();
  if (name === "crashing") renderCrashing();
  if (name === "wbs") renderWbs();
  if (name === "inventory") renderInventory();
  if (name === "floorplan") renderFloorPlan();
  if (name === "findings") renderFindings();
  if (name === "billing") renderBilling();
}

// ===== Sidebar collapse/expand (persisted, collapsed by default, hover-to-peek when collapsed) =====
const SIDEBAR_COLLAPSED_KEY = "trackline_sidebar_collapsed";
const sidebarNav = document.getElementById("sidebarNav");
const sidebarToggle = document.getElementById("sidebarToggle");

function setSidebarCollapsed(collapsed) {
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  sidebarNav.classList.toggle("collapsed", collapsed);
  sidebarNav.classList.remove("hover-peek");
}
const storedSidebarState = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
setSidebarCollapsed(storedSidebarState === null ? true : storedSidebarState === "1"); // collapsed by default on first visit

sidebarToggle.addEventListener("click", () => {
  setSidebarCollapsed(!sidebarNav.classList.contains("collapsed"));
});
document.getElementById("sidebarPin").addEventListener("click", () => {
  setSidebarCollapsed(!sidebarNav.classList.contains("collapsed"));
});
sidebarNav.addEventListener("mouseenter", () => {
  if (sidebarNav.classList.contains("collapsed")) sidebarNav.classList.add("hover-peek");
});
sidebarNav.addEventListener("mouseleave", () => {
  sidebarNav.classList.remove("hover-peek");
});

// ===== Floating chat (Messenger-style bubble/window, persisted, defaults collapsed) =====
const FLOATING_CHAT_KEY = "trackline_floating_chat_open";
const floatingChat = document.getElementById("floatingChat");
function setFloatingChatOpen(open) {
  localStorage.setItem(FLOATING_CHAT_KEY, open ? "1" : "0");
  floatingChat.classList.toggle("open", open);
}
setFloatingChatOpen(localStorage.getItem(FLOATING_CHAT_KEY) === "1");
document.getElementById("floatingChatBubble").addEventListener("click", () => setFloatingChatOpen(true));
document.getElementById("floatingChatMinimize").addEventListener("click", () => setFloatingChatOpen(false));

// ===== Auto-hide header group on scroll (hide on scroll-down, reveal on scroll-up) =====
(function initHeaderAutoHide() {
  const headerGroup = document.getElementById("appHeaderGroup");
  const canvasEl = document.querySelector(".canvas");
  if (!headerGroup || !canvasEl) return;
  let lastScrollTop = 0;
  canvasEl.addEventListener("scroll", () => {
    const st = canvasEl.scrollTop;
    if (st > lastScrollTop && st > 40) headerGroup.classList.add("header-hidden");
    else if (st < lastScrollTop) headerGroup.classList.remove("header-hidden");
    lastScrollTop = st <= 0 ? 0 : st;
  });
})();

// ===== Sample loaders =====
document.querySelectorAll("[data-sample]").forEach((btn) => { btn.addEventListener("click", () => loadSample(btn.dataset.sample)); });
function loadSample(kind) {
  if (kind === "gantt") state.gantt = SAMPLES.gantt, renderGantt(state.gantt);
  if (kind === "burndown") state.burndown = SAMPLES.burndown, renderBurndown(state.burndown);
  if (kind === "kanban") state.kanban = SAMPLES.kanban, renderKanban(state.kanban);
  if (kind === "raid") state.raid = SAMPLES.raid, renderRaid(state.raid);
  if (kind === "dailylog") state.dailylog = SAMPLES.dailylog, renderDailyLog(state.dailylog);
  if (kind === "submittals") state.submittals = SAMPLES.submittals, renderSubmittals(state.submittals);
  if (kind === "punchlist") state.punchlist = SAMPLES.punchlist, renderPunchlist(state.punchlist);
  if (kind === "budget") state.budget = SAMPLES.budget, renderBudget(state.budget);
  if (kind === "crashing") state.crashing = SAMPLES.crashing, renderCrashing();
  if (kind === "wbs") state.wbs = SAMPLES.wbs, renderWbs();
  if (kind === "inventory") state.inventory = SAMPLES.inventory, renderInventory();
  if (kind === "findings") state.findings = SAMPLES.findings, renderFindings();
  if (kind === "billing") state.billing = SAMPLES.billing, renderBilling();
  persistActiveProject();
}

// ===== Export: PNG via html2canvas =====
document.querySelectorAll("[data-export-png]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const el = document.getElementById(btn.dataset.exportPng);
    if (!el) return;
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = "Exporting…";
    try {
      const canvas = await html2canvas(el, { backgroundColor: "#232326", scale: 2 });
      downloadCanvas(canvas, btn.dataset.exportName || "chart");
    } catch (e) { alert("Export failed — try the Export PDF option instead."); }
    finally { btn.disabled = false; btn.textContent = original; }
  });
});
document.querySelectorAll("[data-export-png-canvas]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const canvas = document.getElementById(btn.dataset.exportPngCanvas);
    if (!canvas) return;
    downloadCanvas(canvas, btn.dataset.exportName || "chart");
  });
});
function downloadCanvas(canvas, name) {
  const link = document.createElement("a");
  link.download = `${name}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
document.querySelectorAll("[data-export-print]").forEach((btn) => { btn.addEventListener("click", () => window.print()); });

// ===== Refresh buttons (reload from storage, re-render just that tab) =====
const REFRESH_RENDERERS = {
  dashboard: () => { renderDashboard(); renderSiteOpsLive(); },
  charter: () => renderCharter(),
  gantt: () => renderGantt(state.gantt),
  burndown: () => renderBurndown(state.burndown),
  kanban: () => renderKanban(state.kanban),
  raid: () => renderRaid(state.raid),
  dailylog: () => renderDailyLog(state.dailylog),
  submittals: () => renderSubmittals(state.submittals),
  punchlist: () => renderPunchlist(state.punchlist),
  team: () => renderTeam(),
  siteops: () => { renderSiteOps(); renderSiteOpsLive(); },
  budget: () => renderBudget(state.budget),
  crashing: () => renderCrashing(),
  wbs: () => renderWbs(),
  inventory: () => renderInventory(),
  findings: () => renderFindings(),
  billing: () => renderBilling(),
  floorplan: () => renderFloorPlan(),
  calendar: () => renderCalendar(),
};
document.querySelectorAll("[data-refresh]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.refresh;
    const projects = loadAllProjects();
    const fresh = projects[activeProjectId];
    if (fresh) loadProjectIntoApp(fresh);
    else if (REFRESH_RENDERERS[tab]) REFRESH_RENDERERS[tab]();
    setTicker(`${tab.toUpperCase()} REFRESHED`, true);
  });
});

// ===== Gantt rendering =====
function renderGantt(tasks) {
  state.gantt = tasks;
  const wrap = document.getElementById("ganttWrap");
  if (!tasks || !tasks.length) {
    wrap.innerHTML = `<div class="empty-state" id="ganttEmpty"><p>No schedule yet.</p><button class="btn-ghost" data-sample="gantt">Load a sample schedule</button></div>`;
    rebindSampleButton(wrap);
    return;
  }
  const dates = tasks.flatMap((t) => [new Date(t.start), new Date(t.end)]);
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  const totalDays = Math.max(1, Math.round((maxDate - minDate) / 86400000) + 1);
  const weekCount = Math.ceil(totalDays / 7);
  let scaleHtml = "";
  for (let w = 0; w < weekCount; w++) scaleHtml += `<span>Wk ${w + 1}</span>`;

  let rows = "";
  tasks.forEach((t) => {
    const startOffset = Math.round((new Date(t.start) - minDate) / 86400000);
    const durDays = Math.max(1, Math.round((new Date(t.end) - new Date(t.start)) / 86400000) + 1);
    const leftPct = (startOffset / totalDays) * 100;
    const widthPct = (durDays / totalDays) * 100;
    rows += `
      <div class="gantt-row">
        <div class="gantt-task-name" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</div>
        <div class="gantt-track">
          <div class="gantt-track-bg"></div>
          <div class="gantt-bar" data-task-id="${t.id}" style="left:${leftPct}%; width:${widthPct}%;" title="Drag to move · drag the edges to resize"><div class="gantt-bar-fill" style="width:${t.progress || 0}%;" title="Drag to set progress"></div></div>
          <div class="gantt-bar-label" style="left:calc(${leftPct}% + 8px)">${escapeHtml(t.name)} · ${t.progress || 0}%</div>
        </div>
        <button class="row-delete-btn" data-del="gantt:${t.id}" title="Delete task">×</button>
      </div>`;
  });
  wrap.innerHTML = `<div class="gantt-header"><div>Task</div><div class="gantt-scale">${scaleHtml}</div><div></div></div>${rows}`;
  wrap.style.width = Math.max(640, 260 + weekCount * 90) + "px";
  attachGanttDragEvents(minDate, totalDays);
}

function attachGanttDragEvents(minDate, totalDays) {
  document.querySelectorAll(".gantt-bar").forEach((barEl) => {
    const taskId = barEl.dataset.taskId;
    const track = barEl.parentElement;
    const fillEl = barEl.querySelector(".gantt-bar-fill");

    barEl.addEventListener("pointerdown", (e) => {
      const trackRect = track.getBoundingClientRect();
      const barRect = barEl.getBoundingClientRect();
      const pxPerDay = trackRect.width / totalDays;
      const edgeZone = 8;
      const offsetInBar = e.clientX - barRect.left;
      const mode = offsetInBar <= edgeZone ? "resize-start" : (barRect.width - offsetInBar <= edgeZone ? "resize-end" : "move");
      const startX = e.clientX;
      const task = state.gantt.find((t) => String(t.id) === taskId);
      if (!task) return;
      const origStart = new Date(task.start);
      const origEnd = new Date(task.end);
      barEl.setPointerCapture(e.pointerId);
      document.body.style.cursor = mode === "move" ? "grabbing" : "ew-resize";

      function computeDates(deltaDays) {
        let newStart = origStart, newEnd = origEnd;
        if (mode === "move") {
          newStart = new Date(origStart); newStart.setDate(newStart.getDate() + deltaDays);
          newEnd = new Date(origEnd); newEnd.setDate(newEnd.getDate() + deltaDays);
        } else if (mode === "resize-end") {
          newEnd = new Date(origEnd); newEnd.setDate(newEnd.getDate() + deltaDays);
          if (newEnd < origStart) newEnd = new Date(origStart);
        } else {
          newStart = new Date(origStart); newStart.setDate(newStart.getDate() + deltaDays);
          if (newStart > origEnd) newStart = new Date(origEnd);
        }
        return { newStart, newEnd };
      }
      function onMove(ev) {
        const deltaDays = Math.round((ev.clientX - startX) / pxPerDay);
        const { newStart, newEnd } = computeDates(deltaDays);
        const leftOffset = Math.round((newStart - minDate) / 86400000);
        const dur = Math.round((newEnd - newStart) / 86400000) + 1;
        barEl.style.left = ((leftOffset / totalDays) * 100) + "%";
        barEl.style.width = ((dur / totalDays) * 100) + "%";
      }
      function onUp(ev) {
        barEl.releasePointerCapture(e.pointerId);
        document.body.style.cursor = "";
        barEl.removeEventListener("pointermove", onMove);
        const deltaDays = Math.round((ev.clientX - startX) / pxPerDay);
        if (deltaDays === 0) return;
        const { newStart, newEnd } = computeDates(deltaDays);
        const oldStartStr = task.start, oldEndStr = task.end;
        task.start = newStart.toISOString().slice(0, 10);
        task.end = newEnd.toISOString().slice(0, 10);
        renderGantt(state.gantt);
        persistActiveProject();
        triggerPropagationCheck(`Changed the schedule for task "${task.name}": now ${task.start} to ${task.end} (was ${oldStartStr} to ${oldEndStr}).`);
      }
      barEl.addEventListener("pointermove", onMove);
      barEl.addEventListener("pointerup", onUp, { once: true });
    });

    if (fillEl) {
      fillEl.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        const barRect = barEl.getBoundingClientRect();
        fillEl.setPointerCapture(e.pointerId);
        function pctFromEvent(ev) { return Math.max(0, Math.min(100, Math.round(((ev.clientX - barRect.left) / barRect.width) * 100))); }
        function onMove(ev) { fillEl.style.width = pctFromEvent(ev) + "%"; }
        function onUp(ev) {
          fillEl.releasePointerCapture(e.pointerId);
          fillEl.removeEventListener("pointermove", onMove);
          const pct = pctFromEvent(ev);
          const task = state.gantt.find((t) => String(t.id) === taskId);
          if (task) {
            const oldProgress = task.progress || 0;
            task.progress = pct;
            renderGantt(state.gantt);
            persistActiveProject();
            if (pct !== oldProgress) triggerPropagationCheck(`Changed progress on task "${task.name}" from ${oldProgress}% to ${pct}%.`);
          }
        }
        fillEl.addEventListener("pointermove", onMove);
        fillEl.addEventListener("pointerup", onUp, { once: true });
      });
    }
  });
}

// ===== Burndown rendering =====
function renderBurndown(data) {
  state.burndown = data;
  const emptyEl = document.getElementById("burndownEmpty");
  const canvas = document.getElementById("burndownChart");
  const tableEl = document.getElementById("burndownTable");
  if (!data || !data.days || !data.days.length) {
    emptyEl.style.display = "block"; canvas.style.display = "none"; tableEl.innerHTML = "";
    return;
  }
  emptyEl.style.display = "none"; canvas.style.display = "block";
  const labels = data.days.map((d) => `Day ${d.day}`);
  const ideal = data.days.map((d) => d.ideal);
  const actual = data.days.map((d) => d.actual);
  if (burndownChartInstance) burndownChartInstance.destroy();
  burndownChartInstance = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: { labels, datasets: [
      { label: "Planned", data: ideal, borderColor: "#6B6B72", borderDash: [5, 4], pointRadius: 0, tension: 0 },
      { label: "Actual", data: actual, borderColor: "#F2B705", backgroundColor: "rgba(242,183,5,0.12)", fill: true, pointRadius: 3, tension: 0.25 },
    ]},
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: "#A6A6AC", font: { family: "IBM Plex Mono", size: 11 } } } },
      scales: {
        x: { ticks: { color: "#6B6B72" }, grid: { color: "rgba(255,255,255,0.05)" } },
        y: { ticks: { color: "#6B6B72" }, grid: { color: "rgba(255,255,255,0.05)" }, title: { display: true, text: "Work remaining", color: "#A6A6AC" } },
      },
    },
  });
  const rows = [...data.days].sort((a, b) => a.day - b.day).map((d) => `
      <tr><td>Day ${d.day}</td><td>${d.ideal}</td><td>${d.actual}</td>
      <td class="col-delete"><button class="row-delete-btn" data-del="burndown:${d.day}" title="Delete day">×</button></td></tr>`).join("");
  tableEl.innerHTML = `<table class="log-table"><thead><tr><th>Day</th><th>Planned</th><th>Actual</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ===== Kanban rendering =====
function renderKanban(data) {
  state.kanban = data;
  const wrap = document.getElementById("kanbanWrap");
  if (!data || !data.columns || !data.columns.length) {
    wrap.innerHTML = `<div class="empty-state" id="kanbanEmpty"><p>No task board yet.</p><button class="btn-ghost" data-sample="kanban">Load a sample board</button></div>`;
    rebindSampleButton(wrap);
    return;
  }
  wrap.innerHTML = data.columns.map((col, ci) => `
    <div class="kanban-col" data-col="${ci}">
      <div class="kanban-col-head"><span>${escapeHtml(col.name)}</span><span class="kanban-count">${col.cards.length}</span></div>
      <div class="kanban-cards" data-col-cards="${ci}">
        ${col.cards.map((card) => `<div class="kanban-card" draggable="true" data-card-id="${card.id}">${escapeHtml(card.title)}<button class="row-delete-btn" data-del="kanban:${card.id}" title="Delete card">×</button></div>`).join("")}
      </div>
    </div>`).join("");
  attachDragEvents();
}
function attachDragEvents() {
  let draggedId = null;
  document.querySelectorAll(".kanban-card").forEach((card) => {
    card.addEventListener("dragstart", () => { draggedId = card.dataset.cardId; card.classList.add("dragging"); });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
  });
  document.querySelectorAll(".kanban-col").forEach((col) => {
    col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("drag-over"); });
    col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
    col.addEventListener("drop", () => { col.classList.remove("drag-over"); moveCard(draggedId, Number(col.dataset.col)); });
  });
}
function moveCard(cardId, targetColIdx) {
  if (!state.kanban) return;
  let moved = null;
  state.kanban.columns.forEach((col) => { const idx = col.cards.findIndex((c) => c.id === cardId); if (idx > -1) moved = col.cards.splice(idx, 1)[0]; });
  if (moved) state.kanban.columns[targetColIdx].cards.push(moved);
  renderKanban(state.kanban);
  persistActiveProject();
  if (moved) triggerPropagationCheck(`Moved the site task card "${moved.title}" to column "${state.kanban.columns[targetColIdx].name}".`);
}

// ===== RAID rendering =====
// ===== Inline status radio groups (quick status updates without opening a modal) =====
function statusRadioGroup(module, id, options, current) {
  const groupName = `status-${module}-${id}`;
  return `<div class="status-radio-group" data-status-module="${module}" data-status-id="${id}">
    ${options.map((opt) => `
      <label class="status-radio-option ${opt === current ? "checked" : ""}">
        <input type="radio" name="${groupName}" value="${escapeHtml(opt)}" ${opt === current ? "checked" : ""}>
        ${escapeHtml(opt)}
      </label>`).join("")}
  </div>`;
}
document.addEventListener("change", (e) => {
  const input = e.target.closest(".status-radio-group input[type=radio]");
  if (!input) return;
  const group = input.closest(".status-radio-group");
  updateItemStatus(group.dataset.statusModule, group.dataset.statusId, input.value);
});
function updateItemStatus(module, id, newStatus) {
  if (module === "raid") { const item = (state.raid.items || []).find((i) => i.id === id); if (item) { item.status = newStatus; renderRaid(state.raid); } }
  else if (module === "submittals") { const item = (state.submittals.items || []).find((i) => i.id === id); if (item) { item.status = newStatus; renderSubmittals(state.submittals); } }
  else if (module === "punchlist") { const item = (state.punchlist.items || []).find((i) => i.id === id); if (item) { item.status = newStatus; renderPunchlist(state.punchlist); } }
  else if (module === "machine") { const item = (state.machinery.items || []).find((i) => i.id === id); if (item) { item.status = newStatus; renderSiteOps(); renderSiteOpsLive(); } }
  else if (module === "attendance") { const rec = (state.attendance.records || []).find((r) => r.id === id); if (rec) { rec.status = newStatus; renderSiteOps(); renderSiteOpsLive(); } }
  persistActiveProject();
  triggerPropagationCheck(`Changed a ${MODULE_LABEL_FOR_TYPE[module] || module} item's status to "${newStatus}".`);
}

function renderRaid(data) {
  state.raid = data;
  const wrap = document.getElementById("raidWrap");
  if (!data || !data.items || !data.items.length) {
    wrap.innerHTML = `<div class="empty-state" id="raidEmpty"><p>No RAID log yet.</p><button class="btn-ghost" data-sample="raid">Load a sample log</button></div>`;
    rebindSampleButton(wrap);
    return;
  }
  const rows = data.items.map((item) => `
      <tr><td><span class="raid-badge type-${slug(item.type)}">${escapeHtml(item.type)}</span></td>
      <td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.owner || "—")}</td>
      <td><span class="raid-badge impact-${slug(item.impact)}">${escapeHtml(item.impact || "—")}</span></td>
      <td>${statusRadioGroup("raid", item.id, ["Open", "Monitoring", "Mitigated", "Closed"], item.status)}</td>
      <td class="col-delete"><button class="row-delete-btn" data-del="raid:${item.id}" title="Delete item">×</button></td></tr>`).join("");
  wrap.innerHTML = `<table class="raid-table"><thead><tr><th>Type</th><th>Description</th><th>Owner</th><th>Impact</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ===== Daily Log rendering =====
function renderDailyLog(data) {
  state.dailylog = data;
  const wrap = document.getElementById("dailylogWrap");
  const L = labelsFor("dailylog");
  if (!data || !data.entries || !data.entries.length) {
    wrap.innerHTML = `<div class="empty-state" id="dailylogEmpty"><p>No ${escapeHtml(L.entryNoun)}s yet.</p><button class="btn-ghost" data-sample="dailylog">Load sample entries</button></div>`;
    rebindSampleButton(wrap);
    return;
  }
  const rows = [...data.entries].sort((a, b) => (a.date < b.date ? 1 : -1)).map((e) => `
      <tr><td>${escapeHtml(e.date)}</td><td>${escapeHtml(e.weather || "—")}</td><td>${escapeHtml(e.crew || "—")}</td>
      <td>${escapeHtml(e.workPerformed || "—")}</td><td>${escapeHtml(e.delays || "None")}</td>
      <td class="col-delete"><button class="row-delete-btn" data-del="dailylog:${e.id}" title="Delete entry">×</button></td></tr>`).join("");
  wrap.innerHTML = `<table class="log-table"><thead><tr><th>Date</th><th>${escapeHtml(L.weatherLabel)}</th><th>${escapeHtml(L.crewLabel)}</th><th>Work Performed</th><th>${escapeHtml(L.delaysLabel)}</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ===== Submittals & RFI rendering =====
function renderSubmittals(data) {
  state.submittals = data;
  const wrap = document.getElementById("submittalsWrap");
  const L = labelsFor("submittals");
  if (!data || !data.items || !data.items.length) {
    wrap.innerHTML = `<div class="empty-state" id="submittalsEmpty"><p>No ${L.tabLabel.toLowerCase()} logged yet.</p><button class="btn-ghost" data-sample="submittals">Load a sample log</button></div>`;
    rebindSampleButton(wrap);
    return;
  }
  const rows = data.items.map((item) => `
      <tr><td><span class="log-badge type-${slug(item.type)}">${escapeHtml(item.number)}</span></td>
      <td>${escapeHtml(item.subject)}</td><td>${escapeHtml(item.ballInCourt || "—")}</td><td>${escapeHtml(item.dueDate || "—")}</td>
      <td>${statusRadioGroup("submittals", item.id, ["Open", "Answered", "Approved", "Rejected", "Revise & Resubmit"], item.status)}</td>
      <td class="col-delete"><button class="row-delete-btn" data-del="submittals:${item.id}" title="Delete item">×</button></td></tr>`).join("");
  wrap.innerHTML = `<table class="log-table"><thead><tr><th>${escapeHtml(L.numberLabel)}</th><th>Subject</th><th>${escapeHtml(L.ballLabel)}</th><th>Due</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ===== Punch List rendering =====
function renderPunchlist(data) {
  state.punchlist = data;
  const wrap = document.getElementById("punchlistWrap");
  const L = labelsFor("punchlist");
  if (!data || !data.items || !data.items.length) {
    wrap.innerHTML = `<div class="empty-state" id="punchlistEmpty"><p>No ${L.tabLabel.toLowerCase()} yet.</p><button class="btn-ghost" data-sample="punchlist">Load a sample list</button></div>`;
    rebindSampleButton(wrap);
    return;
  }
  const rows = data.items.map((item) => `
      <tr><td>${escapeHtml(item.location)}</td><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.trade || "—")}</td>
      <td>${escapeHtml(item.assignedTo || "—")}</td><td>${statusRadioGroup("punchlist", item.id, ["Open", "In Progress", "Complete", "Verified"], item.status)}</td>
      <td class="col-delete"><button class="row-delete-btn" data-del="punchlist:${item.id}" title="Delete item">×</button></td></tr>`).join("");
  wrap.innerHTML = `<table class="log-table"><thead><tr><th>${escapeHtml(L.locationLabel)}</th><th>Description</th><th>${escapeHtml(L.tradeLabel)}</th><th>Assigned To</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ===== Team & Timesheets rendering =====
function renderTeam() {
  const wrap = document.getElementById("teamWrap");
  if (!wrap) return;
  const members = (state.team && state.team.members) || [];
  const entries = (state.timesheets && state.timesheets.entries) || [];

  const rosterRows = members.length
    ? members.map((m) => `
      <tr><td>${escapeHtml(m.name)}</td><td>${escapeHtml(m.role || "—")}</td>
      <td class="col-delete"><button class="row-delete-btn" data-del="teammember:${m.id}" title="Remove member">×</button></td></tr>`).join("")
    : `<tr><td colspan="3" style="color:var(--text-faint)">No crew added yet.</td></tr>`;

  const sortedEntries = [...entries].sort((a, b) => (a.date < b.date ? 1 : -1));
  const timesheetRows = sortedEntries.length
    ? sortedEntries.map((t) => `
      <tr><td>${escapeHtml(t.memberName)}</td><td>${escapeHtml(t.date)}</td><td>${escapeHtml(t.taskName || "—")}</td><td>${t.hours}</td>
      <td class="col-delete"><button class="row-delete-btn" data-del="timesheet:${t.id}" title="Delete entry">×</button></td></tr>`).join("")
    : `<tr><td colspan="5" style="color:var(--text-faint)">No hours logged yet.</td></tr>`;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const workloadMap = {};
  members.forEach((m) => { workloadMap[m.name] = 0; });
  entries.forEach((t) => {
    const d = new Date(t.date);
    if (d >= weekAgo && d <= now) workloadMap[t.memberName] = (workloadMap[t.memberName] || 0) + Number(t.hours || 0);
  });
  const workloadRows = members.length
    ? members.map((m) => {
        const hrs = workloadMap[m.name] || 0;
        const pct = Math.min(100, (hrs / 40) * 100);
        const cls = hrs > 45 ? "bad" : hrs > 40 ? "warn" : "";
        return `<div class="workload-row"><div class="workload-name">${escapeHtml(m.name)}</div>
          <div class="workload-bar-track"><div class="workload-bar-fill ${cls}" style="width:${pct}%"></div></div>
          <div class="workload-hours">${hrs}h / 40h</div></div>`;
      }).join("")
    : `<p style="color:var(--text-faint); font-size:13px; margin:0;">Add crew members to see weekly workload.</p>`;

  wrap.innerHTML = `
    <div class="team-panel">
      <h2>Crew</h2>
      <table class="log-table"><thead><tr><th>Name</th><th>Role</th><th></th></tr></thead><tbody>${rosterRows}</tbody></table>
    </div>
    <div class="team-panel">
      <h2>Weekly Workload (last 7 days)</h2>
      ${workloadRows}
    </div>
    <div class="team-panel">
      <h2>Timesheets</h2>
      <table class="log-table"><thead><tr><th>Member</th><th>Date</th><th>Task</th><th>Hours</th><th></th></tr></thead><tbody>${timesheetRows}</tbody></table>
    </div>
  `;
}

// ===== Budget rendering =====
function renderBudget(data) {
  state.budget = data;
  const wrap = document.getElementById("budgetWrap");
  if (!data || !data.items || !data.items.length) {
    wrap.innerHTML = `<div class="empty-state" id="budgetEmpty"><p>No budget line items yet.</p><button class="btn-ghost" data-sample="budget">Load a sample budget</button></div>`;
    rebindSampleButton(wrap);
    return;
  }
  const rows = data.items.map((item) => {
    const variance = item.actual - item.estimated;
    const varClass = item.actual === 0 ? "" : variance > 0 ? "cost-over" : "cost-under";
    const varText = item.actual === 0 ? "—" : `${variance > 0 ? "+" : ""}$${variance.toLocaleString("en-US")}`;
    return `<tr><td>${escapeHtml(item.category || "—")}</td><td>${escapeHtml(item.description)}</td>
      <td>$${Number(item.estimated).toLocaleString("en-US")}</td><td>${item.actual ? "$" + Number(item.actual).toLocaleString("en-US") : "—"}</td>
      <td class="${varClass}">${varText}</td>
      <td class="col-delete"><button class="row-delete-btn" data-del="budget:${item.id}" title="Delete item">×</button></td></tr>`;
  }).join("");
  const totalEst = data.items.reduce((n, i) => n + Number(i.estimated || 0), 0);
  const totalAct = data.items.reduce((n, i) => n + Number(i.actual || 0), 0);
  const totalVar = totalAct - totalEst;
  wrap.innerHTML = `
    <table class="log-table">
      <thead><tr><th>Category</th><th>Description</th><th>Estimated</th><th>Actual</th><th>Variance</th><th></th></tr></thead>
      <tbody>${rows}
        <tr class="totals-row"><td colspan="2">TOTAL</td><td>$${totalEst.toLocaleString("en-US")}</td><td>$${totalAct.toLocaleString("en-US")}</td>
        <td class="${totalVar > 0 ? "cost-over" : totalVar < 0 ? "cost-under" : ""}">${totalVar === 0 ? "—" : (totalVar > 0 ? "+" : "") + "$" + totalVar.toLocaleString("en-US")}</td><td></td></tr>
      </tbody>
    </table>`;
}

// ===== Site Ops: management view (Materials / Attendance / Machinery) =====
function renderSiteOps() {
  const wrap = document.getElementById("siteopsWrap");
  if (!wrap) return;
  const L = labelsFor("siteops");
  const materials = (state.materials && state.materials.items) || [];
  const records = (state.attendance && state.attendance.records) || [];
  const machines = (state.machinery && state.machinery.items) || [];

  const materialRows = materials.length
    ? materials.map((m) => {
        const pct = m.delivered > 0 ? Math.round((m.used / m.delivered) * 100) : 0;
        return `<tr><td>${escapeHtml(m.name)}</td><td>${m.used} / ${m.delivered} <span class="unit-tag">${escapeHtml(m.unit)}</span></td><td>${pct}%</td>
          <td class="col-delete"><button class="row-delete-btn" data-del="material:${m.id}" title="Delete material">×</button></td></tr>`;
      }).join("")
    : `<tr><td colspan="4" style="color:var(--text-faint)">No materials added yet.</td></tr>`;

  const sortedRecords = [...records].sort((a, b) => (a.date < b.date ? 1 : -1));
  const attendanceRows = sortedRecords.length
    ? sortedRecords.map((r) => `<tr><td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.memberName)}</td>
        <td>${statusRadioGroup("attendance", r.id, ["Present", "Absent"], r.status)}</td>
        <td class="col-delete"><button class="row-delete-btn" data-del="attendance:${r.id}" title="Delete record">×</button></td></tr>`).join("")
    : `<tr><td colspan="4" style="color:var(--text-faint)">No attendance recorded yet.</td></tr>`;

  const machineRows = machines.length
    ? machines.map((m) => `<tr><td>${escapeHtml(m.name)}</td><td>${escapeHtml(m.type || "—")}</td>
        <td>${statusRadioGroup("machine", m.id, ["Available", "In Use", "Down"], m.status)}</td>
        <td class="col-delete"><button class="row-delete-btn" data-del="machine:${m.id}" title="Delete machine">×</button></td></tr>`).join("")
    : `<tr><td colspan="4" style="color:var(--text-faint)">No machinery added yet.</td></tr>`;

  wrap.innerHTML = `
    <div class="team-panel">
      <h2>${escapeHtml(L.materialsLabel)}</h2>
      <table class="log-table"><thead><tr><th>Item</th><th>Used / Delivered</th><th>Usage</th><th></th></tr></thead><tbody>${materialRows}</tbody></table>
    </div>
    <div class="team-panel">
      <h2>${escapeHtml(L.attendanceLabel)}</h2>
      <table class="log-table"><thead><tr><th>Date</th><th>Team Member</th><th>Status</th><th></th></tr></thead><tbody>${attendanceRows}</tbody></table>
    </div>
    <div class="team-panel">
      <h2>${escapeHtml(L.machineryLabel)}</h2>
      <table class="log-table"><thead><tr><th>Name / ID</th><th>Type</th><th>Status</th><th></th></tr></thead><tbody>${machineRows}</tbody></table>
    </div>
  `;
}

// ===== Site Ops: live view embedded on the Dashboard (Design B) =====
function renderSiteOpsLive() {
  const wrap = document.getElementById("siteopsLiveWrap");
  if (!wrap) return;
  const materials = (state.materials && state.materials.items) || [];
  const records = (state.attendance && state.attendance.records) || [];
  const machines = (state.machinery && state.machinery.items) || [];
  const members = (state.team && state.team.members) || [];
  const L = labelsFor("siteops");

  const today = todayISO();
  const todayRecords = records.filter((r) => r.date === today);
  const presentToday = todayRecords.filter((r) => r.status === "Present").length;
  const totalForToday = todayRecords.length || members.length;
  const attendancePct = totalForToday > 0 ? Math.round((presentToday / totalForToday) * 100) : 0;
  const circumference = 238.7;
  const dashoffset = circumference - (circumference * attendancePct) / 100;

  wrap.innerHTML = `
    <div class="live-gauge-card">
      <div class="stat-label">${escapeHtml(L.attendanceLabel)} today</div>
      <svg width="90" height="90" viewBox="0 0 90 90" style="margin:0 auto;display:block;">
        <circle cx="45" cy="45" r="38" fill="none" stroke="#3E3E44" stroke-width="8"/>
        <circle cx="45" cy="45" r="38" fill="none" stroke="#4CAF6D" stroke-width="8" stroke-dasharray="${circumference}" stroke-dashoffset="${dashoffset}" stroke-linecap="round" transform="rotate(-90 45 45)"/>
        <text x="45" y="41" text-anchor="middle" fill="#ECECEA" font-family="'Bebas Neue',sans-serif" font-size="20">${attendancePct}%</text>
        <text x="45" y="57" text-anchor="middle" fill="#6B6B72" font-family="'IBM Plex Mono',monospace" font-size="9">${presentToday}/${totalForToday || 0}</text>
      </svg>
      <div class="gauge-sub">${totalForToday ? (totalForToday - presentToday) + " absent" : "No records for today"}</div>
    </div>
    <div class="live-panel">
      <div class="stat-label">${escapeHtml(L.materialsLabel)}</div>
      ${materials.length ? `<div style="position:relative;height:190px;"><canvas id="materialUsageChart" role="img" aria-label="${escapeHtml(L.materialsLabel)} by percentage with unit amounts"></canvas></div>` : `<p style="color:var(--text-faint); font-size:13px; margin:0;">Nothing added yet — use the ${escapeHtml(L.tabLabel)} tab.</p>`}
    </div>
    <div class="live-panel">
      <div class="stat-label">${escapeHtml(L.machineryLabel)}</div>
      <div>${machines.length ? machines.map((m) => `
        <div class="machinery-status-row">
          <span class="machinery-dot ${slug(m.status)}"></span>
          <span class="m-name">${escapeHtml(m.name)}${m.type ? " · " + escapeHtml(m.type) : ""}</span>
          <span class="m-status">${escapeHtml(m.status)}</span>
        </div>`).join("") : `<p style="color:var(--text-faint); font-size:13px; margin:0;">Nothing added yet.</p>`}
      </div>
    </div>
  `;

  if (materials.length) {
    const canvas = document.getElementById("materialUsageChart");
    const labels = materials.map((m) => m.name);
    const pcts = materials.map((m) => (m.delivered > 0 ? Math.round((m.used / m.delivered) * 100) : 0));
    const unitLabels = materials.map((m) => `${m.used}/${m.delivered} ${m.unit}`);
    if (materialChartInstance) materialChartInstance.destroy();
    materialChartInstance = new Chart(canvas.getContext("2d"), {
      type: "bar",
      data: { labels, datasets: [{ data: pcts, backgroundColor: "#F2B705", borderRadius: 2, maxBarThickness: 16 }] },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.x}% used (${unitLabels[ctx.dataIndex]})` } },
        },
        scales: {
          x: { min: 0, max: 100, ticks: { color: "#6B6B72", font: { size: 10 }, callback: (v) => v + "%" }, grid: { color: "rgba(255,255,255,0.05)" } },
          y: { ticks: { color: "#ECECEA", font: { size: 11 } }, grid: { display: false } },
        },
      },
    });
  }
}

document.getElementById("dashAutoRefresh").addEventListener("click", function () {
  const on = this.dataset.on === "1";
  if (on) {
    clearInterval(dashAutoRefreshTimer);
    dashAutoRefreshTimer = null;
    this.dataset.on = "0";
    this.textContent = "⟳ Auto-refresh: Off";
  } else {
    dashAutoRefreshTimer = setInterval(() => { renderDashboard(); renderSiteOpsLive(); }, 15000);
    this.dataset.on = "1";
    this.textContent = "⟳ Auto-refresh: On (15s)";
  }
});

// ===== Excel template download & upload (SheetJS) =====
document.getElementById("btnDownloadTemplate").addEventListener("click", () => {
  const L = labelsFor("siteops");
  const isConstruction = currentIndustry() === "construction";
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    isConstruction ? { Name: "Concrete", Unit: "cu yd", Delivered: 500, Used: 410 } : { Name: "Item", Unit: "units", Delivered: 100, Used: 40 }
  ]), L.materialsLabel);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Date: todayISO(), "Member Name": "John Smith", Status: "Present" }]), L.attendanceLabel);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    isConstruction ? { Name: "EX-102", Type: "Excavator", Status: "In Use" } : { Name: "Item", Type: "Type", Status: "Available" }
  ]), L.machineryLabel);
  XLSX.writeFile(wb, "trackline-site-ops-template.xlsx");
});

document.getElementById("btnUploadSheet").addEventListener("click", () => document.getElementById("sheetUploadInput").click());
document.getElementById("sheetUploadInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const L = labelsFor("siteops");
  if (!confirm(`This will replace your current ${L.materialsLabel}, ${L.attendanceLabel}, and ${L.machineryLabel} data with whatever is in this sheet's matching tabs. Continue?`)) {
    e.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const wb = XLSX.read(evt.target.result, { type: "binary" });
      ensureCollection("material"); ensureCollection("attendance"); ensureCollection("machine");
      if (wb.SheetNames.includes(L.materialsLabel)) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[L.materialsLabel]);
        state.materials.items = rows.map((r, i) => ({ id: "mt" + Date.now() + i, name: String(r.Name || ""), unit: String(r.Unit || "units"), delivered: Number(r.Delivered) || 0, used: Number(r.Used) || 0 })).filter((m) => m.name);
      }
      if (wb.SheetNames.includes(L.attendanceLabel)) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[L.attendanceLabel]);
        state.attendance.records = rows.map((r, i) => ({ id: "at" + Date.now() + i, date: String(r.Date || todayISO()), memberName: String(r["Member Name"] || ""), status: String(r.Status || "Present") })).filter((a) => a.memberName);
      }
      if (wb.SheetNames.includes(L.machineryLabel)) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[L.machineryLabel]);
        state.machinery.items = rows.map((r, i) => ({ id: "mc" + Date.now() + i, name: String(r.Name || ""), type: String(r.Type || ""), status: String(r.Status || "Available") })).filter((m) => m.name);
      }
      renderSiteOps();
      renderSiteOpsLive();
      persistActiveProject();
      setTicker(`${L.tabLabel.toUpperCase()} DATA IMPORTED FROM SPREADSHEET`, true);
      triggerPropagationCheck(`Imported ${L.tabLabel} data (${L.materialsLabel}, ${L.attendanceLabel}, and/or ${L.machineryLabel}) via spreadsheet, replacing what was there.`);
    } catch (err) {
      alert(`Couldn't read that file — make sure it's an .xlsx export with ${L.materialsLabel}, ${L.attendanceLabel}, and/or ${L.machineryLabel} tabs matching the template.`);
    }
    e.target.value = "";
  };
  reader.readAsBinaryString(file);
});

// ===== Generic Excel template/upload for every other tab =====
const MODULE_SCHEMAS = {
  gantt: {
    sheet: "Schedule",
    sample: [{ Name: "Framing", Start: "2026-09-07", End: "2026-09-27", Progress: 0 }],
    setRows: (rows) => { state.gantt = rows.map((r, i) => ({ id: i + 1, name: String(r.Name || ""), start: String(r.Start || todayISO()), end: String(r.End || todayISO()), progress: Number(r.Progress) || 0 })).filter((t) => t.name); },
    afterSet: () => renderGantt(state.gantt),
  },
  burndown: {
    sheet: "Burndown",
    sample: [{ Day: 0, Planned: 60, Actual: 60 }],
    setRows: (rows) => { state.burndown = { days: rows.map((r) => ({ day: Number(r.Day) || 0, ideal: Number(r.Planned) || 0, actual: Number(r.Actual) || 0 })) }; },
    afterSet: () => renderBurndown(state.burndown),
  },
  kanban: {
    sheet: "Site Tasks",
    sample: [{ Column: "To Do", Card: "Pour footings" }],
    setRows: (rows) => {
      const cols = {};
      rows.forEach((r) => {
        const colName = String(r.Column || "To Do");
        if (!cols[colName]) cols[colName] = [];
        if (r.Card) cols[colName].push({ id: "c" + Date.now() + Math.random().toString(36).slice(2, 6), title: String(r.Card) });
      });
      const names = Object.keys(cols).length ? Object.keys(cols) : ["To Do", "In Progress", "Done"];
      state.kanban = { columns: names.map((n) => ({ name: n, cards: cols[n] || [] })) };
    },
    afterSet: () => renderKanban(state.kanban),
  },
  raid: {
    sheet: "RAID",
    sample: [{ Type: "Risk", Description: "Steel delivery could slip", Owner: "PM", Impact: "High", Status: "Open" }],
    setRows: (rows) => { state.raid = { items: rows.map((r, i) => ({ id: "r" + Date.now() + i, type: String(r.Type || "Risk"), description: String(r.Description || ""), owner: String(r.Owner || ""), impact: String(r.Impact || "Medium"), status: String(r.Status || "Open") })).filter((x) => x.description) }; },
    afterSet: () => renderRaid(state.raid),
  },
  dailylog: {
    sheet: "Daily Log",
    sample: [{ Date: todayISO(), Weather: "Clear, 75°F", Crew: "8 (Framing crew)", "Work Performed": "...", Delays: "None" }],
    setRows: (rows) => { state.dailylog = { entries: rows.map((r, i) => ({ id: "d" + Date.now() + i, date: String(r.Date || todayISO()), weather: String(r.Weather || ""), crew: String(r.Crew || ""), workPerformed: String(r["Work Performed"] || ""), delays: String(r.Delays || "None") })) }; },
    afterSet: () => renderDailyLog(state.dailylog),
  },
  submittals: {
    sheet: "Submittals",
    sample: [{ Number: "RFI-014", Type: "RFI", Subject: "...", "Ball-in-Court": "Architect", "Due Date": todayISO(), Status: "Open" }],
    setRows: (rows) => { state.submittals = { items: rows.map((r, i) => ({ id: "s" + Date.now() + i, number: String(r.Number || ""), type: String(r.Type || "RFI"), subject: String(r.Subject || ""), ballInCourt: String(r["Ball-in-Court"] || ""), dueDate: String(r["Due Date"] || ""), status: String(r.Status || "Open") })).filter((x) => x.number) }; },
    afterSet: () => renderSubmittals(state.submittals),
  },
  punchlist: {
    sheet: "Punch List",
    sample: [{ Location: "Unit 204", Description: "Touch up paint", Trade: "Painting", "Assigned To": "ABC Painting Co.", Status: "Open" }],
    setRows: (rows) => { state.punchlist = { items: rows.map((r, i) => ({ id: "p" + Date.now() + i, location: String(r.Location || ""), description: String(r.Description || ""), trade: String(r.Trade || ""), assignedTo: String(r["Assigned To"] || ""), status: String(r.Status || "Open") })).filter((x) => x.location) }; },
    afterSet: () => renderPunchlist(state.punchlist),
  },
  team: {
    sheet: "Team",
    sample: [{ Name: "John Smith", Role: "Site Superintendent" }],
    setRows: (rows) => { state.team = { members: rows.map((r, i) => ({ id: "m" + Date.now() + i, name: String(r.Name || ""), role: String(r.Role || "") })).filter((x) => x.name) }; },
    afterSet: () => renderTeam(),
  },
  budget: {
    sheet: "Budget",
    sample: [{ Category: "Concrete", Description: "Foundation & footings", Estimated: 62000, Actual: 0 }],
    setRows: (rows) => { state.budget = { items: rows.map((r, i) => ({ id: "b" + Date.now() + i, category: String(r.Category || ""), description: String(r.Description || ""), estimated: Number(r.Estimated) || 0, actual: Number(r.Actual) || 0 })).filter((x) => x.description) }; },
    afterSet: () => renderBudget(state.budget),
  },
  crashing: {
    sheet: "Crashing",
    sample: [{ Task: "Framing", "Normal Duration": 20, "Crash Duration": 14, "Normal Cost": 95000, "Crash Cost": 122000 }],
    setRows: (rows) => { state.crashing = { items: rows.map((r, i) => ({ id: "cx" + Date.now() + i, taskName: String(r.Task || ""), normalDuration: Number(r["Normal Duration"]) || 0, crashDuration: Number(r["Crash Duration"]) || 0, normalCost: Number(r["Normal Cost"]) || 0, crashCost: Number(r["Crash Cost"]) || 0 })).filter((x) => x.taskName) }; },
    afterSet: () => renderCrashing(),
  },
  wbs: {
    sheet: "WBS",
    sample: [{ Phase: "Structure", "Work Package": "Foundation" }, { Phase: "Structure", "Work Package": "Framing" }],
    setRows: (rows) => {
      const phaseMap = {};
      let phaseNum = 0;
      rows.forEach((r) => {
        const phaseName = String(r.Phase || "").trim();
        if (!phaseName) return;
        if (!phaseMap[phaseName]) { phaseNum++; phaseMap[phaseName] = { id: "ph" + Date.now() + phaseNum, code: String(phaseNum), name: phaseName, items: [] }; }
        const wpName = String(r["Work Package"] || "").trim();
        if (wpName) { const ph = phaseMap[phaseName]; ph.items.push({ id: "wi" + Date.now() + ph.items.length + Math.random().toString(36).slice(2, 5), code: `${ph.code}.${ph.items.length + 1}`, name: wpName }); }
      });
      state.wbs = { phases: Object.values(phaseMap) };
    },
    afterSet: () => renderWbs(),
  },
  inventory: {
    sheet: "Inventory",
    sample: [{ Name: "2x4 Studs", Category: "Lumber", Quantity: 340, Unit: "pieces", "Reorder Level": 100, Location: "Yard A" }],
    setRows: (rows) => { state.inventory = { items: rows.map((r, i) => ({ id: "iv" + Date.now() + i, name: String(r.Name || ""), category: String(r.Category || ""), quantity: Number(r.Quantity) || 0, unit: String(r.Unit || "units"), reorderLevel: Number(r["Reorder Level"]) || 0, location: String(r.Location || "") })).filter((x) => x.name) }; },
    afterSet: () => renderInventory(),
  },
  charter: {
    sheet: "Charter",
    sample: [{ Purpose: "...", Objectives: "...", Scope: "...", Stakeholders: "...", Sponsor: "...", Milestones: "...", "Success Criteria": "...", "Approved By": "..." }],
    setRows: (rows) => {
      const r = rows[0] || {};
      state.charter = { purpose: String(r.Purpose || ""), objectives: String(r.Objectives || ""), scope: String(r.Scope || ""), stakeholders: String(r.Stakeholders || ""), sponsor: String(r.Sponsor || ""), milestones: String(r.Milestones || ""), successCriteria: String(r["Success Criteria"] || ""), approvedBy: String(r["Approved By"] || "") };
    },
    afterSet: () => renderCharter(),
  },
  findings: {
    sheet: "Findings",
    sample: [{ Finding: "Price sensitivity is highest among first-time buyers", Theme: "Pricing", Evidence: "68% of Q3 respondents cited price as the top barrier", Implication: "Consider a lower-priced entry tier" }],
    setRows: (rows) => { state.findings = { items: rows.map((r, i) => ({ id: "fnd" + Date.now() + i, finding: String(r.Finding || ""), theme: String(r.Theme || ""), evidence: String(r.Evidence || ""), implication: String(r.Implication || "") })).filter((x) => x.finding) }; },
    afterSet: () => renderFindings(),
  },
  billing: {
    sheet: "Billing",
    sample: [{ Date: todayISO(), Consultant: "J. Alvarez", Workstream: "Market sizing", Hours: 4, Billable: "yes", Rate: 150 }],
    setRows: (rows) => { state.billing = { entries: rows.map((r, i) => ({ id: "bh" + Date.now() + i, date: String(r.Date || todayISO()), consultant: String(r.Consultant || ""), workstream: String(r.Workstream || ""), hours: Number(r.Hours) || 0, billable: String(r.Billable || "yes").toLowerCase() !== "no", rate: Number(r.Rate) || 0 })).filter((x) => x.consultant) }; },
    afterSet: () => renderBilling(),
  },
};

document.querySelectorAll("[data-xl-template]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const schema = MODULE_SCHEMAS[btn.dataset.xlTemplate];
    if (!schema) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(schema.sample), schema.sheet);
    XLSX.writeFile(wb, `trackline-${btn.dataset.xlTemplate}-template.xlsx`);
  });
});

let pendingXlUploadType = null;
document.querySelectorAll("[data-xl-upload]").forEach((btn) => {
  btn.addEventListener("click", () => {
    pendingXlUploadType = btn.dataset.xlUpload;
    document.getElementById("genericXlUploadInput").click();
  });
});
document.getElementById("genericXlUploadInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  const type = pendingXlUploadType;
  if (!file || !type) { e.target.value = ""; return; }
  const schema = MODULE_SCHEMAS[type];
  if (!schema) { e.target.value = ""; return; }
  if (!confirm(`This will replace the current ${schema.sheet} data with whatever is in this sheet. Continue?`)) { e.target.value = ""; return; }
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const wb = XLSX.read(evt.target.result, { type: "binary" });
      const sheetName = wb.SheetNames.includes(schema.sheet) ? schema.sheet : wb.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
      schema.setRows(rows);
      schema.afterSet();
      renderDashboard();
      renderSiteOpsLive();
      persistActiveProject();
      setTicker(`${schema.sheet.toUpperCase()} DATA IMPORTED FROM SPREADSHEET`, true);
      triggerPropagationCheck(`Imported ${schema.sheet} data via spreadsheet, replacing what was there.`);
    } catch (err) {
      alert(`Couldn't read that file — make sure it's an .xlsx export with a "${schema.sheet}" tab matching the template.`);
    }
    e.target.value = "";
    pendingXlUploadType = null;
  };
  reader.readAsBinaryString(file);
});

// ===== Project Charter (single-record form) =====
const CHARTER_FIELDS = [
  { id: "purpose", label: "Purpose / Justification", type: "textarea" },
  { id: "objectives", label: "Objectives", type: "textarea" },
  { id: "scope", label: "Scope (in / out)", type: "textarea" },
  { id: "stakeholders", label: "Key Stakeholders", type: "textarea" },
  { id: "sponsor", label: "Sponsor", type: "text" },
  { id: "milestones", label: "High-Level Milestones", type: "textarea" },
  { id: "successCriteria", label: "Success Criteria", type: "textarea" },
  { id: "approvedBy", label: "Approved By", type: "text" },
];
function renderCharter() {
  const wrap = document.getElementById("charterWrap");
  if (!wrap) return;
  const c = state.charter || {};
  wrap.innerHTML = `<div class="charter-grid">${CHARTER_FIELDS.map((f) => `
    <div class="charter-field" style="${f.type === "textarea" ? "grid-column: 1 / -1;" : ""}">
      <label for="charter-${f.id}">${f.label}</label>
      ${f.type === "textarea"
        ? `<textarea id="charter-${f.id}" rows="3">${escapeHtml(c[f.id] || "")}</textarea>`
        : `<input type="text" id="charter-${f.id}" value="${escapeHtml(c[f.id] || "")}">`}
    </div>`).join("")}</div>`;
}
document.getElementById("charterSave").addEventListener("click", () => {
  const c = {};
  CHARTER_FIELDS.forEach((f) => { c[f.id] = document.getElementById(`charter-${f.id}`).value; });
  state.charter = c;
  persistActiveProject();
  setTicker("PROJECT CHARTER SAVED", true);
});

// ===== Project Crashing (cheapest tasks to compress) =====
function renderCrashing() {
  const wrap = document.getElementById("crashingWrap");
  if (!wrap) return;
  const items = (state.crashing && state.crashing.items) || [];
  if (!items.length) {
    wrap.innerHTML = `<div class="empty-state" id="crashingEmpty"><p>No crashing analysis yet.</p><button class="btn-ghost" data-sample="crashing">Load a sample analysis</button></div>`;
    rebindSampleButton(wrap);
    return;
  }
  const withSlope = items.map((it) => {
    const timeSaved = it.normalDuration - it.crashDuration;
    const costIncrease = it.crashCost - it.normalCost;
    const slope = timeSaved > 0 ? costIncrease / timeSaved : null;
    return { ...it, timeSaved, costIncrease, slope };
  });
  const ranked = [...withSlope].filter((i) => i.slope !== null).sort((a, b) => a.slope - b.slope);
  const top3Ids = new Set(ranked.slice(0, 3).map((i) => i.id));
  const rows = withSlope.map((it) => `
      <tr>
        <td>${escapeHtml(it.taskName)}${top3Ids.has(it.id) ? ' <span class="crash-recommend">Focus here</span>' : ""}</td>
        <td>${it.normalDuration}d → ${it.crashDuration}d (${it.timeSaved}d saved)</td>
        <td>$${it.normalCost.toLocaleString("en-US")} → $${it.crashCost.toLocaleString("en-US")}</td>
        <td class="${it.slope !== null ? "crash-slope-good" : ""}">${it.slope !== null ? "$" + Math.round(it.slope).toLocaleString("en-US") + "/day" : "—"}</td>
        <td class="col-delete"><button class="row-delete-btn" data-del="crashing:${it.id}" title="Delete task">×</button></td>
      </tr>`).join("");
  wrap.innerHTML = `
    <p class="dash-empty-note" style="margin-bottom:12px;">Cost slope = extra cost ÷ days saved. Lowest cost-per-day-saved tasks are the cheapest to compress first — marked "Focus here."</p>
    <table class="log-table"><thead><tr><th>Task</th><th>Duration (normal → crash)</th><th>Cost (normal → crash)</th><th>Cost / Day Saved</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ===== Work Breakdown Structure =====
function renderWbs() {
  const wrap = document.getElementById("wbsWrap");
  if (!wrap) return;
  const phases = (state.wbs && state.wbs.phases) || [];
  if (!phases.length) {
    wrap.innerHTML = `<div class="empty-state" id="wbsEmpty"><p>No WBS yet.</p><button class="btn-ghost" data-sample="wbs">Load a sample WBS</button></div>`;
    rebindSampleButton(wrap);
    return;
  }
  wrap.innerHTML = `<div class="team-panel">${phases.map((p) => `
    <div style="margin-bottom:14px;">
      <div class="wbs-phase"><span class="wbs-code">${escapeHtml(p.code)}</span>${escapeHtml(p.name)}
        <button class="row-delete-btn" data-del="wbsphase:${p.id}" title="Delete phase" style="margin-left:8px;">×</button>
      </div>
      ${(p.items || []).map((it) => `
        <div class="wbs-item"><span class="wbs-code">${escapeHtml(it.code)}</span>${escapeHtml(it.name)}
          <button class="row-delete-btn" data-del="wbsitem:${it.id}" title="Delete work package" style="margin-left:8px;">×</button>
        </div>`).join("") || `<div class="wbs-item" style="color:var(--text-faint)">No work packages yet.</div>`}
    </div>`).join("")}</div>`;
}

// ===== Inventory =====
function renderInventory() {
  const wrap = document.getElementById("inventoryWrap");
  if (!wrap) return;
  const L = labelsFor("inventory");
  const items = (state.inventory && state.inventory.items) || [];
  if (!items.length) {
    wrap.innerHTML = `<div class="empty-state" id="inventoryEmpty"><p>No ${L.h1.toLowerCase()} yet.</p><button class="btn-ghost" data-sample="inventory">Load sample ${L.h1.toLowerCase()}</button></div>`;
    rebindSampleButton(wrap);
    return;
  }
  const rows = items.map((it) => {
    const low = it.quantity <= it.reorderLevel;
    return `<tr><td>${escapeHtml(it.name)}</td><td>${escapeHtml(it.category || "—")}</td>
      <td class="${low ? "stock-low" : ""}">${it.quantity} ${escapeHtml(it.unit)}${low ? " ⚠" : ""}</td>
      <td>${it.reorderLevel} ${escapeHtml(it.unit)}</td><td>${escapeHtml(it.location || "—")}</td>
      <td class="col-delete"><button class="row-delete-btn" data-del="inventory:${it.id}" title="Delete item">×</button></td></tr>`;
  }).join("");
  wrap.innerHTML = `<table class="log-table"><thead><tr><th>Item</th><th>Category</th><th>On Hand</th><th>Reorder Level</th><th>Location</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ===== Research Findings (Marketing Research) =====
function renderFindings() {
  const wrap = document.getElementById("findingsWrap");
  if (!wrap) return;
  const items = (state.findings && state.findings.items) || [];
  if (!items.length) {
    wrap.innerHTML = `<div class="empty-state" id="findingsEmpty"><p>No findings logged yet.</p><button class="btn-ghost" data-sample="findings">Load sample findings</button></div>`;
    rebindSampleButton(wrap);
    return;
  }
  const rows = items.map((it) => `<tr>
      <td>${escapeHtml(it.finding)}</td>
      <td>${it.theme ? `<span class="log-badge type-${slug(it.theme)}">${escapeHtml(it.theme)}</span>` : "—"}</td>
      <td>${escapeHtml(it.evidence || "—")}</td>
      <td>${escapeHtml(it.implication || "—")}</td>
      <td class="col-delete"><button class="row-delete-btn" data-del="findings:${it.id}" title="Delete finding">×</button></td></tr>`).join("");
  wrap.innerHTML = `<table class="log-table"><thead><tr><th>Finding</th><th>Theme</th><th>Evidence</th><th>Implication</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ===== Billable Hours (Consulting) =====
function renderBilling() {
  const wrap = document.getElementById("billingWrap");
  if (!wrap) return;
  const entries = (state.billing && state.billing.entries) || [];
  if (!entries.length) {
    wrap.innerHTML = `<div class="empty-state" id="billingEmpty"><p>No hours logged yet.</p><button class="btn-ghost" data-sample="billing">Load sample hours</button></div>`;
    rebindSampleButton(wrap);
    return;
  }
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? 1 : -1));
  let totalHours = 0, billableHours = 0, totalAmount = 0;
  const rows = sorted.map((e) => {
    const amount = e.billable ? e.hours * (e.rate || 0) : 0;
    totalHours += e.hours; if (e.billable) billableHours += e.hours; totalAmount += amount;
    return `<tr>
      <td>${escapeHtml(e.date)}</td><td>${escapeHtml(e.consultant)}</td><td>${escapeHtml(e.workstream || "—")}</td>
      <td>${e.hours}</td><td>${e.billable ? "Billable" : "Non-billable"}</td>
      <td>${e.billable ? "$" + amount.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}</td>
      <td class="col-delete"><button class="row-delete-btn" data-del="billing:${e.id}" title="Delete entry">×</button></td></tr>`;
  }).join("");
  const utilization = totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0;
  wrap.innerHTML = `
    <p class="dash-empty-note" style="margin-bottom:12px;">${totalHours}h logged · ${billableHours}h billable (${utilization}% utilization) · $${totalAmount.toLocaleString("en-US", { maximumFractionDigits: 2 })} billed</p>
    <table class="log-table"><thead><tr><th>Date</th><th>Consultant</th><th>Workstream</th><th>Hours</th><th>Billable?</th><th>Amount</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ===== Floor Plan (image upload + click-to-pin annotations) =====
function renderFloorPlan() {
  const wrap = document.getElementById("floorplanWrap");
  if (!wrap) return;
  const plans = (state.floorplan && state.floorplan.plans) || [];
  const FL = labelsFor("floorplan");
  const isConstruction = currentIndustry() === "construction";
  if (!plans.length) {
    wrap.innerHTML = `<div class="empty-state" id="floorplanEmpty"><p>No ${FL.tabLabel.toLowerCase()}s yet.</p><button class="btn-ghost" id="floorplanEmptyAdd">＋ Add ${FL.tabLabel}</button></div>`;
    const btn = document.getElementById("floorplanEmptyAdd");
    if (btn) btn.addEventListener("click", openFloorPlanModal);
    return;
  }
  wrap.innerHTML = plans.map((p) => {
    const isSchematic = p.type === "schematic";
    const widthFt = p.widthFt || 40, heightFt = p.heightFt || 25;
    const pinsHtml = (p.pins || []).map((pin) => `<span class="floorplan-pin" data-del="floorplanpin:${pin.id}" style="left:${pin.x}%; top:${pin.y}%;" title="${escapeHtml(pin.label)} (click to remove)"></span>`).join("");
    const canvasHtml = isSchematic
      ? `<div class="floorplan-image-holder floorplan-schematic" data-plan-id="${p.id}">
          ${(p.rooms || []).map((r) => {
            const dimHtml = isConstruction ? `<br><span class="floorplan-room-dim">${((r.width / 100) * widthFt).toFixed(1)}' × ${((r.height / 100) * heightFt).toFixed(1)}'</span>` : "";
            return `<div class="floorplan-room" data-room-id="${r.id}" style="left:${r.x}%; top:${r.y}%; width:${r.width}%; height:${r.height}%;">
              <button class="floorplan-room-delete" data-del="floorplanroom:${p.id}::${r.id}" title="Delete ${FL.unitNoun.toLowerCase()}">×</button>
              <div class="floorplan-room-label" title="Double-click to rename">${escapeHtml(r.name)}${dimHtml}</div>
              <div class="floorplan-room-handle" title="Drag to resize"></div>
            </div>`;
          }).join("")}
          ${(p.rooms || []).length === 0 ? `<div class="floorplan-schematic-empty">No ${FL.unitNounPlural.toLowerCase()} yet — click "＋ Add ${FL.unitNoun}" above, or ask the assistant.</div>` : ""}
          ${pinsHtml}
        </div>`
      : `<div class="floorplan-image-holder" data-plan-id="${p.id}">
          <img src="${p.imageDataUrl}" alt="${escapeHtml(p.name)}" draggable="false">
          ${pinsHtml}
        </div>`;
    const schematicTag = isSchematic
      ? (isConstruction
          ? ` <span class="crash-recommend">AI schematic — ${widthFt}' × ${heightFt}' overall (${(widthFt * heightFt).toLocaleString("en-US")} sq ft) · not to scale</span>`
          : ` <span class="crash-recommend">AI-drafted — not to scale</span>`)
      : "";
    return `
    <div class="floorplan-card">
      <div class="floorplan-card-head">
        <h2>${escapeHtml(p.name)}${schematicTag}</h2>
        <div style="display:flex; gap:8px; align-items:center;">
          ${isSchematic ? `<button class="btn-tiny" data-add-room="${p.id}">＋ Add ${escapeHtml(FL.unitNoun)}</button>` : ""}
          <button class="row-delete-btn" data-del="floorplan:${p.id}" title="Delete floor plan">×</button>
        </div>
      </div>
      ${canvasHtml}
      <div class="floorplan-pin-list">${(p.pins || []).map((pin, i) => `<span>#${i + 1}</span>${escapeHtml(pin.label)}`).join("<br>") || "No pins yet — click on the plan to add one."}</div>
    </div>`;
  }).join("");

  wrap.querySelectorAll("[data-add-room]").forEach((btn) => {
    btn.addEventListener("click", () => openAddRoomModal(btn.dataset.addRoom));
  });

  wrap.querySelectorAll(".floorplan-image-holder").forEach((holder) => {
    holder.addEventListener("click", (e) => {
      if (e.target.closest(".floorplan-pin") || e.target.closest(".floorplan-room")) return; // handled by their own listeners
      const planId = holder.dataset.planId;
      const rect = holder.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      const label = prompt("Label for this pin (e.g. a punch item or RFI location):");
      if (!label) return;
      const plan = state.floorplan.plans.find((p) => p.id === planId);
      if (plan) {
        plan.pins.push({ id: "pin" + Date.now(), x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, label });
        renderFloorPlan();
        persistActiveProject();
      }
    });
  });

  plans.filter((p) => p.type === "schematic").forEach((p) => attachFloorPlanRoomEvents(p));
}

function attachFloorPlanRoomEvents(plan) {
  const holder = document.querySelector(`.floorplan-schematic[data-plan-id="${plan.id}"]`);
  if (!holder) return;
  holder.querySelectorAll(".floorplan-room").forEach((roomEl) => {
    const roomId = roomEl.dataset.roomId;
    roomEl.addEventListener("click", (e) => {
      if (e.target.closest(".floorplan-room-delete")) return; // let this bubble to the global delete handler
      e.stopPropagation(); // otherwise don't let a click/drag on a room also drop a pin
    });

    roomEl.addEventListener("dblclick", (e) => {
      if (e.target.closest(".floorplan-room-delete") || e.target.closest(".floorplan-room-handle")) return;
      e.stopPropagation();
      const room = plan.rooms.find((r) => r.id === roomId);
      if (!room) return;
      const newName = prompt(`Rename ${labelsFor("floorplan").unitNoun.toLowerCase()}:`, room.name);
      if (!newName) return;
      room.name = newName;
      renderFloorPlan();
      persistActiveProject();
      triggerPropagationCheck(`Renamed a room to "${newName}" in floor plan "${plan.name}".`);
    });

    roomEl.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".floorplan-room-handle") || e.target.closest(".floorplan-room-delete")) return;
      const holderRect = holder.getBoundingClientRect();
      const room = plan.rooms.find((r) => r.id === roomId);
      if (!room) return;
      const startX = e.clientX, startY = e.clientY;
      const origX = room.x, origY = room.y;
      roomEl.setPointerCapture(e.pointerId);
      function clamp(x, y) {
        return { nx: Math.max(0, Math.min(100 - room.width, x)), ny: Math.max(0, Math.min(100 - room.height, y)) };
      }
      function onMove(ev) {
        const dxPct = ((ev.clientX - startX) / holderRect.width) * 100;
        const dyPct = ((ev.clientY - startY) / holderRect.height) * 100;
        const { nx, ny } = clamp(origX + dxPct, origY + dyPct);
        roomEl.style.left = nx + "%";
        roomEl.style.top = ny + "%";
      }
      function onUp(ev) {
        roomEl.releasePointerCapture(e.pointerId);
        roomEl.removeEventListener("pointermove", onMove);
        const dxPct = ((ev.clientX - startX) / holderRect.width) * 100;
        const dyPct = ((ev.clientY - startY) / holderRect.height) * 100;
        const { nx, ny } = clamp(origX + dxPct, origY + dyPct);
        room.x = Math.round(nx * 10) / 10;
        room.y = Math.round(ny * 10) / 10;
        renderFloorPlan();
        persistActiveProject();
        triggerPropagationCheck(`Moved the room "${room.name}" in floor plan "${plan.name}".`);
      }
      roomEl.addEventListener("pointermove", onMove);
      roomEl.addEventListener("pointerup", onUp, { once: true });
    });

    const handle = roomEl.querySelector(".floorplan-room-handle");
    if (!handle) return;
    handle.addEventListener("click", (e) => e.stopPropagation());
    handle.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      const holderRect = holder.getBoundingClientRect();
      const room = plan.rooms.find((r) => r.id === roomId);
      if (!room) return;
      const startX = e.clientX, startY = e.clientY;
      const origW = room.width, origH = room.height;
      handle.setPointerCapture(e.pointerId);
      function clampSize(w, h) {
        return { nw: Math.max(6, Math.min(100 - room.x, w)), nh: Math.max(6, Math.min(100 - room.y, h)) };
      }
      function onMove(ev) {
        const dwPct = ((ev.clientX - startX) / holderRect.width) * 100;
        const dhPct = ((ev.clientY - startY) / holderRect.height) * 100;
        const { nw, nh } = clampSize(origW + dwPct, origH + dhPct);
        roomEl.style.width = nw + "%";
        roomEl.style.height = nh + "%";
      }
      function onUp(ev) {
        handle.releasePointerCapture(e.pointerId);
        handle.removeEventListener("pointermove", onMove);
        const dwPct = ((ev.clientX - startX) / holderRect.width) * 100;
        const dhPct = ((ev.clientY - startY) / holderRect.height) * 100;
        const { nw, nh } = clampSize(origW + dwPct, origH + dhPct);
        room.width = Math.round(nw * 10) / 10;
        room.height = Math.round(nh * 10) / 10;
        renderFloorPlan();
        persistActiveProject();
        triggerPropagationCheck(`Resized the room "${room.name}" in floor plan "${plan.name}".`);
      }
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp, { once: true });
    });
  });
}

function resizeImageFile(file, maxWidth, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      callback(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function openFloorPlanModal() {
  document.getElementById("fpName").value = "";
  document.getElementById("fpFile").value = "";
  document.getElementById("fpWidthFt").value = "40";
  document.getElementById("fpHeightFt").value = "25";
  document.querySelector('input[name="fpType"][value="image"]').checked = true;
  document.getElementById("fpImageFields").style.display = "block";
  document.getElementById("fpSchematicFields").style.display = "none";
  document.getElementById("floorPlanModalOverlay").style.display = "flex";
  document.getElementById("fpName").focus();
}
function closeFloorPlanModal() { document.getElementById("floorPlanModalOverlay").style.display = "none"; }
document.getElementById("btnAddFloorPlan").addEventListener("click", openFloorPlanModal);
document.getElementById("floorPlanCancel").addEventListener("click", closeFloorPlanModal);
document.querySelectorAll('input[name="fpType"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    const isImage = document.querySelector('input[name="fpType"]:checked').value === "image";
    document.getElementById("fpImageFields").style.display = isImage ? "block" : "none";
    document.getElementById("fpSchematicFields").style.display = isImage ? "none" : "block";
    document.querySelectorAll('#floorPlanModalOverlay .status-radio-option').forEach((lbl) => lbl.classList.toggle("checked", lbl.querySelector("input").checked));
  });
});
document.getElementById("floorPlanSubmit").addEventListener("click", () => {
  const name = document.getElementById("fpName").value.trim();
  const kind = document.querySelector('input[name="fpType"]:checked').value;
  if (!name) { alert("Please name this floor plan (e.g. a level or unit)."); return; }
  ensureCollection("floorplan");
  if (kind === "schematic") {
    const widthFt = Number(document.getElementById("fpWidthFt").value) || 40;
    const heightFt = Number(document.getElementById("fpHeightFt").value) || 25;
    state.floorplan.plans.push({ id: "fp" + Date.now(), name, type: "schematic", widthFt, heightFt, rooms: [], pins: [] });
    renderFloorPlan();
    persistActiveProject();
    closeFloorPlanModal();
    return;
  }
  const file = document.getElementById("fpFile").files[0];
  if (!file) { alert("Please choose an image file."); return; }
  resizeImageFile(file, 1600, (dataUrl) => {
    state.floorplan.plans.push({ id: "fp" + Date.now(), name, type: "image", imageDataUrl: dataUrl, pins: [] });
    renderFloorPlan();
    persistActiveProject();
    closeFloorPlanModal();
  });
});

// ===== Add Room modal (manual room entry for schematic floor plans) =====
let addRoomToPlanId = null;
function openAddRoomModal(planId) {
  addRoomToPlanId = planId;
  const FL = labelsFor("floorplan");
  const isConstruction = currentIndustry() === "construction";
  document.getElementById("addRoomModalTitle").textContent = `Add ${FL.unitNoun}`;
  document.getElementById("arNameLabel").textContent = `${FL.unitNoun} name`;
  document.getElementById("arName").placeholder = isConstruction ? "e.g. Primary Bedroom" : (FL.unitNoun === "Phase" ? "e.g. Fieldwork" : "e.g. Diagnostic");
  document.getElementById("arDimensionFields").style.display = isConstruction ? "block" : "none";
  document.getElementById("addRoomNote").textContent = `New ${FL.unitNounPlural.toLowerCase()} are placed in the top-left corner — drag to position and drag the corner handle to resize afterward.`;
  document.getElementById("arName").value = "";
  document.getElementById("arWidthFt").value = "12";
  document.getElementById("arHeightFt").value = "12";
  document.getElementById("addRoomModalOverlay").style.display = "flex";
  document.getElementById("arName").focus();
}
function closeAddRoomModal() { document.getElementById("addRoomModalOverlay").style.display = "none"; addRoomToPlanId = null; }
document.getElementById("addRoomCancel").addEventListener("click", closeAddRoomModal);
document.getElementById("addRoomSubmit").addEventListener("click", () => {
  const FL = labelsFor("floorplan");
  const isConstruction = currentIndustry() === "construction";
  const name = document.getElementById("arName").value.trim();
  if (!name) { alert(`Please enter a ${FL.unitNoun.toLowerCase()} name.`); return; }
  const plan = (state.floorplan && state.floorplan.plans || []).find((p) => p.id === addRoomToPlanId);
  if (!plan) { closeAddRoomModal(); return; }
  let width, height, dimNote = "";
  if (isConstruction) {
    const widthFt = Number(document.getElementById("arWidthFt").value) || 12;
    const heightFt = Number(document.getElementById("arHeightFt").value) || 12;
    const planWidthFt = plan.widthFt || 40, planHeightFt = plan.heightFt || 25;
    width = Math.max(4, Math.min(96, (widthFt / planWidthFt) * 100));
    height = Math.max(4, Math.min(96, (heightFt / planHeightFt) * 100));
    dimNote = ` (${widthFt}' × ${heightFt}')`;
  } else {
    width = 24; height = 24;
  }
  plan.rooms.push({ id: "room" + Date.now(), name, x: 4, y: 4, width, height });
  renderFloorPlan();
  persistActiveProject();
  closeAddRoomModal();
  triggerPropagationCheck(`Manually added a ${FL.unitNoun.toLowerCase()} "${name}"${dimNote} to "${plan.name}".`);
});

// ===== Dashboard rendering (computed, read-only) =====
const STAT_ICONS = {
  schedule: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="12" width="4" height="7" rx="1" stroke="currentColor" stroke-width="1.8"/><rect x="10" y="7" width="4" height="12" rx="1" stroke="currentColor" stroke-width="1.8"/><rect x="17" y="3" width="4" height="16" rx="1" stroke="currentColor" stroke-width="1.8"/></svg>',
  budget: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v10M9.5 9.5c0-1.4 1.1-2 2.5-2s2.5.7 2.5 2c0 3-5 1.5-5 4.5 0 1.3 1.1 2 2.5 2s2.5-.7 2.5-2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  raid: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3l8 4v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7l8-4z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  submittals: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 3h9l4 4v14H6V3z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 12h6M9 16h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  punch: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 5h14v14H5z" stroke="currentColor" stroke-width="1.8"/><path d="M8 12l2.5 2.5L16 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  siteTasks: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="5" height="16" rx="1" stroke="currentColor" stroke-width="1.8"/><rect x="9.5" y="4" width="5" height="10" rx="1" stroke="currentColor" stroke-width="1.8"/><rect x="16" y="4" width="5" height="13" rx="1" stroke="currentColor" stroke-width="1.8"/></svg>',
  crew: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3.5 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function renderDashboard() {
  const wrap = document.getElementById("dashboardWrap");
  if (!wrap) return;

  const tasks = state.gantt || [];
  const avgProgress = tasks.length ? Math.round(tasks.reduce((n, t) => n + (t.progress || 0), 0) / tasks.length) : null;
  const today = todayISO();
  const overdue = tasks.filter((t) => t.end < today && (t.progress || 0) < 100).length;

  const budgetItems = (state.budget && state.budget.items) || [];
  const totalEst = budgetItems.reduce((n, i) => n + Number(i.estimated || 0), 0);
  const totalAct = budgetItems.reduce((n, i) => n + Number(i.actual || 0), 0);
  const budgetVar = totalAct - totalEst;

  const raidItems = (state.raid && state.raid.items) || [];
  const raidOpen = raidItems.filter((i) => i.status === "Open" || i.status === "Monitoring").length;
  const punchOpen = ((state.punchlist && state.punchlist.items) || []).filter((i) => i.status === "Open" || i.status === "In Progress").length;
  const subOpen = ((state.submittals && state.submittals.items) || []).filter((i) => i.status === "Open" || i.status === "Revise & Resubmit").length;

  const kanbanCols = (state.kanban && state.kanban.columns) || [];
  const kanbanTotal = kanbanCols.reduce((n, c) => n + c.cards.length, 0);

  const members = (state.team && state.team.members) || [];
  const entries = (state.timesheets && state.timesheets.entries) || [];
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const totalHoursThisWeek = entries.filter((t) => { const d = new Date(t.date); return d >= weekAgo && d <= now; }).reduce((n, t) => n + Number(t.hours || 0), 0);

  // Health score: weighted average of schedule, budget, risk, and punch-list health (0-100)
  const scheduleScore = tasks.length ? Math.max(0, (avgProgress || 0) - overdue * 10) : 100;
  const budgetPctOver = totalEst > 0 ? ((totalAct - totalEst) / totalEst) * 100 : 0;
  const budgetScore = budgetItems.length ? Math.max(0, 100 - Math.max(0, budgetPctOver) * 2) : 100;
  const riskScore = Math.max(0, 100 - raidOpen * 10);
  const punchScore = Math.max(0, 100 - punchOpen * 5);
  const healthScore = Math.round((scheduleScore + budgetScore + riskScore + punchScore) / 4);
  const healthClass = healthScore >= 80 ? "good" : healthScore >= 60 ? "fair" : "bad";
  const healthRating = healthScore >= 80 ? "Good" : healthScore >= 60 ? "At Risk" : "Critical";

  wrap.innerHTML = `
    <div class="health-banner ${healthClass}">
      <div class="health-score-text" style="flex:1;">
        <h2>Project Health Score</h2>
        <p>Average of schedule, budget, RAID, and punch-list health — a quick read on overall project condition.</p>
      </div>
      <div style="text-align:right;">
        <div class="stat-value" style="font-size:36px;">${healthScore}</div>
        <div class="health-score-rating">${healthRating}</div>
      </div>
    </div>
    <div class="stat-grid">
      <div class="stat-card${overdue > 0 ? " bad" : ""}"><span class="stat-icon">${STAT_ICONS.schedule}</span>
        <div class="stat-label">Schedule</div>
        <div class="stat-value">${avgProgress === null ? "—" : avgProgress + "%"}</div>
        <div class="stat-sub">${tasks.length} task${tasks.length === 1 ? "" : "s"}${overdue ? ` · ${overdue} overdue` : ""}</div>
      </div>
      <div class="stat-card${budgetVar > 0 ? " bad" : budgetVar < 0 ? " good" : ""}"><span class="stat-icon">${STAT_ICONS.budget}</span>
        <div class="stat-label">Budget Variance</div>
        <div class="stat-value">${budgetItems.length ? (budgetVar >= 0 ? "+" : "") + "$" + budgetVar.toLocaleString("en-US") : "—"}</div>
        <div class="stat-sub">$${totalAct.toLocaleString("en-US")} actual of $${totalEst.toLocaleString("en-US")} estimated</div>
      </div>
      <div class="stat-card${raidOpen > 0 ? " warn" : ""}"><span class="stat-icon">${STAT_ICONS.raid}</span>
        <div class="stat-label">Open RAID Items</div>
        <div class="stat-value">${raidOpen}</div>
        <div class="stat-sub">Risks, issues &amp; assumptions being tracked</div>
      </div>
      <div class="stat-card${subOpen > 0 ? " warn" : ""}"><span class="stat-icon">${STAT_ICONS.submittals}</span>
        <div class="stat-label">Open ${escapeHtml(labelsFor("submittals").tabLabel)}</div>
        <div class="stat-value">${subOpen}</div>
        <div class="stat-sub">Awaiting response</div>
      </div>
      <div class="stat-card${punchOpen > 0 ? " warn" : ""}"><span class="stat-icon">${STAT_ICONS.punch}</span>
        <div class="stat-label">Open ${escapeHtml(labelsFor("punchlist").tabLabel)}</div>
        <div class="stat-value">${punchOpen}</div>
        <div class="stat-sub">Not yet complete or verified</div>
      </div>
      <div class="stat-card"><span class="stat-icon">${STAT_ICONS.siteTasks}</span>
        <div class="stat-label">${escapeHtml(labelsFor("kanban").tabLabel)}</div>
        <div class="stat-value">${kanbanTotal}</div>
        <div class="stat-sub">${kanbanCols.map((c) => `${c.name}: ${c.cards.length}`).join(" · ") || "No board yet"}</div>
      </div>
      <div class="stat-card"><span class="stat-icon">${STAT_ICONS.crew}</span>
        <div class="stat-label">${escapeHtml(labelsFor("dashboard").crewHoursLabel)}</div>
        <div class="stat-value">${totalHoursThisWeek}</div>
        <div class="stat-sub">${members.length} team member${members.length === 1 ? "" : "s"}</div>
      </div>
    </div>

    <div class="dashboard-charts-row">
      <div class="live-panel">
        <div class="stat-label">${escapeHtml(labelsFor("kanban").tabLabel)} by status</div>
        ${kanbanTotal ? `<div style="position:relative;height:180px;"><canvas id="taskStatusChart" role="img" aria-label="Tasks by status"></canvas></div>` : `<p class="dash-empty-note">No board yet — add one on the ${escapeHtml(labelsFor("kanban").tabLabel)} tab.</p>`}
      </div>
      <div class="live-panel">
        <div class="stat-label">Budget: estimated vs. actual</div>
        ${budgetItems.length ? `<div style="position:relative;height:180px;"><canvas id="budgetCompareChart" role="img" aria-label="Budget estimated versus actual by category, in dollars"></canvas></div>` : `<p class="dash-empty-note">No budget line items yet — add one on the Budget tab.</p>`}
      </div>
    </div>

    <div class="dashboard-charts-row">
      <div class="live-panel">
        <div class="stat-label">RAID items by status</div>
        ${raidItems.length ? `<div style="position:relative;height:180px;"><canvas id="raidStatusChart" role="img" aria-label="RAID items by status"></canvas></div>` : `<p class="dash-empty-note">No RAID items yet — add one on the RAID Log tab.</p>`}
      </div>
      <div class="live-panel">
        <div class="stat-label">${escapeHtml(labelsFor("siteops").attendanceLabel)} trend (last 7 days)</div>
        ${(state.attendance && state.attendance.records && state.attendance.records.length) ? `<div style="position:relative;height:180px;"><canvas id="attendanceTrendChart" role="img" aria-label="Percent present, last 7 days"></canvas></div>` : `<p class="dash-empty-note">No attendance recorded yet — add some on the ${escapeHtml(labelsFor("siteops").tabLabel)} tab.</p>`}
      </div>
    </div>

    <div class="dashboard-section-title">Weekly Workload</div>
    <div class="team-panel">${renderWorkloadRowsOnly(members, entries)}</div>
  `;

  renderTaskStatusChart(kanbanCols);
  renderBudgetCompareChart(budgetItems);
  renderRaidStatusChart(raidItems);
  renderAttendanceTrendChart((state.attendance && state.attendance.records) || [], members);
}

let taskStatusChartInstance = null;
function renderTaskStatusChart(cols) {
  const canvas = document.getElementById("taskStatusChart");
  if (!canvas || !cols.length) return;
  const palette = ["#F2B705", "#FF6A1A", "#4CAF6D", "#9B7BE0", "#6B6B72"];
  if (taskStatusChartInstance) taskStatusChartInstance.destroy();
  taskStatusChartInstance = new Chart(canvas.getContext("2d"), {
    type: "doughnut",
    data: { labels: cols.map((c) => c.name), datasets: [{ data: cols.map((c) => c.cards.length), backgroundColor: cols.map((_, i) => palette[i % palette.length]), borderColor: "#232326", borderWidth: 2 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "right", labels: { color: "#A6A6AC", font: { size: 11 }, boxWidth: 10, padding: 10 } } },
    },
  });
}

let budgetCompareChartInstance = null;
function renderBudgetCompareChart(items) {
  const canvas = document.getElementById("budgetCompareChart");
  if (!canvas || !items.length) return;
  if (budgetCompareChartInstance) budgetCompareChartInstance.destroy();
  budgetCompareChartInstance = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: items.map((i) => i.category || i.description),
      datasets: [
        { label: "Estimated", data: items.map((i) => Number(i.estimated) || 0), backgroundColor: "#55555C", borderRadius: 2, maxBarThickness: 22 },
        { label: "Actual", data: items.map((i) => Number(i.actual) || 0), backgroundColor: "#F2B705", borderRadius: 2, maxBarThickness: 22 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: $${ctx.parsed.y.toLocaleString("en-US")}` } },
      },
      scales: {
        x: { ticks: { color: "#A6A6AC", font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: "#6B6B72", font: { size: 10 }, callback: (v) => "$" + (v >= 1000 ? v / 1000 + "k" : v) }, grid: { color: "rgba(255,255,255,0.05)" } },
      },
    },
  });
}

let raidStatusChartInstance = null;
function renderRaidStatusChart(items) {
  const canvas = document.getElementById("raidStatusChart");
  if (!canvas || !items.length) return;
  const statuses = ["Open", "Monitoring", "Mitigated", "Closed"];
  const colors = { Open: "#E24B4B", Monitoring: "#F2B705", Mitigated: "#4CAF6D", Closed: "#6B6B72" };
  const counts = statuses.map((s) => items.filter((i) => i.status === s).length);
  if (raidStatusChartInstance) raidStatusChartInstance.destroy();
  raidStatusChartInstance = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: { labels: statuses, datasets: [{ data: counts, backgroundColor: statuses.map((s) => colors[s]), borderRadius: 2, maxBarThickness: 26 }] },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { color: "#6B6B72", font: { size: 10 }, precision: 0 }, grid: { color: "rgba(255,255,255,0.05)" } },
        y: { ticks: { color: "#ECECEA", font: { size: 11 } }, grid: { display: false } },
      },
    },
  });
}

let attendanceTrendChartInstance = null;
function renderAttendanceTrendChart(records, members) {
  const canvas = document.getElementById("attendanceTrendChart");
  if (!canvas || !records.length) return;
  const labels = [], pcts = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayRecords = records.filter((r) => r.date === dateStr);
    const present = dayRecords.filter((r) => r.status === "Present").length;
    labels.push(d.toLocaleDateString("en-US", { weekday: "short" }));
    pcts.push(dayRecords.length ? Math.round((present / dayRecords.length) * 100) : null);
  }
  if (attendanceTrendChartInstance) attendanceTrendChartInstance.destroy();
  attendanceTrendChartInstance = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: { labels, datasets: [{ data: pcts, borderColor: "#4CAF6D", backgroundColor: "rgba(76,175,109,0.12)", fill: true, tension: 0.25, spanGaps: true, pointRadius: 3, pointBackgroundColor: "#4CAF6D" }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ctx.parsed.y === null ? "No data" : ctx.parsed.y + "% present" } } },
      scales: {
        x: { ticks: { color: "#6B6B72", font: { size: 10 } }, grid: { display: false } },
        y: { min: 0, max: 100, ticks: { color: "#6B6B72", font: { size: 10 }, callback: (v) => v + "%" }, grid: { color: "rgba(255,255,255,0.05)" } },
      },
    },
  });
}

function renderWorkloadRowsOnly(members, entries) {
  if (!members.length) return `<p style="color:var(--text-faint); font-size:13px; margin:0;">No crew added yet — add team members on the Team tab.</p>`;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const workloadMap = {};
  members.forEach((m) => { workloadMap[m.name] = 0; });
  entries.forEach((t) => { const d = new Date(t.date); if (d >= weekAgo && d <= now) workloadMap[t.memberName] = (workloadMap[t.memberName] || 0) + Number(t.hours || 0); });
  const anyHours = Object.values(workloadMap).some((h) => h > 0);
  if (!anyHours) return `<p style="color:var(--text-faint); font-size:13px; margin:0;">No hours logged in the last 7 days — log time on the Team tab.</p>`;
  return members.map((m) => {
    const hrs = workloadMap[m.name] || 0;
    const pct = Math.min(100, (hrs / 40) * 100);
    const cls = hrs > 45 ? "bad" : hrs > 40 ? "warn" : "";
    return `<div class="workload-row"><div class="workload-name">${escapeHtml(m.name)}</div>
      <div class="workload-bar-track"><div class="workload-bar-fill ${cls}" style="width:${pct}%"></div></div>
      <div class="workload-hours">${hrs}h / 40h</div></div>`;
  }).join("");
}

// ===== Calendar rendering (computed, read-only) =====
function renderCalendar() {
  const wrap = document.getElementById("calendarWrap");
  if (!wrap) return;
  const year = calendarMonth.getFullYear(), month = calendarMonth.getMonth();
  const monthLabel = calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = todayISO();

  const eventsByDate = {};
  const addEvent = (dateStr, label, cls) => {
    if (!dateStr) return;
    if (!eventsByDate[dateStr]) eventsByDate[dateStr] = [];
    eventsByDate[dateStr].push({ label, cls });
  };
  (state.gantt || []).forEach((t) => { addEvent(t.start, `▶ ${t.name}`, "ev-gantt-start"); addEvent(t.end, `■ ${t.name}`, "ev-gantt-end"); });
  ((state.dailylog && state.dailylog.entries) || []).forEach((e) => addEvent(e.date, "Site report", "ev-dailylog"));
  ((state.submittals && state.submittals.items) || []).forEach((s) => addEvent(s.dueDate, `${s.number} due`, "ev-submittal"));

  let cellsHtml = "";
  for (let i = 0; i < startWeekday; i++) cellsHtml += `<div class="calendar-cell empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const events = eventsByDate[dateStr] || [];
    const isToday = dateStr === todayStr;
    cellsHtml += `<div class="calendar-cell${isToday ? " today" : ""}">
      <div class="calendar-date">${d}</div>
      ${events.slice(0, 3).map((e) => `<div class="calendar-event ${e.cls}" title="${escapeHtml(e.label)}">${escapeHtml(e.label)}</div>`).join("")}
      ${events.length > 3 ? `<div class="calendar-event" style="background:var(--border-strong)">+${events.length - 3} more</div>` : ""}
    </div>`;
  }

  const dowLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  wrap.innerHTML = `
    <div class="calendar-month-label">${monthLabel}</div>
    <div class="calendar-grid">
      ${dowLabels.map((d) => `<div class="calendar-dow">${d}</div>`).join("")}
      ${cellsHtml}
    </div>`;
}
document.getElementById("calPrev").addEventListener("click", () => { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1); renderCalendar(); });
document.getElementById("calNext").addEventListener("click", () => { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1); renderCalendar(); });
document.getElementById("calToday").addEventListener("click", () => { calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1); renderCalendar(); });

function slug(s) { return String(s || "").toLowerCase().replace(/&/g, "and").replace(/\s+/g, "-"); }
function rebindSampleButton(container) { container.querySelectorAll("[data-sample]").forEach((btn) => { btn.addEventListener("click", () => loadSample(btn.dataset.sample)); }); }
function escapeHtml(str) { return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function timeAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function setTicker(text, live = false) { const el = document.getElementById("tickerText"); el.textContent = text; el.classList.toggle("live", live); }

// ===================== BROWSE PAGES (7 field modules) =====================
const CHART_META = {
  gantt: { label: "Project Schedules", sub: "All projects with a schedule", empty: "No schedules yet." },
  kanban: { label: "Site Task Boards", sub: "All projects with a site task board", empty: "No task boards yet." },
  burndown: { label: "Schedule Burndowns", sub: "All projects with a burndown chart", empty: "No burndown charts yet." },
  raid: { label: "RAID Logs", sub: "All projects with a RAID log", empty: "No RAID logs yet." },
  dailylog: { label: "Daily Logs", sub: "All projects with site reports", empty: "No daily logs yet." },
  submittals: { label: "Submittals & RFIs", sub: "All projects with submittals or RFIs logged", empty: "No submittals or RFIs yet." },
  punchlist: { label: "Punch Lists", sub: "All projects with a punch list", empty: "No punch lists yet." },
};
let currentBrowseType = "gantt";

function chartStat(type, chart) {
  if (type === "gantt") return `${chart.length} task${chart.length === 1 ? "" : "s"}`;
  if (type === "kanban") { const total = chart.columns.reduce((n, c) => n + c.cards.length, 0); return `${chart.columns.length} columns · ${total} cards`; }
  if (type === "burndown") return `${chart.days.length}-day sprint`;
  if (type === "raid" || type === "submittals" || type === "punchlist") return `${chart.items.length} item${chart.items.length === 1 ? "" : "s"}`;
  if (type === "dailylog") return `${chart.entries.length} entr${chart.entries.length === 1 ? "y" : "ies"}`;
  return "";
}
function hasChart(type, chart) {
  if (!chart) return false;
  if (type === "gantt") return Array.isArray(chart) && chart.length > 0;
  if (type === "kanban") return Array.isArray(chart.columns) && chart.columns.length > 0;
  if (type === "burndown") return Array.isArray(chart.days) && chart.days.length > 0;
  if (type === "raid" || type === "submittals" || type === "punchlist") return Array.isArray(chart.items) && chart.items.length > 0;
  if (type === "dailylog") return Array.isArray(chart.entries) && chart.entries.length > 0;
  return false;
}
function openBrowse(type) {
  currentBrowseType = type;
  const meta = CHART_META[type];
  document.getElementById("browseTitle").textContent = meta.label;
  document.getElementById("browseSub").textContent = meta.sub;
  renderBrowseGrid(type);
  showPage("browseView");
}
function renderBrowseGrid(type) {
  const projects = loadAllProjects();
  const grid = document.getElementById("browseGrid");
  const matches = Object.entries(projects).filter(([, p]) => hasChart(type, p.charts[type]));
  matches.sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
  if (!matches.length) {
    grid.innerHTML = `<div class="browse-empty"><p>${CHART_META[type].empty}</p><button class="btn-primary" id="browseEmptyAdd"><span>＋</span> Add New Project</button></div>`;
    document.getElementById("browseEmptyAdd").addEventListener("click", () => { promptNewProject((name, ptype) => createProjectAndOpen(name, ptype, type, true)); });
    return;
  }
  grid.innerHTML = matches.map(([id, p]) => `
      <div class="browse-card" data-project-id="${id}">
        <div class="browse-card-name">${escapeHtml(p.name)}</div>
        <div class="browse-card-meta">${escapeHtml(p.type || "")}${p.type ? " · " : ""}Updated ${timeAgo(p.updatedAt)}</div>
        <div class="browse-card-stat">${chartStat(type, p.charts[type])}</div>
        <div class="browse-card-open">Open →</div>
      </div>`).join("");
  grid.querySelectorAll(".browse-card").forEach((card) => {
    card.addEventListener("click", () => { switchActiveProject(card.dataset.projectId); showApp(); switchView(type); });
  });
}
document.getElementById("browseAddNew").addEventListener("click", () => { promptNewProject((name, type) => createProjectAndOpen(name, type, currentBrowseType, true)); });
document.querySelectorAll('[data-browse]').forEach((card) => {
  card.addEventListener("click", () => openBrowse(card.dataset.browse));
  card.addEventListener("keydown", (e) => { if (e.key === "Enter") openBrowse(card.dataset.browse); });
});
document.getElementById("backToLandingFromBrowse").addEventListener("click", (e) => { e.preventDefault(); showLanding(); });
document.getElementById("brandHomeBrowse").addEventListener("click", () => showLanding());

// ===================== Home page: industry picker cards =====================
document.querySelectorAll(".industry-card").forEach((card) => {
  const go = () => openPortfolio(card.dataset.industry);
  card.addEventListener("click", go);
  card.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
});
function renderIndustryCounts() {
  const projects = Object.values(loadAllProjects());
  const counts = { construction: 0, marketing_research: 0, consulting: 0 };
  projects.forEach((p) => { counts[industryFromType(p.type)]++; });
  const setCount = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = n === 0 ? "No projects yet" : `${n} project${n === 1 ? "" : "s"}`; };
  setCount("countConstruction", counts.construction);
  setCount("countMR", counts.marketing_research);
  setCount("countConsulting", counts.consulting);
}

// ===================== PORTFOLIO (all-projects overview, optionally filtered by industry) =====================
let portfolioIndustryFilter = null;
const INDUSTRY_DISPLAY = { construction: "Construction", marketing_research: "Marketing Research", consulting: "Consulting" };
const INDUSTRY_DEFAULT_TYPE = { construction: "Residential", marketing_research: "Marketing Research", consulting: "Consulting" };
function openPortfolio(industry) {
  portfolioIndustryFilter = industry || null;
  if (industry === "marketing_research" || industry === "consulting") document.body.setAttribute("data-theme", "neutral");
  else document.body.removeAttribute("data-theme");
  renderPortfolioGrid();
  showPage("portfolioView");
}
function projectStats(p) {
  const c = p.charts || {};
  const tasks = c.gantt || [];
  const avgProgress = tasks.length ? Math.round(tasks.reduce((n, t) => n + (t.progress || 0), 0) / tasks.length) : null;
  const budgetItems = (c.budget && c.budget.items) || [];
  const totalEst = budgetItems.reduce((n, i) => n + Number(i.estimated || 0), 0);
  const totalAct = budgetItems.reduce((n, i) => n + Number(i.actual || 0), 0);
  const budgetVar = totalAct - totalEst;
  const raidOpen = ((c.raid && c.raid.items) || []).filter((i) => i.status === "Open" || i.status === "Monitoring").length;
  const punchOpen = ((c.punchlist && c.punchlist.items) || []).filter((i) => i.status === "Open" || i.status === "In Progress").length;
  const subOpen = ((c.submittals && c.submittals.items) || []).filter((i) => i.status === "Open" || i.status === "Revise & Resubmit").length;
  return { avgProgress, totalEst, totalAct, budgetVar, openItems: raidOpen + punchOpen + subOpen };
}
function renderPortfolioGrid() {
  const projects = loadAllProjects();
  const grid = document.getElementById("portfolioGrid");
  const titleEl = document.getElementById("portfolioTitle");
  const subEl = document.getElementById("portfolioSub");
  const defaultType = portfolioIndustryFilter ? INDUSTRY_DEFAULT_TYPE[portfolioIndustryFilter] : "Residential";
  if (portfolioIndustryFilter) {
    titleEl.textContent = INDUSTRY_DISPLAY[portfolioIndustryFilter];
    subEl.textContent = `${INDUSTRY_DISPLAY[portfolioIndustryFilter]} projects — schedule, budget, and open items.`;
  } else {
    titleEl.textContent = "Portfolio";
    subEl.textContent = "Every project at a glance — schedule, budget, and open items.";
  }
  let entries = Object.entries(projects).sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
  if (portfolioIndustryFilter) entries = entries.filter(([, p]) => industryFromType(p.type) === portfolioIndustryFilter);
  if (!entries.length) {
    const label = portfolioIndustryFilter ? INDUSTRY_DISPLAY[portfolioIndustryFilter].toLowerCase() : "";
    grid.innerHTML = `<div class="portfolio-empty"><p>No ${label ? label + " " : ""}projects yet.</p><button class="btn-primary" id="portfolioEmptyAdd"><span>＋</span> Add New Project</button></div>`;
    document.getElementById("portfolioEmptyAdd").addEventListener("click", () => { promptNewProject((name, type) => createProjectAndOpen(name, type, "dashboard", true), defaultType); });
    return;
  }
  grid.innerHTML = entries.map(([id, p]) => {
    const s = projectStats(p);
    const pills = [
      `<span class="portfolio-stat-pill">${s.avgProgress === null ? "No schedule" : s.avgProgress + "% complete"}</span>`,
      `<span class="portfolio-stat-pill ${s.totalEst ? (s.budgetVar > 0 ? "bad" : "good") : ""}">${s.totalEst ? (s.budgetVar >= 0 ? "+" : "") + "$" + s.budgetVar.toLocaleString("en-US") + " var" : "No budget"}</span>`,
      `<span class="portfolio-stat-pill ${s.openItems > 0 ? "warn" : ""}">${s.openItems} open item${s.openItems === 1 ? "" : "s"}</span>`,
    ].join("");
    return `<div class="portfolio-card" data-project-id="${id}">
      <div class="portfolio-card-name">${escapeHtml(p.name)}</div>
      <div class="portfolio-card-meta">${escapeHtml(p.type || "")}${p.type ? " · " : ""}Updated ${timeAgo(p.updatedAt)}</div>
      <div class="portfolio-stat-row">${pills}</div>
      <div class="portfolio-card-open">Open Dashboard →</div>
    </div>`;
  }).join("");
  grid.querySelectorAll(".portfolio-card").forEach((card) => {
    card.addEventListener("click", () => { switchActiveProject(card.dataset.projectId); showApp(); switchView("dashboard"); });
  });
}
document.getElementById("portfolioAddNew").addEventListener("click", () => {
  const defaultType = portfolioIndustryFilter ? INDUSTRY_DEFAULT_TYPE[portfolioIndustryFilter] : "Residential";
  promptNewProject((name, type) => createProjectAndOpen(name, type, "dashboard", true), defaultType);
});
document.getElementById("navPortfolio").addEventListener("click", (e) => { e.preventDefault(); openPortfolio(null); });
document.getElementById("backToLandingFromPortfolio").addEventListener("click", (e) => { e.preventDefault(); portfolioIndustryFilter = null; showLanding(); renderIndustryCounts(); });
document.getElementById("brandHomePortfolio").addEventListener("click", () => { portfolioIndustryFilter = null; showLanding(); renderIndustryCounts(); });

// ===================== DEDICATED CHAT PAGE =====================
function openChatPage() { renderChatHistoryList(); showPage("chatPageView"); }
document.getElementById("navChatHistory").addEventListener("click", (e) => { e.preventDefault(); openChatPage(); });
function renderChatHistoryList() {
  const projects = loadAllProjects();
  const list = document.getElementById("chatHistoryList");
  const entries = Object.entries(projects).sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
  list.innerHTML = entries.map(([id, p]) => {
    const lastMsg = [...(p.chatLog || [])].reverse().find((m) => m.kind === "user" || m.kind === "assistant");
    const snippet = lastMsg ? lastMsg.text.slice(0, 46) + (lastMsg.text.length > 46 ? "…" : "") : "No messages yet";
    return `<div class="chat-history-item ${id === activeProjectId ? "active" : ""}" data-project-id="${id}">
        <div class="chat-history-name">${escapeHtml(p.name)}</div>
        <div class="chat-history-meta">${escapeHtml(snippet)}</div></div>`;
  }).join("");
  list.querySelectorAll(".chat-history-item").forEach((item) => { item.addEventListener("click", () => { switchActiveProject(item.dataset.projectId); renderChatHistoryList(); }); });
}
document.getElementById("btnNewChat").addEventListener("click", () => { createProjectAndOpen("New chat", "", "dashboard", false); renderChatHistoryList(); });
document.getElementById("backToLandingFromChat").addEventListener("click", (e) => { e.preventDefault(); showLanding(); });
document.getElementById("brandHomeChat").addEventListener("click", () => showLanding());

// ===================== CHAT (shared logic, two mount points) =====================
const CHAT_MOUNTS = [
  { log: "chatLog", form: "chatForm", input: "chatInput", send: "chatSend" },
  { log: "chatLogPage", form: "chatFormPage", input: "chatInputPage", send: "chatSendPage" },
];
const VIEW_LABELS = { gantt: "Schedule", kanban: "Site Tasks", burndown: "Progress", raid: "RAID Log", dailylog: "Daily Log", submittals: "Submittals/RFI", punchlist: "Punch List", team: "Team", budget: "Budget", calendar: "Calendar", dashboard: "Dashboard", siteops: "Site Ops", charter: "Charter", crashing: "Crashing", wbs: "WBS", inventory: "Inventory", floorplan: "Floor Plan", findings: "Research Findings", billing: "Billable Hours" };

function addMessage(role, text) { chatLogData.push({ kind: role, text }); CHAT_MOUNTS.forEach((m) => renderChatBubble(document.getElementById(m.log), role, text)); }
function addNote(text, viewTab) { chatLogData.push({ kind: "note", text, viewTab }); CHAT_MOUNTS.forEach((m) => renderChatBubble(document.getElementById(m.log), "note", text, viewTab)); }
function renderChatBubble(container, kind, text, viewTab) {
  if (!container) return;
  const div = document.createElement("div");
  div.className = kind === "note" ? "msg-note" : `msg msg-${kind}`;
  div.textContent = text;
  if (kind === "note" && viewTab) {
    const link = document.createElement("span");
    link.className = "chat-view-link";
    link.textContent = `View in ${VIEW_LABELS[viewTab] || viewTab} →`;
    link.addEventListener("click", () => { showApp(); switchView(viewTab); });
    div.appendChild(document.createElement("br"));
    div.appendChild(link);
  }
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}
function rebuildChatLogDom() {
  CHAT_MOUNTS.forEach((m) => { const el = document.getElementById(m.log); if (el) el.innerHTML = ""; });
  if (!chatLogData.length) {
    CHAT_MOUNTS.forEach((m) => renderChatBubble(document.getElementById(m.log), "assistant",
      "Hi — I'm your construction project management assistant. Ask me anything about scheduling, RFIs, change orders, safety, budget, or crew coordination, or ask me to draft or edit your schedule, site task board, burndown, RAID log, daily log, submittals/RFI log, punch list, team, or budget. You can also add anything manually with the \"+ Add\" button on each page."));
    return;
  }
  chatLogData.forEach((m) => CHAT_MOUNTS.forEach((mount) => renderChatBubble(document.getElementById(mount.log), m.kind, m.text, m.viewTab)));
}

function extractJsonActions(reply) {
  const matches = [...reply.matchAll(/```json\s*([\s\S]*?)```/gi)];
  const actions = [];
  for (const m of matches) {
    try { actions.push(JSON.parse(m[1])); } catch { /* skip malformed block */ }
  }
  return actions;
}
function applyOneAction(action) {
  if (!action || !action.action || !action.data) return;
  if (action.action === "gantt") { renderGantt(action.data); addNote(`✓ Schedule updated (${action.data.length} tasks)`, "gantt"); }
  else if (action.action === "burndown") { renderBurndown(action.data); addNote(`✓ Burndown chart updated`, "burndown"); }
  else if (action.action === "kanban") { renderKanban(action.data); const total = action.data.columns.reduce((n, c) => n + c.cards.length, 0); addNote(`✓ Site task board updated (${total} cards)`, "kanban"); }
  else if (action.action === "raid") { renderRaid(action.data); const total = (action.data.items || []).length; addNote(`✓ RAID log updated (${total} items)`, "raid"); }
  else if (action.action === "dailylog") { renderDailyLog(action.data); const total = (action.data.entries || []).length; addNote(`✓ Daily log updated (${total} entries)`, "dailylog"); }
  else if (action.action === "submittals") { renderSubmittals(action.data); const total = (action.data.items || []).length; addNote(`✓ Submittals/RFI log updated (${total} items)`, "submittals"); }
  else if (action.action === "punchlist") { renderPunchlist(action.data); const total = (action.data.items || []).length; addNote(`✓ Punch list updated (${total} items)`, "punchlist"); }
  else if (action.action === "team") { state.team = action.data; renderTeam(); const total = (action.data.members || []).length; addNote(`✓ Team updated (${total} members)`, "team"); }
  else if (action.action === "timesheet") { state.timesheets = action.data; renderTeam(); const total = (action.data.entries || []).length; addNote(`✓ Timesheets updated (${total} entries)`, "team"); }
  else if (action.action === "budget") { renderBudget(action.data); const total = (action.data.items || []).length; addNote(`✓ Budget updated (${total} line items)`, "budget"); }
  else if (action.action === "materials") { state.materials = action.data; renderSiteOps(); renderSiteOpsLive(); const total = (action.data.items || []).length; addNote(`✓ Materials updated (${total} items)`, "siteops"); }
  else if (action.action === "attendance") { state.attendance = action.data; renderSiteOps(); renderSiteOpsLive(); const total = (action.data.records || []).length; addNote(`✓ Attendance updated (${total} records)`, "siteops"); }
  else if (action.action === "machinery") { state.machinery = action.data; renderSiteOps(); renderSiteOpsLive(); const total = (action.data.items || []).length; addNote(`✓ Machinery updated (${total} items)`, "siteops"); }
  else if (action.action === "charter") { state.charter = action.data; renderCharter(); addNote(`✓ Project charter updated`, "charter"); }
  else if (action.action === "crashing") { state.crashing = action.data; renderCrashing(); const total = (action.data.items || []).length; addNote(`✓ Crashing analysis updated (${total} tasks)`, "crashing"); }
  else if (action.action === "wbs") { state.wbs = action.data; renderWbs(); const total = (action.data.phases || []).length; addNote(`✓ WBS updated (${total} phases)`, "wbs"); }
  else if (action.action === "inventory") { state.inventory = action.data; renderInventory(); const total = (action.data.items || []).length; addNote(`✓ Inventory updated (${total} items)`, "inventory"); }
  else if (action.action === "floorplan") {
    ensureCollection("floorplan");
    const widthFt = Number(action.data.widthFt) || 40;
    const heightFt = Number(action.data.heightFt) || 25;
    const rooms = (action.data.rooms || []).map((r, i) => ({ id: "room" + Date.now() + i, name: r.name, x: r.x, y: r.y, width: r.width, height: r.height }));
    state.floorplan.plans.push({ id: "fp" + Date.now(), name: action.data.name || "AI Floor Plan", type: "schematic", widthFt, heightFt, rooms, pins: [] });
    renderFloorPlan();
    const flNoun = labelsFor("floorplan").tabLabel;
    addNote(`✓ ${flNoun} drafted (${rooms.length} ${labelsFor("floorplan").unitNounPlural.toLowerCase()})${currentIndustry() === "construction" ? ` — ${widthFt}' × ${heightFt}' overall` : ""} — a labeled diagram, not a photorealistic image`, "floorplan");
  }
  else if (action.action === "findings") {
    ensureCollection("findings");
    const items = (action.data.items || []).map((it, i) => ({ id: it.id || "fnd" + Date.now() + i, finding: it.finding, theme: it.theme, evidence: it.evidence, implication: it.implication }));
    state.findings = { items };
    renderFindings();
    addNote(`✓ Research Findings updated (${items.length} finding${items.length === 1 ? "" : "s"})`, "findings");
  }
  else if (action.action === "billing") {
    ensureCollection("billing");
    const entries = (action.data.entries || []).map((e, i) => ({ id: e.id || "bh" + Date.now() + i, date: e.date || todayISO(), consultant: e.consultant, workstream: e.workstream, hours: Number(e.hours) || 0, billable: e.billable !== false, rate: Number(e.rate) || 0 }));
    state.billing = { entries };
    renderBilling();
    addNote(`✓ Billable Hours updated (${entries.length} entr${entries.length === 1 ? "y" : "ies"})`, "billing");
  }
}
function handleAssistantReply(reply) {
  const actions = extractJsonActions(reply);
  const spokenText = reply.replace(/```json\s*[\s\S]*?```/gi, "").trim();
  if (spokenText) addMessage("assistant", spokenText);

  if (actions.length) {
    actions.forEach(applyOneAction);
    renderDashboard();
    renderSiteOpsLive();
    persistActiveProject();
    setTicker(actions.length > 1 ? `UPDATED ${actions.length} TABS AT ONCE` : "UPDATE APPLIED", true);
  } else {
    setTicker("SYSTEM READY · ASK THE ASSISTANT TO PLAN, TRACK, OR CHART YOUR PROJECT");
  }
}

// ===== Cross-tab propagation check (AI reviews manual edits for related updates elsewhere) =====
const MODULE_LABEL_FOR_TYPE = {
  gantt: "Schedule", kanban: "Site Tasks", raid: "RAID Log", dailylog: "Daily Log", submittals: "Submittals/RFI",
  punchlist: "Punch List", burndown: "Progress", teammember: "Team", timesheet: "Team (timesheet)", budget: "Budget",
  material: "Site Ops (materials)", attendance: "Site Ops (attendance)", machine: "Site Ops (machinery)",
  crashing: "Crashing", wbsphase: "WBS", wbsitem: "WBS", inventory: "Inventory",
  floorplan: "Floor Plan", floorplanpin: "Floor Plan (pin)", floorplanroom: "Floor Plan (room)",
  findings: "Research Findings", billing: "Billable Hours",
};
function summarizeActionShort(a) {
  const d = a.data || {};
  if (a.action === "gantt") return `${(d || []).length} task(s)`;
  if (a.action === "kanban") return `${(d.columns || []).reduce((n, c) => n + c.cards.length, 0)} card(s)`;
  if (a.action === "burndown") return `${(d.days || []).length} day(s)`;
  if (a.action === "raid") return `${(d.items || []).length} item(s)`;
  if (a.action === "dailylog") return `${(d.entries || []).length} entr(y/ies)`;
  if (a.action === "submittals") return `${(d.items || []).length} item(s)`;
  if (a.action === "punchlist") return `${(d.items || []).length} item(s)`;
  if (a.action === "team") return `${(d.members || []).length} member(s)`;
  if (a.action === "timesheet") return `${(d.entries || []).length} entr(y/ies)`;
  if (a.action === "budget") return `${(d.items || []).length} line item(s)`;
  if (a.action === "materials") return `${(d.items || []).length} item(s)`;
  if (a.action === "attendance") return `${(d.records || []).length} record(s)`;
  if (a.action === "machinery") return `${(d.items || []).length} item(s)`;
  if (a.action === "charter") return "charter fields";
  if (a.action === "crashing") return `${(d.items || []).length} task(s)`;
  if (a.action === "wbs") return `${(d.phases || []).length} phase(s)`;
  if (a.action === "inventory") return `${(d.items || []).length} item(s)`;
  if (a.action === "floorplan") return `${(d.rooms || []).length} room(s)`;
  return "";
}
let pendingProposedActions = [];
function showProposedUpdatesModal(actions, introText) {
  pendingProposedActions = actions;
  document.getElementById("proposedUpdatesIntro").textContent = introText || "Based on your recent edit, the assistant suggests these related updates:";
  document.getElementById("proposedUpdatesList").innerHTML = actions.map((a, i) => `
    <label style="display:flex; gap:8px; align-items:flex-start; padding:9px 0; border-bottom:1px solid var(--border); font-size:13px; cursor:pointer;">
      <input type="checkbox" checked data-idx="${i}" style="margin-top:3px;">
      <span><strong>${VIEW_LABELS[a.action] || a.action}</strong><br><span style="color:var(--text-dim); font-size:12px;">${escapeHtml(summarizeActionShort(a))}</span></span>
    </label>`).join("");
  document.getElementById("proposedUpdatesOverlay").style.display = "flex";
}
function closeProposedUpdatesModal() {
  document.getElementById("proposedUpdatesOverlay").style.display = "none";
  pendingProposedActions = [];
}
document.getElementById("proposedUpdatesDismiss").addEventListener("click", closeProposedUpdatesModal);
document.getElementById("proposedUpdatesApply").addEventListener("click", () => {
  const checkedIdx = [...document.querySelectorAll('#proposedUpdatesList input[type="checkbox"]:checked')].map((cb) => Number(cb.dataset.idx));
  checkedIdx.forEach((i) => applyOneAction(pendingProposedActions[i]));
  renderDashboard();
  renderSiteOpsLive();
  persistActiveProject();
  setTicker(checkedIdx.length ? `APPLIED ${checkedIdx.length} RELATED UPDATE${checkedIdx.length === 1 ? "" : "S"}` : "NO UPDATES APPLIED", true);
  closeProposedUpdatesModal();
});

let propagationInFlight = false;
async function triggerPropagationCheck(description) {
  if (propagationInFlight) return; // avoid overlapping checks if edits happen in quick succession
  propagationInFlight = true;
  const prevTicker = document.getElementById("tickerText").textContent;
  setTicker("CHECKING FOR RELATED UPDATES…", true);
  try {
    const projects = loadAllProjects();
    const projectType = (projects[activeProjectId] && projects[activeProjectId].type) || "";
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: chatRequestHeaders(),
      body: JSON.stringify({
        messages: [{ role: "user", content: `The user just made this edit directly in the app (not through chat): ${description}` }],
        charts: state,
        projectType,
        mode: "propagation",
      }),
    });
    const data = await res.json();
    if (!res.ok) { setTicker(prevTicker); return; }
    const reply = data.reply || "";
    const actions = extractJsonActions(reply);
    if (actions.length) {
      showProposedUpdatesModal(actions, reply.replace(/```json\s*[\s\S]*?```/gi, "").trim());
      setTicker(`FOUND ${actions.length} RELATED UPDATE${actions.length === 1 ? "" : "S"} · REVIEW & APPLY`, true);
    } else {
      setTicker("SYSTEM READY · NO RELATED UPDATES NEEDED", true);
    }
  } catch (e) {
    setTicker(prevTicker);
  } finally {
    propagationInFlight = false;
  }
}

function showThinkingIndicator() {
  CHAT_MOUNTS.forEach((m) => {
    const container = document.getElementById(m.log);
    if (!container) return;
    const el = document.createElement("div");
    el.className = "msg-thinking";
    el.id = `${m.log}-thinking`;
    el.innerHTML = "<span></span><span></span><span></span>";
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  });
}
function hideThinkingIndicator() {
  CHAT_MOUNTS.forEach((m) => {
    const el = document.getElementById(`${m.log}-thinking`);
    if (el) el.remove();
  });
}
async function sendChatMessage(text) {
  addMessage("user", text);
  history.push({ role: "user", content: text });
  CHAT_MOUNTS.forEach((m) => { const btn = document.getElementById(m.send); if (btn) btn.disabled = true; });
  showThinkingIndicator();
  try {
    const trimmedHistory = history.slice(-MAX_API_HISTORY);
    const projects = loadAllProjects();
    const projectType = (projects[activeProjectId] && projects[activeProjectId].type) || "";
    const res = await fetch("/api/chat", {
      method: "POST", headers: chatRequestHeaders(),
      body: JSON.stringify({ messages: trimmedHistory, charts: state, projectType }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 429) { addMessage("assistant", data.error || "You've hit today's AI assistant limit."); setTicker("DAILY AI LIMIT REACHED"); return; }
      addMessage("assistant", `Error: ${data.error || "the assistant is unavailable right now."}`); setTicker("SYSTEM ERROR · CHECK API KEY CONFIGURATION"); return;
    }
    const reply = data.reply || "";
    history.push({ role: "assistant", content: reply });
    handleAssistantReply(reply);
    persistActiveProject();
    renderChatHistoryList();
  } catch (err) {
    addMessage("assistant", "Error: couldn't reach the server. Check your connection and try again.");
    setTicker("SYSTEM ERROR · REQUEST FAILED");
  } finally {
    CHAT_MOUNTS.forEach((m) => { const btn = document.getElementById(m.send); if (btn) btn.disabled = false; });
    hideThinkingIndicator();
  }
}
CHAT_MOUNTS.forEach((m) => {
  const form = document.getElementById(m.form);
  const input = document.getElementById(m.input);
  if (!form || !input) return;
  form.addEventListener("submit", (e) => { e.preventDefault(); const text = input.value.trim(); if (!text) return; input.value = ""; sendChatMessage(text); });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
});

// ===== Set Up Entire Project (runs in safe batches — one huge reply risks the 10s serverless timeout) =====
const SETUP_BATCHES = [
  { label: "Schedule & Site Tasks", prompt: "Set up the project schedule and the site task board for this project, based on its name and type. Keep the schedule to 6-8 realistic tasks and the task board to a handful of cards across To Do / In Progress / Done." },
  { label: "Progress & RAID Log", prompt: "Add a schedule burndown for this project and populate the RAID log with 3-4 realistic risks, assumptions, issues, and dependencies relevant to this type of project." },
  { label: "Daily Log, Submittals & Punch List", prompt: "Add one daily log entry for today, 2-3 submittals or RFIs, and 3-4 punch list items — all consistent with this project." },
  { label: "Team & Budget", prompt: "Set up a small team roster (3-4 people with construction roles) with a couple of timesheet entries, and a budget with 4-5 line items appropriate for this project type." },
  { label: "Materials, Attendance & Machinery", prompt: "Set up materials usage (4-5 items with realistic units), a few attendance records for today for the team roster, and a machinery roster (3-4 pieces of equipment) for this project." },
  { label: "Charter & Crashing Analysis", prompt: "Draft a project charter for this project, and a crashing analysis for the 2-3 most time-critical tasks in the schedule." },
  { label: "WBS & Inventory", prompt: "Create a work breakdown structure (2-3 phases with work packages) and a starter inventory list (3-4 items) for this project." },
];
async function setupEntireProject() {
  const btn = document.getElementById("btnSetupEntireProject");
  const note = document.getElementById("setupProgressNote");
  if (btn.disabled) return;
  if (!confirm(`This will ask the assistant to populate every module in ${SETUP_BATCHES.length} steps (${SETUP_BATCHES.length} separate requests, so it costs proportionally more than one message). Continue?`)) return;
  btn.disabled = true;
  note.style.display = "block";
  for (let i = 0; i < SETUP_BATCHES.length; i++) {
    note.textContent = `Setting up: ${SETUP_BATCHES[i].label} (step ${i + 1} of ${SETUP_BATCHES.length})…`;
    setTicker(`SETTING UP PROJECT · STEP ${i + 1} OF ${SETUP_BATCHES.length}`, true);
    await sendChatMessage(SETUP_BATCHES[i].prompt);
  }
  note.style.display = "none";
  btn.disabled = false;
  setTicker("PROJECT SETUP COMPLETE · ALL TABS UPDATED", true);
  renderDashboard();
  renderSiteOpsLive();
}
document.getElementById("btnSetupEntireProject").addEventListener("click", setupEntireProject);

// ===== Landing page misc =====
document.getElementById("brandHome").addEventListener("click", () => { persistActiveProject(); showLanding(); renderIndustryCounts(); });

// ===== API key status check =====
(async function checkStatus() {
  const dot = document.getElementById("apiDot");
  const dotBubble = document.getElementById("apiDotBubble");
  const text = document.getElementById("apiStatusText");
  try {
    const res = await fetch("/api/chat", { method: "GET" });
    const data = await res.json();
    if (data.configured) { dot.classList.add("ok"); dotBubble.classList.add("ok"); text.textContent = "Assistant online"; }
    else { dot.classList.add("bad"); dotBubble.classList.add("bad"); text.textContent = "API key missing"; }
  } catch { dot.classList.add("bad"); dotBubble.classList.add("bad"); text.textContent = "Server unreachable"; }
})();

// ===== Boot (waits for auth.js to confirm a signed-in session) =====
function bootApp() { initProjects(); boot(); }
if (window.TracklineAuthReady) { window.TracklineAuthReady.then(bootApp); } else { bootApp(); }
