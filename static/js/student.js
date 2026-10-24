/* ============================================================
   CareerCompass — Student Portal JavaScript
   Shared across all student/*.html pages
   ============================================================ */

var STORAGE_KEY = 'careerCompassResults';
var CURRENT_RESULT_KEY = 'careerCompassCurrentResult';
var AUTH_KEY = 'careerCompassAuth';
var PORTFOLIO_ANALYSIS = null;

var CAREER_DEFINITIONS = [
  {
    key: 'software-engineering',
    name: 'Software Engineering',
    description: 'Builds, tests, and maintains software systems and applications.',
    reasons: [
      'Strong programming fundamentals and analytical thinking.',
      'High problem-solving ability and good academic standing.'
    ],
    keywords: ['software', 'development', 'system', 'programming', 'database', 'application'],
    weights: { academic: 0.60, interest: 0.40 }
  },
  {
    key: 'web-development',
    name: 'Web Development',
    description: 'Creates responsive websites and web applications.',
    reasons: [
      'Excellent fit for students who enjoy design, scripting, and user experience.',
      'Strong performance in JavaScript, PHP, and web technologies.'
    ],
    keywords: ['web', 'design', 'frontend', 'backend', 'website', 'application'],
    weights: { academic: 0.55, interest: 0.45 }
  },
  {
    key: 'data-science',
    name: 'Data Science',
    description: 'Turns data into actionable insights using analysis and models.',
    reasons: [
      'Good match for students strong in analytics and data interpretation.',
      'Python and data-related skills support this path well.'
    ],
    keywords: ['data', 'analytics', 'analysis', 'machine', 'ai', 'statistics'],
    weights: { academic: 0.55, interest: 0.45 }
  },
  {
    key: 'cybersecurity',
    name: 'Cybersecurity',
    description: 'Protects systems, networks, and data from threats.',
    reasons: [
      'Strong logical thinking and security awareness are valuable here.',
      'Well suited to students interested in networking and protection.'
    ],
    keywords: ['security', 'network', 'cyber', 'protect', 'threat'],
    weights: { academic: 0.60, interest: 0.40 }
  },
  {
    key: 'network-administration',
    name: 'Network Administration',
    description: 'Maintains and optimizes network systems and infrastructure.',
    reasons: [
      'Good fit for students who enjoy infrastructure, connectivity, and reliability.',
      'Networking and communication skills support this career well.'
    ],
    keywords: ['network', 'infrastructure', 'systems', 'connectivity', 'server'],
    weights: { academic: 0.55, interest: 0.45 }
  }
];

/* ── Active nav link ───────────────────────────────────────── */
(function markActiveNav() {
  var page = window.location.pathname.split('/').pop();
  document.querySelectorAll('.nav-item-cc[data-page]').forEach(function(el) {
    if (el.dataset.page === page) el.classList.add('active');
  });
})();

/* ── Rating buttons (assessment.html) ─────────────────────── */
/* ── Interest checkboxes (assessment.html) ─────────────────── */
var INTERESTS = [
  'Software Development','Web Design & Development','Data Analytics',
  'Cybersecurity','Network Administration','Database Management',
  'Mobile App Development','AI / Machine Learning'
];
var SELECTED_INTERESTS = [];
var CAREER_INTEREST_MAP = {
  'Software Engineering': ['Software Development', 'Mobile App Development', 'Database Management'],
  'Web Development': ['Web Design & Development', 'Mobile App Development'],
  'Data Science & Analytics': ['Data Analytics', 'AI / Machine Learning', 'Database Management'],
  'Cybersecurity': ['Cybersecurity', 'Network Administration'],
  'Network Engineering': ['Network Administration', 'Cybersecurity']
};

var CAREER_IMPROVEMENT_GUIDES = {
  'Web Development': {
    signals: ['html', 'css', 'javascript', 'react', 'php', 'website', 'frontend', 'backend'],
    actions: ['Build a responsive website using HTML, CSS, and JavaScript.', 'Publish a project on GitHub and, where appropriate, include a live demo.', 'Document the frontend, backend, and database contributions you made.'],
    evidence: 'Add screenshots, a repository link, a live demo link, and a short explanation of the design and technical decisions.'
  },
  'Software Engineering': {
    signals: ['software', 'java', 'python', 'c#', 'api', 'git', 'algorithm', 'backend', 'testing'],
    actions: ['Develop a structured software application with clear features and modules.', 'Demonstrate debugging, testing, version control, and organized code.', 'Document the application design, key features, and testing performed.'],
    evidence: 'Add a project README, selected code samples, a Git history or repository link, and brief test results.'
  },
  'Cybersecurity': {
    signals: ['cybersecurity', 'security', 'penetration', 'vulnerability', 'kali', 'encryption', 'ethical hacking'],
    actions: ['Complete safe, legal cybersecurity labs or defensive security exercises.', 'Practice documenting vulnerabilities, mitigations, and secure configurations.', 'Include relevant training or certifications only when they have actually been earned.'],
    evidence: 'Add lab write-ups, redacted screenshots, defensive checklists, and reflections on safe and ethical practice.'
  },
  'Data Science & Analytics': {
    signals: ['data', 'python', 'sql', 'power bi', 'tableau', 'dashboard', 'analytics', 'machine learning'],
    actions: ['Complete a data analysis project using Python, SQL, or a visualization tool.', 'Show data cleaning, visualization, and interpretation—not only the final chart.', 'Write a short report that explains the conclusions drawn from the data.'],
    evidence: 'Add a notebook or SQL sample, dataset source, dashboard screenshots, and a concise findings report.'
  },
  'Network Engineering': {
    signals: ['network', 'cisco', 'routing', 'switching', 'lan', 'wan', 'infrastructure'],
    actions: ['Build network simulations using appropriate tools such as Packet Tracer.', 'Practice IP addressing, routing, subnetting, and network troubleshooting.', 'Include relevant coursework or certifications when applicable and actually earned.'],
    evidence: 'Add topology diagrams, configuration excerpts, troubleshooting notes, and simulation screenshots.'
  }
};

function buildInterests() {
  var el = document.getElementById('interest-checkboxes');
  if (!el) return;
  SELECTED_INTERESTS = [];
  el.innerHTML = INTERESTS.map(function(opt) {
    return '<div class="col-6"><label class="interest-card d-flex align-items-center gap-2" onclick="toggleInterest(this)">' +
      '<div class="check-box"></div>' +
      '<span class="small">' + opt + '</span></label></div>';
  }).join('');
}

