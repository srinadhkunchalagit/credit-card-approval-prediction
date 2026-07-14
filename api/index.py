"""
api/index.py
------------
Vercel serverless entry point. Imports and re-exports the Flask `app`
object from the root app.py so Vercel can serve it.

Vercel looks for a variable named `app` (WSGI callable) in this file.
"""

import sys
import os

# Make the project root importable so `from model.train_model import ...`
# works the same way it does when running `python app.py` locally.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from app import app  # noqa: F401  – Vercel needs `app` in this module's namespace

# Vercel calls the WSGI app directly; no `app.run()` needed here.
