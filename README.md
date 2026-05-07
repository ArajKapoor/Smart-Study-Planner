# Smart-Study-Planner
# 🧠 Ultimate Study Planner

A highly advanced, dynamic study timetable generator. This repository contains two implementations: a modern, interactive Web App built with JavaScript, and a high-performance terminal algorithm built in C++ using core Data Structures.

## 🌟 Web App Features (HTML/CSS/Vanilla JS)
The Web UI acts as an intelligent personal planner, going far beyond simple block-scheduling:
- **Spaced Repetition Engine:** Automatically schedules review sessions 1 and 3 days after a subject is first studied to maximize memory retention.
- **Active Recall Cues:** Automatically flags every 4th study block for a specific subject as a "Quiz/Self-Testing" session to force active engagement.
- **Adaptive Rescheduling:** If life happens and you miss a study block, simply click "Mark Incomplete." The algorithm instantly returns the missed hours to the syllabus pool and effortlessly redraws your remaining schedule.
- **Conflict Resolution:** Add fixed commitments (like college labs). The minute-by-minute timeline mapping perfectly wraps your study sessions around your fixed events.

## ⚡ Core Algorithm Implementation (C++)
The original timetable scheduling logic is implemented in `timetable.cpp` to efficiently process complex constraints using fundamental Computer Science concepts:
- **Data Structures Used:** Extensively utilizes `std::vector` for dynamic array storage and `std::map` for relational mapping between subjects, student enrollments, and time slots.
- **Backtracking Algorithm:** Implements a recursive backtracking engine (graph coloring logic) to ensure absolutely zero scheduling conflicts among enrolled students.
- **Quick Sort Optimization:** Includes a custom Quick Sort algorithm to dynamically sort subjects by enrollment density in descending order, ensuring the hardest-to-place subjects are scheduled first for optimal performance.

## 🚀 How to Use

### Web App
1. Open `index.html` in any modern web browser.
2. Configure your global preferences, add subjects, and set their priority (Weak, Medium, Strong).
3. Click **Generate Smart Schedule** and follow your dynamic timeline!

### C++ Terminal App
1. Compile the C++ program: `g++ timetable.cpp -o timetable`
2. Run the executable: `./timetable`
3. Enter the requested subjects and student lists via the terminal prompts to generate a conflict-free schedule.
