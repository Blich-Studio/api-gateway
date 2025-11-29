#!/bin/bash

# Migration script for adding token_prefix column
# Run this script to apply the migration to your database

set -e

# Load environment variables if .env file exists
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Database connection string
DB_CONNECTION="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"

echo "🔧 Running migration: 002_add_token_prefix"
echo "================================"

# Run the migration
psql "${DB_CONNECTION}" -f database/migrations/002_add_token_prefix.sql

echo "✅ Migration completed successfully"
echo ""
echo "⚠️  NOTE: Existing tokens will have NULL token_prefix."
echo "   They will not be findable via the new lookup mechanism."
echo "   Consider deleting old tokens or regenerating them."
echo ""
echo "   To clean up old tokens, run:"
echo "   DELETE FROM verification_tokens WHERE token_prefix IS NULL;"
