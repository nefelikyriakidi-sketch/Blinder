import { applyAction, createRound, deckFor, member, outingLabels, viewOf } from "./round.js";
import { venues } from "./venues.js";

const screen = document.querySelector("#screen");
const menuButton = document.querySelector("#room-menu");
const rejoinButton = document.querySelector("#rejoin-room");
const outingChip = document.querySelector("#outing-chip");
const sheet = document.querySelector("#sheet");
const sheetTitle = document.querySelector("#sheet-title");
const sheetBody = document.querySelector("#sheet-body");
const toast = document.querySelector("#toast");
const installButton = document.querySelector("#install");
const requested = new URL(location.href).searchParams.get("room");
const roomCode = /^[a-f0-9]{12}$/.test(requested ?? "") ? requested : null;
const keyName = (code) => `blinder-room:${code}`;
const lastRoomKey = "blinder:last-room";
let key = roomCode ? localStorage.getItem(keyName(roomCode)) : null;
let view;
let demo;
let busy = false;
let polling = false;
let toastTimer;
let installPrompt;
let sheetMode;

const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};

function button(label, method, className = "primary") {
  const node = element("button", label, className);
  node.type = "button";
  node.addEventListener("click", method);
  return node;
}

function tell(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2800);
}

function inviteLink(code = view.code) {
  const url = new URL("./", location.href);
  url.searchParams.set("room", code);
  return url.href;
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(inviteLink());
    tell("Invite link copied.");
  } catch {
    const link = element("input");
    link.value = inviteLink();
    link.readOnly = true;
    link.setAttribute("aria-label", "Invite link");
    const select = () => link.select();
    openSheet("Share this room", [link, button("Select link", select, "secondary")]);
    select();
  }
}

function openSheet(title, content, mode) {
  sheetMode = mode;
  sheetTitle.textContent = title;
  sheetBody.replaceChildren(...content);
  if (!sheet.open) sheet.showModal();
}

const feedKey = (feed) => `blinder-read:${view.code}:${feed}`;
const feedItems = (feed) => view?.[feed] ?? [];
const unread = (feed) => feedItems(feed).filter((entry) =>
  !entry.mine && entry.id > Number(localStorage.getItem(feedKey(feed)) ?? 0)).length;

function refreshRoomMenu() {
  menuButton.hidden = !view || Boolean(demo);
  if (!view || demo) return;
  const count = unread("messages") + unread("activity");
  const label = `Room · ${view.people.length}`;
  menuButton.replaceChildren(label);
  menuButton.setAttribute("aria-label", count ? `${label}, ${count} unread updates` : label);
  if (count) menuButton.append(element("span", String(count), "unread-count"));
  if (sheetMode === "room" && sheet.open) {
    for (const control of sheetBody.querySelectorAll("[data-feed]")) {
      const unseen = unread(control.dataset.feed);
      control.textContent = unseen ? `${control.dataset.label} · ${unseen}` : control.dataset.label;
    }
  }
}

function refreshFeed() {
  if (!sheet.open || !["messages", "activity"].includes(sheetMode)) return;
  const list = sheetBody.querySelector(".room-feed");
  const entries = feedItems(sheetMode);
  const latest = entries.at(-1)?.id ?? 0;
  if (list.dataset.latest === String(latest)) return;
  list.dataset.latest = latest;
  const chat = sheetMode === "messages";
  const rows = chat ? entries : [...entries].reverse();
  list.replaceChildren(...rows.map((entry) => {
    const item = element("li", undefined, chat && entry.mine ? "own-message" : "");
    if (chat) item.append(element("strong", entry.mine ? "You" : entry.sender));
    item.append(element("p", entry.text));
    return item;
  }));
  if (!rows.length) list.append(element("li", chat ? "Say hi to your group." : "No updates yet."));
  if (chat) list.scrollTop = list.scrollHeight;
  localStorage.setItem(feedKey(sheetMode), String(latest));
  refreshRoomMenu();
}

