const SOURCE_DATA = window.DOCTOR_DATA || [];
const SALES_EMAIL = "arnabdascontact@gmail.com";
const PREVIEW_LIMIT_PER_COUNTRY = 100;
const TOP_SEGMENTS = ["Germany", "United Kingdom", "France", "Italy", "Spain", "United States"];

function normalizeData(rows) {
  const previewCounts = new Map();
  return rows.map((row, index) => {
    const copy = { ...row };
    copy._index = index;
    copy.v = Boolean(row.v);
    copy.f = false;

    if (!copy.v) {
      const country = copy.c || "Unknown";
      const current = previewCounts.get(country) || 0;
      if (current < PREVIEW_LIMIT_PER_COUNTRY) {
        copy.f = true;
        previewCounts.set(country, current + 1);
      }
    }

    return copy;
  });
}

const DATA = normalizeData(SOURCE_DATA);

const state = {
  search: "",
  country: "All",
  specialty: "All",
  access: "all",
  sort: "priority",
  page: 1,
  pageSize: 25,
  modalSegment: "custom segment",
  modalTitle: "Request access"
};

const $ = (id) => document.getElementById(id);

function showToast(message) {
  const el = $("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => el.classList.remove("show"), 1800);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function flagFor(country) {
  const flags = {
    "United Kingdom": "🇬🇧",
    UK: "🇬🇧",
    Germany: "🇩🇪",
    France: "🇫🇷",
    Italy: "🇮🇹",
    Spain: "🇪🇸",
    "United States": "🇺🇸"
  };
  return flags[country] || "";
}

function statusClass(row) {
  if (row.f) return "st-free";
  if (row.v) return "st-locked";
  return "st-locked";
}

function statusText(row) {
  if (row.f) return "Free preview";
  if (row.v) return "Verified locked";
  return "Locked";
}

function emailHTML(row) {
  if (row.f) {
    return `<span class="email revealed">${escapeHTML(row.e)}</span>`;
  }
  return '<span class="email locked">🔒 Hidden</span>';
}

function rowAccess(row) {
  if (row.f) return "free";
  if (row.v) return "verified";
  return "locked";
}

function mailtoLink(subject, body) {
  return `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function uniqueCountries() {
  return [...new Set(DATA.map((r) => r.c).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function uniqueSpecialties() {
  return [...new Set(DATA.map((r) => r.s).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function getFiltered() {
  const q = state.search.trim().toLowerCase();
  let rows = DATA.filter((row) => {
    const matchesQuery = !q || [row.n, row.s, row.o, row.e, row.c].some((v) => String(v || "").toLowerCase().includes(q));
    const matchesCountry = state.country === "All" || row.c === state.country;
    const matchesSpecialty = state.specialty === "All" || row.s === state.specialty;
    const access = rowAccess(row);
    const matchesAccess = state.access === "all" || access === state.access;
    return matchesQuery && matchesCountry && matchesSpecialty && matchesAccess;
  });

  if (state.sort === "name") {
    rows.sort((a, b) => a.n.localeCompare(b.n));
  } else if (state.sort === "country") {
    rows.sort((a, b) => a.c.localeCompare(b.c) || a.n.localeCompare(b.n));
  } else if (state.sort === "specialty") {
    rows.sort((a, b) => a.s.localeCompare(b.s) || a.n.localeCompare(b.n));
  } else {
    // Free preview rows first, then verified-locked rows, then the rest.
    rows.sort((a, b) => (b.f - a.f) || (b.v - a.v) || a.n.localeCompare(b.n));
  }
  return rows;
}

function csvEscape(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function exportPreviewCSV() {
  const rows = getFiltered().filter((row) => row.f);
  if (!rows.length) {
    openModal("Nothing to export", "No preview rows match the current filters.");
    return;
  }
  const header = ["name", "specialty", "organization", "country", "email", "verified"];
  const csv = [
    header.join(","),
    ...rows.map((row) => [
      row.n, row.s, row.o, row.c, row.e, row.v ? "yes" : "no"
    ].map(csvEscape).join(","))
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "verdoc-preview-leads.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function populateFilters() {
  const countries = uniqueCountries();
  const specialties = uniqueSpecialties();

  const countrySelect = $("country");
  countrySelect.innerHTML = '<option value="All">All countries</option>' + countries.map((c) => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");

  const specialtySelect = $("specialty");
  specialtySelect.innerHTML = '<option value="All">All specialties</option>' + specialties.map((s) => `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join("");
}

function renderStats() {
  $("totalCount").textContent = DATA.length.toLocaleString();
  $("freeCount").textContent = DATA.filter((r) => r.f).length.toLocaleString();
  $("verifiedCount").textContent = DATA.filter((r) => r.v).length.toLocaleString();
  $("countryCount").textContent = uniqueCountries().length.toLocaleString();
  $("coverageValue").textContent = `${DATA.length.toLocaleString()} records`;
  $("previewPill").textContent = `${PREVIEW_LIMIT_PER_COUNTRY.toLocaleString()} preview leads per country`;
  $("previewSummary").textContent = `Free preview includes up to ${PREVIEW_LIMIT_PER_COUNTRY} non-verified leads per country. Verified records stay locked in every country and specialty.`;
}

function render() {
  const rows = getFiltered();
  const pageSize = Number(state.pageSize);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  if (state.page > pages) state.page = pages;
  const start = (state.page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  $("tbody").innerHTML = pageRows.length
    ? pageRows.map((row) => {
      const action = row.f
        ? `<button class="copy-btn mini" data-copy="${escapeHTML(row.e)}">Copy email</button>`
        : `<button class="unlock-btn mini" data-unlock="${row.id}">Request access</button>`;

      const rowClass = row.f ? "preview-row" : (row.v ? "verified-row" : "locked-row");

      return `<tr class="${rowClass}">
        <td>
          <strong>${escapeHTML(row.n)}</strong><br>
          <small>${escapeHTML(row.s || "")}</small>
        </td>
        <td>${row.o ? `${flagFor(row.c) ? `<span class="flag">${flagFor(row.c)}</span>` : ""}${escapeHTML(row.o)}` : '<small>—</small>'}</td>
        <td>${escapeHTML(row.c)}</td>
        <td><span class="status ${statusClass(row)}">${statusText(row)}</span></td>
        <td>${emailHTML(row)}</td>
        <td class="actions">${action}</td>
      </tr>`;
    }).join("")
    : '<tr><td colspan="6" style="padding:24px;color:#90a3bf;">No matches.</td></tr>';

  $("pageInfo").textContent = `Page ${state.page} of ${pages}`;
  $("rowsPill").textContent = `${rows.length.toLocaleString()} rows`;

  const pager = $("pager");
  pager.innerHTML = "";
  const button = (txt, disabled, fn) => {
    const b = document.createElement("button");
    b.className = "secondary mini";
    b.textContent = txt;
    b.disabled = disabled;
    b.onclick = fn;
    return b;
  };
  pager.appendChild(button("Prev", state.page === 1, () => { state.page--; render(); }));
  const count = document.createElement("span");
  count.className = "pill";
  count.textContent = `${rows.length.toLocaleString()} matching rows`;
  pager.appendChild(count);
  pager.appendChild(button("Next", state.page === pages, () => { state.page++; render(); }));

  $("resultsPill").textContent = `${rows.length.toLocaleString()} results`;
  bindRowEvents();
}

function bindRowEvents() {
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.onclick = async () => {
      const value = btn.dataset.copy || "";
      try {
        await navigator.clipboard.writeText(value);
        showToast("Email copied to clipboard");
      } catch {
        showToast("Copy blocked by browser");
      }
    };
  });

  document.querySelectorAll("[data-unlock]").forEach((btn) => {
    btn.onclick = () => {
      openRequestModal(`Locked lead #${btn.dataset.unlock}`);
    };
  });
}

