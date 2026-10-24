# CareerCompass

## Scope and Current Features

CareerCompass currently includes the following features and functionalities:

- User authentication with email verification for registration, login, logout, password reset, and password change.
- Student profile management for name, year level, section, phone number, age, and account details.
- Career assessment submission using the student's GWA and selected career-interest options.
- Portfolio analysis from a text-based PDF e-portfolio, a public portfolio website, or both.
- Career matching that ranks the five IT career tracks supported by the system: Software Engineering, Web Development, Data Science & Analytics, Cybersecurity, and Network Engineering.
- Personalized recommendation results that show the top career match, alternative tracks, match scores, and a written explanation of the recommendation.
- Student dashboard, recommendation page, assessment page, history page, and profile page for tracking results and updating information.
- Faculty and administrator access to student records, submitted assessments, and recommendation summaries.
- Faculty dashboard tools for viewing student lists, recent recommendations, recommendation distribution, and assessment completion summaries.
- Faculty notes for recording adviser feedback on student records.
- Shared web pages served through the Flask application, with assessment and recommendation data stored in SQLite.

## Run the application

From the project folder, run:

```bash
python app.py
```

Then open [http://localhost:3000](http://localhost:3000). The application serves every student and faculty page, its CSS and JavaScript assets, and the assessment API from the same origin.

## Database and deployment

Local development uses `careercompass.db` (SQLite). For a live deployment, set a PostgreSQL `DATABASE_URL` environment variable; the application will automatically use PostgreSQL instead of SQLite.

After provisioning an empty PostgreSQL database, copy local development data with:

```bash
python migrate_sqlite_to_postgres.py --replace
```

`--replace` clears the target PostgreSQL tables only. It never changes the local SQLite source file, but use it only for a new or disposable target database.

For Render, create a Web Service and PostgreSQL database in the same region, set `DATABASE_URL` to Render's internal PostgreSQL URL, install dependencies with `pip install -r requirements.txt`, and start the application with `gunicorn app:app`.

The included `render.yaml` supplies the Render build and start commands. It downloads the `all-MiniLM-L6-v2` Sentence-BERT model during the build so the deployed application can use semantic matching instead of its keyword fallback.

## Optional Node server

`server/server.js` remains available as an alternate server. Run `npm install` and `npm start` inside `server`, then open [http://localhost:3001](http://localhost:3001). Its default port is different so it does not conflict with the Python application.
