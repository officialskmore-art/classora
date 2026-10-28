const fs = require("fs");

// ─── Student Classrooms ───────────────────────────────────────────────
let html = fs.readFileSync("student/classrooms.html", "utf8");
const OLD_JOIN = `  async function handleSendJoinRequest(e) {`;
const NEW_JOIN = `  async function handleSendJoinRequest(e) {
    e.preventDefault();
    var codeInput = document.getElementById("join-code-input");
    var code = (codeInput.value || "").trim().toUpperCase();
    if (!code) return;
    var btn = document.getElementById("join-submit-btn");
    if (btn) { btn.disabled = true; btn.textContent = "Sending..."; }
    try {
      await ClassoraAuth.submitJoinRequest({ classroomCode: code });
      closeModal("modal-join-class");
      codeInput.value = "";
      showToast("Join request sent! Your teacher will approve shortly.", "success", 5000);
      await loadStudentClassrooms();
    } catch(err) { showToast(err.message || "Failed to send join request.", "error"); }
    finally { if (btn) { btn.disabled = false; btn.textContent = "Send Join Request"; } }
  }

  async function loadStudentClassrooms() {
    var classrooms = await ClassoraAuth.fetchEnrolledClassrooms();
    var badge = document.getElementById("student-class-count");
    if (badge) badge.textContent = classrooms.length;
    renderStudentClassroomsDB(classrooms);
  }

  function renderStudentClassroomsDB(classrooms) {
    classrooms = classrooms || [];
    var grid = document.querySelector(".dash-content .grid") || document.getElementById("classrooms-container");
    if (!grid) return;
    if (!classrooms.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:56px 20px;border:2px dashed #E5E7EB;border-radius:12px;background:#F9FAFB"><div style="font-size:2.5rem;margin-bottom:8px">&#127979;</div><h4 style="color:#1F2937;margin-bottom:4px">No Enrolled Classrooms</h4><p style="font-size:0.875rem;color:#6B7280;margin-bottom:16px">Enter your teacher Classroom Code to join.</p><button class="btn btn-primary btn-sm" onclick="openModal(\'modal-join-class\')">+ Join Classroom</button></div>';
      return;
    }
    var grads = ["card-grad-1","card-grad-2","card-grad-3","card-grad-4"];
    grid.innerHTML = classrooms.map(function(c,i){
      var g = grads[i % grads.length];
      return '<div class="class-card animate-fade-up"><div class="class-card-header ' + g + '"><div style="display:flex;justify-content:space-between"><span class="badge" style="background:rgba(255,255,255,0.25);color:#fff">' + (c.section||"General") + '</span><span class="badge" style="background:rgba(255,255,255,0.2);color:#fff">Code: ' + c.class_code + '</span></div><h3 style="color:#fff;margin-top:12px;margin-bottom:4px">' + c.name + '</h3><div style="font-size:0.85rem;opacity:0.85">' + (c.subject||"Academic") + '</div></div><div class="class-card-body"><div class="class-meta-row"><span>Code</span><strong>' + c.class_code + '</strong></div><div class="class-meta-row"><span>Subject</span><strong>' + (c.subject||"General") + '</strong></div><div style="display:flex;gap:10px;margin-top:auto;padding-top:12px"><a href="homework.html" class="btn btn-primary btn-sm" style="flex:1">Homework</a><a href="exams.html" class="btn btn-secondary btn-sm" style="flex:1">Exams</a></div></div></div>';
    }).join("");
  }

  // Override old renderStudentClassrooms to load from DB
  function renderStudentClassrooms() { loadStudentClassrooms(); }

  document.addEventListener("DOMContentLoaded", async function() {
    await loadStudentClassrooms();
  });
  /* REPLACED_BELOW_PLACEHOLDER */
  async function handleSendJoinRequest_ORIGINAL(e) {`;
if (html.includes(OLD_JOIN)) {
  // Find the closing of handleSendJoinRequest
  let start = html.indexOf(OLD_JOIN);
  // Find DOMContentLoaded block closing
  let endMarker = `  document.addEventListener('DOMContentLoaded', () => {\n    renderStudentClassrooms();\n  });`;
  let end = html.indexOf(endMarker);
  if (end > start) {
    html = html.slice(0, start) + NEW_JOIN + html.slice(end + endMarker.length);
    // Remove REPLACED_BELOW_PLACEHOLDER and the ORIGINAL function placeholder
    html = html.replace(/\/\* REPLACED_BELOW_PLACEHOLDER \*\/[\s\S]*$/, "</script>\n</body>\n</html>\n");
  }
}
// Fix submit button id
html = html.replace('<button type="submit" class="btn btn-primary">Send Join Request</button>',
  '<button type="submit" class="btn btn-primary" id="join-submit-btn">Send Join Request</button>');
fs.writeFileSync("student/classrooms.html", html, "utf8");
console.log("Student classrooms done. len=" + html.length);
