#!/bin/sh
set -e

DB_HOST="db"
DB_USER="tutor"
DB_NAME="tutor"
INIT_SQL="/docker-entrypoint-initdb.d/01_schema.sql"

echo "Waiting for Postgres at ${DB_HOST}..."
until pg_isready -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1; do
  sleep 1
done

if [ -f "${INIT_SQL}" ]; then
  echo "Applying init SQL: ${INIT_SQL}"
  # Use PGPASSWORD env if provided by compose; otherwise will prompt (not desired)
  if [ -z "${PGPASSWORD}" ]; then
    echo "Warning: PGPASSWORD not set; attempting connection without password."
  fi
  psql -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" -f "${INIT_SQL}" || true
else
  echo "No init SQL found at ${INIT_SQL}; skipping."
fi

exec "$@"
