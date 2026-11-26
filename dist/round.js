export const openingDeck = Array.from({ length: 12 }, (_, id) => id);
export const extraDeck = Array.from({ length: 6 }, (_, id) => 12 + id);

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

export function createRound(host) {
  return {
    host: host.id, members: [host], phase: "lobby", order: [],
    shortlist: [], rejected: [], proposal: null, notice: "", extended: false,
  };
}

const voters = (round) => round.members.filter((person) => !person.paused);
const finished = (round, person) => round.order.every((id) => Object.hasOwn(person.votes, id));

function advanceProposal(round) {
  for (const person of round.members) person.agreed = false;
  round.proposal = round.shortlist[0] ?? null;
  round.phase = round.proposal === null ? "empty" : "confirm";
}

function settle(round) {
  const active = voters(round);
  if (round.phase === "confirm" && active.every((person) => person.agreed)) {
    round.phase = "done";
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
      round.order = shuffle(openingDeck);
      round.phase = "swipe";
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
      if (!["empty", "confirm"].includes(round.phase) || round.extended) {
        throw new RoundError("All sample places have been shown.");
      }
      round.order.push(...shuffle(extraDeck));
      round.extended = true;
      round.phase = "swipe";
      round.proposal = null;
      round.shortlist = [];
      round.notice = "";
      for (const voter of round.members) voter.agreed = false;
      break;
    case "restart":
      if (!["done", "empty"].includes(round.phase)) throw new RoundError("This round is still open.");
      Object.assign(round, createRound(round.members[0]), {
        members: round.members.map(({ id, name, tokenHash }) => member(id, name, tokenHash)),
      });
      break;
    default:
      throw new RoundError("Unknown round action.", 400);
  }
}

export function viewOf(round, person, code, revision) {
  const active = voters(round);
  return {
    code, revision, phase: round.phase, host: round.host === person.id,
    name: person.name, paused: person.paused,
    people: round.members.map(({ id, name, paused }) => ({ id, name, paused })),
    active: active.length,
    swiped: Object.keys(person.votes).length, total: round.order.length,
    next: round.phase === "swipe" && !person.paused
      ? round.order.find((id) => !Object.hasOwn(person.votes, id)) ?? null : null,
    favorite: person.favorite, agreed: person.agreed, proposal: round.proposal,
    matches: round.shortlist.slice(0, 3), notice: round.notice, canExtend: !round.extended,
  };
}
