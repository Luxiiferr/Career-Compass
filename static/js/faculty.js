/* ============================================================
   CareerCompass — Faculty Portal JavaScript
   ============================================================ */

var STORAGE_KEY = 'careerCompassResults';
var AUTH_KEY = 'careerCompassAuth';

function getAuthUser() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function getReportData() {
  return window.facultyReports || [];
}

function fetchReportsRemote() {
  return fetch('/api/assessments').then(function(res) {
    return res.json();
  }).then(function(json) {
    if (json && json.ok && Array.isArray(json.items)) {
      // map server items to the format used by the frontend
      return json.items.map(function(it) {
        return {
          id: it.id,
          studentName: it.studentName || it.raw && it.raw.studentName,
          initials: it.initials || (it.studentName || '').split(' ').map(function(s){return s[0];}).join('').slice(0,2).toUpperCase(),
          year: it.year || '',
          section: it.section || '',
          career: it.career || (it.raw && it.raw.topCareer && it.raw.topCareer.name) || 'Unknown',
          score: it.score || (it.raw && it.raw.topCareer && it.raw.topCareer.score) || 0,
          date: it.date || new Date().toLocaleDateString()
        };
      });
    }
    return [];
  }).catch(function() { return []; });
}

function renderDashboardSummary(reports) {
  var totalEl = document.getElementById('dashboard-total-students');
  var completedEl = document.getElementById('dashboard-completed-count');
  var recommendedEl = document.getElementById('dashboard-most-recommended');
  var averageEl = document.getElementById('dashboard-average-score');
  var tableEl = document.getElementById('faculty-recent-students');

  if (totalEl) totalEl.textContent = reports.length;
  if (completedEl) completedEl.textContent = reports.length;

  if (reports.length) {
    var counts = reports.reduce(function(acc, item) {
      acc[item.career] = (acc[item.career] || 0) + 1;
      return acc;
    }, {});
    var topCareer = Object.keys(counts).sort(function(a, b) { return counts[b] - counts[a]; })[0];
    if (recommendedEl) recommendedEl.textContent = topCareer || 'Pending';
    if (averageEl) averageEl.textContent = Math.round(reports.reduce(function(sum, item) { return sum + item.score; }, 0) / reports.length) + '%';
    if (tableEl) {
      tableEl.innerHTML = reports.slice(0, 5).map(function(r) {
        var c = r.score >= 85 ? '#10B981' : r.score >= 70 ? 'var(--indigo)' : 'var(--amber)';
        return '<tr><td><div class="d-flex align-items-center gap-2"><div class="sidebar-avatar" style="width:32px;height:32px;background:#EEF2FF;color:var(--indigo)">' + (r.initials || 'ST') + '</div><span class="fw-medium">' + (r.studentName || 'Student') + '</span></div></td><td class="text-secondary">' + (r.year || '—') + ' · ' + (r.section || '—') + '</td><td>' + (r.career || 'Pending') + '</td><td style="min-width:160px"><div class="d-flex align-items-center gap-2"><div class="skill-bar flex-grow-1"><div class="fill" style="width:' + r.score + '%;background:' + c + '"></div></div><span class="small fw-semibold">' + r.score + '%</span></div></td><td class="text-secondary">' + (r.date || '—') + '</td></tr>';
      }).join('');
    }
  } else {
    if (recommendedEl) recommendedEl.textContent = 'Pending';
    if (averageEl) averageEl.textContent = '0%';
    if (tableEl) tableEl.innerHTML = '<tr><td colspan="5" class="text-center text-secondary py-4">No assessment results yet.</td></tr>';
  }
}

