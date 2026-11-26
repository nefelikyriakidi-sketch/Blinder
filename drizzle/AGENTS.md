# Blinder database migrations

## Purpose

Define the D1 schema for rooms, profiles, friendships, and invitations.

## Local Contracts

- Append a migration for each schema change and register it in `meta/_journal.json`.
- Preserve applied migrations. Keep sample venue records and room data outside this directory.

## Verification

- Start the local Worker and exercise room creation and profile invites before deploying a migration.
