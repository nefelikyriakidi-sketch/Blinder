import { applyAction, createRound, deckFor, member, outingLabels, viewOf } from "./round.js";
import { venues } from "./venues.js";

const screen = document.querySelector("#screen");
const menuButton = document.querySelector("#room-menu");
const friendsButton = document.querySelector("#friends-menu");
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
let account;
let accountPolling = false;
let accountWriting = false;
let accountVersion = 0;
let checkedRoom;
const sentInvites = new Set();

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

async function shareInvite() {
  try {
    await navigator.share({ title: view.title || "Join my Blinder room", url: inviteLink() });
  } catch (error) {
    if (error.name !== "AbortError") await copyLink();
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
const accountUnread = () => (account?.invites ?? []).filter(invite => !invite.joined).length
  + (account?.friends ?? []).filter(friend => !friend.accepted && !friend.sent).length;

function badge(control, label, count) {
  control.replaceChildren(label);
  control.setAttribute("aria-label", count ? `${label}, ${count} unread updates` : label);
  if (count) control.append(element("span", String(count), "unread-count"));
}

function refreshRoomMenu() {
  friendsButton.hidden = Boolean(view);
  badge(friendsButton, "Friends", accountUnread());
  menuButton.hidden = !view || Boolean(demo);
  if (!view || demo) return;
  badge(menuButton, `Room · ${view.people.length}`, unread("messages") + unread("activity") + accountUnread());
  if (sheetMode === "room" && sheet.open) {
    sheetTitle.textContent = view.title || "Group room";
    for (const control of sheetBody.querySelectorAll("[data-feed]")) {
      const unseen = unread(control.dataset.feed);
      control.textContent = unseen ? `${control.dataset.label} · ${unseen}` : control.dataset.label;
    }
  }
}

function pageLink(label, href, className = "primary") {
  const link = element("a", label, className);
  link.href = href;
  return link;
}

function signInLink() {
  const current = new URL(location.href);
  current.searchParams.set("friends", "1");
  const link = pageLink("Sign in with ChatGPT",
    `/signin-with-chatgpt?return_to=${encodeURIComponent(current.pathname + current.search)}`);
  link.target = "_top";
  return link;
}

function entryForm(label, hint, maxLength, submitLabel, submit, value = "") {
  const form = element("form", undefined, "entry-form");
  const field = element("label", label);
  const input = element("input");
  input.name = "value";
  input.placeholder = hint;
  input.maxLength = maxLength;
  input.required = true;
  input.value = value;
  field.append(input);
  const submitButton = element("button", submitLabel, "primary");
  submitButton.type = "submit";
  form.append(field, submitButton);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || submitButton.disabled) return;
    submitButton.disabled = true;
    try {
      await submit(text);
    } finally {
      submitButton.disabled = false;
    }
  });
  return form;
}

function renameRoom() {
  const form = entryForm("Room name", "e.g. Alex’s birthday", 48, "Save room name", async title => {
    if (await act({ type: "rename", title })) sheet.close();
    else accountStatus("Could not save the room name. Try again.");
  }, view.title);
  openSheet("Name your room", [form]);
}

const accountStatus = (message) => {
  let status = sheetBody.querySelector(".account-status");
  if (!status) {
    status = element("p", "", "account-status");
    status.setAttribute("role", "status");
    sheetBody.append(status);
  }
  status.textContent = message;
};

async function accountAction(action) {
  if (accountWriting) return false;
  accountWriting = true;
  accountVersion++;
  try {
    account = await request("./api/account", { method: "POST", body: JSON.stringify(action) });
    refreshRoomMenu();
    return true;
  } catch (error) {
    accountStatus(error.status ? error.message : "Could not reach Blinder. Try again.");
    return false;
  } finally {
    accountWriting = false;
  }
}

