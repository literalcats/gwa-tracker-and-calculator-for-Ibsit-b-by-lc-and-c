"""Backend tests. Run with:  python -m pytest -q   (or: python -m unittest discover tests)"""
import io
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from openpyxl import load_workbook

from tracker import create_app
from tracker.excel import build_workbook, parse_workbook
from tracker.grading import course_standing, grade_from_percent, gwa
from tracker.models import AppData

SAMPLE = {
    "settings": {"passingPercent": 75, "failGrade": 5, "roundPercent": True,
                 "scale": [{"min": 90, "grade": 1.0}, {"min": 75, "grade": 3.0}]},
    "courses": [{
        "name": "Intro =cmd()", "code": "IT 101", "units": 3,
        "components": [
            {"name": "Quizzes", "weight": 40, "items": [{"name": "Q1", "score": 8, "max": 10}, {"name": "Q2", "score": None, "max": 10}]},
            {"name": "Final", "weight": 60, "items": []},
        ],
    }, {"name": "Empty course", "units": 2, "components": []}],
}


class GradingTests(unittest.TestCase):
    def test_standing_uses_only_graded_components(self):
        data = AppData.from_dict(SAMPLE)
        s = course_standing(data.courses[0], data.settings)
        self.assertAlmostEqual(s["percent"], 80.0)       # 8/10, Final not graded yet
        self.assertEqual(s["grade"], 3.0)
        self.assertTrue(s["passed"])

    def test_scale_lookup_and_fail(self):
        data = AppData.from_dict(SAMPLE)
        self.assertEqual(grade_from_percent(74.4, data.settings), 5.0)
        self.assertEqual(grade_from_percent(74.5, data.settings), 3.0)   # rounds to 75
        self.assertEqual(grade_from_percent(95, data.settings), 1.0)

    def test_gwa_ignores_courses_without_scores(self):
        data = AppData.from_dict(SAMPLE)
        self.assertAlmostEqual(gwa(data.courses, data.settings), 3.0)


class ExcelTests(unittest.TestCase):
    def test_round_trip(self):
        data = AppData.from_dict(SAMPLE)
        again = parse_workbook(build_workbook(data))
        self.assertEqual(len(again.courses), 2)
        quizzes = again.courses[0].components[0]
        self.assertEqual([(i.score, i.max_score) for i in quizzes.items], [(8.0, 10.0), (None, 10.0)])
        self.assertEqual(again.courses[0].components[1].weight, 60)
        self.assertEqual([(r.min_percent, r.grade) for r in again.settings.scale], [(90, 1.0), (75, 3.0)])

    def test_text_is_never_a_formula(self):
        wb = load_workbook(build_workbook(AppData.from_dict(SAMPLE)))
        cell = wb["Data"]["A2"]
        self.assertEqual(cell.data_type, "s")
        self.assertEqual(cell.value, "Intro =cmd()")

    def test_bad_file_gives_friendly_error(self):
        with self.assertRaises(ValueError):
            parse_workbook(io.BytesIO(b"not an excel file"))


class RouteTests(unittest.TestCase):
    def setUp(self):
        self.client = create_app().test_client()

    def test_pages(self):
        self.assertEqual(self.client.get("/").status_code, 200)
        self.assertEqual(self.client.get("/healthz").json, {"status": "ok"})
        self.assertIn("icons/icon-192.png", self.client.get("/manifest.webmanifest").get_data(as_text=True))
        sw = self.client.get("/sw.js")
        self.assertIn("javascript", sw.content_type)
        self.assertIn("/static/js/app.js", sw.get_data(as_text=True))

    def test_export_then_import(self):
        res = self.client.post("/api/export", json=SAMPLE)
        self.assertEqual(res.status_code, 200)
        res2 = self.client.post("/api/import", data={"file": (io.BytesIO(res.data), "save.xlsx")}, content_type="multipart/form-data")
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(len(res2.json["courses"]), 2)

    def test_import_rejects_wrong_type(self):
        res = self.client.post("/api/import", data={"file": (io.BytesIO(b"x"), "save.txt")}, content_type="multipart/form-data")
        self.assertEqual(res.status_code, 400)

    def test_export_rejects_garbage(self):
        self.assertEqual(self.client.post("/api/export", json=[1, 2]).status_code, 400)


if __name__ == "__main__":
    unittest.main()