function openModal(title, text) {
  $("modalTitle").textContent = title;
  $("modalText").textContent = text;
  $("modalBackdrop").style.display = "flex";
  $("modalBackdrop").setAttribute("aria-hidden", "false");
}

function closeModal() {
  $("modalBackdrop").style.display = "none";
  $("modalBackdrop").setAttribute("aria-hidden", "true");
}

function openRequestModal(segment = "custom segment") {
  state.modalSegment = segment;
  $("modalTitle").textContent = "Request access";
  $("modalText").textContent = "Send a request for premium access. The form opens a pre-filled email, so you can keep everything direct and simple.";
  $("reqSegment").value = segment;
  $("modalBackdrop").style.display = "flex";
  $("modalBackdrop").setAttribute("aria-hidden", "false");
}

function syncModalFields() {
  const savedName = localStorage.getItem("verdoc_name") || "";
  const savedCompany = localStorage.getItem("verdoc_company") || "";
  const savedEmail = localStorage.getItem("verdoc_email") || "";
  $("reqName").value = savedName;
  $("reqCompany").value = savedCompany;
  $("reqEmail").value = savedEmail;
}

function collectRequestData() {
  return {
    name: $("reqName").value.trim(),
    company: $("reqCompany").value.trim(),
    email: $("reqEmail").value.trim(),
    segment: $("reqSegment").value.trim(),
    useCase: $("reqUseCase").value.trim(),
    notes: $("reqNotes").value.trim()
  };
}

