# Exam_Pro Backend

REST API built with Node.js 20+, Express 5 and MongoDB (Mongoose).

## Setup

```sh
npm install
```

Copy `.env.example` to `.env` and set values for your environment. Then add the first accounts and
sample exams:

```sh
npm run seed
```

It asks for emails and passwords, or reads `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`,
`SEED_STUDENT_EMAIL` and `SEED_STUDENT_PASSWORD`. It never changes existing accounts or exams.

## Run

```sh
npm run dev
```

The API listens on port `5000` by default. Available endpoints:

- `GET /` — API name and version
- `GET /api/v1/health` — service health and timestamp
- `GET /api/v1/health/ready` — 200 when the database is connected, otherwise 503

Under `/api/v1`, all except login need `Authorization: Bearer <token>`:

| Endpoint | Role | Purpose |
| --- | --- | --- |
| `POST /auth/login` | none | Returns a token |
| `GET /auth/me` | any | Signed-in user |
| `GET /exams`, `GET /exams/:id` | student | Published exams |
| `POST /exams/:id/attempts` | student | Start, or resume an unfinished attempt |
| `GET /attempts/:id` | student | Questions (no answer key) and saved answers |
| `PUT /attempts/:id/answers` | student | Autosave; older revisions are ignored |
| `POST /attempts/:id/submit` | student | Submit and grade; safe to repeat |
| `GET /results`, `GET /results/:attemptId` | student | Scores and answer review |
| `GET`, `POST /admin/exams` | admin | List and create exams |
| `GET`, `PUT`, `DELETE /admin/exams/:id` | admin | Read, update and delete an exam |

An attempt keeps its own copy of the exam, so later edits never change it. Answers are accepted
until 10 seconds after the deadline, to allow for the browser's automatic submit.

## Environment

Variables are validated in `src/config/env.js`; the app stops at startup if one is invalid.

| Variable | Default | Notes |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test` or `production` |
| `PORT` | `5000` | 1–65535 |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated exact origins; required in production |
| `MONGODB_URI` | none, required | MongoDB or Atlas connection string |
| `MONGODB_DB_NAME` | `exam_pro` | Database name |
| `JWT_SECRET` | none, required | At least 32 random characters, different per environment |
| `JWT_EXPIRES_IN_HOURS` | `12` | 9–168, so a login outlasts the longest exam |
| `TRUST_PROXY_HOPS` | `0` | Number of reverse proxies in front of the app |

Credentialed requests are allowed from `CORS_ORIGINS`. If login uses cookies, set
`SameSite` on them and add CSRF protection.

## Structure

```
src/
├── app.js         # Express app
├── server.js      # starts the server
├── config/        # environment validation, MongoDB connection
├── middleware/    # authentication, errors, validation, rate limiting
├── modules/       # auth, users, exams, attempts
├── routes/        # health route, and index.js mounting everything under /api/v1
└── utils/         # AppError
```

Put each feature in `src/modules/<feature>/`, split into routes, controller, service,
model and validation files, and mount its router in `src/routes/index.js`.

- Throw `new AppError(status, message)` for expected errors. Async handlers need no `try/catch`.
- Use `validate({ body, params, query })` and read the result from `request.validated`.
- Put `createAuthLimiter()` on register and password-reset routes. Login uses `createLoginLimiters()`.

## Tests

```sh
npm test
```

API tests use a temporary in-memory MongoDB, downloaded on the first run. They never use `MONGODB_URI`
from `.env`.
