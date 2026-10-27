"""
grading.py  --  The grade math (server side).
=============================================

The web page does its own live calculations in JavaScript (static/js/calc.js)
so numbers update instantly while you type. This Python copy is used when we
build the Excel "Summary" sheet. Both follow the SAME rules, written below:

  1. Component average  = (sum of scores) / (sum of max scores) * 100
     Items with no score yet are ignored (they are "upcoming").
  2. A component counts toward the course only if it has at least one score.
  3. Current course %   = sum(weight * component%) / sum(weight of graded components)
     -> "how well am I doing on the work that has been graded so far"
  4. Grade equivalent   = look up the percent in the grade scale (settings).
  5. GWA                = sum(grade * units) / sum(units)   (only courses with scores)
"""

from __future__ import annotations

from .models import Component, Course, Settings


def component_average(component: Component) -> float | None:
    """Return the component's average percent, or None if nothing is graded yet."""
    graded = [i for i in component.items if i.score is not None and i.max_score > 0]
    if not graded:
        return None
    total_score = sum(i.score for i in graded)
    total_max = sum(i.max_score for i in graded)
    return total_score / total_max * 100


def grade_from_percent(percent: float, settings: Settings) -> float:
    """Convert a percent (e.g. 86.2) to a grade equivalent (e.g. 2.00)."""
    value = round(percent + 1e-9) if settings.round_percent else percent
    for row in sorted(settings.scale, key=lambda r: r.min_percent, reverse=True):
        if value >= row.min_percent:
            return row.grade
    return settings.fail_grade


def course_standing(course: Course, settings: Settings) -> dict:
    """Work out where a course stands right now."""
    total_weight = sum(c.weight for c in course.components)
    graded_weight = 0.0
    earned = 0.0  # weighted points collected so far
    for comp in course.components:
        avg = component_average(comp)
        if avg is not None:
            graded_weight += comp.weight
            earned += comp.weight * avg / 100

    current = earned / graded_weight * 100 if graded_weight > 0 else None
    result = {"percent": current, "grade": None, "passed": None,
              "graded_weight": graded_weight, "total_weight": total_weight, "earned": earned}
    if current is not None:
        result["grade"] = grade_from_percent(current, settings)
        rounded = round(current + 1e-9) if settings.round_percent else current
        result["passed"] = rounded >= settings.passing_percent
    return result


def gwa(courses: list[Course], settings: Settings) -> float | None:
    """General Weighted Average across all courses that already have scores."""
    points = units = 0.0
    for course in courses:
        standing = course_standing(course, settings)
        if standing["grade"] is not None and course.units > 0:
            points += standing["grade"] * course.units
            units += course.units
    return points / units if units > 0 else None
