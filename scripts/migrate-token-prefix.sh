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

# Database connection string
DB_CONNECTION="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"

echo "🔧 Running migration: 002_add_token_prefix"
echo "================================"

# Run the migration
psql "${DB_CONNECTION}" -f database/migrations/002_add_token_prefix.sql

echo "✅ Migration completed successfully"
echo ""
echo "⚠️  NOTE: Existing tokens with NULL token_prefix have been deleted."
echo "   Users with active verification tokens will need to request a new one."
