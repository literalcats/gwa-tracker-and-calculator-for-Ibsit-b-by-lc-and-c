"""
models.py  --  The "shape" of our data.
=======================================

Most Flask tutorials put *database* models here (SQLAlchemy classes).
This app is different on purpose: every student's grades are saved in THEIR OWN
browser (local web storage), so the server never keeps a database of grades.

So what are these classes for?
  1. They describe the data clearly (a Course has Components, a Component has Items).
  2. They CLEAN and VALIDATE data that arrives from outside (an uploaded Excel
     file or JSON from the browser). Never trust data you did not create!
  3. Later, if you want a real database, these same classes can become your
     SQLAlchemy models with very little change.

Vocabulary used everywhere in this project
------------------------------------------
  Course     -> a subject, e.g. "IT 101 - Intro to Computing" (has units)
  Component  -> a graded category of a course, e.g. "Quizzes" worth 20%
  Item       -> one single score inside a component, e.g. "Quiz 1: 8 / 10"
  Settings   -> passing percentage + the grade scale (percent -> 1.00, 1.25, ...)
"""

from __future__ import annotations

import math
import uuid
from dataclasses import dataclass, field

# ---------------------------------------------------------------------------
# Limits. They keep a bad or huge file from filling the server's memory.
# ---------------------------------------------------------------------------
MAX_NAME_LENGTH = 80
MAX_COURSES = 60
MAX_COMPONENTS_PER_COURSE = 20
MAX_ITEMS_PER_COMPONENT = 200


# ---------------------------------------------------------------------------
# Small helper functions ("cleaners")
# ---------------------------------------------------------------------------
def new_id() -> str:
    """Make a short random id such as 'a3f9c01b2e'. Used to tell items apart."""
    return uuid.uuid4().hex[:10]


def clean_text(value, default: str = "", limit: int = MAX_NAME_LENGTH) -> str:
    """Turn anything into a trimmed string no longer than `limit` characters."""
    if value is None:
        return default
    text = str(value).strip()
    return text[:limit] if text else default


def clean_number(value, default=None, low=None, high=None):
    """
    Turn anything into a float, or return `default` if it is not a real number.
    Optionally squeeze the result between `low` and `high`.
    """
    if value is None or isinstance(value, bool):
        return default
    try:
        number = float(str(value).replace(",", "").strip()) if isinstance(value, str) else float(value)
    except (TypeError, ValueError):
        return default
    if math.isnan(number) or math.isinf(number):
        return default
    if low is not None:
        number = max(low, number)
    if high is not None:
        number = min(high, number)
    return number


# ---------------------------------------------------------------------------
# The default grade scale (Philippine style: 1.00 is best, 5.00 is failing).
# Schools differ, so the user can edit all of this inside the app.
# Each pair means: "from this percent and above, the grade is ...".
# ---------------------------------------------------------------------------
DEFAULT_SCALE = [
    (97, 1.00), (94, 1.25), (91, 1.50), (88, 1.75), (85, 2.00),
    (82, 2.25), (79, 2.50), (76, 2.75), (75, 3.00),
]


@dataclass
class GradeRow:
    """One line of the grade scale: 'from `min_percent` up, the grade is `grade`'."""
    min_percent: float
    grade: float

    @classmethod
    def from_dict(cls, data: dict) -> "GradeRow | None":
        low = clean_number(data.get("min"), None, 0, 100)
        grade = clean_number(data.get("grade"), None, 0, 100)
        if low is None or grade is None:
            return None  # skip broken rows instead of crashing
        return cls(low, grade)

    def to_dict(self) -> dict:
        return {"min": self.min_percent, "grade": self.grade}


