"""
app.py
------
Flask web application for the Credit Card Approval Prediction project.

Routes:
    GET  /                  -> main UI (form + dashboard)
    GET  /api/meta          -> form field options / ranges + model metrics
    GET  /api/submissions   -> list of in-memory prediction history
    POST /api/predict       -> run a prediction for a submitted application

Run locally:
    python app.py
Then open http://127.0.0.1:5000

Deploy on Vercel:
    The app is served via api/index.py which imports this `app` object.
    Submissions are kept in memory (reset on cold start) because Vercel's
    serverless filesystem is read-only at runtime.
"""

import json
import os
from datetime import datetime

import joblib
import pandas as pd
from flask import Flask, jsonify, render_template, request

from model.train_model import (CATEGORICAL_FEATURES, NUMERIC_FEATURES,
                                engineer_features)

# ---------------------------------------------------------------------------
# Paths — all relative to this file so they work both locally and on Vercel
# ---------------------------------------------------------------------------
HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(HERE, "model", "credit_model.joblib")
METRICS_PATH = os.path.join(HERE, "model", "metrics.json")
META_PATH = os.path.join(HERE, "model", "feature_meta.json")

app = Flask(
    __name__,
    template_folder=os.path.join(HERE, "templates"),
    static_folder=os.path.join(HERE, "static"),
)

# ---------------------------------------------------------------------------
# Lazy-loaded singletons (avoids re-reading large files on every request)
# ---------------------------------------------------------------------------
_model = None
_metrics = None
_meta = None

# In-memory submissions store — Vercel's filesystem is read-only, so we keep
# history in process memory.  History resets on a new cold start, but the
# app functions correctly for every request within a warm instance.
_submissions: list = []


def get_model():
    global _model
    if _model is None:
        _model = joblib.load(MODEL_PATH)
    return _model


def get_metrics():
    global _metrics
    if _metrics is None:
        with open(METRICS_PATH) as f:
            _metrics = json.load(f)
    return _metrics


def get_meta():
    global _meta
    if _meta is None:
        with open(META_PATH) as f:
            _meta = json.load(f)
    return _meta


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/meta")
def api_meta():
    return jsonify({"form_options": get_meta(), "metrics": get_metrics()})


@app.route("/api/submissions")
def api_submissions():
    return jsonify({"submissions": _submissions})


@app.route("/api/predict", methods=["POST"])
def api_predict():
    payload = request.get_json(force=True)

    try:
        record = {
            "CODE_GENDER": payload["gender"],
            "FLAG_OWN_CAR": payload["own_car"],
            "FLAG_OWN_REALTY": payload["own_realty"],
            "CNT_CHILDREN": int(payload["children"]),
            "AMT_INCOME_TOTAL": float(payload["income"]),
            "NAME_INCOME_TYPE": payload["income_type"],
            "NAME_EDUCATION_TYPE": payload["education"],
            "NAME_FAMILY_STATUS": payload["family_status"],
            "NAME_HOUSING_TYPE": payload["housing_type"],
            "DAYS_BIRTH": -int(float(payload["age"]) * 365),
            "DAYS_EMPLOYED": -int(float(payload["years_employed"]) * 365),
            "FLAG_WORK_PHONE": int(payload.get("work_phone", 0)),
            "FLAG_PHONE": int(payload.get("phone", 0)),
            "FLAG_EMAIL": int(payload.get("email", 0)),
            "OCCUPATION_TYPE": payload["occupation"],
            "CNT_FAM_MEMBERS": int(payload["family_members"]),
        }
    except (KeyError, ValueError) as e:
        return jsonify({"error": f"Invalid or missing field: {e}"}), 400

    df = pd.DataFrame([record])
    df = engineer_features(df)
    X = df[NUMERIC_FEATURES + CATEGORICAL_FEATURES]

    model = get_model()
    proba = float(model.predict_proba(X)[0, 1])
    prediction = int(proba >= 0.5)

    if proba >= 0.75:
        band = "Strong Approval"
    elif proba >= 0.5:
        band = "Likely Approval"
    elif proba >= 0.25:
        band = "Likely Rejection"
    else:
        band = "Strong Rejection"

    submission = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "payload": payload,
        "prediction": prediction,
        "label": "Approved" if prediction == 1 else "Rejected",
        "probability_approved": round(proba, 4),
        "confidence_band": band,
    }

    # Prepend to in-memory list (most recent first, cap at 100 entries)
    _submissions.insert(0, submission)
    if len(_submissions) > 100:
        _submissions.pop()

    return jsonify(submission)


# ---------------------------------------------------------------------------
# Local dev entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=5000)