function openActivity() {
  const list = element("ul", undefined, "room-feed");
  openSheet("Activity", [list, button("Back to room", roomMenu, "text-button")], "activity");
  refreshFeed();
}

function openChat() {
  const list = element("ul", undefined, "room-feed chat-feed");
  list.setAttribute("role", "log");
  list.setAttribute("aria-label", "Room messages");
  const form = element("form", undefined, "chat-form");
  const input = element("input");
  input.name = "message";
  input.autocomplete = "off";
  input.placeholder = "Message your group";
  input.maxLength = 300;
  input.required = true;
  input.setAttribute("aria-label", "Message your group");
  const send = element("button", "Send", "primary");
  send.type = "submit";
  const status = element("p", "", "chat-status");
  status.setAttribute("role", "status");
  form.append(input, send, status);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || send.disabled) return;
    send.disabled = true;
    status.textContent = "";
    const sent = await act({ type: "message", text });
    if (sent && input.value.trim() === text) input.value = "";
    if (!sent) status.textContent = "Message couldn’t be sent. Try again.";
    send.disabled = false;
    input.focus();
  });
  openSheet("Room chat", [list, form, button("Back to room", roomMenu, "text-button")], "messages");
  refreshFeed();
}

function links(place, names) {
  return names.flatMap(([field, label]) => {
    if (!place[field]) return [];
    const link = element("a", label, "secondary");
    link.href = place[field];
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return [link];
  });
}

function photoOf(place, className = "") {
  const photo = element("div", undefined, `photo ${className}`);
  const tile = place.photo % 12;
  if (place.photo >= 12) photo.classList.add("outing-photo");
  photo.style.setProperty("--x", `${(tile % 3) * 50}%`);
  photo.style.setProperty("--y", `${Math.floor(tile / 3) * 100 / 3}%`);
  photo.setAttribute("aria-hidden", "true");
  return photo;
}

function details(id) {
  const place = venues[id];
  const tags = element("div", undefined, "tags");
  tags.append(...[place.cuisine, place.vibe, place.price].map((tag) => element("span", tag)));
  const related = links(place, [["menu", "Menu"], ["instagram", "Instagram"], ["website", "Website"], ["reviews", "Maps reviews"]]);
  openSheet(place.name, [
    photoOf(place), element("h2", place.dish), element("p", place.description),
    tags, ...related, element("p", "Sample venue and illustrative photo.", "caption"),
  ]);
}

function cardOf(id) {
  const place = venues[id];
  const card = element("article", undefined, "card");
  const info = element("div", undefined, "card-info");
  const title = element("div");
  title.append(element("h2", place.name), element("p", place.dish));
  info.append(title, button("Details", () => details(id), "text-button details-button"));
  card.append(photoOf(place, "card-photo"), info);
  return card;
}

function swipeOptions(card) {
  const choices = element("div", undefined, "votes");
  const id = view.next;
  const choose = (choice) => act({ type: "vote", place: id, choice });
  for (const [symbol, label, choice] of [["×", "Pass", "pass"], ["★", "Favorite", "favorite"], ["♥", "Like", "like"]]) {
    const choiceButton = button(label, () => choose(choice), `vote ${choice}`);
    const icon = element("span", symbol);
    icon.setAttribute("aria-hidden", "true");
    choiceButton.prepend(icon, " ");
    choices.append(choiceButton);
  }

  card.classList.add("draggable");
  let gesture;
  card.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0 || event.target.closest("button") || busy) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
    card.setPointerCapture(event.pointerId);
  });
  card.addEventListener("pointermove", (event) => {
    if (gesture?.id !== event.pointerId) return;
    const x = event.clientX - gesture.x;
    if (Math.abs(x) > Math.abs(event.clientY - gesture.y)) {
      card.style.transform = `translateX(${Math.max(-60, Math.min(x, 60))}px) rotate(${x / 20}deg)`;
    }
  });
  const reset = () => {
    card.style.transform = "";
    gesture = undefined;
  };
  card.addEventListener("pointerup", (event) => {
    if (gesture?.id !== event.pointerId) return;
    const x = event.clientX - gesture.x;
    const y = event.clientY - gesture.y;
    reset();
    if (Math.abs(x) > 50 && Math.abs(x) > Math.abs(y)) choose(x > 0 ? "like" : "pass");
  });
  card.addEventListener("pointercancel", reset);
  return choices;
}

