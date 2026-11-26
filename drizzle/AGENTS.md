# Blinder database migrations

## Purpose

Define the D1 schema for shared dinner rooms.

## Local Contracts

- Append a migration for each schema change and register it in `meta/_journal.json`.
- Preserve applied migrations. Keep sample venue records and room data outside this directory.

## Verification

- Start the local Worker and exercise room creation before deploying a migration.