function friendsMenu() {
  const title = "Friends & invites";
  if (!account?.signedIn) {
    openSheet(title, [
      element("p", "Sign in so your friends and invites follow you across devices. Friends see the Blinder username you choose."),
      signInLink(),
    ], "friends");
    return;
  }
  const signOut = pageLink("Sign out", "/signout-with-chatgpt?return_to=%2F", "text-button");
  signOut.target = "_top";
  if (!account.handle) {
    openSheet(title, [
      element("p", "Choose a username friends can use to find you."),
      entryForm("Blinder username", "e.g. alex", 20, "Save username", async handle => {
        if (await accountAction({ type: "profile", handle })) friendsMenu();
      }),
      signOut,
    ], "friends");
    return;
  }
  const contents = [element("p", `You’re @${account.handle}.`)];
  if (account.invites.length) {
    const invites = element("ul", undefined, "people account-list");
    for (const invite of account.invites) {
      const row = element("li");
      const label = element("div");
      label.append(element("strong", invite.title || "Group room"), element("p", `From @${invite.sender}`));
      const options = element("div", undefined, "account-actions");
      options.append(pageLink(invite.joined ? "Open room" : "Join room", inviteLink(invite.code), "text-button"));
      if (!invite.joined) options.append(button("Dismiss", async () => {
        if (await accountAction({ type: "dismiss-invite", code: invite.code })) friendsMenu();
      }, "text-button"));
      row.append(label, options);
      invites.append(row);
    }
    contents.push(element("h3", "Room invites"), invites);
  }
  if (account.friends.length) {
    const people = element("ul", undefined, "people account-list");
    for (const friend of account.friends) {
      const row = element("li");
      const label = element("div");
      const labelText = friend.accepted ? "Friend" : friend.sent ? "Request sent" : "Wants to connect";
      label.append(element("strong", `@${friend.handle}`), element("p", labelText));
      const options = element("div", undefined, "account-actions");
      if (!friend.accepted && !friend.sent) options.append(button("Accept", async () => {
        if (await accountAction({ type: "accept-friend", handle: friend.handle })) friendsMenu();
      }, "text-button"));
      options.append(button(friend.accepted ? "Remove" : friend.sent ? "Cancel" : "Decline", async () => {
        if (await accountAction({ type: "remove-friend", handle: friend.handle })) friendsMenu();
      }, "text-button"));
      row.append(label, options);
      people.append(row);
    }
    contents.push(element("h3", "Friends"), people);
  }
  contents.push(entryForm("Friend’s username", "e.g. @alex", 21, "Send friend request", async handle => {
    if (await accountAction({ type: "add-friend", handle })) friendsMenu();
  }), signOut);
  openSheet(title, contents, "friends");
}

function inviteFriends() {
  if (!account?.handle) {
    friendsMenu();
    return;
  }
  const friends = account.friends.filter(friend => friend.accepted);
  const contents = [];
  if (friends.length) {
    const list = element("ul", undefined, "people");
    for (const friend of friends) {
      const row = element("li");
      const inviteId = `${view.code}/${friend.handle}`;
      const send = button(sentInvites.has(inviteId) ? "Invited" : "Invite", async () => {
        send.disabled = true;
        if (await accountAction({ type: "invite", handle: friend.handle, code: view.code })) {
          sentInvites.add(inviteId);
          send.textContent = "Invited";
        } else {
          send.disabled = false;
        }
      }, "text-button");
      send.disabled = sentInvites.has(inviteId);
      row.append(element("span", `@${friend.handle}`), send);
      list.append(row);
    }
    contents.push(list);
  } else {
    contents.push(element("p", "Add a friend by their Blinder username. You can invite them after they accept."));
  }
  contents.push(button("Friends & invites", friendsMenu, "secondary"));
  openSheet("Invite friends", contents, "invite-friends");
}

