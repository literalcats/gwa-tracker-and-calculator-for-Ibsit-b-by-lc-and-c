// presets.js -- ready-made starting points so adding a course is fast.
// The user can change every name and weight afterwards (syllabi differ!).

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
