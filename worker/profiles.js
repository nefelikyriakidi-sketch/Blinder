import { RoundError } from "../dist/round.js";

export function accountOf(request) {
  const id = request.headers.get("oai-authenticated-user-id");
  return id && request.headers.get("oai-authenticated-user-email") ? id : null;
}

function handleOf(value) {
  const handle = typeof value === "string" ? value.trim().toLowerCase().replace(/^@/, "") : "";
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
    throw new RoundError("Use 3–20 letters, numbers or underscores for a username.", 400);
  }
  return handle;
}

const pairOf = (first, second) => [first, second].sort();
const profileOf = (db, id) => db.prepare("SELECT handle FROM profiles WHERE account_id = ?").bind(id).first();

async function accountView(db, id) {
  if (!id) return { signedIn: false };
  const profile = await profileOf(db, id);
  if (!profile) return { signedIn: true, handle: null };
  const [people, rooms] = await Promise.all([
    db.prepare(`
      SELECT p.handle, f.accepted, f.requester_id = ? AS sent
      FROM friendships f
      JOIN profiles p ON p.account_id = CASE WHEN f.first_id = ? THEN f.second_id ELSE f.first_id END
      WHERE f.first_id = ? OR f.second_id = ?
      ORDER BY p.handle
    `).bind(id, id, id, id).all(),
    db.prepare(`
      SELECT i.code, p.handle AS sender, json_extract(r.state, '$.title') AS title,
             json_extract(r.state, '$.outing') AS outing,
             EXISTS (SELECT 1 FROM json_each(r.state, '$.members') m
                     WHERE json_extract(m.value, '$.accountId') = ?) AS joined
      FROM room_invites i
      JOIN profiles p ON p.account_id = i.sender_id
      JOIN rooms r ON r.code = i.code
      JOIN friendships f ON f.first_id = min(i.sender_id, i.recipient_id)
        AND f.second_id = max(i.sender_id, i.recipient_id) AND f.accepted = 1
      WHERE i.recipient_id = ? AND i.dismissed = 0 AND r.expires_at > ?
      AND (json_extract(r.state, '$.phase') = 'lobby' OR EXISTS (
        SELECT 1 FROM json_each(r.state, '$.members') m
        WHERE json_extract(m.value, '$.accountId') = ?))
      ORDER BY i.created_at DESC
      LIMIT 30
    `).bind(id, id, Date.now(), id).all(),
  ]);
  return { signedIn: true, handle: profile.handle, friends: people.results, invites: rooms.results };
}

async function setProfile(db, id, value) {
  const handle = handleOf(value);
  const result = await db.prepare(`
    INSERT INTO profiles (account_id, handle) VALUES (?, ?)
    ON CONFLICT DO NOTHING
  `).bind(id, handle).run();
  if (result.meta.changes) return;
  const profile = await profileOf(db, id);
  if (!profile || profile.handle !== handle) throw new RoundError("That username is already in use.");
}

async function contact(db, id, value) {
  const handle = handleOf(value);
  const found = await db.prepare("SELECT account_id FROM profiles WHERE handle = ?").bind(handle).first();
  if (!found || found.account_id === id) throw new RoundError("Enter your friend’s Blinder username.", 404);
  return found.account_id;
}

async function changeFriendship(db, id, other, type) {
  const [first, second] = pairOf(id, other);
  if (type === "add-friend") {
    await db.prepare(`
      INSERT INTO friendships (first_id, second_id, requester_id) VALUES (?, ?, ?)
      ON CONFLICT DO NOTHING
    `).bind(first, second, id).run();
  } else if (type === "accept-friend") {
    const result = await db.prepare(`
      UPDATE friendships SET accepted = 1
      WHERE first_id = ? AND second_id = ? AND requester_id = ? AND accepted = 0
    `).bind(first, second, other).run();
    if (!result.meta.changes) throw new RoundError("This request is no longer waiting.");
  } else {
    await db.prepare("DELETE FROM friendships WHERE first_id = ? AND second_id = ?")
      .bind(first, second).run();
  }
}

async function inviteFriend(db, request, id, other, code, hash) {
  if (typeof code !== "string" || !/^[a-f0-9]{12}$/.test(code)) throw new RoundError("Select an active room.", 400);
  const hostKey = request.headers.get("Authorization")?.match(/^Bearer ([a-f0-9]{32})$/)?.[1];
  const row = await db.prepare("SELECT state FROM rooms WHERE code = ? AND expires_at > ?")
    .bind(code, Date.now()).first();
  const room = row ? JSON.parse(row.state) : null;
  const host = room?.members.find(person => person.id === room.host);
  if (!host || !(host.accountId === id || hostKey && host.tokenHash === await hash(hostKey))) {
    throw new RoundError("Only the host can send this invite.", 403);
  }
  if (room.phase !== "lobby") throw new RoundError("Send invites while the room is in the lobby.");

  const [first, second] = pairOf(id, other);
  const accepted = await db.prepare(`
    SELECT accepted FROM friendships WHERE first_id = ? AND second_id = ?
  `).bind(first, second).first();
  if (!accepted?.accepted) throw new RoundError("Your friend needs to accept your request first.", 403);
  if (room.members.some(person => person.accountId === other)) return;
  await db.prepare(`
    INSERT INTO room_invites (code, recipient_id, sender_id, created_at)
    SELECT r.code, ?, ?, ? FROM rooms r
    JOIN friendships f ON f.first_id = ? AND f.second_id = ? AND f.accepted = 1
    WHERE r.code = ? AND r.expires_at > ? AND json_extract(r.state, '$.phase') = 'lobby'
    ON CONFLICT DO NOTHING
  `).bind(other, id, Date.now(), first, second, code, Date.now()).run();
}

export async function handleAccount(request, db, { bodyOf, hash, json }) {
  const id = accountOf(request);
  if (request.method === "GET") return json(await accountView(db, id));
  if (request.method !== "POST") throw new RoundError("Account action not found.", 404);
  if (!id) throw new RoundError("Sign in to use Friends & invites.", 401);
  const action = await bodyOf(request);
  if (action.type === "profile") {
    await setProfile(db, id, action.handle);
  } else {
    if (!await profileOf(db, id)) throw new RoundError("Choose a Blinder username first.");
    if (["add-friend", "accept-friend", "remove-friend"].includes(action.type)) {
      await changeFriendship(db, id, await contact(db, id, action.handle), action.type);
    } else if (action.type === "invite") {
      await inviteFriend(db, request, id, await contact(db, id, action.handle), action.code, hash);
    } else if (action.type === "dismiss-invite") {
      await db.prepare("UPDATE room_invites SET dismissed = 1 WHERE code = ? AND recipient_id = ?")
        .bind(typeof action.code === "string" ? action.code : "", id).run();
    } else {
      throw new RoundError("Unknown account action.", 400);
    }
  }
  return json(await accountView(db, id));
}
