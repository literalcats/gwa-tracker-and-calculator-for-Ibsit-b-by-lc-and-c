// presets.js -- ready-made starting points so adding a course is fast.
// The user can change every name and weight afterwards (syllabi differ!).
import { DEFAULT_SCALE } from "./schema.js";

/** One-click grade scales in Settings. */
export const SCALE_PRESETS = {
  ph: { label: "Philippines 1.00 – 5.00", failGrade: 5, passingPercent: 75, scale: DEFAULT_SCALE },
  gpa: {
    label: "US 4.0 GPA", failGrade: 0, passingPercent: 60,
    scale: [
      { min: 93, grade: 4.0 }, { min: 90, grade: 3.7 }, { min: 87, grade: 3.3 }, { min: 83, grade: 3.0 },
      { min: 80, grade: 2.7 }, { min: 77, grade: 2.3 }, { min: 73, grade: 2.0 }, { min: 70, grade: 1.7 },
      { min: 67, grade: 1.3 }, { min: 63, grade: 1.0 }, { min: 60, grade: 0.7 },
    ],
  },
};

export const COURSE_TEMPLATES = [
  { id: "blank", label: "Blank (I'll add components myself)", components: [] },
  {
    id: "typical", label: "Typical: Quizzes 20 · Activities 20 · Midterm 25 · Final 35",
    components: [["Quizzes", 20], ["Activities", 20], ["Midterm Exam", 25], ["Final Exam", 35]],
  },
  {
    id: "lecture-lab", label: "Lecture + Lab: Quizzes 15 · Activities 15 · Midterm 20 · Final 20 · Laboratory 30",
    components: [["Quizzes", 15], ["Activities", 15], ["Midterm Exam", 20], ["Final Exam", 20], ["Laboratory", 30]],
  },
];

// One-click buttons shown under a course's components.
export const QUICK_COMPONENTS = ["Quizzes", "Activities", "Midterm Exam", "Final Exam", "Project", "Recitation", "Attendance", "Laboratory"];

/** Sample data for the "Try with sample data" button. */
export function sampleCourse() {
  const items = (list) => list.map(([name, score, max]) => ({ name, score, max }));
  return {
    name: "Introduction to Computing", code: "IT 101", units: 3,
    components: [
      { name: "Quizzes", weight: 20, items: items([["Quiz 1", 18, 20], ["Quiz 2", 14, 20], ["Quiz 3", 19, 20]]) },
      { name: "Activities", weight: 20, items: items([["Lab 1", 45, 50], ["Lab 2", 40, 50]]) },
      { name: "Midterm Exam", weight: 25, items: items([["Midterm", 78, 100]]) },
      { name: "Final Exam", weight: 35, items: [] },
    ],
  };
}
