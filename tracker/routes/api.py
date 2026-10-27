"""
routes/api.py  --  The "behind the scenes" endpoints the page talks to.
=======================================================================

A *route* connects a URL to a Python function. The browser calls these with
`fetch(...)` from static/js/excel-io.js. Nothing here stores anything: we
receive data, convert it, and send the result straight back.

  POST /api/export  -> receives the save (JSON), returns an .xlsx file
  POST /api/import  -> receives an .xlsx file, returns the save (JSON)
"""

from flask import Blueprint, jsonify, request, send_file

from ..excel import build_workbook, parse_workbook
from ..models import AppData

api_bp = Blueprint("api", __name__, url_prefix="/api")

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@api_bp.post("/export")
def export_excel():
    payload = request.get_json(silent=True)
    try:
        data = AppData.from_dict(payload)  # clean + validate
    except ValueError as exc:
        return jsonify(error=str(exc)), 400
    return send_file(build_workbook(data), mimetype=XLSX_MIME,
                     as_attachment=True, download_name="grade-tracker-save.xlsx")


@api_bp.post("/import")
def import_excel():
    upload = request.files.get("file")
    if upload is None or not upload.filename:
        return jsonify(error="Please choose an .xlsx file."), 400
    if not upload.filename.lower().endswith(".xlsx"):
        return jsonify(error="Only .xlsx files are supported."), 400
    try:
        data = parse_workbook(upload.stream)
    except ValueError as exc:
        return jsonify(error=str(exc)), 400
    return jsonify(data.to_dict())


@api_bp.errorhandler(413)
def too_large(_error):
    return jsonify(error="That file is too large (max 2 MB)."), 413
