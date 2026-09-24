// ===== Supabase auth + cloud project sync =====
// Fill these in from your Supabase project's Settings → API page.
// The anon key is meant to be public/embeddable — it only grants what the
// Row Level Security policies in supabase/schema.sql allow (a user can only
// touch their own rows).
const SUPABASE_URL = "https://zmmrkgnjiupjfxhynsgr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptbXJrZ25qaXVwamZ4aHluc2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNDU2NzksImV4cCI6MjEwNTgyMTY3OX0.vYKcnbWhXaUnDFL3E-A1LxyCAJhUNUYDyj93FhD2Tcc";

const PROJECTS_STORAGE_KEY = "trackline_projects_v1";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

let currentSession = null;
let authReadyResolve = null;
window.TracklineAuthReady = new Promise((resolve) => { authReadyResolve = resolve; });

window.TracklineAuth = {
  client: supabaseClient,
  getSession: () => currentSession,
  getAccessToken: () => (currentSession ? currentSession.access_token : null),
};

function setLoginError(msg) {
  const el = document.getElementById("loginError");
  el.textContent = msg || "";
  el.style.display = msg ? "block" : "none";
}

async function pullCloudProjects(userId) {
  const { data, error } = await supabaseClient.from("projects").select("id,data").eq("user_id", userId);
  if (error) { console.error("Failed to load projects from Supabase", error); return {}; }
  const projects = {};
  (data || []).forEach((row) => { projects[row.id] = row.data; });
  return projects;
}

async function claimLocalProjects(userId) {
  let local = {};
  try { local = JSON.parse(localStorage.getItem(PROJECTS_STORAGE_KEY) || "{}"); } catch { local = {}; }
  const localIds = Object.keys(local);
  if (!localIds.length) return;
  const rows = localIds.map((id) => ({
    id, user_id: userId, name: local[id].name || "Untitled Project", type: local[id].type || "",
    data: local[id], updated_at: new Date().toISOString(),
  }));
  const { error } = await supabaseClient.from("projects").upsert(rows);
  if (error) console.error("Failed to import local projects into account", error);
}

async function completeLogin(session) {
  currentSession = session;
  const userId = session.user.id;

  let projects = await pullCloudProjects(userId);
  if (!Object.keys(projects).length) {
    // First time this account has been seen — bring in any anonymous
    // in-browser projects from before signing up/in.
    await claimLocalProjects(userId);
    projects = await pullCloudProjects(userId);
  }
  localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  if (window.TracklineCloud) window.TracklineCloud.setInitialIds(Object.keys(projects));

  document.getElementById("loginView").style.display = "none";
  document.querySelectorAll(".account-email").forEach((el) => { el.textContent = session.user.email; });

  if (authReadyResolve) { authReadyResolve(); authReadyResolve = null; }
}

function showLoginGate() {
  document.getElementById("loginView").style.display = "flex";
}

async function signOut() {
  await supabaseClient.auth.signOut();
  location.reload();
}
document.getElementById("logoutBtnApp").addEventListener("click", signOut);
document.getElementById("logoutLinkLanding").addEventListener("click", (e) => { e.preventDefault(); signOut(); });

// ===== Password visibility toggle =====
document.getElementById("loginPasswordToggle").addEventListener("click", () => {
  const input = document.getElementById("loginPassword");
  const btn = document.getElementById("loginPasswordToggle");
  const showing = input.type === "text";
  input.type = showing ? "password" : "text";
  btn.classList.toggle("showing", !showing);
  btn.title = showing ? "Show password" : "Hide password";
  btn.setAttribute("aria-label", btn.title);
});

// ===== Login / sign-up form =====
let authMode = "signin"; // "signin" | "signup"
document.getElementById("loginToggleLink").addEventListener("click", (e) => {
  e.preventDefault();
  authMode = authMode === "signin" ? "signup" : "signin";
  setLoginError("");
  document.getElementById("loginSubmit").textContent = authMode === "signin" ? "Sign In" : "Create Account";
  document.getElementById("loginToggleText").textContent = authMode === "signin" ? "Don't have an account?" : "Already have an account?";
  document.getElementById("loginToggleLink").textContent = authMode === "signin" ? "Create one" : "Sign in";
});

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const submitBtn = document.getElementById("loginSubmit");
  setLoginError("");
  submitBtn.disabled = true;
  try {
    if (authMode === "signup") {
      const { data, error } = await supabaseClient.auth.signUp({ email, password });
      if (error) { setLoginError(error.message); return; }
      if (!data.session) {
        // Email confirmation is turned on in the Supabase project — no session yet.
        setLoginError("Check your email to confirm your account, then sign in.");
        return;
      }
      await completeLogin(data.session);
    } else {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) { setLoginError(error.message); return; }
      await completeLogin(data.session);
    }
  } catch (err) {
    setLoginError("Couldn't reach the server. Check your connection and try again.");
  } finally {
    submitBtn.disabled = false;
  }
});

// ===== Restore an existing session on page load =====
(async function initAuth() {
  const { data } = await supabaseClient.auth.getSession();
  if (data && data.session) {
    await completeLogin(data.session);
  } else {
    showLoginGate();
  }
})();
