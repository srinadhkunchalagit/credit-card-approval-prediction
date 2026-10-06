// script.js — Ledger credit approval estimator front end with 22 Official Indian Languages support
import { LANGUAGES, getTranslations, translate } from "./translations.js";

let currentLang = localStorage.getItem("ledger_lang") || "en";
let translations = {};
let latestMetrics = null;
let latestSubmissions = [];
let lastResult = null;
let formCategoricalOptions = {};

const SELECT_FIELDS = {
  gender: "CODE_GENDER",
  family_status: "NAME_FAMILY_STATUS",
  income_type: "NAME_INCOME_TYPE",
  occupation: "OCCUPATION_TYPE",
  education: "NAME_EDUCATION_TYPE",
  housing_type: "NAME_HOUSING_TYPE",
};

const BAND_KEYS = {
  "Strong Approval": "band_strong_approval",
  "Likely Approval": "band_likely_approval",
  "Likely Rejection": "band_likely_rejection",
  "Strong Rejection": "band_strong_rejection",
};

function t(key, fallback = "") {
  return translate(translations, currentLang, key, fallback);
}

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

async function initI18n() {
  translations = await getTranslations();
  setupLanguageSelector();
  applyLanguage(currentLang);
}

function setupLanguageSelector() {
  const select = document.getElementById("langSelect");
  if (!select) return;
  select.innerHTML = "";

  LANGUAGES.forEach((lang) => {
    const opt = document.createElement("option");
    opt.value = lang.code;
    opt.textContent = `${lang.native} (${lang.name})`;
    if (lang.code === currentLang) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });

  select.addEventListener("change", (e) => {
    setLanguage(e.target.value);
  });
}

function setLanguage(langCode) {
  currentLang = langCode;
  localStorage.setItem("ledger_lang", langCode);
  document.documentElement.lang = langCode;
  applyLanguage(langCode);
}