function toggleInterest(card) {
  var label = card.querySelector('span').textContent.trim();
  card.classList.toggle('selected');
  var box = card.querySelector('.check-box');
  box.classList.toggle('checked');
  box.innerHTML = box.classList.contains('checked') ? '<i class="bi bi-check2 text-white" style="font-size:.6rem"></i>' : '';
  if (card.classList.contains('selected')) {
    if (!SELECTED_INTERESTS.includes(label)) SELECTED_INTERESTS.push(label);
  } else {
    SELECTED_INTERESTS = SELECTED_INTERESTS.filter(function(item) { return item !== label; });
  }
}

/* ── Assessment Wizard (assessment.html) ───────────────────── */
var STEP_NAMES = ['Personal Info', 'E-Portfolio Upload', 'Academic Info', 'Career Interests'];
var currentStep = 1, TOTAL_STEPS = 4;

function renderStepIndicators() {
  var c = document.getElementById('step-indicators');
  if (!c) return;
  var h = '';
  for (var i = 1; i <= TOTAL_STEPS; i++) {
    var cls  = i < currentStep ? 'done' : i === currentStep ? 'active' : '';
    var icon = i < currentStep ? '<i class="bi bi-check2" style="font-size:.7rem"></i>' : i;
    h += '<div class="d-flex flex-column align-items-center" style="flex:0 0 auto">' +
         '<div class="step-circle ' + cls + '">' + icon + '</div>' +
         '<div class="step-label d-none d-lg-block" style="max-width:60px">' + STEP_NAMES[i-1] + '</div></div>';
    if (i < TOTAL_STEPS)
      h += '<div class="step-connector ' + (i < currentStep ? 'done' : '') + '"></div>';
  }
  c.innerHTML = h;
}

function updateWizard() {
  renderStepIndicators();
  var stepCurrent = document.getElementById('step-current');
  var stepName = document.getElementById('step-name-display');
  var percentage = document.getElementById('step-pct-display');
  var progress = document.getElementById('wizard-progress');
  var previousBtn = document.getElementById('btn-prev');
  if (stepCurrent) stepCurrent.textContent = currentStep;
  if (stepName) stepName.textContent = STEP_NAMES[currentStep - 1];
  if (percentage) percentage.textContent = Math.round((currentStep - 1) / (TOTAL_STEPS - 1) * 100) + '% complete';
  if (progress) progress.style.width = Math.round(currentStep / TOTAL_STEPS * 100) + '%';
  if (previousBtn) previousBtn.disabled = currentStep === 1;

  var nextBtn = document.getElementById('btn-next');
  if (nextBtn) {
    if (currentStep === TOTAL_STEPS) {
      nextBtn.innerHTML = 'Submit Assessment <i class="bi bi-check-circle"></i>';
    } else {
      nextBtn.innerHTML = 'Next Step <i class="bi bi-chevron-right"></i>';
    }
  }
}

async function wizardNext() {
  if (currentStep < TOTAL_STEPS) {
    if (!(await validateCurrentStep())) return;
    document.getElementById('ws-' + currentStep).classList.add('d-none');
    currentStep++;
    document.getElementById('ws-' + currentStep).classList.remove('d-none');
    updateWizard();
  } else {
    submitAssessment();
  }
}

async function validateCurrentStep() {
  if (currentStep === 1) {
    var age = document.getElementById('assessment-age');
    var validAge = age && age.value !== '' && Number(age.value) >= 18 && Number(age.value) <= 40;
    if (!validAge) { if (age) { age.classList.add('is-invalid'); age.focus(); } return false; }
    age.classList.remove('is-invalid');
  }
  if (currentStep === 2) {
    return await analyzePortfolio();
  }
  if (currentStep === 3) {
    var gwa = document.getElementById('assessment-gwa');
    var validGwa = gwa && gwa.value !== '' && Number(gwa.value) >= 1 && Number(gwa.value) <= 5;
    if (!validGwa) { if (gwa) { gwa.classList.add('is-invalid'); gwa.focus(); } return false; }
    gwa.classList.remove('is-invalid');
  }
  if (currentStep === 4) {
    var preferredCareer = document.getElementById('preferred-career');
    if (!preferredCareer || !preferredCareer.value) { if (preferredCareer) { preferredCareer.classList.add('is-invalid'); preferredCareer.focus(); } return false; }
    preferredCareer.classList.remove('is-invalid');
  }
  return true;
}

