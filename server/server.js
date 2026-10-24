const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'results.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}

ensureDataDir();

function readAll() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) { return []; }
}

function writeAll(items) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf8');
}

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));

const PROJECT_DIR = path.join(__dirname, '..');
const TEMPLATE_DIR = path.join(PROJECT_DIR, 'templates');

// Serve only published assets and explicit application pages. Serving the
// project root made relative URLs resolve into non-existent template folders.
app.use('/static', express.static(path.join(PROJECT_DIR, 'static')));
app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(TEMPLATE_DIR, 'index.html')));
app.get(['/login', '/login.html'], (req, res) => res.sendFile(path.join(TEMPLATE_DIR, 'login.html')));
app.get('/:portal/:page.html', (req, res, next) => {
  const portal = req.params.portal;
  if (!['student', 'faculty'].includes(portal)) return next();
  const pagePath = path.join(TEMPLATE_DIR, portal, req.params.page + '.html');
  if (!fs.existsSync(pagePath)) return next();
  res.sendFile(pagePath);
});

// Simple login endpoint (mock)
app.post('/api/login', (req, res) => {
  const user = req.body && req.body.user ? req.body.user : { name: 'Maria Santos', initials: 'MS', role: 'Student', year: '3rd Year', section: 'BSIT-3A' };
  res.json({ ok: true, user });
});

// Create assessment
app.post('/api/assessments', (req, res) => {
  try {
    const payload = req.body || {};
    const items = readAll();
    const item = {
      id: Date.now(),
      studentName: payload.studentName || 'Unknown',
      initials: payload.initials || 'NA',
      year: payload.year || '',
      section: payload.section || '',
      career: (payload.topCareer && payload.topCareer.name) || (payload.career) || 'Unassigned',
      score: (payload.topCareer && payload.topCareer.score) || payload.score || 0,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      raw: payload
    };
    items.unshift(item);
    writeAll(items.slice(0, 1000));
    res.json({ ok: true, item });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// List assessments
app.get('/api/assessments', (req, res) => {
  const items = readAll();
  res.json({ ok: true, items });
});

// Get assessment by id
app.get('/api/assessments/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const items = readAll();
  const found = items.find(i => i.id === id);
  if (!found) return res.status(404).json({ ok: false, error: 'Not found' });
  res.json({ ok: true, item: found });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log('CareerCompass API listening on http://localhost:' + PORT));
