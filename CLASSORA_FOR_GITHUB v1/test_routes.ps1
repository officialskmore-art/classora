$urls = @(
  'http://localhost:3000/index.html',
  'http://localhost:3000/login.html',
  'http://localhost:3000/register-teacher.html',
  'http://localhost:3000/register-student.html',
  'http://localhost:3000/search.html',
  'http://localhost:3000/about.html',
  'http://localhost:3000/forgot-password.html',
  'http://localhost:3000/teacher/dashboard.html',
  'http://localhost:3000/teacher/profile.html',
  'http://localhost:3000/teacher/classrooms.html',
  'http://localhost:3000/teacher/students.html',
  'http://localhost:3000/teacher/join-requests.html',
  'http://localhost:3000/teacher/schedule.html',
  'http://localhost:3000/teacher/exams.html',
  'http://localhost:3000/teacher/homework.html',
  'http://localhost:3000/teacher/results.html',
  'http://localhost:3000/teacher/progress.html',
  'http://localhost:3000/teacher/notes.html',
  'http://localhost:3000/teacher/notifications.html',
  'http://localhost:3000/student/dashboard.html',
  'http://localhost:3000/student/profile.html',
  'http://localhost:3000/student/classrooms.html',
  'http://localhost:3000/student/teachers.html',
  'http://localhost:3000/student/schedule.html',
  'http://localhost:3000/student/exams.html',
  'http://localhost:3000/student/homework.html',
  'http://localhost:3000/student/results.html',
  'http://localhost:3000/student/progress.html',
  'http://localhost:3000/auth-callback.html',
  'http://localhost:3000/setup-profile.html',
  'http://localhost:3000/js/supabase-client.js',
  'http://localhost:3000/student/downloads.html',
  'http://localhost:3000/student/notifications.html'
)

$allOk = $true
foreach ($u in $urls) {
  try {
    $res = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 3
    if ($res.StatusCode -eq 200) {
      Write-Host "OK (200): $u" -ForegroundColor Green
    } else {
      Write-Host "Status $($res.StatusCode): $u" -ForegroundColor Yellow
      $allOk = $false
    }
  } catch {
    Write-Host "FAILED: $u - $($_.Exception.Message)" -ForegroundColor Red
    $allOk = $false
  }
}

if ($allOk) {
  Write-Host "ALL 29 ROUTES SERVING PERFECTLY (200 OK)!" -ForegroundColor Cyan
}
