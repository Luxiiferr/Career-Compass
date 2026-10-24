import json
import os
import ipaddress
import sqlite3
import socket
import secrets
import smtplib
import re
from datetime import datetime, timezone, timedelta
from email.message import EmailMessage
from functools import wraps
from pathlib import Path
from urllib.parse import urlparse

from flask import Flask, abort, g, jsonify, render_template, request, session, send_file
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None
try:
    import requests as http_requests
    from bs4 import BeautifulSoup
except ImportError:
    http_requests = BeautifulSoup = None
try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:
    psycopg = dict_row = None

BASE_DIR = Path(__file__).resolve().parent
SQLITE_DATABASE = BASE_DIR / "careercompass.db"
ALLOWED_UPLOADS = {"pdf"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
CODE_TTL_MINUTES = 10


def load_local_env():
    """Load local development settings without requiring an extra package."""
    env_file = BASE_DIR / ".env"
    if not env_file.is_file():
        return
    for raw_line in env_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


load_local_env()
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
USING_POSTGRES = DATABASE_URL.startswith(("postgres://", "postgresql://"))
NON_PORTFOLIO_HOSTS = {
    "youtube.com", "youtu.be", "facebook.com", "instagram.com", "tiktok.com",
    "x.com", "twitter.com", "linkedin.com", "google.com", "drive.google.com",
}

CAREER_PROFILES = {
    "Software Engineering": (
        "software engineering application development programming Java Python C# C++ PHP API REST backend systems "
        "algorithms data structures object oriented programming OOP testing debugging version control Git GitHub "
        "Visual Studio Code IDE frameworks Android mobile app database SQL MySQL software design patterns "
        "agile scrum software development lifecycle SDLC system analysis problem solving logic unit testing "
        "compiler interpreter scripting automation microservices cloud AWS deployment DevOps"
    ),
    "Web Development": (
        "web development frontend backend HTML CSS JavaScript jQuery Bootstrap Tailwind React Vue Angular "
        "PHP Laravel Node.js Express website web app responsive design UI UX user interface user experience "
        "Basic HTML CSS web design ecommerce portfolio website WordPress hosting domain SEO "
        "form validation AJAX JSON REST API web hosting FTP cPanel web standards accessibility"
    ),
    "Data Science & Analytics": (
        "data science analytics Python R SQL Power BI Tableau Excel Microsoft Office dashboard statistics "
        "machine learning deep learning AI artificial intelligence data analysis data cleaning data visualization "
        "pandas numpy scikit-learn regression classification clustering neural network dataset reporting "
        "business intelligence data mining predictive modeling spreadsheet pivot table data-driven insights"
    ),
    "Cybersecurity": (
        "cybersecurity security network security ethical hacking penetration testing vulnerability assessment "
        "Kali Linux encryption firewall intrusion detection incident response threat analysis risk management "
        "computer troubleshooting hardware troubleshooting system security access control identity management "
        "SIEM log analysis digital forensics malware antivirus password security social engineering phishing"
    ),
    "Network Engineering": (
        "network engineering networking Cisco routing switching LAN WAN wireless infrastructure server "
        "basic networking TCP IP subnetting VPN firewall configuration network administration "
        "OSI model network protocols DHCP DNS Active Directory network monitoring bandwidth troubleshooting "
        "fiber optic cabling structured cabling wireless access point router switch hub connectivity"
    ),
}

# Weighted skill groups: each career has categories, and each category has related terms with weights.
# This means even if a student uses different phrasing, the system still scores it correctly.
CAREER_SKILL_GROUPS = {
    "Software Engineering": [
        {"weight": 3, "terms": ["java", "java programming", "c#", "c++", "python", "php", "kotlin", "swift"]},
        {"weight": 3, "terms": ["software development", "software engineering", "application development", "system development"]},
        {"weight": 2, "terms": ["git", "github", "version control", "visual studio", "visual studio code", "vscode", "intellij", "eclipse"]},
        {"weight": 2, "terms": ["object oriented", "oop", "data structures", "algorithms", "design patterns", "api", "rest api"]},
        {"weight": 2, "terms": ["database", "sql", "mysql", "postgresql", "mongodb", "backend", "server-side"]},
        {"weight": 2, "terms": ["android", "mobile app", "mobile development", "ios", "flutter", "react native"]},
        {"weight": 1, "terms": ["programming", "coding", "debugging", "testing", "unit test", "agile", "scrum", "sdlc"]},
        {"weight": 1, "terms": ["problem solving", "logical thinking", "analytical", "computational thinking"]},
    ],
    "Web Development": [
        {"weight": 3, "terms": ["html", "css", "html & css", "basic html", "html5", "css3"]},
        {"weight": 3, "terms": ["javascript", "jquery", "react", "vue", "angular", "typescript", "node.js", "next.js"]},
        {"weight": 3, "terms": ["web development", "web design", "website", "web application", "web app", "frontend", "front-end"]},
        {"weight": 2, "terms": ["bootstrap", "tailwind", "sass", "responsive design", "mobile-first", "ui", "ux"]},
        {"weight": 2, "terms": ["php", "laravel", "django", "flask", "backend", "server-side", "rest api", "ajax"]},
        {"weight": 2, "terms": ["wordpress", "ecommerce", "hosting", "domain", "ftp", "cpanel", "web hosting"]},
        {"weight": 1, "terms": ["seo", "accessibility", "web standards", "json", "xml", "forms", "validation"]},
    ],
    "Data Science & Analytics": [
        {"weight": 3, "terms": ["data science", "data analytics", "data analysis", "machine learning", "artificial intelligence", "ai", "deep learning"]},
        {"weight": 3, "terms": ["python", "r programming", "pandas", "numpy", "scikit-learn", "tensorflow", "pytorch"]},
        {"weight": 3, "terms": ["power bi", "tableau", "dashboard", "data visualization", "visualization", "reporting"]},
        {"weight": 2, "terms": ["sql", "database", "data mining", "data cleaning", "data processing", "etl"]},
        {"weight": 2, "terms": ["statistics", "statistical analysis", "regression", "classification", "clustering", "neural network"]},
        {"weight": 2, "terms": ["excel", "microsoft office", "spreadsheet", "pivot table", "data-driven", "business intelligence"]},
        {"weight": 1, "terms": ["dataset", "model training", "prediction", "insight", "trend analysis", "kpi"]},
    ],
    "Cybersecurity": [
        {"weight": 3, "terms": ["cybersecurity", "cyber security", "network security", "information security", "infosec"]},
        {"weight": 3, "terms": ["ethical hacking", "penetration testing", "pen testing", "vulnerability", "kali linux", "kali"]},
        {"weight": 2, "terms": ["encryption", "firewall", "intrusion detection", "ids", "ips", "siem", "log analysis"]},
        {"weight": 2, "terms": ["computer troubleshooting", "troubleshooting", "hardware troubleshooting", "system maintenance", "technical support"]},
        {"weight": 2, "terms": ["threat", "malware", "antivirus", "phishing", "social engineering", "incident response", "risk management"]},
        {"weight": 1, "terms": ["access control", "identity management", "password", "digital forensics", "security audit", "compliance"]},
    ],
    "Network Engineering": [
        {"weight": 3, "terms": ["networking", "network engineering", "network administration", "basic networking", "computer networks"]},
        {"weight": 3, "terms": ["cisco", "routing", "switching", "router", "switch", "lan", "wan", "vlan"]},
        {"weight": 2, "terms": ["tcp/ip", "tcp ip", "osi model", "subnetting", "ip addressing", "dhcp", "dns"]},
        {"weight": 2, "terms": ["server", "active directory", "network monitoring", "bandwidth", "vpn", "wireless", "wi-fi"]},
        {"weight": 2, "terms": ["infrastructure", "cabling", "structured cabling", "fiber optic", "network configuration", "firewall"]},
        {"weight": 1, "terms": ["connectivity", "network protocols", "hub", "access point", "network troubleshooting", "uptime"]},
    ],
}

# Kept for evidence display — flat list of important terms per career
CAREER_KEYWORDS = {
    "Software Engineering": ["java", "java programming", "python", "c#", "c++", "git", "visual studio code", "sql", "mysql", "api", "mobile app", "software development", "programming", "backend", "object oriented", "oop"],
    "Web Development": ["html", "css", "html & css", "javascript", "react", "php", "laravel", "bootstrap", "website", "web development", "frontend", "web design", "ui", "ux"],
    "Data Science & Analytics": ["data science", "machine learning", "ai", "python", "power bi", "tableau", "sql", "excel", "microsoft office", "data analytics", "statistics", "visualization"],
    "Cybersecurity": ["cybersecurity", "security", "ethical hacking", "penetration testing", "kali linux", "encryption", "firewall", "computer troubleshooting", "troubleshooting", "network security", "vulnerability"],
    "Network Engineering": ["networking", "basic networking", "cisco", "routing", "switching", "lan", "wan", "tcp/ip", "server", "network administration", "subnetting", "wireless"],
}
CAREER_INTERESTS = {
    "Software Engineering": {"Software Development", "Mobile App Development", "Database Management"},
    "Web Development": {"Web Design & Development", "Mobile App Development"},
    "Data Science & Analytics": {"Data Analytics", "AI / Machine Learning", "Database Management"},
    "Cybersecurity": {"Cybersecurity", "Network Administration"},
    "Network Engineering": {"Network Administration", "Cybersecurity"},
}

app = Flask(__name__)
app.config.update(
    SECRET_KEY=os.environ.get("CAREERCOMPASS_SECRET_KEY", "change-this-development-secret-before-deployment"),
    MAX_CONTENT_LENGTH=MAX_UPLOAD_BYTES,
)


class DatabaseConnection:
    """Small compatibility wrapper for SQLite local development and PostgreSQL deployment."""
    def __init__(self):
        self.is_postgres = False
        if USING_POSTGRES:
            if psycopg is not None:
                try:
                    self.connection = psycopg.connect(DATABASE_URL, row_factory=dict_row)
                    self.is_postgres = True
                    return
                except Exception as e:
                    print(f"[Database] Notice: PostgreSQL connection unreachable ({e}). Using local SQLite database.")
            else:
                print("[Database] Notice: psycopg is not installed. Using local SQLite database.")
        self.connection = sqlite3.connect(SQLITE_DATABASE)
        self.connection.row_factory = sqlite3.Row

    def execute(self, query, params=()):
        # Existing queries use SQLite qmark parameters. Psycopg uses %s parameters.
        if getattr(self, "is_postgres", False):
            query = query.replace("?", "%s")
        return self.connection.execute(query, params)

    def commit(self):
        self.connection.commit()

    def close(self):
        self.connection.close()


def connect_db():
    return DatabaseConnection()


def get_db():
    if "db" not in g:
        g.db = connect_db()
    return g.db


@app.teardown_appcontext
def close_db(_error=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = connect_db()
    sqlite_schema = """
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('student', 'faculty', 'admin')),
          year TEXT DEFAULT '', section TEXT DEFAULT '', phone TEXT DEFAULT '', age INTEGER,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS assessments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id),
          career TEXT NOT NULL, score INTEGER NOT NULL, payload TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS verification_codes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL, purpose TEXT NOT NULL,
          code_hash TEXT NOT NULL, payload TEXT DEFAULT '',
          expires_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS faculty_notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id INTEGER NOT NULL REFERENCES users(id),
          faculty_id INTEGER NOT NULL REFERENCES users(id),
          note TEXT NOT NULL, created_at TEXT NOT NULL
        );
    """
    postgres_schema = """
        CREATE TABLE IF NOT EXISTS users (
          id BIGSERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('student', 'faculty', 'admin')),
          year TEXT DEFAULT '', section TEXT DEFAULT '', phone TEXT DEFAULT '', age INTEGER,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS assessments (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES users(id),
          career TEXT NOT NULL, score INTEGER NOT NULL, payload TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS verification_codes (
          id BIGSERIAL PRIMARY KEY,
          email TEXT NOT NULL, purpose TEXT NOT NULL,
          code_hash TEXT NOT NULL, payload TEXT DEFAULT '',
          expires_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS faculty_notes (
          id BIGSERIAL PRIMARY KEY,
          student_id BIGINT NOT NULL REFERENCES users(id),
          faculty_id BIGINT NOT NULL REFERENCES users(id),
          note TEXT NOT NULL, created_at TEXT NOT NULL
        );
    """
    for statement in (postgres_schema if getattr(db, "is_postgres", False) else sqlite_schema).split(";"):
        if statement.strip():
            db.execute(statement)
    admin = db.execute("SELECT id FROM users WHERE role = 'admin'").fetchone()
    if admin is None:
        db.execute(
            "INSERT INTO users (name, username, email, password_hash, role, year, section, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("System Administrator", "admin@careercompass.local", "admin@careercompass.local", generate_password_hash("admin123"), "admin", "Admin", "System", now()),
        )
    guidance = db.execute("SELECT id FROM users WHERE email = 'guidance@careercompass.local'").fetchone()
    if guidance is None:
        db.execute(
            "INSERT INTO users (name, username, email, password_hash, role, year, section, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("Guidance Counselor", "guidance@careercompass.local", "guidance@careercompass.local", generate_password_hash("guidance123"), "faculty", "Guidance", "Office", now()),
        )
    faculty = db.execute("SELECT id FROM users WHERE email = 'faculty@careercompass.local'").fetchone()
    if faculty is None:
        db.execute(
            "INSERT INTO users (name, username, email, password_hash, role, year, section, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("Faculty Member", "faculty@careercompass.local", "faculty@careercompass.local", generate_password_hash("faculty123"), "faculty", "Faculty", "CCIT", now()),
        )
    db.commit()

    # Automatically seed Chapter 3 benchmark assessments if table is empty (e.g. fresh live PostgreSQL deployment on Render)
    try:
        count_row = db.execute("SELECT count(*) as cnt FROM assessments").fetchone()
        cnt = count_row["cnt"] if isinstance(count_row, dict) or hasattr(count_row, "keys") else count_row[0]
        if cnt == 0:
            from create_ch3_dataset import seed_dataset_into_db
            seed_dataset_into_db(db)
            print("[Database] Live deployment detected with 0 assessments: Auto-seeded 60 Chapter 3 benchmark assessments.")
    except Exception as e:
        print(f"[Database] Notice during assessment auto-seed: {e}")

    db.close()


def is_integrity_error(error):
    return isinstance(error, sqlite3.IntegrityError) or (psycopg is not None and isinstance(error, psycopg.IntegrityError))


def now():
    return datetime.now(timezone.utc).isoformat()


def valid_email(value):
    email = (value or "").strip().lower()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise ValueError("Enter a valid email address.")
    return email


def code_expired(value):
    return datetime.fromisoformat(value) <= datetime.now(timezone.utc)


def send_email_code(email, code, purpose):
    sender = os.environ.get("CAREERCOMPASS_SMTP_EMAIL")
    # Google shows app passwords in groups; whitespace is only visual.
    password = "".join((os.environ.get("CAREERCOMPASS_SMTP_APP_PASSWORD") or "").split())
    if not sender or not password:
        raise RuntimeError("Email delivery is not configured. Set CAREERCOMPASS_SMTP_EMAIL and CAREERCOMPASS_SMTP_APP_PASSWORD on the server.")
    message = EmailMessage()
    message["Subject"] = "CareerCompass verification code"
    message["From"] = sender
    message["To"] = email
    action = "finish creating your account" if purpose == "signup" else "reset your password"
    message.set_content(f"Your CareerCompass verification code is: {code}\n\nUse it to {action}. It expires in {CODE_TTL_MINUTES} minutes. Do not share this code.")
    try:
        with smtplib.SMTP_SSL(os.environ.get("CAREERCOMPASS_SMTP_HOST", "smtp.gmail.com"), int(os.environ.get("CAREERCOMPASS_SMTP_PORT", "465")), timeout=15) as server:
            server.login(sender, password)
            server.send_message(message)
    except smtplib.SMTPAuthenticationError as error:
        raise RuntimeError("Gmail rejected the sender email or App Password. Generate a new Gmail App Password and check the sender email address.") from error
    except (smtplib.SMTPException, OSError) as error:
        raise RuntimeError("Email delivery failed. Check the Gmail SMTP settings and try again.") from error


def create_verification_code(email, purpose, payload=""):
    code = f"{secrets.randbelow(1000000):06d}"
    # Send before saving so a failed SMTP attempt never leaves an unusable code.
    send_email_code(email, code, purpose)
    db = get_db()
    db.execute("DELETE FROM verification_codes WHERE email = ? AND purpose = ?", (email, purpose))
    db.execute("INSERT INTO verification_codes (email, purpose, code_hash, payload, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
               (email, purpose, generate_password_hash(code), payload,
                (datetime.now(timezone.utc) + timedelta(minutes=CODE_TTL_MINUTES)).isoformat(), now()))
    db.commit()


def consume_verification_code(email, purpose, code):
    row = get_db().execute("SELECT * FROM verification_codes WHERE email = ? AND purpose = ? ORDER BY id DESC LIMIT 1", (email, purpose)).fetchone()
    if row is None or code_expired(row["expires_at"]) or row["attempts"] >= 5:
        raise ValueError("This code is invalid or expired. Request a new code.")
    if not check_password_hash(row["code_hash"], code or ""):
        get_db().execute("UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?", (row["id"],)); get_db().commit()
        raise ValueError("Incorrect verification code.")
    get_db().execute("DELETE FROM verification_codes WHERE id = ?", (row["id"],)); get_db().commit()
    return row["payload"]


def extract_pdf_text(uploaded):
    if fitz is None:
        raise ValueError("PDF text extraction is not installed on the server.")
    document = fitz.open(stream=uploaded.read(), filetype="pdf")
    text = "\n".join(page.get_text() for page in document)
    document.close()
    if not text.strip():
        raise ValueError("No selectable text was found in this PDF. Upload a text-based PDF or use a public portfolio link.")
    return text


def safe_public_url(value):
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Enter a valid public http(s) portfolio URL.")
    hostname = parsed.hostname.lower().rstrip(".")
    if any(hostname == domain or hostname.endswith("." + domain) for domain in NON_PORTFOLIO_HOSTS):
        raise ValueError("Use a public e-portfolio website that shows your projects, skills, or experience—not a social-media, video, search, or file-sharing link.")
    try:
        address = ipaddress.ip_address(socket.gethostbyname(hostname))
        if address.is_private or address.is_loopback or address.is_link_local or address.is_reserved:
            raise ValueError("Portfolio URLs must point to a public website.")
    except socket.gaierror:
        raise ValueError("The portfolio website could not be found.")
    return value


def extract_website_text(value):
    if http_requests is None or BeautifulSoup is None:
        raise ValueError("Website portfolio analysis is not installed on the server.")
    response = http_requests.get(safe_public_url(value), timeout=10, allow_redirects=False, headers={"User-Agent": "CareerCompass portfolio analyzer/1.0"})
    if 300 <= response.status_code < 400:
        raise ValueError("Use the final public URL of your e-portfolio website, not a redirected link.")
    response.raise_for_status()
    if "text/html" not in response.headers.get("Content-Type", ""):
        raise ValueError("The portfolio URL must point to a public HTML page.")
    soup = BeautifulSoup(response.text, "html.parser")
    for element in soup(["script", "style", "noscript", "svg"]):
        element.decompose()
    return " ".join(soup.stripped_strings)[:50000]


def portfolio_recommendation(text):
    """Rank career profiles using semantic embeddings when available, or weighted skill-group matching as fallback."""
    compact_text = " ".join(text.split())[:50000]
    if len(compact_text) < 30:
        raise ValueError("The portfolio does not contain enough readable text to analyze.")
    names = list(CAREER_PROFILES)
    scores, method = None, "weighted skill matching"
    try:
        from sentence_transformers import SentenceTransformer, util
        model = SentenceTransformer("all-MiniLM-L6-v2", local_files_only=True)
        embeddings = model.encode([compact_text] + [CAREER_PROFILES[name] for name in names], convert_to_tensor=True)
        similarity = util.cos_sim(embeddings[0], embeddings[1:])[0].tolist()
        scores = [max(0, round(value * 100)) for value in similarity]
        method = "semantic portfolio matching"
    except Exception:
        # Weighted skill-group matching: each skill category has a weight.
        # This captures any phrasing a student might use, not just exact keywords.
        lowered = compact_text.lower()
        raw = []
        for name in names:
            total = 0
            for group in CAREER_SKILL_GROUPS[name]:
                w = group["weight"]
                hits = sum(1 for term in group["terms"] if term in lowered)
                # Partial credit: at least one hit in a group scores full group weight
                if hits > 0:
                    total += w * min(hits, len(group["terms"])) / len(group["terms"]) * 10
            raw.append(total)
        maximum = max(raw) if any(r > 0 for r in raw) else 1
        scores = [round(r / maximum * 100) for r in raw]
    matches = []
    lowered = compact_text.lower()
    for name, score in zip(names, scores):
        evidence = [kw for kw in CAREER_KEYWORDS[name] if kw in lowered][:5]
        matches.append({"name": name, "score": score, "evidence": evidence})
    matches.sort(key=lambda item: item["score"], reverse=True)
    return {"method": method, "topCareer": matches[0], "rankings": matches, "textPreview": compact_text[:600]}


def contextual_recommendation(analysis, gwa, interests):
    """Combine portfolio similarity, declared interests, and GWA readiness into a realistic score."""
    selected = {item.strip() for item in interests if isinstance(item, str) and item.strip()}
    academic_score = max(0, min(100, round((5 - gwa) / 4 * 100)))
    raw_scores = [m["score"] for m in analysis["rankings"]]
    raw_max = max(raw_scores) if raw_scores else 1
    raw_min = min(raw_scores) if raw_scores else 0
    rankings = []
    for match in analysis["rankings"]:
        aligned = sorted(selected & CAREER_INTERESTS.get(match["name"], set()))
        interest_score = round(len(aligned) / len(selected) * 100) if selected else 0
        # Rescale portfolio score to 45-95 range so top match is meaningful
        if raw_max == raw_min:
            scaled_portfolio = 75
        else:
            scaled_portfolio = round(45 + ((match["score"] - raw_min) / (raw_max - raw_min)) * 50)
        score = min(100, round(scaled_portfolio * 0.65 + interest_score * 0.20 + academic_score * 0.15))
        evidence = list(match.get("evidence", []))
        if aligned:
            evidence.append("interests: " + ", ".join(aligned))
        rankings.append({**match, "score": score, "portfolioScore": scaled_portfolio,
                         "interestScore": interest_score, "academicReadinessScore": academic_score,
                         "evidence": evidence})
    rankings.sort(key=lambda item: item["score"], reverse=True)
    return rankings, {"portfolioSimilarity": 65, "careerInterests": 20, "gwaReadiness": 15}


def user_payload(user):
    return {
        "id": user["id"], "name": user["name"], "username": user["username"], "email": user["email"],
        "role": user["role"], "year": user["year"], "section": user["section"], "phone": user["phone"],
        "age": user["age"], "initials": "".join(part[0] for part in user["name"].split()[:2]).upper() or "ST",
    }


def current_user():
    user_id = session.get("user_id")
    return get_db().execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone() if user_id else None


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        user = current_user()
        if user is None:
            return jsonify(ok=False, error="Please sign in first."), 401
        return view(user, *args, **kwargs)
    return wrapped


def faculty_required(view):
    @wraps(view)
    def wrapped(user, *args, **kwargs):
        if user["role"] not in {"faculty", "admin"}:
            return jsonify(ok=False, error="Faculty access is required."), 403
        return view(user, *args, **kwargs)
    return wrapped


def render_page(template_name):
    path = Path(app.jinja_loader.searchpath[0]) / template_name
    if not path.is_file():
        abort(404)
    return render_template(template_name)


@app.route("/")
@app.route("/index.html")
def home(): return render_page("index.html")


@app.route("/login")
@app.route("/login.html")
def login_page(): return render_page("login.html")


@app.get("/careercompass-logo.png")
def careercompass_logo():
    logo_path = BASE_DIR / "Careercompass_Logo.png"
    if not logo_path.is_file():
        abort(404)
    return send_file(logo_path, mimetype="image/png")


@app.route("/<portal>/<page>.html")
def portal_page(portal, page):
    if portal not in {"student", "faculty"}: abort(404)
    return render_page(f"{portal}/{page}.html")


@app.post("/api/auth/request-verification")
def request_verification():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = data.get("email") or data.get("username")
    role = data.get("role") if data.get("role") in {"student", "faculty"} else "student"
    try:
        email = valid_email(email)
    except ValueError as error:
        return jsonify(ok=False, error=str(error)), 400
    if len(name) < 2:
        return jsonify(ok=False, error="Enter your full name."), 400
    db = get_db()
    if db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone():
        return jsonify(ok=False, error="An account with that email address already exists. Sign in instead."), 409
    try:
        create_verification_code(email, "signup", json.dumps({"name": name, "role": role}))
    except RuntimeError as error:
        return jsonify(ok=False, error=str(error)), 503
    return jsonify(ok=True, message="A verification code was sent to your email address.")


@app.post("/api/auth/complete-registration")
def complete_registration():
    data = request.get_json(silent=True) or {}
    try:
        email = valid_email(data.get("email"))
        payload = json.loads(consume_verification_code(email, "signup", data.get("code")))
    except (ValueError, json.JSONDecodeError) as error:
        return jsonify(ok=False, error=str(error)), 400
    password = data.get("password") or ""
    if len(password) < 8:
        return jsonify(ok=False, error="Use a password with at least 8 characters."), 400
    db = get_db()
    try:
        db.execute("INSERT INTO users (name, username, email, password_hash, role, year, section, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          (payload["name"], email, email, generate_password_hash(password), payload["role"], "3rd Year" if payload["role"] == "student" else "Faculty", "BSIT-3A" if payload["role"] == "student" else "CCIT", now()))
        db.commit()
    except Exception as error:
        if is_integrity_error(error):
            return jsonify(ok=False, error="An account with that email address already exists."), 409
        raise
    return jsonify(ok=True, message="Account verified. You can now sign in."), 201


@app.post("/api/auth/request-password-reset")
def request_password_reset():
    data = request.get_json(silent=True) or {}
    try:
        email = valid_email(data.get("email"))
    except ValueError as error:
        return jsonify(ok=False, error=str(error)), 400
    if get_db().execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone() is None:
        return jsonify(ok=False, error="No account was found for that email address."), 404
    try:
        create_verification_code(email, "reset")
    except RuntimeError as error:
        return jsonify(ok=False, error=str(error)), 503
    return jsonify(ok=True, message="A password-reset code was sent to your email address.")


@app.post("/api/auth/complete-password-reset")
def complete_password_reset():
    data = request.get_json(silent=True) or {}
    try:
        email = valid_email(data.get("email"))
        consume_verification_code(email, "reset", data.get("code"))
    except ValueError as error:
        return jsonify(ok=False, error=str(error)), 400
    password = data.get("password") or ""
    if len(password) < 8:
        return jsonify(ok=False, error="Use a password with at least 8 characters."), 400
    db = get_db(); db.execute("UPDATE users SET password_hash = ? WHERE email = ?", (generate_password_hash(password), email)); db.commit()
    return jsonify(ok=True, message="Your password has been reset. You can now sign in.")


@app.post("/api/auth/login")
def api_login():
    data = request.get_json(silent=True) or {}
    identifier, password = (data.get("identifier") or "").strip().lower(), data.get("password") or ""
    try:
        identifier = valid_email(identifier)
    except ValueError as error:
        return jsonify(ok=False, error=str(error)), 400
    user = get_db().execute("SELECT * FROM users WHERE username = ? OR email = ?", (identifier, identifier)).fetchone()
    if user is None or not check_password_hash(user["password_hash"], password):
        return jsonify(ok=False, error="Invalid username or password."), 401
    if data.get("role") == "faculty" and user["role"] not in {"faculty", "admin"}:
        return jsonify(ok=False, error="This account is not a faculty account."), 403
    session.clear(); session["user_id"] = user["id"]
    return jsonify(ok=True, user=user_payload(user))


@app.post("/api/auth/logout")
def logout():
    session.clear()
    return jsonify(ok=True)


@app.get("/api/auth/me")
@login_required
def me(user): return jsonify(ok=True, user=user_payload(user))


@app.route("/api/profile", methods=["GET", "PATCH"])
@login_required
def profile(user):
    if request.method == "GET": return jsonify(ok=True, user=user_payload(user))
    data = request.get_json(silent=True) or {}
    allowed = {key: data.get(key) for key in ("name", "year", "section", "phone", "age") if key in data}
    if not allowed: return jsonify(ok=False, error="No profile fields were supplied."), 400
    columns, values = [], []
    for key, value in allowed.items():
        columns.append(f"{key} = ?"); values.append(value.strip() if isinstance(value, str) else value)
    values.append(user["id"])
    db = get_db(); db.execute(f"UPDATE users SET {', '.join(columns)} WHERE id = ?", values); db.commit()
    return jsonify(ok=True, user=user_payload(db.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()))


@app.get("/api/faculty/students")
@login_required
@faculty_required
def faculty_students(user):
    rows = get_db().execute("""
        SELECT u.id, u.name, u.email, u.year, u.section, u.phone, u.age, u.created_at,
               a.career, a.score, a.created_at AS assessment_date
        FROM users u LEFT JOIN assessments a ON a.id = (
            SELECT id FROM assessments WHERE user_id = u.id ORDER BY id DESC LIMIT 1
        ) WHERE u.role = 'student' ORDER BY u.name COLLATE NOCASE
    """).fetchall()
    return jsonify(ok=True, items=[dict(row) for row in rows])


@app.route("/api/faculty/students/<int:student_id>/notes", methods=["GET", "POST"])
@login_required
@faculty_required
def faculty_notes(user, student_id):
    db = get_db()
    if db.execute("SELECT id FROM users WHERE id = ? AND role = 'student'", (student_id,)).fetchone() is None:
        return jsonify(ok=False, error="Student not found."), 404
    if request.method == "POST":
        note = (request.get_json(silent=True) or {}).get("note", "").strip()
        if not note or len(note) > 1000:
            return jsonify(ok=False, error="Enter a note up to 1,000 characters."), 400
        db.execute("INSERT INTO faculty_notes (student_id, faculty_id, note, created_at) VALUES (?, ?, ?, ?)", (student_id, user["id"], note, now())); db.commit()
    rows = db.execute("""SELECT n.id, n.note, n.created_at, u.name AS faculty_name
                         FROM faculty_notes n JOIN users u ON u.id=n.faculty_id
                         WHERE n.student_id=? ORDER BY n.id DESC""", (student_id,)).fetchall()
    return jsonify(ok=True, items=[dict(row) for row in rows])


@app.delete("/api/faculty/students/<int:student_id>")
@login_required
@faculty_required
def delete_student(user, student_id):
    db = get_db()
    student = db.execute("SELECT id, name FROM users WHERE id = ? AND role = 'student'", (student_id,)).fetchone()
    if student is None:
        return jsonify(ok=False, error="Student not found."), 404
    # Cascade: remove notes and assessments before deleting the user
    db.execute("DELETE FROM faculty_notes WHERE student_id = ?", (student_id,))
    db.execute("DELETE FROM assessments WHERE user_id = ?", (student_id,))
    db.execute("DELETE FROM users WHERE id = ?", (student_id,))
    db.commit()
    return jsonify(ok=True, message=f"Student account '{student['name']}' has been deleted.")


@app.get("/api/student/notes")
@login_required
def student_notes(user):
    if user["role"] != "student":
        return jsonify(ok=False, error="Only student accounts can view their notes."), 403
    db = get_db()
    rows = db.execute("""SELECT n.id, n.note, n.created_at, u.name AS faculty_name
                         FROM faculty_notes n JOIN users u ON u.id=n.faculty_id
                         WHERE n.student_id=? ORDER BY n.id DESC""", (user["id"],)).fetchall()
    return jsonify(ok=True, items=[dict(row) for row in rows])


@app.post("/api/auth/change-password")
@login_required
def change_password(user):
    data = request.get_json(silent=True) or {}
    current, new = data.get("currentPassword") or "", data.get("newPassword") or ""
    if not check_password_hash(user["password_hash"], current):
        return jsonify(ok=False, error="Your current password is incorrect."), 400
    if len(new) < 8:
        return jsonify(ok=False, error="Use a new password with at least 8 characters."), 400
    db = get_db(); db.execute("UPDATE users SET password_hash=? WHERE id=?", (generate_password_hash(new), user["id"])); db.commit()
    return jsonify(ok=True, message="Password updated.")


@app.route("/api/assessments", methods=["GET", "POST"])
@login_required
def assessments(user):
    db = get_db()
    if request.method == "GET":
        query = "SELECT a.*, u.name AS student_name, u.year, u.section FROM assessments a JOIN users u ON a.user_id = u.id"
        params = () if user["role"] in {"faculty", "admin"} else (user["id"],)
        if params: query += " WHERE a.user_id = ?"
        rows = db.execute(query + " ORDER BY a.id DESC", params).fetchall()
        return jsonify(ok=True, items=[{"id": r["id"], "studentName": r["student_name"], "year": r["year"], "section": r["section"], "career": r["career"], "score": r["score"], "date": r["created_at"], "raw": json.loads(r["payload"])} for r in rows])
    if user["role"] != "student": return jsonify(ok=False, error="Only student accounts can submit assessments."), 403
    data = request.get_json(silent=True) or {}
    analysis = session.get("portfolio_analysis")
    if not analysis:
        return jsonify(ok=False, error="Analyze an E-Portfolio PDF or public portfolio URL before submitting the assessment."), 400
    try:
        age = int(data.get("age"))
    except (TypeError, ValueError):
        return jsonify(ok=False, error="Enter your age before submitting the assessment."), 400
    if not 18 <= age <= 40:
        return jsonify(ok=False, error="Age must be between 18 and 40."), 400
    try:
        gwa = float(data.get("gwa"))
    except (TypeError, ValueError):
        return jsonify(ok=False, error="Enter your GWA before submitting the assessment."), 400
    if not 1 <= gwa <= 5:
        return jsonify(ok=False, error="GWA must be between 1.00 and 5.00."), 400
    interests = data.get("interests")
    if not isinstance(interests, list) or not interests:
        return jsonify(ok=False, error="Select at least one career interest before submitting the assessment."), 400
    rankings, scoring = contextual_recommendation(analysis, gwa, interests)
    top = rankings[0]
    data.update(topCareer=top, rankings=rankings, portfolioMethod=analysis["method"], scoring=scoring)
    cursor = db.execute("INSERT INTO assessments (user_id, career, score, payload, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id", (user["id"], top["name"], round(top["score"]), json.dumps(data), now()))
    assessment_id = cursor.fetchone()["id"]
    db.commit()
    return jsonify(ok=True, id=assessment_id, result={"topCareer": top, "alternatives": rankings[1:4], "portfolioMethod": analysis["method"], "scoring": scoring,
        "summary": f"{top['name']} is the strongest match based on portfolio similarity, selected career interests, and GWA readiness."}), 201


@app.post("/api/portfolio")
@login_required
def portfolio(user):
    uploaded = request.files.get("file")
    if not uploaded or not uploaded.filename: return jsonify(ok=False, error="Choose a PDF file."), 400
    if "." not in uploaded.filename or uploaded.filename.rsplit(".", 1)[1].lower() not in ALLOWED_UPLOADS: return jsonify(ok=False, error="Only PDF files are supported."), 400
    session["portfolio_filename"] = secure_filename(uploaded.filename)
    # File persistence and skill extraction belong to the next portfolio-analysis milestone.
    return jsonify(ok=True, filename=secure_filename(uploaded.filename), message="PDF received and validated. Automated skill extraction is not enabled yet.")


@app.post("/api/portfolio/analyze")
@login_required
def analyze_portfolio(user):
    uploaded = request.files.get("file")
    website = (request.form.get("website") or "").strip()
    if not uploaded and not website:
        return jsonify(ok=False, error="Upload a PDF or enter a public e-portfolio URL."), 400
    try:
        sources, texts = [], []
        if uploaded and uploaded.filename:
            if "." not in uploaded.filename or uploaded.filename.rsplit(".", 1)[1].lower() not in ALLOWED_UPLOADS:
                return jsonify(ok=False, error="Only PDF portfolio files are supported."), 400
            texts.append(extract_pdf_text(uploaded))
            filename = secure_filename(uploaded.filename)
            sources.append(filename)
            session["portfolio_filename"] = filename
        if website:
            texts.append(extract_website_text(website))
            sources.append(website)
        analysis = portfolio_recommendation("\n".join(texts))
        analysis["sources"] = sources
        session["portfolio_analysis"] = analysis
        return jsonify(ok=True, analysis=analysis)
    except ValueError as error:
        return jsonify(ok=False, error=str(error)), 400
    except Exception:
        app.logger.exception("Portfolio analysis failed")
        return jsonify(ok=False, error="We could not analyze this portfolio. Please try a text-based PDF or another public URL."), 500


@app.errorhandler(413)
def too_large(_error): return jsonify(ok=False, error="The PDF must be 5 MB or smaller."), 413


init_db()

if __name__ == "__main__": app.run(host="0.0.0.0", debug=False, port=int(os.environ.get("PORT", "3000")))