function applyLanguage(lang) {
  // Update nav
  setText("navEstimator", t("nav_estimator", "Estimator"));
  setText("navModel", t("nav_model", "Model file"));

  // Update Hero
  setText("heroEyebrow", t("hero_eyebrow", "Applicant Risk Estimator · v1.0"));
  const heroTitle = document.getElementById("heroTitle");
  if (heroTitle) {
    heroTitle.innerHTML = t("hero_title", "Will the card<br>say <em>yes</em>?");
  }
  setText("heroSub", t("hero_sub"));
  setText("heroBtn", t("hero_btn", "Run an estimate ↓"));

  // Update Credit Card
  setText("cardLabelApplicant", t("card_applicant", "applicant"));
  setText("cardLabelStatus", t("card_status", "status"));
  const cardStatus = document.getElementById("cardStatus");
  if (cardStatus && !lastResult) {
    cardStatus.textContent = t("card_awaiting", "awaiting input");
  } else if (cardStatus && lastResult) {
    cardStatus.textContent = lastResult.probability_approved >= 0.5 ? t("card_approved", "approved") : t("card_declined", "declined");
  }

  // Update File section
  setText("secFileEyebrow", t("sec_file_eyebrow", "01 · Applicant file"));
  setText("secFileTitle", t("sec_file_title", "Fill the ledger"));

  setText("legendIdentity", t("legend_identity", "Identity"));
  setText("labelGender", t("label_gender", "Gender"));
  setText("labelAge", t("label_age", "Age (years)"));
  setText("labelFamilyStatus", t("label_family_status", "Family status"));
  setText("labelChildren", t("label_children", "Children"));
  setText("labelFamilyMembers", t("label_family_members", "Family members (total)"));

  setText("legendLivelihood", t("legend_livelihood", "Livelihood"));
  setText("labelIncomeType", t("label_income_type", "Income type"));
  setText("labelOccupation", t("label_occupation", "Occupation"));
  setText("labelIncome", t("label_income", "Annual income"));
  setText("labelYearsEmployed", t("label_years_employed", "Years employed"));
  setText("labelEducation", t("label_education", "Education"));

  setText("legendAssets", t("legend_assets", "Assets & contact"));
  setText("labelHousingType", t("label_housing_type", "Housing type"));
  setText("labelOwnCar", t("label_own_car", "Owns a car"));
  setText("labelOwnRealty", t("label_own_realty", "Owns realty"));
  setText("labelWorkPhone", t("label_work_phone", "Work phone on file"));
  setText("labelPhone", t("label_phone", "Phone on file"));
  setText("labelEmail", t("label_email", "Email on file"));

  setText("optCarY", t("opt_yes", "Yes"));
  setText("optCarN", t("opt_no", "No"));
  setText("optRealtyY", t("opt_yes", "Yes"));
  setText("optRealtyN", t("opt_no", "No"));

  const submitBtn = document.getElementById("submitBtn");
  if (submitBtn && !submitBtn.disabled) {
    submitBtn.textContent = t("btn_submit", "Stamp the ledger");
  }

  const formHint = document.getElementById("formHint");
  if (formHint && (!lastResult || formHint.dataset.state === "default")) {
    formHint.textContent = t("hint_default", "Submit the form to store the applicant record below.");
    formHint.dataset.state = "default";
  }

  // Update History section
  setText("secHistoryEyebrow", t("sec_history_eyebrow", "03 · Ledger history"));
  setText("secHistoryTitle", t("sec_history_title", "Stored application stamps"));
  setText("thTime", t("th_timestamp", "Timestamp"));
  setText("thApplicant", t("th_applicant", "Applicant"));
  setText("thOutcome", t("th_outcome", "Outcome"));
  setText("thScore", t("th_score", "Score"));
  setText("thAction", t("th_action", "Action"));
  setText("noSubmissions", t("no_submissions", "No stored submissions yet."));
  setText("tableNote", t("table_note", "Click a row action to load the application back into the form for editing."));

  // Update Model section
  setText("secModelEyebrow", t("sec_model_eyebrow", "02 · Model file"));
  setText("secModelTitle", t("sec_model_title", "What the model was graded on"));
  setText("labelAccuracy", t("m_accuracy", "Accuracy"));
  setText("labelPrecision", t("m_precision", "Precision"));
  setText("labelRecall", t("m_recall", "Recall"));
  setText("labelF1", t("m_f1", "F1 score"));
  setText("labelAuc", t("m_auc", "ROC AUC"));

  setText("topSignalsTitle", t("top_signals", "Top signals the model relies on"));
  setText("modelNotesTitle", t("model_notes", "Model file notes"));
  setText("dtAlgo", t("note_algo", "Algorithm"));
  setText("dtTrain", t("note_train", "Training rows"));
  setText("dtTest", t("note_test", "Held-out test rows"));
  setText("dtSchema", t("note_schema", "Source schema"));

  setText("footerText", t("footer_text", "Ledger — a credit approval estimator built with Node.js and underwriting risk modeling."));

  // Re-render select options with translated gender
  if (formCategoricalOptions && Object.keys(formCategoricalOptions).length > 0) {
    populateSelects(formCategoricalOptions);
  }

  // Re-render submissions with translated columns
  renderSubmissions(latestSubmissions);

  // If result is displayed, refresh localized result text
  if (lastResult) {
    displayResult(lastResult);
  }

  updateCardPreview();
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el && text) {
    el.textContent = text;
  }
}

async function loadMeta() {
  try {
    const res = await fetch("/api/meta");
    const data = await parseJsonOrError(res);

    if (!data.form_options || !data.form_options.categorical_options) {
      throw new Error("Missing form options in meta response");
    }

    formCategoricalOptions = data.form_options.categorical_options;
    latestMetrics = data.metrics;

    populateSelects(formCategoricalOptions);
    renderMetrics(data.metrics);
    renderFeatureBars(data.metrics.top_features || []);
  } catch (err) {
    console.error("Failed to load meta:", err);
    document.getElementById("formHint").textContent =
      "Unable to load dropdown options. Check the server or network.";
    populateSelects({});
  }
}

function getGenderLabel(val) {
  if (val === "M") return t("opt_male", "Male");
  if (val === "F") return t("opt_female", "Female");
  return val;
}