async function analyzePortfolio() {
  var portfolio = document.getElementById('portfolio_upload');
  var website = document.getElementById('portfolio_website');
  var status = document.getElementById('portfolio-status');
  var nextBtn = document.getElementById('btn-next');
  var prevBtn = document.getElementById('btn-prev');
  var modal = document.getElementById('analyzing-modal');
  var progressBar = document.getElementById('analyzing-progress-bar');
  
  var file = portfolio && portfolio.files && portfolio.files[0];
  var url = website ? website.value.trim() : '';
  if (url) {
    // Clean accidental leading slashes or missing protocol
    url = url.replace(/^\/+/, '');
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    if (website) website.value = url;
  }
  if (!file && !url) { 
    if (portfolio) { portfolio.classList.add('is-invalid'); portfolio.focus(); } 
    return false; 
  }
  if (file && !/\.pdf$/i.test(file.name)) { 
    if (portfolio) portfolio.classList.add('is-invalid'); 
    if (status) status.textContent = 'Only PDF files are accepted.'; 
    return false; 
  }
  if (portfolio) portfolio.classList.remove('is-invalid');
  
  var data = new FormData(); 
  if (file) data.append('file', file); 
  if (url) data.append('website', url);

  // 1. Disable Next and Previous buttons
  if (nextBtn) {
    nextBtn.disabled = true;
    nextBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Analyzing...';
  }
  if (prevBtn) prevBtn.disabled = true;

  // 2. Show Animated Modal
  if (modal) modal.classList.remove('d-none');
  
  // Helper for animated checklist progression
  function setStepState(stepId, state) {
    var el = document.getElementById(stepId);
    if (!el) return;
    el.classList.remove('active', 'completed');
    var icon = el.querySelector('.step-icon');
    if (state === 'active') {
      el.classList.add('active');
      if (icon) icon.innerHTML = '<i class="bi bi-arrow-repeat"></i>';
    } else if (state === 'completed') {
      el.classList.add('completed');
      if (icon) icon.innerHTML = '<i class="bi bi-check-circle-fill text-success"></i>';
    } else {
      if (icon) icon.innerHTML = '<i class="bi bi-circle text-muted"></i>';
    }
  }

  // Initial step: Extracting
  setStepState('step-extract', 'active');
  setStepState('step-tokenize', 'pending');
  setStepState('step-embeddings', 'pending');
  setStepState('step-match', 'pending');
  if (progressBar) progressBar.style.width = '25%';

  var stepTimer1 = setTimeout(function() {
    setStepState('step-extract', 'completed');
    setStepState('step-tokenize', 'active');
    if (progressBar) progressBar.style.width = '50%';
  }, 400);

  var stepTimer2 = setTimeout(function() {
    setStepState('step-tokenize', 'completed');
    setStepState('step-embeddings', 'active');
    if (progressBar) progressBar.style.width = '75%';
  }, 800);

  var stepTimer3 = setTimeout(function() {
    setStepState('step-embeddings', 'completed');
    setStepState('step-match', 'active');
    if (progressBar) progressBar.style.width = '90%';
  }, 1200);

  try {
    var response = await fetch('/api/portfolio/analyze', { method: 'POST', body: data });
    var payload = await response.json();
    
    // Clear mock timers if response came back quickly
    clearTimeout(stepTimer1);
    clearTimeout(stepTimer2);
    clearTimeout(stepTimer3);

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Portfolio analysis failed.');
    }

    // Finish all steps with checks
    setStepState('step-extract', 'completed');
    setStepState('step-tokenize', 'completed');
    setStepState('step-embeddings', 'completed');
    setStepState('step-match', 'completed');
    if (progressBar) progressBar.style.width = '100%';

    var titleEl = document.getElementById('analyzing-title');
    var subtitleEl = document.getElementById('analyzing-subtitle');
    if (titleEl) titleEl.textContent = 'Analysis Complete!';
    if (subtitleEl) subtitleEl.textContent = 'Top match: ' + payload.analysis.topCareer.name + ' (' + payload.analysis.topCareer.score + '% similarity).';

    PORTFOLIO_ANALYSIS = payload.analysis;
    if (status) {
      status.innerHTML = '<span class="text-success fw-semibold"><i class="bi bi-check-circle"></i> Portfolio successfully analyzed (' + payload.analysis.method + '). Top match: ' + payload.analysis.topCareer.name + '</span>';
    }

    // Brief pause (600ms) so the user and panel can see the final checkmark
    await new Promise(function(resolve) { setTimeout(resolve, 600); });

    if (modal) modal.classList.add('d-none');
    return true;
  } catch (error) {
    clearTimeout(stepTimer1);
    clearTimeout(stepTimer2);
    clearTimeout(stepTimer3);
    if (modal) modal.classList.add('d-none');
    if (status) {
      status.innerHTML = '<span class="text-danger fw-semibold"><i class="bi bi-exclamation-triangle"></i> ' + (error.message || 'Portfolio analysis failed.') + '</span>';
    }
    return false;
  } finally {
    // 3. Re-enable Next and Previous buttons
    if (nextBtn) {
      nextBtn.disabled = false;
      nextBtn.innerHTML = 'Next Step <i class="bi bi-chevron-right"></i>';
    }
    if (prevBtn) prevBtn.disabled = false;
  }
}

function wizardPrev() {
  if (currentStep > 1) {
    document.getElementById('ws-' + currentStep).classList.add('d-none');
    currentStep--;
    document.getElementById('ws-' + currentStep).classList.remove('d-none');
    updateWizard();
  }
}

function getCurrentUser() {
  try {
    var auth = JSON.parse(localStorage.getItem(AUTH_KEY)) || {};
    if (auth.user) {
      return auth.user;
    }
  } catch (e) {}
  return { name: 'Guest User', initials: 'GU', year: '—', section: '—', role: 'student' };
}

function getUserStorageKey(baseKey) {
  var user = getCurrentUser();
  var identity = user.id || user.username || user.email || user.name || 'guest';
  return baseKey + ':' + String(identity).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
}

function getDisplayName(user) {
  return user && user.name ? user.name : 'Guest User';
}

function getDisplayInitials(user) {
  if (user && user.initials) return user.initials;
  return (user && user.name ? user.name : 'Guest User').split(' ').filter(Boolean).slice(0, 2).map(function(part) {
    return part[0].toUpperCase();
  }).join('') || 'GU';
}

function getDisplayMeta(user) {
  if (!user) return '—';
  if (user.role === 'faculty') return 'Faculty';
  return (user.section || 'BSIT-3A') + ' · ' + (user.year || '3rd Year');
}

function renderAuthenticatedUser() {
  var user = getCurrentUser();
  var initials = getDisplayInitials(user);
  var name = getDisplayName(user);
  var meta = getDisplayMeta(user);

  var avatarEls = document.querySelectorAll('.sidebar-avatar, .topbar-avatar');
  avatarEls.forEach(function(el) {
    if (el) el.textContent = initials;
  });

  var nameEls = document.querySelectorAll('.sidebar-user .fw-semibold');
  nameEls.forEach(function(el) {
    if (el) el.textContent = name;
  });

  var metaEls = document.querySelectorAll('.sidebar-user .text-secondary');
  metaEls.forEach(function(el) {
    if (el) el.textContent = meta;
  });

  var greetingEl = document.getElementById('dashboard-assessment-count') && document.querySelector('.topbar > div:first-child .text-secondary');
  if (greetingEl) {
    var firstName = name.split(' ')[0] || 'there';
    greetingEl.textContent = 'Welcome back, ' + firstName + '! Here is your career overview.';
  }
}