function panel(title, body) {
  const box = element("section", undefined, "panel");
  box.append(element("h1", title), ...body);
  return box;
}

function peopleList(administrative = false) {
  const list = element("ul", undefined, "people");
  for (const person of view.people) {
    const item = element("li");
    item.append(element("span", person.name));
    if (person.paused) item.append(element("small", "Watching"));
    if (administrative && person.id !== view.people[0].id && !person.paused && view.active > 2
      && ["swipe", "confirm"].includes(view.phase)) {
      item.append(button("Pause vote", () => {
        sheet.close();
        act({ type: "pause", member: person.id });
      }, "text-button"));
    }
    list.append(item);
  }
  return list;
}

function roomMenu() {
  const feeds = element("div", undefined, "room-feed-actions");
  for (const [feed, label, open] of [["messages", "Chat", openChat], ["activity", "Activity", openActivity]]) {
    const control = button(label, open, "secondary");
    control.dataset.feed = feed;
    control.dataset.label = label;
    feeds.append(control);
  }
  const options = [feeds, peopleList(view.host)];
  if (view.phase === "lobby") options.unshift(button("Copy invite link", copyLink));
  if (view.host && view.phase === "confirm" && view.canExtend) {
    options.push(button("Add more sample places", () => {
      sheet.close();
      act({ type: "extend" });
    }, "secondary"));
  }
  openSheet("Group room", options, "room");
  refreshRoomMenu();
}

function showMatches(current) {
  const list = element("ul", undefined, "alternatives");
  for (const id of view.matches.filter((id) => id !== current)) {
    const item = element("li");
    const venue = venues[id];
    const open = button(venue.name, () => details(id));
    open.prepend(photoOf(venue));
    item.append(open);
    list.append(item);
  }
  openSheet("Other matches", [list]);
}

