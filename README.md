# Blinder

Blinder is a proof-of-concept PWA built with plain HTML, CSS, and JavaScript. The current shell lets you check installation and offline access in a browser.

## Try it

Open the [GitHub Pages preview](https://nefelikyriakidi-sketch.github.io/Blinder/) on a phone or desktop. On iPhone, use Safari’s Share menu and choose **Add to Home Screen**. On Android, use Chrome’s **Install app** or **Add to home screen** action. After **Offline access** shows **Ready**, disconnect and reopen Blinder to test the cached shell.

## Develop locally

From the repository root, run:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open [localhost:8000](http://localhost:8000/). GitHub Pages serves the same files over HTTPS for phone testing.
