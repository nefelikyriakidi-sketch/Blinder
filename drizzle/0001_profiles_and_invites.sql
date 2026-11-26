CREATE TABLE profiles (
    account_id TEXT PRIMARY KEY NOT NULL,
    handle TEXT NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE friendships (
    first_id TEXT NOT NULL REFERENCES profiles(account_id) ON DELETE CASCADE,
    second_id TEXT NOT NULL REFERENCES profiles(account_id) ON DELETE CASCADE,
    requester_id TEXT NOT NULL REFERENCES profiles(account_id) ON DELETE CASCADE,
    accepted INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (first_id, second_id),
    CHECK (first_id < second_id),
    CHECK (requester_id = first_id OR requester_id = second_id)
);
--> statement-breakpoint
CREATE INDEX friendships_by_second ON friendships (second_id);
--> statement-breakpoint
CREATE TABLE room_invites (
    code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
    recipient_id TEXT NOT NULL REFERENCES profiles(account_id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL REFERENCES profiles(account_id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    dismissed INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (code, recipient_id)
);
--> statement-breakpoint
CREATE INDEX room_invites_by_recipient ON room_invites (recipient_id, created_at DESC);