function renderDashboardSummary() {
  var result = getCurrentResult();
  var stored = getStoredResults();
  var countEl = document.getElementById('dashboard-assessment-count');
  if (countEl) countEl.textContent = String(stored.length || 0);

  var latestCareerEl = document.getElementById('dashboard-latest-career');
  var latestDateEl = document.getElementById('dashboard-latest-date');
  var scoreEl = document.getElementById('dashboard-match-score');
  var recommendedEl = document.getElementById('dashboard-recommended-career');
  var reasonsEl = document.getElementById('dashboard-reason-list');
  var alternativesEl = document.getElementById('dashboard-alternatives');
  var statScoreEl = document.getElementById('dashboard-stat-score');
  var statScoreCaptionEl = document.getElementById('dashboard-stat-score-caption');
  var statCareerEl = document.getElementById('dashboard-stat-career');
  var statCareerCaptionEl = document.getElementById('dashboard-stat-career-caption');
  var activityEl = document.getElementById('dashboard-activity');

  var skillsEl = document.getElementById('dashboard-skills');
  if (result && result.topCareer) {
    if (latestCareerEl) latestCareerEl.textContent = result.topCareer.name;
    if (latestDateEl) latestDateEl.textContent = result.createdAt || (stored[0] && stored[0].date) || 'Just now';
    if (scoreEl) scoreEl.textContent = result.topCareer.score + '%';
    if (recommendedEl) recommendedEl.textContent = result.topCareer.name;
    if (statScoreEl) statScoreEl.textContent = result.topCareer.score + '%';
    if (statScoreCaptionEl) statScoreCaptionEl.textContent = 'Latest assessment';
    if (statCareerEl) statCareerEl.textContent = result.topCareer.name;
    if (statCareerCaptionEl) statCareerCaptionEl.textContent = 'Based on latest assessment';
    if (reasonsEl) {
      reasonsEl.innerHTML = (result.topCareer.reasons || []).map(function(reason) {
        return '<div class="d-flex align-items-center gap-2 small text-secondary"><i class="bi bi-check2 text-success"></i>' + reason + '</div>';
      }).join('');
    }
    if (activityEl) activityEl.innerHTML = '<div class="d-flex align-items-start gap-3 py-3"><div class="stat-icon flex-shrink-0 bg-indigo-light"><i class="bi bi-clipboard-check text-indigo small"></i></div><div><div class="small fw-medium">Completed Career Assessment</div><div class="text-secondary" style="font-size:.75rem">' + (result.createdAt || 'Recently') + '</div></div></div>';
    if (alternativesEl) {
      alternativesEl.innerHTML = (result.alternatives || []).map(function(item) {
        return '<span class="badge-gray">' + item.name + '</span>';
      }).join('');
    }
    if (skillsEl) {
      var top = result.topCareer;
      var scores = [
        { label: 'Overall Match', value: top.score },
        { label: 'Portfolio Similarity', value: typeof top.portfolioScore === 'number' ? top.portfolioScore : top.score },
        { label: 'Interest Alignment', value: typeof top.interestScore === 'number' ? top.interestScore : 0 },
        { label: 'Academic Readiness', value: typeof top.academicReadinessScore === 'number' ? top.academicReadinessScore : 0 }
      ];
      skillsEl.innerHTML = scores.map(function(item) {
        var value = Math.max(0, Math.min(100, Math.round(item.value || 0)));
        return '<div><div class="d-flex justify-content-between mb-1"><span class="small text-secondary">' + item.label + '</span><span class="small fw-semibold">' + value + '%</span></div><div class="skill-bar"><div class="fill" style="width:' + value + '%"></div></div></div>';
      }).join('');
    }
  } else {
    if (latestCareerEl) latestCareerEl.textContent = 'No assessment yet';
    if (latestDateEl) latestDateEl.textContent = 'Complete an assessment to see your result';
    if (scoreEl) scoreEl.textContent = '—';
    if (recommendedEl) recommendedEl.textContent = 'Awaiting assessment';
    if (statScoreEl) statScoreEl.textContent = '-';
    if (statScoreCaptionEl) statScoreCaptionEl.textContent = 'Complete an assessment';
    if (statCareerEl) statCareerEl.textContent = 'Awaiting assessment';
    if (statCareerCaptionEl) statCareerCaptionEl.textContent = 'Complete an assessment';
    if (reasonsEl) reasonsEl.innerHTML = '<div class="small text-secondary">Complete your assessment to receive a recommendation.</div>';
    if (alternativesEl) alternativesEl.innerHTML = '<span class="badge-gray">Pending</span>';
    if (activityEl) activityEl.innerHTML = '<div class="text-secondary small py-3">No assessment activity yet.</div>';
    if (skillsEl) {
      skillsEl.innerHTML = [
        { label: 'Overall Match', value: 0 },
        { label: 'Portfolio Similarity', value: 0 },
        { label: 'Interest Alignment', value: 0 },
        { label: 'Academic Readiness', value: 0 }
      ].map(function(item) {
        return '<div><div class="d-flex justify-content-between mb-1"><span class="small text-secondary">' + item.label + '</span><span class="small fw-semibold">—</span></div><div class="skill-bar"><div class="fill" style="width:0%"></div></div></div>';
      }).join('');
    }
  }
}

function collectAssessmentData() {
  var user = getCurrentUser();
  var yearEl = document.getElementById('assessment-year');
  var sectionEl = document.getElementById('assessment-section');
  var ageEl = document.getElementById('assessment-age');
  var gwaEl = document.getElementById('assessment-gwa');
  var preferredCareerEl = document.getElementById('preferred-career');
  var workEl = document.querySelector('#ws-4 select');

  return {
    studentName: user.name,
    initials: user.initials || (user.name || 'MS').split(' ').map(function(s) { return s[0]; }).join('').slice(0, 2).toUpperCase(),
    year: yearEl ? yearEl.value : user.year,
    section: sectionEl ? sectionEl.value : user.section,
    age: ageEl ? ageEl.value : '',
    gwa: gwaEl ? parseFloat(gwaEl.value) : null,
    workEnvironment: workEl ? workEl.value : 'Hybrid (Office + Remote)',
    interests: SELECTED_INTERESTS.slice(),
    preferredCareer: preferredCareerEl ? preferredCareerEl.value : ''
  };
}

function getAcademicScore(gwa) {
  return Math.min(100, Math.max(0, 100 - ((Number(gwa) - 1) * 25)));
}

function getInterestScore(interests, career) {
  var related = CAREER_INTEREST_MAP[career.name] || [];
  if (!interests.length) return 0;
  return Math.round(interests.filter(function(item) { return related.indexOf(item) >= 0; }).length / interests.length * 100);
}