function render() {
  refreshRoomMenu();
  const lastRoom = localStorage.getItem(lastRoomKey);
  rejoinButton.hidden = Boolean(view || roomCode) || !lastRoom || !localStorage.getItem(keyName(lastRoom));
  if (!rejoinButton.hidden) rejoinButton.href = inviteLink(lastRoom);
  outingChip.hidden = !view;
  outingChip.textContent = view ? outingLabels[view.outing] : "";
  screen.replaceChildren();
  if (!view) {
    screen.append(document.querySelector("#home").content.cloneNode(true));
    installButton.hidden = !installPrompt;
    const outing = screen.querySelector("#outing");
    for (const [value, label] of Object.entries(outingLabels)) outing.add(new Option(label, value));
    if (roomCode) {
      screen.querySelector("h1").textContent = "Join your friends.";
      screen.querySelector("#join-submit").textContent = "Join the room →";
      screen.querySelector("#outing-field").hidden = true;
      screen.querySelector(".form-fields").classList.add("joining");
    }
    screen.querySelector("#join-form").addEventListener("submit", join);
    screen.querySelector("#try-demo").addEventListener("click", startDemo);
    return;
  }
  installButton.hidden = true;

  if (view.phase === "lobby") {
    screen.append(panel("Group room", [
      element("p", "Share the link. Start when everyone is here."),
      peopleList(),
      button("Copy invite link", copyLink),
      ...(view.host ? [button("Start swiping", () => act({ type: "start" }), "secondary")] : [
        element("p", "Waiting for the host to start."),
      ]),
    ]));
    if (view.host) screen.querySelector(".secondary").disabled = view.people.length < 2;
    return;
  }

  if (view.notice) screen.append(element("p", view.notice, "notice"));
  if (view.phase === "swipe" && view.next !== null) {
    const heading = element("div", undefined, "heading-row");
    heading.append(element("h1", "Pick your places"), element("span", `${view.swiped + 1} / ${view.total}`, "counter"));
    const progress = element("div", undefined, "progress");
    progress.setAttribute("aria-hidden", "true");
    const fill = element("span");
    fill.style.width = `${(view.swiped + 1) * 100 / view.total}%`;
    progress.append(fill);
    const card = cardOf(view.next);
    screen.append(heading, progress, card, swipeOptions(card));
    if (view.favorite !== null) screen.append(element("p", `★ Your favorite is ${venues[view.favorite].name}`, "caption"));
    return;
  }

  if (view.phase === "swipe") {
    screen.append(panel(view.paused ? "You’re watching" : "Waiting for the group", [
      element("p", view.paused
        ? "You’ll see the group’s pick here. You can vote again next round."
        : "The group pick appears here when everyone finishes."),
    ]));
    return;
  }

  if (view.phase === "empty") {
    screen.append(panel("No match this round", [
      element("p", view.canExtend ? "You can look through more sample places." : "Start another round whenever you’re ready."),
      ...(view.host ? [view.canExtend
        ? button("Add more sample places", () => act({ type: "extend" }))
        : button("Start another round", restart)] : [element("p", "Waiting for the host.")]),
    ]));
    return;
  }

  const heading = element("div", undefined, "heading-row");
  heading.append(element("h1", view.phase === "done" ? "You’re going here" : "Your group pick"));
  screen.append(heading, cardOf(view.proposal));
  const actions = element("section", undefined, "confirm-actions");
  if (view.phase === "done") {
    actions.append(...links(venues[view.proposal], [["directions", "Get directions"], ["booking", "Book a table"]]));
    actions.append(element("p", "Everyone who voted agreed. This is a sample venue.", "caption"));
    if (view.host) actions.append(button("Start another round", restart, "secondary"));
  } else {
    const confirm = (choice) => act({ type: "confirm", place: view.proposal, choice });
    if (view.agreed || view.paused) {
      actions.append(element("p", view.paused ? "You’re watching this round." : "Waiting for the group.", "caption"));
    } else {
      actions.append(
        button("Agree", () => confirm("agree")),
        button("I changed my mind", () => confirm("decline"), "secondary"),
      );
    }
    if (view.matches.length > 1) actions.append(button("See other matches", () => showMatches(view.proposal), "text-button"));
  }
  screen.append(actions);
}

async function request(path, options = {}) {
  const headers = { ...options.headers };
  if (key) headers.Authorization = `Bearer ${key}`;
  if (options.body) headers["Content-Type"] = "application/json";
  const response = await fetch(path, { ...options, headers, cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error), { status: response.status });
  return result;
}

function update(next) {
  if (view && next.revision <= view.revision) return;
  const previous = view;
  const changed = previous && (next.phase !== previous.phase || next.proposal !== previous.proposal);
  view = next;
  if (changed && sheet.open && !["messages", "activity"].includes(sheetMode)) sheet.close();
  const scene = ({ revision, activity, messages, ...visible }) => JSON.stringify(visible);
  if (!previous || scene(previous) !== scene(next)) render();
  refreshFeed();
  refreshRoomMenu();
  if (!previous || demo || sheet.open) return;
  const message = next.messages?.at(-1);
  const activity = next.activity?.at(-1);
  if (message && !message.mine && message.id > (previous.messages?.at(-1)?.id ?? 0)) {
    tell(`${message.sender} sent a message.`);
  } else if (activity && activity.id > (previous.activity?.at(-1)?.id ?? 0)) {
    tell(activity.text);
  }
}

