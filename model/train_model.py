"""
train_model.py
---------------
Trains a credit card approval classifier on data/credit_card_approval.csv
and exports the fitted pipeline + metadata used by the Flask web app.

Run:
    python train_model.py
Produces (in model/):
    credit_model.joblib   - full sklearn Pipeline (preprocessing + classifier)
    metrics.json          - evaluation metrics for the web dashboard
    feature_meta.json     - dropdown options / ranges for the web form
"""

import json
import os

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score,
                              precision_score, recall_score, roc_auc_score)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(HERE, "..", "data", "credit_card_approval.csv")
MODEL_PATH = os.path.join(HERE, "credit_model.joblib")
METRICS_PATH = os.path.join(HERE, "metrics.json")
META_PATH = os.path.join(HERE, "feature_meta.json")

NUMERIC_FEATURES = [
    "CNT_CHILDREN", "AMT_INCOME_TOTAL", "AGE_YEARS", "YEARS_EMPLOYED",
    "CNT_FAM_MEMBERS", "FLAG_WORK_PHONE", "FLAG_PHONE", "FLAG_EMAIL",
]
CATEGORICAL_FEATURES = [
    "CODE_GENDER", "FLAG_OWN_CAR", "FLAG_OWN_REALTY", "NAME_INCOME_TYPE",
    "NAME_EDUCATION_TYPE", "NAME_FAMILY_STATUS", "NAME_HOUSING_TYPE",
    "OCCUPATION_TYPE",
]


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["AGE_YEARS"] = (-df["DAYS_BIRTH"] / 365).round(1)
    years_employed = -df["DAYS_EMPLOYED"] / 365
    # sentinel 365243 marks pensioners with no employment record -> 0 years
    years_employed = years_employed.where(df["DAYS_EMPLOYED"] != 365243, 0)
    df["YEARS_EMPLOYED"] = years_employed.clip(lower=0).round(1)
    return df


def build_pipeline() -> Pipeline:
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), NUMERIC_FEATURES),
            ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
        ]
    )
    classifier = RandomForestClassifier(
        n_estimators=300,
        max_depth=12,
        min_samples_leaf=3,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    return Pipeline(steps=[("preprocess", preprocessor), ("model", classifier)])


def main():
    df = pd.read_csv(DATA_PATH)
    df = engineer_features(df)

    X = df[NUMERIC_FEATURES + CATEGORICAL_FEATURES]
    y = df["TARGET"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    pipeline = build_pipeline()
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy": round(accuracy_score(y_test, y_pred), 4),
        "precision": round(precision_score(y_test, y_pred), 4),
        "recall": round(recall_score(y_test, y_pred), 4),
        "f1_score": round(f1_score(y_test, y_pred), 4),
        "roc_auc": round(roc_auc_score(y_test, y_proba), 4),
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
        "n_train": len(X_train),
        "n_test": len(X_test),
        "model_type": "RandomForestClassifier",
    }

    # Feature importance (mapped back to readable names)
    ohe = pipeline.named_steps["preprocess"].named_transformers_["cat"]
    cat_names = list(ohe.get_feature_names_out(CATEGORICAL_FEATURES))
    all_feature_names = NUMERIC_FEATURES + cat_names
    importances = pipeline.named_steps["model"].feature_importances_
    top_idx = np.argsort(importances)[::-1][:10]
    metrics["top_features"] = [
        {"feature": all_feature_names[i], "importance": round(float(importances[i]), 4)}
        for i in top_idx
    ]

    with open(METRICS_PATH, "w") as f:
        json.dump(metrics, f, indent=2)

    # Metadata for building the web form dynamically
    meta = {
        "categorical_options": {
            col: sorted(df[col].dropna().unique().tolist())
            for col in CATEGORICAL_FEATURES
        },
        "numeric_ranges": {
            col: {
                "min": float(df[col].min()),
                "max": float(df[col].max()),
                "mean": round(float(df[col].mean()), 2),
            }
            for col in NUMERIC_FEATURES
        },
    }
    with open(META_PATH, "w") as f:
        json.dump(meta, f, indent=2)

    joblib.dump(pipeline, MODEL_PATH)

    print("Training complete.")
    print(json.dumps({k: v for k, v in metrics.items() if k not in ("confusion_matrix", "top_features")}, indent=2))
    print(f"Model saved -> {MODEL_PATH}")


if __name__ == "__main__":
    main()