function populateSelects(options) {
  for (const [fieldId, optionKey] of Object.entries(SELECT_FIELDS)) {
    const select = document.getElementById(fieldId);
    if (!select) continue;

    const previousVal = select.value;
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
      opt.textContent = fieldId === "gender" ? getGenderLabel(val) : val;
      if (val === previousVal) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });

    if (!select.value && values.length) {
      select.value = values[0];
    }
  }
}

function renderMetrics(metrics) {
  if (!metrics) return;
  document.getElementById("mAccuracy").textContent = pct(metrics.accuracy);
  document.getElementById("mPrecision").textContent = pct(metrics.precision);
  document.getElementById("mRecall").textContent = pct(metrics.recall);
  document.getElementById("mF1").textContent = pct(metrics.f1_score);
  document.getElementById("mAuc").textContent = metrics.roc_auc.toFixed(3);
  document.getElementById("nAlgo").textContent = metrics.model_type;
  document.getElementById("nTrain").textContent = metrics.n_train.toLocaleString();
  document.getElementById("nTest").textContent = metrics.n_test.toLocaleString();
}

function renderFeatureBars(features) {
  const container = document.getElementById("featureBars");
  if (!container) return;
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
  try {
    const res = await fetch("/api/submissions");
    const contentType = res.headers.get("content-type") || "";
    const text = await res.text();

    if (!res.ok) {
      console.error("Failed to load submissions:", res.status, text);
      renderSubmissions([]);
      return;
    }

    const data = contentType.includes("application/json") ? JSON.parse(text) : { submissions: [] };
    latestSubmissions = data.submissions || [];
    renderSubmissions(latestSubmissions);
  } catch (err) {
    console.error("Unable to load submissions:", err);
    latestSubmissions = [];
    renderSubmissions([]);
  }
}

