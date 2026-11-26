# Live room Worker

## Purpose

Serve the Blinder PWA and synchronize shared rounds across browsers.

## Ownership

- `index.js` validates room requests, authenticates individual participants by bearer key, and stores state in D1.
- `profiles.js` uses Sites account identity for usernames, accepted friendships, and direct invites.
- `build.mjs` bundles the browser assets and shared round rules into the Sites Worker.
- `dev.mjs` runs the same Worker locally with an in-memory SQLite database.

## Local Contracts

- Use the room revision when writing to keep simultaneous votes consistent.
- Validate the host’s outing when creating a room. Rooms created before outing selection use the mixed deck.
- Return only the caller's private selections and group-level outcomes. Keep room keys out of invite links and API responses for other participants.
- Allow chat and activity only for room participants. Keep the latest 50 entries in each feed and omit the identity behind an anonymous rejection.
- Room links expire 24 hours after creation. Apply storage changes via `../drizzle/`.
- Only the host can rename a room or invite signed-in friends while joining is open. Store a site-scoped account ID and chosen handle for profiles. Keep sign-in email and account IDs out of browser responses.
- Publish build output to the existing Sites project. Keep authored code in the GitHub repository.

## Verification

- Run `node worker/build.mjs` from the repository root and check the generated Worker.
- Verify a host and two guests can finish the same round without exposing individual votes.