function buildRecommendation(data) {
  if (PORTFOLIO_ANALYSIS && PORTFOLIO_ANALYSIS.rankings) {
    // Rescale raw portfolio scores so the top career always anchors at a meaningful range.
    // Raw cosine similarity scores tend to be 20-45; we lift them to 55-95 range.
    var rawScores = PORTFOLIO_ANALYSIS.rankings.map(function(m) { return m.score; });
    var rawMax = Math.max.apply(null, rawScores) || 1;
    var rawMin = Math.min.apply(null, rawScores);
    var portfolioResults = PORTFOLIO_ANALYSIS.rankings.map(function(match) {
      var definition = CAREER_DEFINITIONS.find(function(career) {
        return career.name === match.name || match.name.indexOf(career.name) === 0;
      }) || {};
      // Rescale: top score maps to ~90, lowest maps to ~45
      var scaledPortfolio = rawMax === rawMin ? 75 : Math.round(45 + ((match.score - rawMin) / (rawMax - rawMin)) * 50);
      var academicScore = getAcademicScore(data.gwa);
      var interestScore = getInterestScore(data.interests, { name: match.name });
      var finalScore = Math.min(100, Math.round(scaledPortfolio * 0.65 + interestScore * 0.20 + academicScore * 0.15));
      // Separate portfolio keyword evidence from interests (backend appends "interests: X, Y" as last evidence item)
      var rawEvidence = match.evidence || [];
      var portfolioSkills = rawEvidence.filter(function(e) { return e.indexOf('interests:') !== 0; });
      var interestEntry  = rawEvidence.find(function(e)  { return e.indexOf('interests:') === 0; });

      var reasons = [];
      if (portfolioSkills.length) {
        reasons.push('Skills detected in your e-portfolio: ' + portfolioSkills.map(function(s) {
          return s.charAt(0).toUpperCase() + s.slice(1);
        }).join(', ') + '.');
      } else {
        reasons.push('Your e-portfolio content is most closely aligned with this career track.');
      }
      if (interestEntry) {
        var interestNames = interestEntry.replace('interests:', '').trim();
        reasons.push('Your selected career interests match this path: ' + interestNames + '.');
      }
      if (data.gwa) {
        var gwaLabel = data.gwa <= 1.75 ? 'Excellent' : data.gwa <= 2.5 ? 'Good' : data.gwa <= 3.0 ? 'Satisfactory' : 'Fair';
        reasons.push('Academic readiness (' + gwaLabel + ' GWA of ' + data.gwa + ') supports this career path.');
      }
      return {
        id: definition.key || match.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: match.name,
        description: definition.description || 'A portfolio-based IT career recommendation.',
        reasons: reasons,
        score: finalScore,
        portfolioScore: scaledPortfolio,
        interestScore: interestScore,
        academicReadinessScore: academicScore,
        keywords: definition.keywords || []
      };
    });
    portfolioResults.sort(function(a, b) { return b.score - a.score; });
    var portfolioTop = portfolioResults[0];
    return {
      studentName: data.studentName, initials: data.initials, year: data.year, section: data.section,
      age: data.age, gwa: data.gwa, workEnvironment: data.workEnvironment, interests: data.interests, preferredCareer: data.preferredCareer,
      createdAt: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      topCareer: portfolioTop, alternatives: portfolioResults.slice(1, 4), portfolioMethod: PORTFOLIO_ANALYSIS.method,
      summary: portfolioTop.name + ' is the strongest match based on your e-portfolio content, selected interests, and academic performance.'
    };
  }
  var result = CAREER_DEFINITIONS.map(function(career) {
    var academicScore = getAcademicScore(data.gwa) * career.weights.academic;
    var interestScore = getInterestScore(data.interests, career) * career.weights.interest;
    var score = Math.round(academicScore + interestScore);
    return {
      id: career.key,
      name: career.name,
      description: career.description,
      reasons: career.reasons,
      score: Math.min(100, score),
      keywords: career.keywords
    };
  }).sort(function(a, b) { return b.score - a.score; });

  var top = result[0];
  return {
    studentName: data.studentName,
    initials: data.initials,
    year: data.year,
    section: data.section,
    age: data.age,
    gwa: data.gwa,
    workEnvironment: data.workEnvironment,
    interests: data.interests,
    preferredCareer: data.preferredCareer,
    createdAt: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    topCareer: top,
    alternatives: result.slice(1, 4),
    summary: top.name + ' is the strongest fit because your score profile aligns best with programming, technical problem-solving, and interest in software-related work.'
  };
}

async function saveAssessmentResult(result) {
  var response = await fetch('/api/assessments', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result)
  });
  var payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.error || 'Unable to save the assessment.');
  result = Object.assign(result, payload.result || {});

  // Always save locally first (offline fallback)
  try {
    var stored = JSON.parse(localStorage.getItem(getUserStorageKey(STORAGE_KEY))) || [];
    stored.unshift({
      id: Date.now(),
      studentName: result.studentName,
      initials: result.initials,
      year: result.year,
      section: result.section,
      career: result.topCareer.name,
      score: result.topCareer.score,
      date: result.createdAt,
      summary: result.summary,
      workEnvironment: result.workEnvironment,
      interests: result.interests
    });
    localStorage.setItem(getUserStorageKey(STORAGE_KEY), JSON.stringify(stored.slice(0, 100)));
  } catch (e) {
    console.log('Unable to store assessment result locally', e);
  }

  return result;
}

async function submitAssessment() {
  var assessment = collectAssessmentData();
  var result = buildRecommendation(assessment);
  try {
    result = await saveAssessmentResult(result);
    localStorage.setItem(getUserStorageKey(CURRENT_RESULT_KEY), JSON.stringify(result));
    window.location.href = 'recommendation.html';
  } catch (error) {
    alert(error.message || 'Unable to submit the assessment.');
  }
}

function getCurrentResult() {
  try {
    var saved = localStorage.getItem(getUserStorageKey(CURRENT_RESULT_KEY));
    if (saved) return JSON.parse(saved);
    var stored = JSON.parse(localStorage.getItem(getUserStorageKey(STORAGE_KEY))) || [];
    return stored[0] ? { topCareer: { name: stored[0].career, score: stored[0].score }, summary: stored[0].summary, createdAt: stored[0].date, studentName: stored[0].studentName, initials: stored[0].initials, year: stored[0].year, section: stored[0].section, workEnvironment: stored[0].workEnvironment, interests: stored[0].interests, alternatives: [] } : null;
  } catch (e) {
    return null;
  }
}

