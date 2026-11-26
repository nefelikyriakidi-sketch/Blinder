# Blinder PWA

## Purpose

This folder contains the framework-free browser interface and the sample venue deck.

## Ownership

- `index.html`, `styles.css`, and `app.js` own the layout, gestures, room interface, and solo demo.
- `round.js` defines room transitions and the private view returned to each participant. The Worker packages the same module.
- `venues.js`, `venue-photos.jpg`, and `outing-photos.jpg` contain fictional venues and illustrative photo grids.
- `manifest.webmanifest`, the icons, and `sw.js` provide installation and offline access to the app and solo demo.

## Local Contracts

- Keep Pass and Like available by button and horizontal swipe. Favorite also Likes the current card and replaces the previous favorite.
- The host sets Anything, Coffee, Brunch, Lunch, Dinner, or Drinks when creating a room. Filter both the opening deck and any added cards by that outing.
- Use the original overlapping photo cards on the homepage. The intro names brunch, lunch, dinner, and drinks and explains that friends swipe to agree where to go.
- Show the same group recommendation to all participants. Keeping other matches open for browsing leaves the current confirmation intact.
- Put chat, activity, and unread counts in the room menu. Let returning participants rejoin their most recent room from the same browser.
- Let the host name the room and share an invite from the lobby. Explain when the lobby is waiting for its second participant.
- Offer optional sign-in in Friends. Use Blinder usernames for friend requests and show invitations from accepted friends in that menu.
- Use text nodes for nicknames and room content. Use venue links for directions and booking when real links are available.
- Keep asset and service-worker URLs relative. Update the precache list and increment the cache version when cached files change. Keep live room responses out of the cache.
- Treat `server/` as generated Worker output.

## Verification

- Check the solo demo and installability at a phone-sized viewport.
- Verify outing selection, a movable favorite, anonymous rejection, offline reopening, and a shared round across three independent browser sessions.