function renderReports() {
  var searchEl = document.getElementById('reports-search');
  var yearEl   = document.getElementById('reports-year');
  var s = searchEl ? searchEl.value.toLowerCase() : '';
  var y = yearEl   ? yearEl.value                 : '';
  var reports = getReportData();
  var filtered = reports.filter(function(r) {
    return (!y || r.year === y) && (r.studentName.toLowerCase().includes(s) || r.career.toLowerCase().includes(s));
  });
  var tbody = document.getElementById('reports-tbody');
  if (!tbody) return;
  tbody.innerHTML = filtered.map(function(r, i) {
    var c = r.score >= 85 ? '#10B981' : r.score >= 70 ? 'var(--indigo)' : 'var(--amber)';
    return '<tr>' +
      '<td class="text-secondary" style="font-size:.75rem">' + String(i+1).padStart(3,'0') + '</td>' +
      '<td><div class="d-flex align-items-center gap-2"><div class="sidebar-avatar" style="width:32px;height:32px;background:#EEF2FF;color:var(--indigo)">' + r.initials + '</div><span class="fw-medium">' + r.studentName + '</span></div></td>' +
      '<td class="text-secondary">' + r.year + ' &middot; ' + r.section + '</td>' +
      '<td><div class="d-flex align-items-center gap-2"><i class="bi bi-code-slash text-indigo" style="font-size:.8rem"></i>' + r.career + '</div></td>' +
      '<td style="min-width:150px"><div class="d-flex align-items-center gap-2"><div class="skill-bar flex-grow-1"><div class="fill" style="width:' + r.score + '%;background:' + c + '"></div></div><span class="small fw-semibold">' + r.score + '%</span></div></td>' +
      '<td class="text-secondary">' + r.date + '</td>' +
      '<td><span class="badge-green">Completed</span></td>' +
      '</tr>';
  }).join('');
  var el = document.getElementById('reports-count');
  if (el) el.textContent = 'Showing ' + filtered.length + ' of ' + reports.length + ' students';

  var totalEl = document.getElementById('reports-total-students');
  if (totalEl) totalEl.textContent = reports.length;
  var completionEl = document.getElementById('reports-completion');
  if (completionEl) completionEl.textContent = reports.length + ' assessments';
  var averageEl = document.getElementById('reports-average-score');
  if (averageEl) {
    var avg = reports.length ? Math.round(reports.reduce(function(sum, r) { return sum + r.score; }, 0) / reports.length) : 0;
    averageEl.textContent = avg + '%';
  }

  var distEl = document.getElementById('distribution-bars');
  if (distEl) {
    var groups = reports.reduce(function(acc, item) {
      acc[item.career] = (acc[item.career] || 0) + 1;
      return acc;
    }, {});
    var total = reports.length || 1;
    distEl.innerHTML = Object.keys(groups).sort().map(function(key) {
      var pct = Math.round((groups[key] / total) * 100);
      return '<div class="dist-bar-row"><span class="label">' + key + '</span><div class="skill-bar flex-grow-1"><div class="fill" style="width:' + pct + '%"></div></div><span class="pct">' + pct + '%</span></div>';
    }).join('');
  }
}

function escapeHtml(value) { var d = document.createElement('div'); d.textContent = value == null ? '' : String(value); return d.innerHTML; }

