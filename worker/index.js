import { RoundError, applyAction, createRound, member, outingLabels, recordActivity, viewOf } from "../dist/round.js";

const ROOM_LIFETIME = 24 * 60 * 60 * 1000;
const MAX_MEMBERS = 12;
const token = () => crypto.randomUUID().replaceAll("-", "");

function json(value, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

function nickname(value) {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name.length > 24) throw new RoundError("Enter a nickname up to 24 characters.", 400);
  return name;
}

async function hash(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function makeMember(name) {
  const key = token();
  return { key, person: member(token().slice(0, 12), nickname(name), await hash(key)) };
}

async function bodyOf(request) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) throw new RoundError("Open Blinder to vote.", 403);
  if (!request.headers.get("Content-Type")?.startsWith("application/json")) {
    throw new RoundError("Send a JSON request.", 415);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new RoundError("Send an action.", 400);
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 2048) {
      await reader.cancel();
      throw new RoundError("This request is too large.", 413);
    }
    text += decoder.decode(value, { stream: true });
  }
  try {
    const value = JSON.parse(text + decoder.decode());
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
  } catch {
    // Return the same response for malformed and unsupported bodies.
  }
  throw new RoundError("Invalid action.", 400);
}

async function handleApi(request, db, context) {
  if (!db) throw new RoundError("Shared rooms are temporarily unavailable. You can still try the solo demo.", 503);
  const path = new URL(request.url).pathname;

  if (path === "/api/rooms" && request.method === "POST") {
    const body = await bodyOf(request);
    const outing = body.outing ?? "any";
    if (typeof outing !== "string" || !Object.hasOwn(outingLabels, outing)) {
      throw new RoundError("Choose a supported outing.", 400);
    }
    const { key, person } = await makeMember(body.name);
    const room = createRound(person, outing);
    const code = token().slice(0, 12);
    const now = Date.now();
    await db.prepare("INSERT INTO rooms (code, expires_at, state) VALUES (?, ?, ?)")
      .bind(code, now + ROOM_LIFETIME, JSON.stringify(room)).run();
    context.waitUntil(db.prepare("DELETE FROM rooms WHERE expires_at < ?").bind(now).run().catch(() => {}));
    return json({ key, view: viewOf(room, person, code, 0) }, 201);
  }

  const match = path.match(/^\/api\/rooms\/([a-f0-9]{12})$/);
  if (!match || !["GET", "POST"].includes(request.method)) throw new RoundError("Room not found.", 404);
  const code = match[1];
  const action = request.method === "POST" ? await bodyOf(request) : null;
  const joining = action?.type === "join";
  const invite = joining ? await makeMember(action.name) : null;
  const authorization = request.headers.get("Authorization") ?? "";
  const key = authorization.match(/^Bearer ([a-f0-9]{32})$/)?.[1];
  if (!joining && !key) throw new RoundError("Join this room to continue.", 401);
  const tokenHash = key ? await hash(key) : null;

  for (let attempt = 0; attempt < 8; attempt++) {
    const row = await db.prepare("SELECT revision, state FROM rooms WHERE code = ? AND expires_at > ?")
      .bind(code, Date.now()).first();
    if (!row) throw new RoundError("This room is unavailable or has expired.", 404);
    const room = JSON.parse(row.state);
    let person;
    if (joining) {
      if (room.phase !== "lobby") throw new RoundError("The round has already started.");
      if (room.members.length >= MAX_MEMBERS) throw new RoundError("This room is full.");
      person = invite.person;
      room.members.push(person);
      recordActivity(room, `${person.name} joined the room.`);
    } else {
      person = room.members.find((candidate) => candidate.tokenHash === tokenHash);
      if (!person) throw new RoundError("Join this room to continue.", 401);
      if (!action) return json({ view: viewOf(room, person, code, row.revision) });
      applyAction(room, person, action);
    }

    const saved = await db.prepare("UPDATE rooms SET state = ?, revision = revision + 1 WHERE code = ? AND revision = ?")
      .bind(JSON.stringify(room), code, row.revision).run();
    if (saved.meta.changes) {
      return json({ ...(joining ? { key: invite.key } : {}), view: viewOf(room, person, code, row.revision + 1) });
    }
  }

  throw new RoundError("The room is busy. Try again.", 409);
}

export function createWorker(assets) {
  const decoded = new Map();
  return {
    async fetch(request, env, context) {
      const { pathname } = new URL(request.url);
      if (pathname.startsWith("/api/")) {
        try {
          return await handleApi(request, env.DB, context);
        } catch (error) {
          if (error instanceof RoundError) return json({ error: error.message }, error.status);
          return json({ error: "Could not reach the room. Try again." }, 503);
        }
      }

      const path = pathname === "/" ? "/index.html" : pathname;
      const asset = Object.hasOwn(assets, path) ? assets[path] : null;
      if (!asset || !["GET", "HEAD"].includes(request.method)) {
        return new Response("Not found", { status: 404 });
      }
      const [type, bytes] = asset;
      if (request.method === "GET" && !decoded.has(path)) {
        const binary = atob(bytes);
        const buffer = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index++) buffer[index] = binary.charCodeAt(index);
        decoded.set(path, buffer);
      }
      return new Response(request.method === "HEAD" ? null : decoded.get(path), {
        headers: {
          "Content-Type": type,
          "Cache-Control": "public, max-age=0, must-revalidate",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
        },
      });
    },
  };
}