function renderSubmissions(submissions) {
  const tbody = document.querySelector("#submissionsTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  renderSubmissionStats(submissions);

  if (!submissions.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="no-data" id="noSubmissions">${t("no_submissions", "No stored submissions yet.")}</td></tr>`;
    return;
  }

  submissions.forEach((submission, index) => {
    const row = document.createElement("tr");
    const isApproved = submission.prediction === 1;
    const outcomeLabel = isApproved ? t("card_approved", "Approved") : t("card_declined", "Declined");
    const genderText = getGenderLabel(submission.payload.gender);
    const loadBtnText = t("btn_load", "Load");

    row.innerHTML = `
      <td>${formatTimestamp(submission.timestamp)}</td>
      <td>${genderText} · ${submission.payload.income_type}</td>
      <td class="${isApproved ? "approved" : "rejected"}">${outcomeLabel}</td>
      <td>${pct(submission.probability_approved)}</td>
      <td><button type="button" class="load-btn" data-index="${index}">${loadBtnText}</button></td>
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

  const totalEl = document.getElementById("totalSubmissions");
  const approvedEl = document.getElementById("approvedCount");
  const rejectedEl = document.getElementById("rejectedCount");

  if (totalEl) totalEl.textContent = `${total} ${t("saved_count", "saved applications")}`;
  if (approvedEl) approvedEl.textContent = `${approved} ${t("accepted_count", "accepted")}`;
  if (rejectedEl) rejectedEl.textContent = `${rejected} ${t("declined_count", "declined")}`;
}

function displayResult(submission) {
  lastResult = submission;
  const isApproved = submission.prediction === 1;
  const outcomeLabel = isApproved ? t("card_approved", "Approved") : t("card_declined", "Rejected");
  const bandKey = BAND_KEYS[submission.confidence_band] || "band_likely_approval";
  const localizedBand = t(bandKey, submission.confidence_band);

  const resultPanel = document.getElementById("resultPanel");
  const resultLabel = document.getElementById("resultLabel");
  const resultBand = document.getElementById("resultBand");
  const resultPct = document.getElementById("resultPct");
  const resultBarFill = document.getElementById("resultBarFill");

  if (resultPanel) resultPanel.hidden = false;
  if (resultLabel) {
    resultLabel.textContent = outcomeLabel;
    resultLabel.style.color = isApproved ? "var(--emerald-soft)" : "var(--rust-soft)";
  }
  if (resultBand) resultBand.textContent = localizedBand;
  if (resultPct) {
    resultPct.textContent = `${pct(submission.probability_approved)} ${t("res_likelihood", "approval likelihood")}`;
  }
  if (resultBarFill) {
    resultBarFill.style.width = pct(submission.probability_approved);
  }

  setCardState(submission.probability_approved);
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
  document.getElementById("work_phone").checked = Boolean(Number(payload.work_phone));
  document.getElementById("phone").checked = Boolean(Number(payload.phone));
  document.getElementById("email").checked = Boolean(Number(payload.email));

  updateCardPreview();
  displayResult(submission);

  const hint = document.getElementById("formHint");
  if (hint) {
    hint.textContent = t("hint_loaded", "Loaded a saved record for editing. Stamp again to update history.");
    hint.dataset.state = "loaded";
  }
}

function maskedCardNumber(seedText) {
  let hash = 0;
  for (let i = 0; i < seedText.length; i++) {
    hash = (hash * 31 + seedText.charCodeAt(i)) >>> 0;
  }
  const digits = String(hash).padStart(4, "0").slice(-4);
  return `•••• •••• •••• ${digits}`;
}

function updateCardPreview() {
  const genderEl = document.getElementById("gender");
  const incomeTypeEl = document.getElementById("income_type");
  const incomeEl = document.getElementById("income");

  if (!genderEl || !incomeTypeEl || !incomeEl) return;

  const gender = genderEl.value;
  const incomeType = incomeTypeEl.value;
  const income = incomeEl.value;

  const nameSeed = `${gender}-${incomeType}`;
  const cardNameEl = document.getElementById("cardName");
  if (cardNameEl) {
    const genderName = getGenderLabel(gender).toUpperCase();
    cardNameEl.textContent = `${genderName || "APPLICANT"} · ${(incomeType || "").toUpperCase()}`;
  }

  const cardNumEl = document.getElementById("cardNumber");
  if (cardNumEl) {
    cardNumEl.textContent = maskedCardNumber(nameSeed + income);
  }
}

function setCardState(probApproved) {
  const card = document.getElementById("creditCard");
  const meterFill = document.getElementById("cardMeterFill");
  const status = document.getElementById("cardStatus");
  if (!card || !meterFill || !status) return;

  card.classList.remove("state-approved", "state-rejected");
  meterFill.style.width = `${Math.round(probApproved * 100)}%`;

  if (probApproved >= 0.5) {
    card.classList.add("state-approved");
    meterFill.style.background = "var(--emerald)";
    status.textContent = t("card_approved", "approved");
    status.style.color = "var(--emerald-soft)";
  } else {
    card.classList.add("state-rejected");
    meterFill.style.background = "var(--rust)";
    status.textContent = t("card_declined", "declined");
    status.style.color = "var(--rust-soft)";
  }
}

function resetCardState() {
  const card = document.getElementById("creditCard");
  const meterFill = document.getElementById("cardMeterFill");
  const status = document.getElementById("cardStatus");
  if (!card || !meterFill || !status) return;

  card.classList.remove("state-approved", "state-rejected");
  meterFill.style.width = "50%";
  meterFill.style.background = "var(--gold)";
  status.textContent = t("card_awaiting", "awaiting input");
  status.style.color = "";
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
  btn.textContent = t("btn_submitting", "Reading the file…");

  try {
    const res = await fetch("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(collectFormPayload()),
    });
    const data = await parseJsonOrError(res);

    displayResult(data);
    hint.textContent = t("hint_saved", "Record stored. You can click a saved row to load it back into the form.");
    hint.dataset.state = "saved";
    await loadSubmissions();
  } catch (err) {
    hint.textContent = "Something went wrong: " + (err.message || "unexpected response");
  } finally {
    btn.disabled = false;
    btn.textContent = t("btn_submit", "Stamp the ledger");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await initI18n();
  await loadMeta();
  await loadSubmissions();
  updateCardPreview();
  resetCardState();

  const form = document.getElementById("predictForm");
  if (form) {
    form.addEventListener("submit", handleSubmit);
    form.addEventListener("input", () => {
      // Don't wipe result immediately on select changes, just update preview
    });
  }

  ["gender", "income_type", "income"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", updateCardPreview);
      el.addEventListener("change", updateCardPreview);
    }
  });
});