function renderFacultyStudents(items) {
  var search = (document.getElementById('students-search') || {}).value || '';
  search = search.toLowerCase();
  var rows = items.filter(function(s) { return !search || (s.name + ' ' + s.email + ' ' + (s.section || '')).toLowerCase().includes(search); });
  var table = document.getElementById('students-tbody'); if (!table) return;
  table.innerHTML = rows.length ? rows.map(function(s) {
    return '<tr>' +
      '<td><strong>' + escapeHtml(s.name) + '</strong><div class="small text-secondary">' + escapeHtml(s.email) + '</div></td>' +
      '<td>' + escapeHtml(s.year || '—') + ' · ' + escapeHtml(s.section || '—') + '</td>' +
      '<td>' + (s.career ? escapeHtml(s.career) + ' <span class="badge-green">' + s.score + '%</span>' : '<span class="text-secondary">Not completed</span>') + '</td>' +
      '<td>' +
        '<div class="d-flex gap-2">' +
          '<button class="btn btn-sm btn-outline-primary" onclick="showStudentNotes(' + s.id + ', \'' + escapeHtml(s.name).replace(/'/g, '&#39;') + '\')">Notes</button>' +
          '<button class="btn btn-sm btn-outline-danger" onclick="showDeleteStudent(' + s.id + ', \'' + escapeHtml(s.name).replace(/'/g, '&#39;') + '\')"><i class="bi bi-trash"></i></button>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }).join('') : '<tr><td colspan="4" class="text-center text-secondary py-4">No students found.</td></tr>';
  var count = document.getElementById('students-count'); if (count) count.textContent = rows.length + ' student' + (rows.length === 1 ? '' : 's');
}

function loadFacultyStudents() {
  return fetch('/api/faculty/students').then(function(r) { return r.json(); }).then(function(data) { window.facultyStudents = data.items || []; renderFacultyStudents(window.facultyStudents); }).catch(function() { renderFacultyStudents([]); });
}

function refreshStudentNotes(id) {
  return fetch('/api/faculty/students/' + id + '/notes').then(function(r) { return r.json(); }).then(function(data) {
    document.getElementById('notes-list').innerHTML = (data.items || []).map(function(n) { return '<div class="border rounded p-2 mb-2 small"><strong>' + escapeHtml(n.faculty_name) + '</strong><div>' + escapeHtml(n.note) + '</div><div class="text-secondary mt-1">' + new Date(n.created_at).toLocaleString() + '</div></div>'; }).join('') || '<p class="text-secondary small">No notes yet.</p>';
  });
}

function showStudentNotes(id, name) {
  window.activeStudentId = id; document.getElementById('notes-student-name').textContent = name;
  refreshStudentNotes(id).then(function() {
    var modalEl = document.getElementById('notes-modal');
    var modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (!modalInstance) {
      modalInstance = new bootstrap.Modal(modalEl);
    }
    modalInstance.show();
  });
}

function saveStudentNote() {
  var input = document.getElementById('notes-input'), note = input.value.trim(); if (!note) return;
  fetch('/api/faculty/students/' + window.activeStudentId + '/notes', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({note:note}) }).then(function(r) { return r.json(); }).then(function(data) { if (!data.ok) throw new Error(data.error); input.value=''; refreshStudentNotes(window.activeStudentId); }).catch(function(e) { alert(e.message); });
}

function showDeleteStudent(id, name) {
  window.deleteStudentId = id;
  var nameEl = document.getElementById('delete-student-name');
  if (nameEl) nameEl.textContent = name;
  var modalEl = document.getElementById('delete-student-modal');
  var instance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
  instance.show();
}

function confirmDeleteStudent() {
  var btn = document.querySelector('#delete-student-modal .btn-danger');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Deleting...'; }
  fetch('/api/faculty/students/' + window.deleteStudentId, { method: 'DELETE' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.ok) throw new Error(data.error);
      var modalEl = document.getElementById('delete-student-modal');
      bootstrap.Modal.getInstance(modalEl).hide();
      // Remove from local list and re-render
      window.facultyStudents = (window.facultyStudents || []).filter(function(s) { return s.id !== window.deleteStudentId; });
      renderFacultyStudents(window.facultyStudents);
    })
    .catch(function(e) { alert(e.message); })
    .finally(function() {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-trash me-1"></i>Delete Account'; }
    });
}

function renderRecommendationManagement(items) {
  var el = document.getElementById('recommendations-list'); if (!el) return;
  var completed = items.filter(function(s) { return s.career; });
  el.innerHTML = completed.length ? completed.map(function(s) { return '<div class="border rounded-3 p-3 mb-3 d-flex justify-content-between align-items-center"><div><strong>' + escapeHtml(s.name) + '</strong><div class="small text-secondary">' + escapeHtml(s.year || '—') + ' · ' + escapeHtml(s.section || '—') + '</div></div><div class="text-end"><div class="fw-semibold text-indigo">' + escapeHtml(s.career) + '</div><span class="badge-green">' + s.score + '% match</span></div></div>'; }).join('') : '<p class="text-secondary">No completed recommendations yet.</p>';
}

function saveFacultySettings() {
  var name = document.getElementById('faculty-name').value.trim(), phone = document.getElementById('faculty-phone').value.trim();
  fetch('/api/profile', {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:name, phone:phone})}).then(function(r){return r.json();}).then(function(data){if(!data.ok) throw new Error(data.error); localStorage.setItem(AUTH_KEY, JSON.stringify({role:data.user.role,user:data.user})); document.getElementById('settings-message').textContent='Profile saved.';}).catch(function(e){document.getElementById('settings-message').textContent=e.message;});
}