function inviteControls() {
  const controls = [];
  if (navigator.share) controls.push(button("Share invite", shareInvite));
  controls.push(button("Copy invite link", copyLink, navigator.share ? "secondary" : "primary"));
  if (view.host) controls.push(button("Invite friends", inviteFriends, "secondary"));
  return controls;
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
  const options = [feeds, peopleList(view.host), button("Friends & invites", friendsMenu, "text-button")];
  if (view.phase === "lobby") {
    options.unshift(...inviteControls());
    if (view.host) options.push(button("Rename room", renameRoom, "text-button"));
  }
  if (view.host && view.phase === "confirm" && view.canExtend) {
    options.push(button("Add more sample places", () => {
      sheet.close();
      act({ type: "extend" });
    }, "secondary"));
  }
  openSheet(view.title || "Group room", options, "room");
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
    screen.querySelector("#nickname").value = account?.handle ?? "";
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
    const canStart = view.people.length >= 2;
    const hint = element("p", canStart ? "Start when everyone is here." : "Waiting for a friend to join. Start swiping turns on when someone joins.");
    hint.id = "lobby-start-hint";
    const start = button("Start swiping", () => act({ type: "start" }), "secondary");
    start.disabled = !canStart;
    start.setAttribute("aria-describedby", hint.id);
    screen.append(panel(view.title || "Group room", [
      ...(view.host ? [button(view.title ? "Rename room" : "Name room", renameRoom, "text-button room-name-button"), hint] : []),
      peopleList(),
      ...inviteControls(),
      ...(view.host ? [start] : [
        element("p", "Waiting for the host to start."),
      ]),
    ]));
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
    if (newKey) {
      key = newKey;
      localStorage.setItem(keyName(next.code), key);
    }
    checkedRoom = null;
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
  if (demo || busy || polling || document.hidden) return;
  const code = view?.code ?? roomCode;
  if (!code || !key && (!account?.signedIn || checkedRoom === code)) return;
  polling = true;
  try {
    const { view: next } = await request(`./api/rooms/${code}`);
    localStorage.setItem(lastRoomKey, code);
    update(next);
  } catch (error) {
    if (error.status === 401 || error.status === 404) {
      checkedRoom = code;
      localStorage.removeItem(keyName(code));
      if (localStorage.getItem(lastRoomKey) === code) localStorage.removeItem(lastRoomKey);
      key = null;
      view = undefined;
      if (sheet.open) sheet.close();
      render();
      if (error.status === 404) tell(error.message);
    }
  } finally {
    polling = false;
  }
}

async function refreshAccount() {
  if (document.hidden || accountPolling || accountWriting) return;
  const version = accountVersion;
  const previouslyLoaded = Boolean(account);
  accountPolling = true;
  try {
    const next = await request("./api/account");
    if (version !== accountVersion) return;
    const changed = JSON.stringify(next) !== JSON.stringify(account);
    const alerted = accountUnread();
    account = next;
    refreshRoomMenu();
    if (changed && accountUnread() > alerted && previouslyLoaded && !sheet.open) tell("You have a new update in Friends.");
    const url = new URL(location.href);
    if (url.searchParams.has("friends")) {
      url.searchParams.delete("friends");
      history.replaceState(null, "", url);
      friendsMenu();
    } else if (changed && sheet.open && sheetMode === "friends" && !sheetBody.querySelector("input")?.value) {
      friendsMenu();
    }
    const nicknameInput = screen.querySelector("#nickname");
    if (nicknameInput && !nicknameInput.value && account.handle) nicknameInput.value = account.handle;
    if (account.signedIn) refresh();
  } catch {
    // The guest lobby and solo demo can open without loading a profile.
  } finally {
    accountPolling = false;
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
friendsButton.addEventListener("click", friendsMenu);
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
document.addEventListener("visibilitychange", refreshAccount);

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
render();
refresh();
refreshAccount();
setInterval(refresh, 1700);
setInterval(() => {
  if (account?.signedIn) refreshAccount();
}, 10000);
