// ---- Config
const BATCH_SIZE = 10;     // show 10 initially, load 10 more each time
const DEBOUNCE_MS = 120;   // search debounce

// ---- Elements
const listEl = document.getElementById("list");
const dropdownEl = document.getElementById("myDropdown");
const toggleBtn = document.getElementById("toggleBtn");
const inputEl = document.getElementById("myInput");
const countEl = document.getElementById("count");
const statusEl = document.getElementById("status");

// ---- State
let ALL_ITEMS = [];        // full dataset loaded from course_codes.txt
let filtered = [];         // current filtered set
let renderedCount = 0;     // how many of `filtered` are currently rendered
let loading = false;

// ---- Load data from course_codes.txt (comma-separated list)
async function loadCourses() {
  // Make sure course_codes.txt is in the same folder as index.html
  const res = await fetch("course_codes.txt");
  const text = await res.text();

  // Split on commas, trim whitespace, drop empties, de-dupe
  ALL_ITEMS = text
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  // Optional: dedupe while preserving order
  const seen = new Set();
  ALL_ITEMS = ALL_ITEMS.filter(c => (seen.has(c) ? false : (seen.add(c), true)));

  filtered = ALL_ITEMS.slice();
}

// ---- Open/close
toggleBtn.addEventListener("click", async () => {
  const willShow = !dropdownEl.classList.contains("show");
  dropdownEl.classList.toggle("show", willShow);
  toggleBtn.setAttribute("aria-expanded", String(willShow));
  if (willShow) {
    if (ALL_ITEMS.length === 0) {
      statusEl.textContent = "Loading…";
      await loadCourses();
      statusEl.textContent = "";
    }
    // Reset & render initial batch
    inputEl.value = "";
    applyFilter(""); // ensures filtered === ALL_ITEMS
    inputEl.focus();
  }
});

// Close when clicking outside
document.addEventListener("click", (e) => {
  if (!dropdownEl.contains(e.target) && e.target !== toggleBtn) {
    dropdownEl.classList.remove("show");
    toggleBtn.setAttribute("aria-expanded", "false");
  }
});

// ---- Rendering (virtualized)
function clearList() {
  listEl.innerHTML = "";
  renderedCount = 0;
}

function renderNextBatch() {
  if (loading) return;
  if (renderedCount >= filtered.length) return;

  loading = true;
  statusEl.textContent = "Loading…";

  const end = Math.min(renderedCount + BATCH_SIZE, filtered.length);
  const frag = document.createDocumentFragment();

  for (let i = renderedCount; i < end; i++) {
    const a = document.createElement("a");
    a.href = "#";
    a.className = "item";
    a.role = "option";
    a.textContent = filtered[i];
    a.addEventListener("click", (ev) => {
      ev.preventDefault();
      toggleBtn.textContent = `${filtered[i]} ▾`;
      dropdownEl.classList.remove("show");
      toggleBtn.setAttribute("aria-expanded", "false");
    });
    frag.appendChild(a);
  }

  listEl.appendChild(frag);
  renderedCount = end;
  countEl.textContent = `${filtered.length} items`;
  statusEl.textContent = renderedCount >= filtered.length ? "All loaded" : "";
  loading = false;
}

function maybeShowEmpty() {
  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="empty">No matches</div>`;
    countEl.textContent = "0 items";
    statusEl.textContent = "";
    renderedCount = 0;
    return true;
  }
  return false;
}

// ---- Infinite scroll
listEl.addEventListener("scroll", () => {
  const nearBottom = listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 24;
  if (nearBottom) renderNextBatch();
});

// ---- Filtering (debounced) across ALL items
let debounceTimer = null;
inputEl.addEventListener("input", (e) => {
  const q = e.target.value.trim();
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    applyFilter(q);
  }, DEBOUNCE_MS);
});

function applyFilter(query) {
  const Q = query.toLowerCase();
  filtered = Q
    ? ALL_ITEMS.filter((item) => item.toLowerCase().includes(Q))
    : ALL_ITEMS.slice();

  clearList();
  if (!maybeShowEmpty()) {
    renderNextBatch();      // first 10
    listEl.scrollTop = 0;   // reset scroll to top
  }
}

// Optional: pre-load on page ready so first open is instant
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadCourses();
  } catch (e) {
    // If you open the file directly from the file:// URL and fetch is blocked,
    // you can run from a small local server (e.g., `python -m http.server`).
    console.warn("Could not preload courses:", e);
  }
});
