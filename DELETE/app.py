"""
app.py  --  The entry point.

Run it locally:     python app.py          (then open http://127.0.0.1:5000)
Render runs it as:  gunicorn app:app       (see render.yaml)
"""

import os

from tracker import create_app

app = create_app()

if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG") == "1", port=int(os.environ.get("PORT", 5000)))