function viewCareerDetails() {
  var details = document.getElementById('recommendation-details');
  if (details) details.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function escapeRecommendationHtml(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function detectedPortfolioEvidence(result) {
  var top = result.topCareer || {};
  var evidence = (top.evidence || []).filter(function(item) { return item && item.indexOf('interests:') !== 0; });
  if (evidence.length) return evidence;
  (top.reasons || []).forEach(function(reason) {
    var match = String(reason).match(/^Skills detected in your e-portfolio:\s*(.+)\.$/i);
    if (match) evidence = evidence.concat(match[1].split(',').map(function(item) { return item.trim(); }).filter(Boolean));
  });
  return evidence;
}

function renderImprovementSuggestions(result) {
  var target = document.getElementById('improvement-content');
  if (!target) return;
  var preferred = result.preferredCareer;
  var top = result.topCareer || {};
  if (!preferred || !CAREER_IMPROVEMENT_GUIDES[preferred]) {
    target.innerHTML = '<div class="small text-secondary">Choose a preferred career track in your next assessment to receive tailored, practical portfolio suggestions.</div>';
    return;
  }
  var guide = CAREER_IMPROVEMENT_GUIDES[preferred];
  var evidence = detectedPortfolioEvidence(result);
  var detectedForTarget = evidence.filter(function(item) {
    return guide.signals.some(function(signal) { return item.toLowerCase().indexOf(signal) >= 0; });
  });
  var sameAsTop = preferred === top.name;
  var explanation = sameAsTop
    ? 'Your preferred career, <strong>' + escapeRecommendationHtml(preferred) + '</strong>, is currently your top-ranked recommendation. Continue building visible, well-documented evidence of your progress.'
    : 'You selected <strong>' + escapeRecommendationHtml(preferred) + '</strong> as your preferred career. The current top-ranked track is <strong>' + escapeRecommendationHtml(top.name || 'your current result') + '</strong>, based on the portfolio and assessment information submitted. You can still pursue ' + escapeRecommendationHtml(preferred) + ' by strengthening relevant portfolio evidence.';
  var evidenceBlock = detectedForTarget.length
    ? '<div class="p-3 rounded-3 mb-3" style="background:#F5F3FF"><div class="small fw-semibold text-indigo mb-2">Detected evidence relevant to ' + escapeRecommendationHtml(preferred) + '</div>' + detectedForTarget.map(function(item) { return '<span class="evidence-pill">' + escapeRecommendationHtml(item) + '</span>'; }).join('') + '</div>'
    : '<div class="p-3 rounded-3 mb-3" style="background:#F9FAFB"><div class="small text-secondary"><i class="bi bi-info-circle me-1"></i>We did not detect clear portfolio evidence specifically for this track. Consider adding evidence of the following; this does not mean you lack these skills.</div></div>';
  var actions = guide.actions.slice();
  if (detectedForTarget.length) actions.unshift('Keep expanding and documenting the relevant evidence already detected in your portfolio.');
  target.innerHTML = '<div class="small text-secondary mb-3">' + explanation + '</div>' + evidenceBlock +
    '<div class="fw-semibold small mb-2">Suggested next steps</div><ul class="improvement-list mb-3">' + actions.map(function(action) { return '<li>' + escapeRecommendationHtml(action) + '</li>'; }).join('') + '</ul>' +
    '<div class="d-flex align-items-start gap-2 p-3 rounded-3" style="background:#ECFDF5"><i class="bi bi-folder-plus text-success mt-1"></i><div class="small"><span class="fw-semibold text-success">Portfolio evidence to add:</span> <span class="text-secondary">' + escapeRecommendationHtml(guide.evidence) + '</span></div></div>' +
    '<p class="small text-secondary mb-0 mt-3">Your preferred career remains a valid path to explore. These suggestions are guidance for strengthening your profile, not a requirement to change your career goal.</p>';
}

function renderRecommendationPage() {
  var result = getCurrentResult();
  if (!result) {
    var content = document.getElementById('recommendation-content');
    if (content) {
      content.innerHTML = '<div class="card-cc p-5 text-center"><div class="stat-icon bg-indigo-light text-indigo mx-auto mb-3"><i class="bi bi-clipboard-check fs-5"></i></div><h5 class="fw-bold mb-2">No recommendation yet</h5><p class="text-secondary small mb-4">Complete your career assessment to receive a personalized recommendation.</p><a class="btn btn-indigo" href="assessment.html">Start Assessment</a></div>';
    }
    return;
  }
  var titleEl = document.getElementById('recommendation-title');
  var descriptionEl = document.getElementById('recommendation-description');
  var scoreEl = document.getElementById('recommendation-score');
  var ringEl = document.getElementById('recommendation-ring-progress');
  var reasonsEl = document.getElementById('recommendation-reasons');
  var summaryEl = document.getElementById('recommendation-summary');
  var alternativesEl = document.getElementById('alternative-list');
  var statusEl = document.getElementById('recommendation-status');
  if (statusEl) {
    statusEl.style.background = '#ECFDF5';
    statusEl.style.borderColor = '#A7F3D0';
    statusEl.innerHTML = '<i class="bi bi-check-circle-fill text-success flex-shrink-0"></i><span class="small fw-medium text-success">Assessment completed successfully! Your career recommendation is ready.</span>';
  }
  if (titleEl) titleEl.textContent = result.topCareer.name;
  if (descriptionEl) descriptionEl.textContent = result.topCareer.description;
  if (scoreEl) scoreEl.innerHTML = '<div class="text-white fw-black" style="font-size:1.8rem;line-height:1">' + result.topCareer.score + '%</div><div style="color:rgba(255,255,255,.7);font-size:.65rem">Recommendation Score</div>';
  if (ringEl) {
    var score = Math.max(0, Math.min(100, Number(result.topCareer.score) || 0));
    ringEl.style.strokeDashoffset = String(339 * (1 - score / 100));
  }
  if (reasonsEl) {
    var top = result.topCareer;
    var reasons = [];

    // If reasons are already in the new multi-bullet format, use them directly
    if (top.reasons && top.reasons.length && top.reasons[0].indexOf('Portfolio evidence:') !== 0) {
      reasons = top.reasons;
    } else {
      // Handle old-format or raw evidence — rebuild bullets properly
      var rawEvidence = top.evidence || [];
      // Old format stored as reasons: ["Portfolio evidence: interests: X, Y."]
      if (!rawEvidence.length && top.reasons && top.reasons.length) {
        var merged = top.reasons[0] || '';
        // Extract everything after "Portfolio evidence: "
        var stripped = merged.replace(/^Portfolio evidence:\s*/i, '');
        // Split out interests part if present
        var intIdx = stripped.indexOf('interests:');
        if (intIdx > 0) {
          var skillsPart = stripped.substring(0, intIdx).replace(/,\s*$/, '').trim();
          var intPart = stripped.substring(intIdx + 'interests:'.length).replace(/\.$/, '').trim();
          if (skillsPart) rawEvidence = skillsPart.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
          if (intPart) rawEvidence.push('interests: ' + intPart);
        } else {
          rawEvidence = stripped.replace(/\.$/, '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
        }
      }
      var portfolioSkills = rawEvidence.filter(function(e) { return e.indexOf('interests:') !== 0 && e.length > 0; });
      var interestEntry   = rawEvidence.find(function(e)   { return e.indexOf('interests:') === 0; });

      if (portfolioSkills.length) {
        reasons.push('Skills detected in your e-portfolio: ' + portfolioSkills.map(function(s) {
          return s.charAt(0).toUpperCase() + s.slice(1);
        }).join(', ') + '.');
      } else {
        reasons.push('Your e-portfolio content is most closely aligned with this career track.');
      }
      if (interestEntry) {
        reasons.push('Your selected career interests match this path: ' + interestEntry.replace('interests:', '').trim() + '.');
      }
      if (result.gwa) {
        var gwaLabel = result.gwa <= 1.75 ? 'Excellent' : result.gwa <= 2.5 ? 'Good' : result.gwa <= 3.0 ? 'Satisfactory' : 'Fair';
        reasons.push('Academic readiness (' + gwaLabel + ' GWA of ' + result.gwa + ') supports this career path.');
      }
    }

    reasonsEl.innerHTML = reasons.length ? reasons.map(function(reason) {
      return '<div class="d-flex align-items-start gap-2 small text-secondary"><div style="width:20px;height:20px;border-radius:50%;background:#ECFDF5;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="bi bi-check2 text-success" style="font-size:.65rem"></i></div>' + reason + '</div>';
    }).join('') : '<div class="small text-secondary">Your portfolio, selected interests, and GWA were used to calculate this result.</div>';
  }
  if (summaryEl) summaryEl.textContent = result.summary;
  renderImprovementSuggestions(result);
  if (alternativesEl) {
    alternativesEl.innerHTML = (result.alternatives || []).map(function(item) {
      var color = item.score >= 80 ? '#10B981' : item.score >= 70 ? 'var(--indigo)' : 'var(--amber)';
      return '<div class="p-3 rounded-3 border mb-3"><div class="d-flex justify-content-between align-items-center mb-2"><span class="fw-semibold small">' + item.name + '</span><span class="badge-green">' + item.score + '% match</span></div><p class="text-secondary mb-2" style="font-size:.75rem">' + (item.description || 'An alternative career path that also aligns with your assessment.') + '</p><div class="skill-bar"><div class="fill" style="width:' + item.score + '%;background:' + color + '"></div></div></div>';
    }).join('');
  }
}

function renderProfile() {
  var user = getCurrentUser();
  var result = getCurrentResult();
  var nameEl = document.getElementById('profile-name');
  var avatarEl = document.getElementById('profile-avatar');
  var scoreEl = document.getElementById('profile-match-score');
  var careerEl = document.getElementById('profile-career');
  if (nameEl) nameEl.textContent = getDisplayName(user);
  if (avatarEl) avatarEl.textContent = getDisplayInitials(user);
  if (scoreEl) scoreEl.textContent = result && result.topCareer ? result.topCareer.score + '%' : '—';
  if (careerEl) careerEl.textContent = result && result.topCareer ? result.topCareer.name : 'No assessment yet';
  setValue('profile-first-name', (user.name || '').split(' ')[0] || '');
  setValue('profile-last-name', (user.name || '').split(' ').slice(1).join(' '));
  setValue('profile-email', user.email || user.username || '');
  setValue('profile-phone', user.phone || '');
  var skillSummary = document.getElementById('profile-skill-summary');
  if (skillSummary) skillSummary.classList.toggle('d-none', !result);
  var skillItems = document.getElementById('profile-skill-items');
  if (skillItems && result && result.topCareer) {
    var top = result.topCareer;
    var scores = [
      { label: 'Recommendation Score', value: top.score },
      { label: 'Portfolio Similarity', value: top.portfolioScore },
      { label: 'Interest Alignment', value: top.interestScore },
      { label: 'Academic Readiness', value: top.academicReadinessScore }
    ].filter(function(item) { return typeof item.value === 'number' && isFinite(item.value); });
    if (!scores.length) scores = [{ label: 'Recommendation Score', value: top.score }];
    skillItems.innerHTML = scores.map(function(item) {
      var value = Math.max(0, Math.min(100, Math.round(item.value)));
      return '<div><div class="d-flex justify-content-between mb-1"><span class="small text-secondary">' + item.label + '</span><span class="small fw-semibold">' + value + '%</span></div><div class="skill-bar"><div class="fill" style="width:' + value + '%"></div></div></div>';
    }).join('');
  }
  var emailDisplay = document.getElementById('profile-email-display');
  var phoneDisplay = document.getElementById('profile-phone-display');
  if (emailDisplay) emailDisplay.textContent = user.email || user.username || 'Not provided';
  if (phoneDisplay) phoneDisplay.textContent = user.phone || 'Not provided';
}

function setValue(id, value) { var el = document.getElementById(id); if (el) el.value = value; }

/* ── Profile edit toggle (profile.html) ────────────────────── */
var editing = false;
async function toggleEdit() {
  if (editing) {
    var first = (document.getElementById('profile-first-name').value || '').trim();
    var last = (document.getElementById('profile-last-name').value || '').trim();
    if (!first) { document.getElementById('profile-first-name').focus(); return; }
    var updates = { name: [first, last].filter(Boolean).join(' '), phone: document.getElementById('profile-phone').value };
    try {
      var response = await fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
      var payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Unable to save profile changes.');
      localStorage.setItem(AUTH_KEY, JSON.stringify({ role: payload.user.role, user: payload.user }));
      renderAuthenticatedUser(); renderProfile();
    } catch (error) { alert(error.message || 'Unable to save profile changes.'); return; }
  }
  editing = !editing;
  document.querySelectorAll('.profile-field').forEach(function(f) {
    f.readOnly = !editing || f.id === 'profile-email';
    f.style.background    = editing ? '#fff'         : '#F9FAFB';
    f.style.borderColor   = editing ? '#C7D2FE'      : 'transparent';
  });
  var btn = document.getElementById('edit-btn');
  if (btn) {
    btn.innerHTML    = editing ? '<i class="bi bi-check2"></i> Save Changes' : '<i class="bi bi-pencil"></i> Edit Profile';
    btn.style.background  = editing ? '#10B981' : '';
    btn.style.color       = editing ? '#fff'    : '';
    btn.style.borderColor = editing ? '#10B981' : '';
  }
}

/* ── History table (history.html) ──────────────────────────── */
function getStoredResults() {
  try {
    return JSON.parse(localStorage.getItem(getUserStorageKey(STORAGE_KEY))) || [];
  } catch (e) {
    return [];
  }
}

function renderHistory() {
  var searchEl  = document.getElementById('history-search');
  var filterEl  = document.getElementById('history-filter');
  var s = searchEl  ? searchEl.value.toLowerCase()  : '';
  var f = filterEl  ? filterEl.value                : '';
  var historyData = getStoredResults();
  var filtered = historyData.filter(function(r) {
    return (!f || r.career === f) && r.career.toLowerCase().includes(s);
  });
  var tbody = document.getElementById('history-tbody');
  if (!tbody) return;
  tbody.innerHTML = filtered.map(function(r) {
    var c = r.score >= 85 ? '#10B981' : r.score >= 70 ? 'var(--indigo)' : 'var(--amber)';
    return '<tr>' +
      '<td class="text-secondary">' + r.date + '</td>' +
      '<td><div class="d-flex align-items-center gap-2"><div class="stat-icon bg-indigo-light" style="width:28px;height:28px;border-radius:7px"><i class="bi bi-code-slash text-indigo" style="font-size:.75rem"></i></div><span class="fw-medium">' + r.career + '</span></div></td>' +
      '<td style="min-width:160px"><div class="d-flex align-items-center gap-2"><div class="skill-bar flex-grow-1"><div class="fill" style="width:' + r.score + '%;background:' + c + '"></div></div><span class="small fw-semibold">' + r.score + '%</span></div></td>' +
      '<td><span class="badge-green">Completed</span></td>' +
      '<td><a href="recommendation.html" class="btn btn-sm text-indigo d-flex align-items-center gap-1" style="font-size:.78rem"><i class="bi bi-eye"></i> View</a></td>' +
      '</tr>';
  }).join('');
  var count = document.getElementById('history-count');
  if (count) count.textContent = 'Showing ' + filtered.length + ' of ' + historyData.length + ' results';
}

async function renderAdviserNotes() {
  var notesEl = document.getElementById('dashboard-notes');
  if (!notesEl) return;
  try {
    var response = await fetch('/api/student/notes');
    var payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'Failed to load notes.');
    if (payload.items && payload.items.length) {
      notesEl.innerHTML = payload.items.map(function(item) {
        return '<div class="d-flex align-items-start gap-3 py-3 border-bottom">' +
                 '<div class="stat-icon flex-shrink-0" style="background:#FFF1F2;color:#E11D48;width:32px;height:32px;border-radius:8px"><i class="bi bi-chat-left-text" style="font-size:.78rem"></i></div>' +
                 '<div class="flex-grow-1">' +
                   '<div class="small fw-semibold">' + item.faculty_name + ' <span class="text-secondary fw-normal" style="font-size:.75rem">· ' + new Date(item.created_at).toLocaleString() + '</span></div>' +
                   '<div class="text-secondary mt-1 small" style="white-space:pre-wrap">' + item.note + '</div>' +
                 '</div>' +
               '</div>';
      }).join('');
    } else {
      notesEl.innerHTML = '<div class="text-secondary small py-3">No advising feedback notes from faculty or guidance yet.</div>';
    }
  } catch (error) {
    notesEl.innerHTML = '<div class="text-danger small py-3">Error loading advising notes: ' + error.message + '</div>';
  }
}

/* ── Init on page load ─────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {
  var auth = localStorage.getItem(AUTH_KEY);
  if (!auth && window.location.pathname.indexOf('/student/') >= 0) {
    window.location.href = '../login.html';
    return;
  }

  renderAuthenticatedUser();

  if (document.getElementById('ws-1')) {
    initializeAssessmentProfile();
    updateWizard();
  }
  buildInterests();
  if (document.getElementById('dashboard-assessment-count')) {
    renderDashboardSummary();
    renderAdviserNotes();
  }
  if (document.getElementById('recommendation-title')) {
    renderRecommendationPage();
  }
  if (document.getElementById('profile-name')) {
    renderProfile();
  }
  if (document.getElementById('history-tbody')) {
    renderHistory();
  }
});

function initializeAssessmentProfile() {
  var user = getCurrentUser();
  var year = document.getElementById('assessment-year');
  var age = document.getElementById('assessment-age');
  if (year && user.year) year.value = user.year;
  if (age && user.age) age.value = user.age;
  updateSectionOptions();
  var section = document.getElementById('assessment-section');
  if (section && user.section && Array.prototype.some.call(section.options, function(option) { return option.value === user.section; })) section.value = user.section;
  if (year) year.addEventListener('change', updateSectionOptions);
}

function updateSectionOptions() {
  var year = document.getElementById('assessment-year');
  var section = document.getElementById('assessment-section');
  if (!year || !section) return;
  var level = year.value.charAt(0);
  section.innerHTML = ['A', 'B', 'C', 'D', 'E'].map(function(letter) { return '<option value="BSIT-' + level + letter + '">BSIT-' + level + letter + '</option>'; }).join('');
}
