export const outingLabels = { any: "Anything", coffee: "Coffee", brunch: "Brunch", lunch: "Lunch", dinner: "Dinner", drinks: "Drinks" };
const decks = {
  any: [0, 1, 2, 18, 11, 3, 24, 4, 19, 5, 25, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 20, 21, 22, 23, 26, 27, 28, 29],
  coffee: [23, 21, 22, 18],
  brunch: [18, 19, 20, 21, 22, 23],
  lunch: [0, 1, 2, 4, 6, 7, 8, 10, 19, 20, 21, 23],
  dinner: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16],
  drinks: [11, 24, 25, 26, 27, 28, 29, 17],
};
export const deckFor = (outing) => decks[outing ?? "any"];
const available = (round) => deckFor(round.outing).filter((id) => !round.order.includes(id));

export class RoundError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.status = status;
  }
}

export function shuffle(ids) {
  const result = [...ids];
  for (let end = result.length - 1; end > 0; end--) {
    const random = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
    const pick = Math.floor(random * (end + 1));
    [result[end], result[pick]] = [result[pick], result[end]];
  }
  return result;
}

export function member(id, name, tokenHash) {
  return { id, name, tokenHash, paused: false, votes: {}, favorite: null, agreed: false };
}

export function createRound(host, outing = "any") {
  return {
    host: host.id, members: [host], outing, phase: "lobby", order: [],
    shortlist: [], rejected: [], proposal: null, notice: "", extended: false,
    messages: [], activity: [],
  };
}

const voters = (round) => round.members.filter((person) => !person.paused);
const finished = (round, person) => round.order.every((id) => Object.hasOwn(person.votes, id));

function appendTo(list, item) {
  list.push({ id: (list.at(-1)?.id ?? 0) + 1, time: Date.now(), ...item });
  if (list.length > 50) list.shift();
}

export function recordActivity(round, text) {
  appendTo(round.activity ??= [], { text });
}

function advanceProposal(round) {
  for (const person of round.members) person.agreed = false;
  round.proposal = round.shortlist[0] ?? null;
  round.phase = round.proposal === null ? "empty" : "confirm";
  if (round.phase === "confirm") recordActivity(round, "A group pick is ready to confirm.");
}

function settle(round) {
  const active = voters(round);
  if (round.phase === "confirm" && active.every((person) => person.agreed)) {
    round.phase = "done";
    recordActivity(round, "The group agreed on a place.");
  }
  if (round.phase !== "swipe" || !active.every((person) => finished(round, person))) return;

  const weight = (id) => active.filter((person) => person.favorite === id).length;
  round.shortlist = round.order
    .filter((id) => !round.rejected.includes(id) && active.every((person) => person.votes[id] === "like"))
    .sort((first, second) => weight(second) - weight(first));
  advanceProposal(round);
}

export function applyAction(round, person, action) {
  const host = person.id === round.host;
  if (action.type === "message") {
    const text = typeof action.text === "string" ? action.text.trim() : "";
    if (!text || text.length > 300) throw new RoundError("Enter a message up to 300 characters.", 400);
    appendTo(round.messages ??= [], { text, sender: person.name, memberId: person.id });
    return;
  }
  if (action.type === "vote") {
    if (round.phase !== "swipe" || person.paused) throw new RoundError("Voting has closed.");
    const next = round.order.find((id) => !Object.hasOwn(person.votes, id));
    if (action.place !== next || !["like", "pass", "favorite"].includes(action.choice)) {
      throw new RoundError("The card has changed. Try the current card.");
    }
    person.votes[next] = action.choice === "pass" ? "pass" : "like";
    if (action.choice === "favorite") person.favorite = next;
    settle(round);
    return;
  }
  if (action.type === "confirm") {
    if (round.phase !== "confirm" || person.paused || person.agreed || action.place !== round.proposal) {
      throw new RoundError("This pick is no longer open for your vote.");
    }
    if (action.choice === "agree") {
      person.agreed = true;
      settle(round);
    } else if (action.choice === "decline") {
      round.rejected.push(round.proposal);
      round.shortlist.shift();
      round.notice = "Someone changed their mind.";
      recordActivity(round, round.notice);
      advanceProposal(round);
    } else {
      throw new RoundError("Choose Agree or I changed my mind.", 400);
    }
    return;
  }
  if (!host) throw new RoundError("The host controls the round.", 403);
  switch (action.type) {
    case "start":
      if (round.phase !== "lobby" || round.members.length < 2) {
        throw new RoundError("Invite at least one friend to start.");
      }
      round.order = shuffle(deckFor(round.outing)).slice(0, 12);
      round.phase = "swipe";
      recordActivity(round, "Swiping is open.");
      break;
    case "pause": {
      if (!["swipe", "confirm"].includes(round.phase) || voters(round).length <= 2) {
        throw new RoundError("At least two people need to keep voting.");
      }
      const target = round.members.find((candidate) => candidate.id === action.member && candidate.id !== round.host);
      if (!target || target.paused) throw new RoundError("This person is already watching.");
      target.paused = true;
      round.notice = "A friend is watching this round.";
      settle(round);
      break;
    }
    case "extend":
      if (!["empty", "confirm"].includes(round.phase) || round.extended || !available(round).length) {
        throw new RoundError("All sample places have been shown.");
      }
      round.order.push(...shuffle(available(round)).slice(0, 6));
      round.extended = true;
      round.phase = "swipe";
      round.proposal = null;
      round.shortlist = [];
      round.notice = "";
      for (const voter of round.members) voter.agreed = false;
      break;
    case "restart":
      if (!["done", "empty"].includes(round.phase)) throw new RoundError("This round is still open.");
      Object.assign(round, createRound(round.members[0], round.outing), {
        members: round.members.map(({ id, name, tokenHash }) => member(id, name, tokenHash)),
        activity: round.activity ?? [],
        messages: round.messages ?? [],
      });
      recordActivity(round, "The host opened another round.");
      break;
    default:
      throw new RoundError("Unknown round action.", 400);
  }
}

export function viewOf(round, person, code, revision) {
  const active = voters(round);
  return {
    code, revision, phase: round.phase, host: round.host === person.id, outing: round.outing ?? "any",
    name: person.name, paused: person.paused,
    people: round.members.map(({ id, name, paused }) => ({ id, name, paused })),
    active: active.length,
    swiped: Object.keys(person.votes).length, total: round.order.length,
    next: round.phase === "swipe" && !person.paused
      ? round.order.find((id) => !Object.hasOwn(person.votes, id)) ?? null : null,
    favorite: person.favorite, agreed: person.agreed, proposal: round.proposal,
    matches: round.shortlist.slice(0, 3), notice: round.notice,
    canExtend: !round.extended && available(round).length > 0,
    activity: round.activity ?? [],
    messages: (round.messages ?? []).map(({ memberId, ...message }) => ({ ...message, mine: memberId === person.id })),
  };
}