function sendRequestEmail() {
  const req = collectRequestData();
  if (!req.name || !req.company || !req.email) {
    openModal("Missing fields", "Please fill in your name, company, and work email.");
    return;
  }

  localStorage.setItem("verdoc_name", req.name);
  localStorage.setItem("verdoc_company", req.company);
  localStorage.setItem("verdoc_email", req.email);

  const subject = `VerDoc access request — ${req.segment}`;
  const body = [
    `Name: ${req.name}`,
    `Company: ${req.company}`,
    `Work email: ${req.email}`,
    `Segment requested: ${req.segment}`,
    `Use case: ${req.useCase}`,
    `Notes: ${req.notes || "—"}`
  ].join("\n");

  window.location.href = mailtoLink(subject, body);
  closeModal();
}

function wireEvents() {
  $("search").addEventListener("input", (e) => { state.search = e.target.value; state.page = 1; render(); });
  $("country").addEventListener("change", (e) => { state.country = e.target.value; state.page = 1; render(); });
  $("specialty").addEventListener("change", (e) => { state.specialty = e.target.value; state.page = 1; render(); });
  $("access").addEventListener("change", (e) => { state.access = e.target.value; state.page = 1; render(); });
  $("sort").addEventListener("change", (e) => { state.sort = e.target.value; state.page = 1; render(); });
  $("pageSize").addEventListener("change", (e) => { state.pageSize = e.target.value; state.page = 1; render(); });

  $("exportBtn").onclick = exportPreviewCSV;
  $("closeModal").onclick = closeModal;
  $("modalBackdrop").addEventListener("click", (e) => { if (e.target.id === "modalBackdrop") closeModal(); });
  $("sendRequest").onclick = sendRequestEmail;

  $("openRequestTop").onclick = () => openRequestModal("custom segment");
  $("openRequestHero").onclick = () => openRequestModal("custom segment");
  $("scrollPricing").onclick = () => $("pricing").scrollIntoView({ behavior: "smooth", block: "start" });
  $("scrollDirectory").onclick = () => $("directory").scrollIntoView({ behavior: "smooth", block: "start" });
  $("jumpPricing").onclick = () => $("pricing").scrollIntoView({ behavior: "smooth", block: "start" });
  document.querySelectorAll(".open-segment").forEach((btn) => {
    btn.onclick = () => openRequestModal(btn.dataset.segment || "custom segment");
  });
}

function init() {
  populateFilters();
  renderStats();
  syncModalFields();
  wireEvents();
  render();
}

init();
