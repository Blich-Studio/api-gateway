#!/bin/bash

# Migration script for adding token_prefix column
# Run this script to apply the migration to your database

set -e

# Safely load environment variables if .env file exists
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Validate required environment variables
if [ -z "${POSTGRES_HOST}" ] || [ -z "${POSTGRES_PORT}" ] || [ -z "${POSTGRES_USER}" ] || [ -z "${POSTGRES_DB}" ]; then
  echo "❌ Error: Required environment variables not set"
  echo "   Please ensure POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, and POSTGRES_DB are defined"
  exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MIGRATION_FILE="${SCRIPT_DIR}/../database/migrations/002_add_token_prefix.sql"

# Verify migration file exists
if [ ! -f "${MIGRATION_FILE}" ]; then
  echo "❌ Error: Migration file not found at ${MIGRATION_FILE}"
  exit 1
fi

echo "🔧 Running migration: 002_add_token_prefix"
echo "================================"

# Run the migration using separate parameters (safer than connection URI)
# PGPASSWORD environment variable is used for password (no need to pass on command line)
export PGPASSWORD="${POSTGRES_PASSWORD}"
psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -f "${MIGRATION_FILE}"
unset PGPASSWORD

echo "✅ Migration completed successfully"
echo ""
echo "⚠️  NOTE: Existing tokens with NULL token_prefix have been deleted."
echo "   Users with active verification tokens will need to request a new one."