async function join(event) {
  event.preventDefault();
  if (busy) return;
  busy = true;
  const form = event.currentTarget;
  const submit = form.querySelector("button");
  submit.disabled = true;
  const data = new FormData(form);
  const name = data.get("name");
  const outing = data.get("outing");
  try {
    const { key: newKey, view: next } = await request(roomCode ? `./api/rooms/${roomCode}` : "./api/rooms", {
      method: "POST", body: JSON.stringify(roomCode ? { type: "join", name } : { name, outing }),
    });
    key = newKey;
    localStorage.setItem(keyName(next.code), key);
    localStorage.setItem(lastRoomKey, next.code);
    update(next);
    history.replaceState(null, "", inviteLink());
    screen.focus();
  } catch (error) {
    tell(error.status ? error.message : "Could not connect. Try again or open the solo demo.");
  } finally {
    busy = false;
    submit.disabled = false;
  }
}

function startDemo() {
  const host = member("solo", "You");
  const outing = demo?.room.outing ?? screen.querySelector("#outing")?.value ?? "any";
  const deck = deckFor(outing);
  const room = createRound(host, outing);
  room.members.push(member("friend-1", "Sam"), member("friend-2", "Jo"));
  applyAction(room, host, { type: "start" });
  room.order = deck.slice(0, 12);
  const liked = new Set(deck.filter((_, index) => index % 4 !== 3));
  for (const [index, friend] of room.members.slice(1).entries()) {
    friend.votes = Object.fromEntries(deck.map((id) => [id, liked.has(id) ? "like" : "pass"]));
    friend.favorite = deck[index * 2];
  }
  demo = { room, host };
  view = viewOf(room, host, "demo", 0);
  render();
  screen.focus();
}

const restart = () => demo ? startDemo() : act({ type: "restart" });

async function act(action) {
  if (busy) return false;
  busy = true;
  const subject = action.type === "vote" && action.choice === "favorite" ? venues[action.place] : null;
  const previousFavorite = view.favorite;
  try {
    let next;
    if (demo) {
      applyAction(demo.room, demo.host, action);
      if (action.type === "confirm" && action.choice === "agree" && demo.room.phase === "confirm") {
        for (const friend of demo.room.members.slice(1)) {
          applyAction(demo.room, friend, action);
        }
      }
      next = viewOf(demo.room, demo.host, "demo", view.revision + 1);
    } else {
      ({ view: next } = await request(`./api/rooms/${view.code}`, { method: "POST", body: JSON.stringify(action) }));
    }
    update(next);
    if (subject) tell(previousFavorite === null ? `Favorite set to ${subject.name}` : `Favorite moved to ${subject.name}`);
    return true;
  } catch (error) {
    tell(error.status ? error.message : "Could not save your action. Try again.");
    return false;
  } finally {
    busy = false;
  }
}

async function refresh() {
  if (demo || busy || polling || document.hidden || !key) return;
  const code = view?.code ?? roomCode;
  if (!code) return;
  polling = true;
  try {
    const { view: next } = await request(`./api/rooms/${code}`);
    localStorage.setItem(lastRoomKey, code);
    update(next);
  } catch (error) {
    if (error.status === 401 || error.status === 404) {
      localStorage.removeItem(keyName(code));
      if (localStorage.getItem(lastRoomKey) === code) localStorage.removeItem(lastRoomKey);
      key = null;
      view = undefined;
      if (sheet.open) sheet.close();
      render();
      tell(error.message);
    }
  } finally {
    polling = false;
  }
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = Boolean(view);
});
installButton.addEventListener("click", async () => {
  if (!installPrompt) return;
  const prompt = installPrompt;
  installPrompt = undefined;
  installButton.hidden = true;
  await prompt.prompt();
});
menuButton.addEventListener("click", roomMenu);
document.addEventListener("keydown", (event) => {
  if (sheet.open || view?.phase !== "swipe" || view.next === null || event.repeat) return;
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  act({ type: "vote", place: view.next, choice: event.key === "ArrowLeft" ? "pass" : "like" });
});
window.addEventListener("offline", () => {
  if (!demo) tell("You’re offline. The solo demo is still available from home.");
});
window.addEventListener("online", refresh);
document.addEventListener("visibilitychange", refresh);

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
render();
refresh();
setInterval(refresh, 1700);
