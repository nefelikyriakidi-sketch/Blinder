# Blinder

Blinder is a proof-of-concept PWA built with plain HTML, CSS, and JavaScript. The current shell lets you check installation and offline access in a browser.

## Try it

Open the [ChatGPT Sites preview](https://blinder.clevergoldfinch32.chatgpt.site/) on a phone or desktop. On iPhone, use Safari’s Share menu and choose **Add to Home Screen**. On Android, use Chrome’s **Install app** or **Add to home screen** action. After **Offline access** shows **Ready**, disconnect and reopen Blinder to test the cached shell.

## Develop locally

From the repository root, run:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Open [localhost:8000](http://localhost:8000/). Edit the static app directly in `dist/`. GitHub holds the source and commit history. ChatGPT Sites serves the app over HTTPS using the project in `.openai/hosting.json`.
