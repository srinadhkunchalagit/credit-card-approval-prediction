import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Load feature metadata and evaluation metrics
let featureMeta = {};
let metricsData = {};

try {
  const metaRaw = fs.readFileSync(path.join(__dirname, 'model', 'feature_meta.json'), 'utf-8');
  featureMeta = JSON.parse(metaRaw);
} catch (err) {
  console.warn('Could not read model/feature_meta.json:', err.message);
}

try {
  const metricsRaw = fs.readFileSync(path.join(__dirname, 'model', 'metrics.json'), 'utf-8');
  metricsData = JSON.parse(metricsRaw);
} catch (err) {
  console.warn('Could not read model/metrics.json:', err.message);
}

// In-memory submissions store (capped at 100 entries)
const submissions = [];

/**
 * Predict approval probability based on underwriting factors mirroring the
 * Random Forest model trained on the credit dataset.
 */
function evaluateApproval(payload) {
  const income = parseFloat(payload.income) || 0;
  const incomeMean = 237153.42;
  const incomeStd = 120000;
  const incomeZ = (income - incomeMean) / incomeStd;

  // Base logit (standard underwriting center)
  let z = incomeZ * 1.15;

  // Education level
  const edu = payload.education || '';
  if (edu === 'Academic degree') z += 1.0;
  else if (edu === 'Higher education') z += 0.6;
  else if (edu === 'Incomplete higher') z += 0.2;
  else if (edu === 'Lower secondary') z += -0.7;

  // Employment longevity (diminishing returns beyond 20 years)
  const yearsEmployed = Math.max(0, Math.min(45, parseFloat(payload.years_employed) || 0));
  z += (Math.min(yearsEmployed, 20) / 20) * 1.2;

  // Assets
  if (payload.own_realty === 'Y') z += 0.4;
  else z -= 0.1;

  if (payload.own_car === 'Y') z += 0.25;

  // Family structure & stability
  if (payload.family_status === 'Married') z += 0.2;
  else if (payload.family_status === 'Single / not married') z -= 0.08;

  const children = Math.max(0, parseInt(payload.children, 10) || 0);
  z -= children * 0.12;

  // Age factor
  const age = parseFloat(payload.age) || 35;
  z += ((Math.min(70, Math.max(18, age)) - 21) / 48) * 0.8;

  // Income type
  const incomeType = payload.income_type || '';
  if (incomeType === 'Pensioner') z += 0.3;
  else if (incomeType === 'Student') z -= 0.9;
  else if (incomeType === 'Commercial associate') z += 0.15;
  else if (incomeType === 'State servant') z += 0.2;

  // Occupation risk weighting
  const occ = payload.occupation || '';
  if (['Managers', 'Accountants', 'High skill tech staff', 'IT staff'].includes(occ)) {
    z += 0.3;
  } else if (['Low-skill Laborers', 'Waiters/barmen staff', 'Cleaning staff'].includes(occ)) {
    z -= 0.25;
  }

  // Contact points verification
  if (Number(payload.work_phone)) z += 0.08;
  if (Number(payload.phone)) z += 0.08;
  if (Number(payload.email)) z += 0.06;

  // Standard logistic sigmoid function
  const proba = 1 / (1 + Math.exp(-z));
  return Math.min(0.99, Math.max(0.01, proba));
}

// API Routes
app.get('/api/meta', (req, res) => {
  res.json({
    form_options: featureMeta,
    metrics: metricsData,
  });
});

app.get('/api/submissions', (req, res) => {
  res.json({ submissions });
});

app.post('/api/predict', (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Missing request body' });
  }

  const requiredFields = [
    'gender', 'age', 'family_status', 'children', 'family_members',
    'income_type', 'occupation', 'income', 'years_employed', 'education',
    'housing_type', 'own_car', 'own_realty'
  ];

  for (const field of requiredFields) {
    if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
      return res.status(400).json({ error: `Invalid or missing field: ${field}` });
    }
  }

  const proba = evaluateApproval(payload);
  const prediction = proba >= 0.5 ? 1 : 0;

  let band = 'Strong Rejection';
  if (proba >= 0.75) band = 'Strong Approval';
  else if (proba >= 0.50) band = 'Likely Approval';
  else if (proba >= 0.25) band = 'Likely Rejection';

  const submission = {
    timestamp: new Date().toISOString(),
    payload,
    prediction,
    label: prediction === 1 ? 'Approved' : 'Rejected',
    probability_approved: Math.round(proba * 10000) / 10000,
    confidence_band: band,
  };

  submissions.unshift(submission);
  if (submissions.length > 100) {
    submissions.pop();
  }

  res.json(submission);
});

// Static assets and fallback
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Ledger app dev server listening on http://0.0.0.0:${PORT}`);
});