function changeFacultyPassword() {
  fetch('/api/auth/change-password', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:document.getElementById('current-password').value,newPassword:document.getElementById('new-password').value})}).then(function(r){return r.json();}).then(function(data){if(!data.ok)throw new Error(data.error);document.getElementById('settings-message').textContent=data.message;document.getElementById('current-password').value='';document.getElementById('new-password').value='';}).catch(function(e){document.getElementById('settings-message').textContent=e.message;});
}

/* ── Chart.js init (dashboard only) ───────────────────────── */
function initCharts(reports) {
  var pie = document.getElementById('pie-chart');
  var bar = document.getElementById('bar-chart');
  reports = reports || [];
  if (pie) {
    var groups = reports.reduce(function(result, report) { result[report.career] = (result[report.career] || 0) + 1; return result; }, {});
    var labels = Object.keys(groups);
    var data = labels.map(function(label) { return groups[label]; });
    var legend = document.getElementById('career-distribution-legend');
    if (legend) legend.innerHTML = labels.length ? labels.map(function(label, index) { return '<div class="d-flex align-items-center gap-2"><div style="width:10px;height:10px;border-radius:50%;background:' + ['#4F46E5','#7C3AED','#2563EB','#0891B2','#0D9488'][index % 5] + ';flex-shrink:0"></div><span class="small text-secondary flex-grow-1">' + label + '</span><span class="small fw-semibold">' + data[index] + '</span></div>'; }).join('') : '<span class="small text-secondary">No assessment data yet.</span>';
    new Chart(pie, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{ data: data, backgroundColor:['#4F46E5','#7C3AED','#2563EB','#0891B2','#0D9488'], borderWidth:0, hoverOffset:6 }]
      },
      options: { cutout:'60%', plugins: { legend:{display:false}, tooltip:{ callbacks:{ label:function(ctx){ return ' '+ctx.label+': '+ctx.parsed+'%'; } } } } }
    });
  }
  if (bar) {
    new Chart(bar, {
      type: 'bar',
      data: {
        labels: ['Submitted assessments'],
        datasets: [
          { label:'Completed', data:[reports.length], backgroundColor:'#4F46E5', borderRadius:6, barPercentage:.5 }
        ]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ position:'bottom', labels:{ font:{size:11}, boxWidth:10, padding:12 } } },
        scales:{ x:{ grid:{display:false}, ticks:{font:{size:11}} }, y:{ grid:{color:'#F3F4F6'}, ticks:{font:{size:11}}, beginAtZero:true } }
      }
    });
  }
}

/* ── Init on load ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  fetchReportsRemote().then(function(remote) {
    window.facultyReports = remote || [];
    var reports = getReportData();
    initCharts(reports);
    renderDashboardSummary(reports);
    renderReports();
    if (document.getElementById('students-tbody')) loadFacultyStudents();
    if (document.getElementById('recommendations-list')) loadFacultyStudents().then(function() { renderRecommendationManagement(window.facultyStudents || []); });
    if (document.getElementById('faculty-name')) { var a=getAuthUser().user || {}; document.getElementById('faculty-name').value=a.name || ''; document.getElementById('faculty-email').value=a.email || ''; document.getElementById('faculty-phone').value=a.phone || ''; }
  }).catch(function() {
    var reports = getReportData();
    initCharts(reports);
    renderDashboardSummary(reports);
    renderReports();
  });
});
