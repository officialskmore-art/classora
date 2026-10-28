# Classora 🎓
> Academic Management, Beautifully Simple.

Classora is an intuitive academic workspace connecting educators and students with universal Classora IDs, real-time classroom management, homework & schedule tracking, examination publishing, and privacy-first public profiles.

---

## 🌟 Key Features

* **Universal Classora ID System**: Permanent alphanumeric academic identity for teachers (`TCH-...`) and students (`STD-...`).
* **Instagram-Style Public Profiles**: Card modal with avatar ring, role badges, verified credentials, and 1-click sharing.
* **Granular Privacy Controls**: User-controlled visibility toggles for email, phone, school/institution, grade/classes, and bio.
* **Teacher Portal**: Classroom creation & management, student enrollment approvals, schedule planner, exam grading, and attendance tracking.
* **Student Portal**: Enrolled classroom viewer, lecture timetable, homework submissions, and formal grade reporting.
* **Universal Directory Search**: Fast real-time search across the academic network by Name or Classora ID with `Ctrl + K` global shortcut.
* **Instant Demo Mode**: Pre-configured instant access for instant walkthroughs without login barriers (`?demo=teacher` and `?demo=student`).

---

## 🚀 Live Deployment

Classora is pre-configured for one-click hosting on **Vercel** or **Netlify**:

* `vercel.json` included with `cleanUrls: true` and security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`).
* No complex build steps or node server required — pure, fast HTML5, CSS3, and JavaScript.

---

## 📂 Project Structure

```
├── index.html              # Landing page (Early access & feature showcase)
├── search.html             # Universal academic directory search
├── about.html              # FAQ, architecture, and help documentation
├── login.html              # Unified authentication portal
├── register-teacher.html   # Educator registration
├── register-student.html   # Student registration
├── setup-profile.html      # Post-registration onboarding wizard
├── forgot-password.html    # Password recovery flow
├── auth-callback.html      # Supabase OAuth/magic link callback handler
├── vercel.json             # Deployment routing & security configuration
├── css/
│   └── style.css           # Complete design system & component styles
├── js/
│   ├── main.js             # Navigation, Instagram modal, directory search
│   └── supabase-client.js  # Supabase client, auth management & state sync
├── teacher/                # Educator portal pages
│   ├── dashboard.html      # Main teacher dashboard with verified ID card
│   ├── classrooms.html     # Classroom management & delete confirmation
│   ├── students.html       # Enrolled student directory & approvals
│   ├── schedule.html       # Weekly lecture calendar
│   ├── exams.html          # Examination scheduler & grade input
│   ├── homework.html       # Assignments tracker
│   ├── notes.html          # Study materials & announcements
│   ├── progress.html       # Academic performance metrics
│   ├── results.html        # Published grades & marksheets
│   ├── notifications.html  # System alerts & join requests
│   ├── join-requests.html  # Pending student enrollment requests
│   └── profile.html        # Profile settings & privacy controls
└── student/                # Student portal pages
    ├── dashboard.html      # Main student dashboard with verified ID card
    ├── classrooms.html     # Enrolled classes & join requests
    ├── teachers.html       # Linked educators directory
    ├── schedule.html       # Timetable viewer
    ├── exams.html          # Upcoming tests & seat numbers
    ├── homework.html       # Pending assignments
    ├── results.html        # Academic performance & grades
    ├── progress.html       # Attendance & progress tracker
    ├── downloads.html      # Study notes & resource repository
    ├── notifications.html  # Alert center
    └── profile.html        # Student credentials & privacy controls
```

---

## 📄 License
© 2026 Classora. All rights reserved.
