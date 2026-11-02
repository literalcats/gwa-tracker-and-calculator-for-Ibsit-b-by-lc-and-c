"""
tracker/__init__.py  --  Builds the Flask app ("application factory").
======================================================================

Why a function (`create_app`) instead of a global `app`?
It keeps setup in one tidy place, makes testing easy, and lets you plug this
whole tracker into the bigger Block B hub later:

    from tracker import create_app            # run on its own
    # or, inside the hub:  hub.register_blueprint(pages_bp, url_prefix="/grades")
"""

import hashlib
import os

from flask import Flask

from .routes.api import api_bp
from .routes.pages import pages_bp


def _asset_version(static_folder: str) -> str:
    """A short fingerprint of /static. When any file changes, offline caches refresh."""
    digest = hashlib.sha1()
    for folder, _dirs, files in sorted(os.walk(static_folder)):
        for name in sorted(files):
            path = os.path.join(folder, name)
            digest.update(name.encode())
            digest.update(str(os.path.getmtime(path)).encode())
            digest.update(str(os.path.getsize(path)).encode())
    return digest.hexdigest()[:10]


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024  # reject uploads bigger than 2 MB
    app.config["ASSET_VERSION"] = _asset_version(app.static_folder)

    app.register_blueprint(pages_bp)
    app.register_blueprint(api_bp)

    @app.after_request
    def add_security_headers(response):
        # Simple, safe defaults: only load scripts/styles from our own site.
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "same-origin")
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; "
            "base-uri 'self'; frame-ancestors 'none'",
        )
        return response

    return app
