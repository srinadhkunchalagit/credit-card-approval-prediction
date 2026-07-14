# Ledger — Credit Card Approval Prediction

A full-stack machine learning project that predicts whether a credit card
application would be **approved** or **rejected**, based on the schema of
the popular Kaggle dataset *"Credit Card Approval Prediction"*
(`application_record.csv` + `credit_record.csv`).

- **Backend / ML**: Python, pandas, scikit-learn (Random Forest), Flask REST API
- **Frontend**: HTML, CSS, vanilla JavaScript — a live "credit card" visual
  that updates as you fill out the applicant form
- **Dataset**: synthetically generated to match the real Kaggle dataset's
  columns and statistical relationships (income, employment length,
  education, housing, family structure → approval), since this environment
  cannot reach kaggle.com directly. See *Using the real Kaggle dataset*
  below to swap in the actual data with zero code changes.

## Project structure

```
credit-card-approval/
├── app.py                     # Flask app: serves UI + /api/meta, /api/predict
├── requirements.txt
├── data/
│   ├── generate_data.py       # builds the synthetic dataset
│   └── credit_card_approval.csv
├── model/
│   ├── train_model.py         # preprocessing + training + evaluation + export
│   ├── credit_model.joblib    # trained sklearn Pipeline (generated)
│   ├── metrics.json           # evaluation metrics (generated)
│   └── feature_meta.json      # form dropdown options / ranges (generated)
├── templates/
│   └── index.html
└── static/
    ├── css/style.css
    └── js/script.js
```

## Quick start

```bash
cd credit-card-approval
pip install -r requirements.txt

# 1. Generate the dataset (skip if credit_card_approval.csv already exists)
python data/generate_data.py

# 2. Train the model (skip if model/credit_model.joblib already exists)
python model/train_model.py

# 3. Run the web app
python app.py
```

Open **http://127.0.0.1:5000** in your browser.

## How it works

1. `data/generate_data.py` produces `credit_card_approval.csv` with columns
   matching the real Kaggle dataset (`CODE_GENDER`, `FLAG_OWN_CAR`,
   `AMT_INCOME_TOTAL`, `NAME_EDUCATION_TYPE`, `DAYS_BIRTH`, `DAYS_EMPLOYED`,
   etc.) plus a `TARGET` column (1 = approved, 0 = rejected).
2. `model/train_model.py` engineers `AGE_YEARS` / `YEARS_EMPLOYED` from the
   day-count fields, one-hot encodes categoricals, scales numerics, and
   fits a `RandomForestClassifier` inside an sklearn `Pipeline`. It exports
   the fitted pipeline plus evaluation metrics and feature importances.
3. `app.py` loads the pipeline once at startup and exposes:
   - `GET /api/meta` — dropdown options and model metrics for the UI
   - `POST /api/predict` — takes an applicant profile as JSON, returns
     `{ prediction, label, probability_approved, confidence_band }`
4. `templates/index.html` + `static/js/script.js` render the form, call
   the API, and animate a credit card whose color and "signal meter"
   reflect the live approval probability.

## Using the real Kaggle dataset

To swap in the actual data instead of the synthetic generator:

1. Download `application_record.csv` and `credit_record.csv` from the
   Kaggle dataset **"Credit Card Approval Prediction"**.
2. Merge them on `ID`, and derive a binary `TARGET` from `credit_record.csv`
   (commonly: applicants with any `STATUS` of `2`–`5`, i.e. 60+ days
   overdue, are labeled high-risk / rejected).
3. Save the merged file as `data/credit_card_approval.csv` with the same
   column names used in `model/train_model.py`.
4. Re-run `python model/train_model.py` — no other code changes required.

## Retraining

Delete `model/credit_model.joblib`, `model/metrics.json`, and
`model/feature_meta.json`, then re-run `python model/train_model.py`.
The Flask app reads these files at startup.

## Notes

- The Random Forest uses `class_weight="balanced"` and reports accuracy,
  precision, recall, F1, ROC AUC, a confusion matrix, and top feature
  importances — all surfaced in the "Model file" section of the UI.
- No applicant data submitted through the form is stored; each prediction
  is stateless.