@dataclass
class Settings:
    passing_percent: float = 75.0
    fail_grade: float = 5.0
    round_percent: bool = True  # round 74.6 -> 75 before looking up the grade
    scale: list[GradeRow] = field(default_factory=lambda: [GradeRow(p, g) for p, g in DEFAULT_SCALE])

    @classmethod
    def from_dict(cls, data: dict | None) -> "Settings":
        data = data or {}
        rows = [GradeRow.from_dict(r) for r in (data.get("scale") or []) if isinstance(r, dict)]
        rows = [r for r in rows if r is not None][:40]
        settings = cls(
            passing_percent=clean_number(data.get("passingPercent"), 75.0, 0, 100),
            fail_grade=clean_number(data.get("failGrade"), 5.0, 0, 100),
            round_percent=bool(data.get("roundPercent", True)),
        )
        if rows:
            settings.scale = sorted(rows, key=lambda r: r.min_percent, reverse=True)
        return settings

    def to_dict(self) -> dict:
        return {
            "passingPercent": self.passing_percent,
            "failGrade": self.fail_grade,
            "roundPercent": self.round_percent,
            "scale": [r.to_dict() for r in self.scale],
        }


@dataclass
class Item:
    """One score, e.g. 'Quiz 1' with 8 out of 10. `score` is None until it is graded."""
    name: str = "Item"
    score: float | None = None
    max_score: float = 100.0
    id: str = field(default_factory=new_id)

    @classmethod
    def from_dict(cls, data: dict) -> "Item":
        return cls(
            id=clean_text(data.get("id"), new_id(), 40),
            name=clean_text(data.get("name"), "Item"),
            score=clean_number(data.get("score"), None, 0),
            max_score=clean_number(data.get("max"), 100.0, 0.0001) or 100.0,
        )

    def to_dict(self) -> dict:
        return {"id": self.id, "name": self.name, "score": self.score, "max": self.max_score}


@dataclass
class Component:
    """A graded category (Quizzes, Midterm Exam, ...) and how much it is worth."""
    name: str = "Component"
    weight: float = 0.0  # percent of the whole course, e.g. 20 means 20%
    items: list[Item] = field(default_factory=list)
    id: str = field(default_factory=new_id)

    @classmethod
    def from_dict(cls, data: dict) -> "Component":
        items = [Item.from_dict(i) for i in (data.get("items") or []) if isinstance(i, dict)]
        return cls(
            id=clean_text(data.get("id"), new_id(), 40),
            name=clean_text(data.get("name"), "Component"),
            weight=clean_number(data.get("weight"), 0.0, 0, 100),
            items=items[:MAX_ITEMS_PER_COMPONENT],
        )

    def to_dict(self) -> dict:
        return {"id": self.id, "name": self.name, "weight": self.weight,
                "items": [i.to_dict() for i in self.items]}


@dataclass
class Course:
    name: str = "New course"
    code: str = ""
    units: float = 3.0
    components: list[Component] = field(default_factory=list)
    id: str = field(default_factory=new_id)

    @classmethod
    def from_dict(cls, data: dict) -> "Course":
        comps = [Component.from_dict(c) for c in (data.get("components") or []) if isinstance(c, dict)]
        return cls(
            id=clean_text(data.get("id"), new_id(), 40),
            name=clean_text(data.get("name"), "Untitled course"),
            code=clean_text(data.get("code"), "", 30),
            units=clean_number(data.get("units"), 3.0, 0, 30),
            components=comps[:MAX_COMPONENTS_PER_COURSE],
        )

    def to_dict(self) -> dict:
        return {"id": self.id, "name": self.name, "code": self.code, "units": self.units,
                "components": [c.to_dict() for c in self.components]}


@dataclass
class AppData:
    """Everything the app saves: settings + all courses. This is the whole 'save file'."""
    settings: Settings = field(default_factory=Settings)
    courses: list[Course] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: dict) -> "AppData":
        if not isinstance(data, dict):
            raise ValueError("That data is not a valid grade tracker save.")
        courses = [Course.from_dict(c) for c in (data.get("courses") or []) if isinstance(c, dict)]
        return cls(settings=Settings.from_dict(data.get("settings")), courses=courses[:MAX_COURSES])

    def to_dict(self) -> dict:
        return {"version": 1, "settings": self.settings.to_dict(),
                "courses": [c.to_dict() for c in self.courses]}
