// script.js — Ledger credit approval estimator front end

const SELECT_FIELDS = {
  gender: "CODE_GENDER",
  family_status: "NAME_FAMILY_STATUS",
  income_type: "NAME_INCOME_TYPE",
  occupation: "OCCUPATION_TYPE",
  education: "NAME_EDUCATION_TYPE",
  housing_type: "NAME_HOUSING_TYPE",
};

const GENDER_LABELS = { M: "Male", F: "Female" };

async function parseJsonOrError(res) {
  const text = await res.text();
  if (!res.ok) {
    let errorMessage = text;
    try {
      const data = JSON.parse(text);
      errorMessage = data.error || data.message || text;
    } catch (_) {}
    throw new Error(`Request failed (${res.status}): ${errorMessage}`);
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON response: ${err.message}`);
  }
}

async function loadMeta() {
  try {
    const res = await fetch("/api/meta");
    const data = await parseJsonOrError(res);

    if (!data.form_options || !data.form_options.categorical_options) {
      throw new Error("Missing form options in meta response");
    }

    populateSelects(data.form_options.categorical_options);
    renderMetrics(data.metrics);
    renderFeatureBars(data.metrics.top_features || []);
  } catch (err) {
    console.error("Failed to load meta:", err);
    document.getElementById("formHint").textContent =
      "Unable to load dropdown options. Check the server or network.";
    populateSelects({});
  }
}

function populateSelects(options) {
  for (const [fieldId, optionKey] of Object.entries(SELECT_FIELDS)) {
    const select = document.getElementById(fieldId);
    const values = options[optionKey] || [];
    select.innerHTML = "";

    if (!values.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.disabled = true;
      opt.selected = true;
      opt.textContent = "No options available";
      select.appendChild(opt);
      continue;
    }

    values.forEach((val) => {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = fieldId === "gender" ? GENDER_LABELS[val] || val : val;
      select.appendChild(opt);
    });
  }
}

function renderMetrics(metrics) {
  document.getElementById("mAccuracy").textContent = pct(metrics.accuracy);
  document.getElementById("mPrecision").textContent = pct(metrics.precision);
  document.getElementById("mRecall").textContent = pct(metrics.recall);
  document.getElementById("mF1").textContent = pct(metrics.f1_score);
  document.getElementById("mAuc").textContent = metrics.roc_auc.toFixed(3);
  document.getElementById("nAlgo").textContent = metrics.model_type;
  document.getElementById("nTrain").textContent =
    metrics.n_train.toLocaleString();
  document.getElementById("nTest").textContent =
    metrics.n_test.toLocaleString();
}

function renderFeatureBars(features) {
  const container = document.getElementById("featureBars");
  const maxImportance = Math.max(...features.map((f) => f.importance));
  container.innerHTML = "";
  features.slice(0, 8).forEach((f) => {
    const row = document.createElement("div");
    row.className = "feature-bar-row";
    const widthPct = (f.importance / maxImportance) * 100;
    row.innerHTML = `
      <span>${prettyFeatureName(f.feature)}</span>
      <span class="feature-bar-track"><span class="feature-bar-fill" style="width:${widthPct}%"></span></span>
      <span>${f.importance.toFixed(3)}</span>
    `;
    container.appendChild(row);
  });
}

function prettyFeatureName(raw) {
  return raw
    .replace(/^(num__|cat__)/, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function pct(x) {
  return (x * 100).toFixed(1) + "%";
}

async function loadSubmissions() {
  const res = await fetch("/api/submissions");
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!res.ok) {
    console.error("Failed to load submissions:", res.status, text);
    renderSubmissions([]);
    return;
  }

  let data;
  try {
    data = contentType.includes("application/json")
      ? JSON.parse(text)
      : { submissions: [] };
  } catch (err) {
    console.error("Unable to parse submissions JSON:", text, err);
    data = { submissions: [] };
  }
  renderSubmissions(data.submissions || []);
}

function renderSubmissions(submissions) {
  const tbody = document.querySelector("#submissionsTable tbody");
  tbody.innerHTML = "";
  renderSubmissionStats(submissions);

  if (!submissions.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="no-data">No stored submissions yet.</td></tr>`;
    return;
  }

  submissions.forEach((submission, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${formatTimestamp(submission.timestamp)}</td>
      <td>${GENDER_LABELS[submission.payload.gender] || submission.payload.gender} · ${submission.payload.income_type}</td>
      <td class="${submission.prediction === 1 ? "approved" : "rejected"}">${submission.label}</td>
      <td>${pct(submission.probability_approved)}</td>
      <td><button type="button" class="load-btn" data-index="${index}">Load</button></td>
    `;
    tbody.appendChild(row);
  });

  tbody.querySelectorAll(".load-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      const index = Number(event.currentTarget.dataset.index);
      populateFormFromSubmission(submissions[index]);
    });
  });
}

function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function renderSubmissionStats(submissions) {
  const total = submissions.length;
  const approved = submissions.filter((item) => item.prediction === 1).length;
  const rejected = submissions.filter((item) => item.prediction === 0).length;

  document.getElementById("totalSubmissions").textContent =
    `${total} saved application${total === 1 ? "" : "s"}`;
  document.getElementById("approvedCount").textContent = `${approved} accepted`;
  document.getElementById("rejectedCount").textContent = `${rejected} declined`;
}

function populateFormFromSubmission(submission) {
  const payload = submission.payload;

  document.getElementById("gender").value = payload.gender;
  document.getElementById("age").value = payload.age;
  document.getElementById("family_status").value = payload.family_status;
  document.getElementById("children").value = payload.children;
  document.getElementById("family_members").value = payload.family_members;
  document.getElementById("income_type").value = payload.income_type;
  document.getElementById("occupation").value = payload.occupation;
  document.getElementById("income").value = payload.income;
  document.getElementById("years_employed").value = payload.years_employed;
  document.getElementById("education").value = payload.education;
  document.getElementById("housing_type").value = payload.housing_type;
  document.getElementById("own_car").value = payload.own_car;
  document.getElementById("own_realty").value = payload.own_realty;
  document.getElementById("work_phone").checked = Boolean(
    Number(payload.work_phone),
  );
  document.getElementById("phone").checked = Boolean(Number(payload.phone));
  document.getElementById("email").checked = Boolean(Number(payload.email));

  updateCardPreview();
  document.getElementById("resultPanel").hidden = false;
  document.getElementById("resultLabel").textContent = submission.label;
  document.getElementById("resultLabel").style.color =
    submission.prediction === 1 ? "var(--emerald-soft)" : "var(--rust-soft)";
  document.getElementById("resultBand").textContent =
    submission.confidence_band;
  document.getElementById("resultPct").textContent =
    pct(submission.probability_approved) + " approval likelihood";
  document.getElementById("resultBarFill").style.width = pct(
    submission.probability_approved,
  );
  setCardState(submission.probability_approved);
  document.getElementById("formHint").textContent =
    "Loaded a saved record for editing. Stamp again to update history.";
}

function maskedCardNumber(seedText) {
  // Deterministic pseudo-number derived from applicant text, purely cosmetic.
  let hash = 0;
  for (let i = 0; i < seedText.length; i++) {
    hash = (hash * 31 + seedText.charCodeAt(i)) >>> 0;
  }
  const digits = String(hash).padStart(4, "0").slice(-4);
  return `•••• •••• •••• ${digits}`;
}

function updateCardPreview() {
  const gender = document.getElementById("gender").value;
  const incomeType = document.getElementById("income_type").value;
  const income = document.getElementById("income").value;

  const nameSeed = `${gender}-${incomeType}`;
  document.getElementById("cardName").textContent =
    (GENDER_LABELS[gender]
      ? GENDER_LABELS[gender].toUpperCase()
      : "APPLICANT") +
    " · " +
    (incomeType || "").toUpperCase();
  document.getElementById("cardNumber").textContent = maskedCardNumber(
    nameSeed + income,
  );
}

function setCardState(probApproved) {
  const card = document.getElementById("creditCard");
  const meterFill = document.getElementById("cardMeterFill");
  const status = document.getElementById("cardStatus");

  card.classList.remove("state-approved", "state-rejected");
  meterFill.style.width = `${Math.round(probApproved * 100)}%`;

  if (probApproved >= 0.5) {
    card.classList.add("state-approved");
    meterFill.style.background = "var(--emerald)";
    status.textContent = "approved";
    status.style.color = "var(--emerald-soft)";
  } else {
    card.classList.add("state-rejected");
    meterFill.style.background = "var(--rust)";
    status.textContent = "declined";
    status.style.color = "var(--rust-soft)";
  }
}

function resetCardState() {
  const card = document.getElementById("creditCard");
  card.classList.remove("state-approved", "state-rejected");
  document.getElementById("cardMeterFill").style.width = "50%";
  document.getElementById("cardMeterFill").style.background = "var(--gold)";
  document.getElementById("cardStatus").textContent = "awaiting input";
  document.getElementById("cardStatus").style.color = "";
}

function collectFormPayload() {
  return {
    gender: document.getElementById("gender").value,
    age: document.getElementById("age").value,
    family_status: document.getElementById("family_status").value,
    children: document.getElementById("children").value,
    family_members: document.getElementById("family_members").value,
    income_type: document.getElementById("income_type").value,
    occupation: document.getElementById("occupation").value,
    income: document.getElementById("income").value,
    years_employed: document.getElementById("years_employed").value,
    education: document.getElementById("education").value,
    housing_type: document.getElementById("housing_type").value,
    own_car: document.getElementById("own_car").value,
    own_realty: document.getElementById("own_realty").value,
    work_phone: document.getElementById("work_phone").checked ? 1 : 0,
    phone: document.getElementById("phone").checked ? 1 : 0,
    email: document.getElementById("email").checked ? 1 : 0,
  };
}

async function handleSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById("submitBtn");
  const hint = document.getElementById("formHint");
  btn.disabled = true;
  btn.textContent = "Reading the file…";

  try {
    const res = await fetch("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(collectFormPayload()),
    });
    const data = await parseJsonOrError(res);

    document.getElementById("resultPanel").hidden = false;
    document.getElementById("resultLabel").textContent = data.label;
    document.getElementById("resultLabel").style.color =
      data.prediction === 1 ? "var(--emerald-soft)" : "var(--rust-soft)";
    document.getElementById("resultBand").textContent = data.confidence_band;
    document.getElementById("resultPct").textContent =
      pct(data.probability_approved) + " approval likelihood";
    document.getElementById("resultBarFill").style.width = pct(
      data.probability_approved,
    );

    setCardState(data.probability_approved);
    hint.textContent =
      "Record stored. You can click a saved row to load it back into the form.";
    await loadSubmissions();
  } catch (err) {
    hint.textContent =
      "Something went wrong: " + (err.message || "unexpected response");
  } finally {
    btn.disabled = false;
    btn.textContent = "Stamp the ledger";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadMeta();
  loadSubmissions();
  updateCardPreview();
  resetCardState();

  document
    .getElementById("predictForm")
    .addEventListener("submit", handleSubmit);
  ["gender", "income_type", "income"].forEach((id) => {
    document.getElementById(id).addEventListener("input", updateCardPreview);
    document.getElementById(id).addEventListener("change", updateCardPreview);
  });
  document
    .getElementById("predictForm")
    .addEventListener("input", resetCardState);
});
