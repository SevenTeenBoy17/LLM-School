# EduAI Prism deployment profiles

## School server

Use `school.compose.yml` on one school-controlled host. Keep the named data volume on encrypted storage, back up `/data` while the app is stopped or through a SQLite-consistent snapshot, and restore into a fresh volume before starting the service.

## Internet pilot

Use `internet-single.compose.yml` behind the school's TLS reverse proxy. The default bind address is `127.0.0.1`; expose only the reverse proxy. This profile is intentionally single-instance because the current authoritative repository is SQLite and generated files use local storage.

Do not scale either profile above one application replica. PostgreSQL, a durable job queue, and object storage are required before multi-instance public deployment. `EDUAI_ENABLE_DEMO_SEED=true` is rejected in production.

For a new empty database, set `EDUAI_BOOTSTRAP_ADMIN_USERNAME`, `EDUAI_BOOTSTRAP_ADMIN_PASSWORD` (at least 12 characters), and optionally `EDUAI_BOOTSTRAP_ADMIN_NAME`. The account is created only while the users table is empty. Without a user import or bootstrap administrator, readiness remains `503` instead of reporting a misleading healthy state.

Vercel's ephemeral filesystem is not a supported production data plane for this SQLite edition: readiness is `503` and data mutations are rejected. Use the single-instance Internet profile on a persistent host, or migrate to PostgreSQL and object storage before horizontal/serverless deployment.

Set secrets through the host secret store or an untracked environment file. Never put API keys in Compose files, source code, browser bundles, screenshots, or logs. Rotate any credential that has already been shared in chat.
