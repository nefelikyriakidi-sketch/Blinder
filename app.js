const connection = document.querySelector("#connection");
const offlineAccess = document.querySelector("#offline-access");
const installButton = document.querySelector("#install-button");
const installHelp = document.querySelector("#install-help");
const standalone = window.matchMedia("(display-mode: standalone)");
let installPrompt;
let installed = false;

function updateConnection() {
  connection.textContent = navigator.onLine ? "Online" : "Offline";
}

function updateInstallControls() {
  const runningAsApp = installed || standalone.matches || navigator.standalone;
  installButton.hidden = Boolean(runningAsApp || !installPrompt);
  installHelp.hidden = Boolean(runningAsApp || installPrompt);
}

window.addEventListener("online", updateConnection);
window.addEventListener("offline", updateConnection);
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  updateInstallControls();
});
window.addEventListener("appinstalled", () => {
  installed = true;
  installPrompt = undefined;
  updateInstallControls();
});
standalone.addEventListener("change", updateInstallControls);

installButton.addEventListener("click", async () => {
  if (!installPrompt) return;

  const prompt = installPrompt;
  installPrompt = undefined;
  try {
    const { outcome } = await prompt.prompt();
    if (outcome === "accepted") installed = true;
  } catch (error) {
    console.warn("Could not open the install prompt.", error);
  } finally {
    updateInstallControls();
  }
});

updateConnection();
updateInstallControls();

if ("serviceWorker" in navigator) {
  const worker = navigator.serviceWorker;
  const updateOfflineAccess = () => {
    offlineAccess.textContent = worker.controller ? "Ready" : "Getting ready…";
  };

  worker.addEventListener("controllerchange", updateOfflineAccess);
  updateOfflineAccess();
  worker.register("./sw.js")
    .then(({ installing }) => {
      installing?.addEventListener("statechange", () => {
        if (installing.state === "redundant" && !worker.controller) {
          offlineAccess.textContent = "Unavailable";
        }
      });
    })
    .catch((error) => {
      if (!worker.controller) offlineAccess.textContent = "Unavailable";
      console.warn("Could not register the service worker.", error);
    });
} else {
  offlineAccess.textContent = "Unavailable";
}
