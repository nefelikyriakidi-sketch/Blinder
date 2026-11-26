# Blinder

Blinder is a phone-first PWA for groups deciding where to go, from team lunches to drinks with friends. Everyone votes privately and can move their one favorite as they swipe. The suggested group pick needs a second private confirmation before it is final.

## Try it

Open [Blinder](https://blinder.clevergoldfinch32.chatgpt.site/) and choose **Try a solo demo** to practice swiping with simulated friends. To test together, choose **Anything**, **Coffee**, **Brunch**, **Lunch**, **Dinner**, or **Drinks**, create a room, and share its invite link. The outing controls which sample places everyone sees. Shared rounds need an internet connection. Room links expire after 24 hours.

The sample deck uses fictional places and illustrative food photos. Real venue links can be added to the deck for directions and booking.

On iPhone, use Safari’s Share menu and choose **Add to Home Screen**. On Android, use Chrome’s **Install app** or **Add to home screen**. The app and solo demo can reopen offline after the first online visit.

## Develop locally

Run the preview with Node.js 24 or later.

```sh
node worker/dev.mjs
```

Open [localhost:8093](http://localhost:8093/). The preview database resets when the process stops.

Edit the browser app under `dist/` and live room handling under `worker/`. Run `node worker/build.mjs` to create the Worker for ChatGPT Sites. GitHub holds the source and commit history.
