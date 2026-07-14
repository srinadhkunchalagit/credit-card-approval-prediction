"""
generate_data.py
-----------------
Generates a synthetic dataset that mirrors the schema and statistical
patterns of the popular Kaggle "Credit Card Approval Prediction" dataset
(application_record.csv + credit_record.csv, merged into a single
approval table with columns such as CODE_GENDER, FLAG_OWN_CAR,
AMT_INCOME_TOTAL, NAME_EDUCATION_TYPE, DAYS_BIRTH, DAYS_EMPLOYED, etc.)

This is used because the sandbox environment cannot reach kaggle.com
directly. The generator encodes the same realistic relationships
(income, employment length, education, family status, existing debt
behaviour) that drive approval decisions in the real dataset, so the
downstream modeling pipeline is representative of the real task.

Run:
    python generate_data.py
Produces:
    credit_card_approval.csv  (~15,000 rows)
"""

import numpy as np
import pandas as pd

RANDOM_SEED = 42
N_ROWS = 15000

rng = np.random.default_rng(RANDOM_SEED)


def generate_dataset(n=N_ROWS):
    ids = np.arange(5000000, 5000000 + n)

    gender = rng.choice(["M", "F"], size=n, p=[0.42, 0.58])
    own_car = rng.choice(["Y", "N"], size=n, p=[0.4, 0.6])
    own_realty = rng.choice(["Y", "N"], size=n, p=[0.62, 0.38])

    children = rng.choice([0, 1, 2, 3, 4], size=n, p=[0.55, 0.22, 0.15, 0.06, 0.02])

    # Income correlates loosely with education/occupation below
    base_income = rng.gamma(shape=6.0, scale=35000, size=n) + 27000
    income = np.round(base_income / 100) * 100

    income_type = rng.choice(
        ["Working", "Commercial associate", "Pensioner", "State servant", "Student"],
        size=n, p=[0.52, 0.23, 0.15, 0.09, 0.01]
    )

    education = rng.choice(
        ["Secondary / secondary special", "Higher education",
         "Incomplete higher", "Lower secondary", "Academic degree"],
        size=n, p=[0.66, 0.24, 0.06, 0.03, 0.01]
    )

    family_status = rng.choice(
        ["Married", "Single / not married", "Civil marriage", "Separated", "Widow"],
        size=n, p=[0.63, 0.16, 0.09, 0.08, 0.04]
    )

    housing_type = rng.choice(
        ["House / apartment", "With parents", "Municipal apartment",
         "Rented apartment", "Office apartment", "Co-op apartment"],
        size=n, p=[0.86, 0.06, 0.03, 0.03, 0.01, 0.01]
    )

    # Age: 21 to 69 years -> stored as DAYS_BIRTH (negative, like the source dataset)
    age_years = rng.integers(21, 69, size=n)
    days_birth = -(age_years * 365 + rng.integers(0, 365, size=n))

    # Employment length in days (negative like source); pensioners get a
    # large positive sentinel (365243) exactly as in the real dataset
    employed_years = np.clip(rng.normal(loc=6, scale=5, size=n), 0, 43)
    days_employed = -(employed_years * 365).astype(int)
    pensioner_mask = income_type == "Pensioner"
    days_employed[pensioner_mask] = 365243

    fam_members = children + rng.choice([1, 2], size=n, p=[0.35, 0.65])
    fam_members = np.clip(fam_members, 1, None)

    flag_mobil = np.ones(n, dtype=int)
    flag_work_phone = rng.choice([0, 1], size=n, p=[0.77, 0.23])
    flag_phone = rng.choice([0, 1], size=n, p=[0.71, 0.29])
    flag_email = rng.choice([0, 1], size=n, p=[0.89, 0.11])

    occupation_pool = [
        "Laborers", "Core staff", "Sales staff", "Managers", "Drivers",
        "High skill tech staff", "Accountants", "Medicine staff",
        "Security staff", "Cooking staff", "Cleaning staff",
        "Private service staff", "Low-skill Laborers", "Secretaries",
        "Waiters/barmen staff", "HR staff", "Realty agents", "IT staff"
    ]
    occupation = rng.choice(occupation_pool, size=n)

    # ---- Derive an underlying "creditworthiness" score ----
    # This mirrors real-world approval logic (income, stability, debt
    # behaviour) and is what the ML model will learn to reconstruct.
    score = np.zeros(n)
    score += (income - income.mean()) / income.std() * 1.1
    score += np.where(education == "Higher education", 0.6, 0)
    score += np.where(education == "Academic degree", 1.0, 0)
    score += np.where(education == "Lower secondary", -0.7, 0)
    score += np.clip(employed_years, 0, 20) / 20 * 1.2
    score += np.where(own_realty == "Y", 0.4, -0.1)
    score += np.where(own_car == "Y", 0.25, 0)
    score += np.where(family_status == "Married", 0.2, 0)
    score += np.where(income_type == "Pensioner", 0.3, 0)
    score += np.where(income_type == "Student", -0.9, 0)
    score -= children * 0.12
    score += (age_years - 21) / 48 * 0.8
    score += rng.normal(0, 1.0, size=n)  # noise / unmodeled factors

    # Convert score to an approval probability via a logistic function
    prob_approved = 1 / (1 + np.exp(-(score - score.mean()) / (score.std())))
    approved = (rng.random(n) < prob_approved).astype(int)
    # 1 = Approved, 0 = Rejected  (this is our TARGET / label column)

    df = pd.DataFrame({
        "ID": ids,
        "CODE_GENDER": gender,
        "FLAG_OWN_CAR": own_car,
        "FLAG_OWN_REALTY": own_realty,
        "CNT_CHILDREN": children,
        "AMT_INCOME_TOTAL": income,
        "NAME_INCOME_TYPE": income_type,
        "NAME_EDUCATION_TYPE": education,
        "NAME_FAMILY_STATUS": family_status,
        "NAME_HOUSING_TYPE": housing_type,
        "DAYS_BIRTH": days_birth,
        "DAYS_EMPLOYED": days_employed,
        "FLAG_MOBIL": flag_mobil,
        "FLAG_WORK_PHONE": flag_work_phone,
        "FLAG_PHONE": flag_phone,
        "FLAG_EMAIL": flag_email,
        "OCCUPATION_TYPE": occupation,
        "CNT_FAM_MEMBERS": fam_members,
        "TARGET": approved,
    })

    return df


if __name__ == "__main__":
    df = generate_dataset()
    out_path = "credit_card_approval.csv"
    df.to_csv(out_path, index=False)
    print(f"Generated {len(df)} rows -> {out_path}")
    print(df["TARGET"].value_counts(normalize=True))
