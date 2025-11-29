"""
@file __init__.py
@description
Package initializer for the AI service's `app` package.

Responsibilities:
- Explicitly mark the `app/` directory as a Python package so that imports
  like `app.main` reliably resolve to this directory when running:

      uvicorn app.main:app

- Provide a clear place for any future package-level initialization, such as
  logging configuration or environment bootstrapping (if needed).

Current behavior:
- No side effects; the FastAPI application is defined in `app/main.py` and
  imported directly by uvicorn.

Notes:
- Keeping this file light avoids unexpected import-time behavior and makes
  debugging easier.
"""
# At this stage, we intentionally do not import anything here.
# Uvicorn will import `app.main:app` directly.
