# Blinder PWA

## Purpose

This folder contains the framework-free PWA and provides the static files served by ChatGPT Sites.

## Ownership

- `index.html`, `styles.css`, and `app.js` handle the interface, installation controls, and browser status.
- `manifest.webmanifest` and the PNG icons define how browsers install and launch the app.
- `sw.js` caches the app shell for offline use.

## Local Contracts

- Edit the source files here directly. Sites serves this directory without a build step.
- Keep asset and service-worker URLs relative. Update the precache list and increment the cache version when cached files change. Scope cache deletion to this app.
- Serve only files intended for site visitors from this directory.

## Verification

- Check a browser load, service-worker control, and offline reopening. Check the install controls at a phone-sized viewport.
