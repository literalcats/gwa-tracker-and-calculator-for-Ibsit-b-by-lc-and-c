"""
routes/pages.py  --  The routes that show pages and PWA files.
==============================================================

  GET /                      -> the app itself (one page; JavaScript handles the views)
  GET /manifest.webmanifest  -> tells phones "this website can be installed as an app"
  GET /sw.js                 -> the service worker (makes the app work offline)
  GET /healthz               -> Render pings this to know the app is alive
"""

import os

from flask import Blueprint, current_app, jsonify, make_response, render_template, url_for

pages_bp = Blueprint("pages", __name__)

APP_NAME = "Block B Grade Tracker"


@pages_bp.get("/")
def index():
    return render_template("index.html", app_name=APP_NAME)


@pages_bp.get("/healthz")
def healthz():
    return jsonify(status="ok")


@pages_bp.get("/manifest.webmanifest")
def manifest():
    """The web app manifest. Built in Python so URLs stay correct on any host."""
    icon = lambda name: url_for("static", filename=f"icons/{name}")
    body = {
        "name": APP_NAME,
        "short_name": "Grades",
        "description": "Track scores, see your GWA, and find the exam score you need.",
        "start_url": url_for("pages.index"),
        "scope": url_for("pages.index"),
        "display": "standalone",
        "background_color": "#1d2022",
        "theme_color": "#1d2022",
        "icons": [
            {"src": icon("icon-192.png"), "sizes": "192x192", "type": "image/png"},
            {"src": icon("icon-512.png"), "sizes": "512x512", "type": "image/png"},
            {"src": icon("maskable-512.png"), "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
    }
    response = make_response(jsonify(body))
    response.headers["Content-Type"] = "application/manifest+json"
    return response


def _static_files() -> list[str]:
    """List every file in /static so the service worker can save them for offline use."""
    root = current_app.static_folder
    found = []
    for folder, _dirs, files in os.walk(root):
        for name in files:
            rel = os.path.relpath(os.path.join(folder, name), root).replace(os.sep, "/")
            found.append(url_for("static", filename=rel))
    return sorted(found)


@pages_bp.get("/sw.js")
def service_worker():
    """
    The service worker must be served from the app's root path (not /static/)
    so that it controls the whole app. We render it as a template to inject
    the file list and a cache version.
    """
    body = render_template(
        "sw.js.jinja",
        version=current_app.config["ASSET_VERSION"],
        files=[url_for("pages.index")] + _static_files(),
    )
    response = make_response(body)
    response.headers["Content-Type"] = "application/javascript"
    response.headers["Cache-Control"] = "no-cache"  # always check for a new worker
    return response
