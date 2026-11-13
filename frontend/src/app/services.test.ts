import test from "node:test";
import assert from "node:assert/strict";
import { makeDemoServices } from "../services/demo.ts";
import { createSeed } from "./seed.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
function fake() {
  const calls: { name: string; args: unknown }[] = [];
  let fail = false;
  let uploadCount = 0;
  const client = {
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return {
        data: name === "demo_state" ? createSeed("2026-11-05") : null,
        error: fail ? { message: "connection interrupted" } : null,
      };
    },
    auth: {
      getUser: async () => ({ data: { user: { id: "eric" } }, error: null }),
    },
    storage: {
      from: () => ({
        upload: async () => {
          uploadCount++;
          return { error: null };
        },
        createSignedUrl: async (p: string) => ({
          data: { signedUrl: "https://images.example/" + p },
          error: null,
        }),
      }),
    },
  };
  return {
    service: makeDemoServices(client as unknown as SupabaseClient),
    calls,
    setFail: (value: boolean) => {
      fail = value;
    },
    uploads: () => uploadCount,
  };
}
test("commands use the repository request ID/revision and never send a whole Store or active actor", async () => {
  const f = fake();
  await f.service.execute(
    { type: "approve-plan", loanId: "loan" },
    "request",
    4,
  );
  // Verify that commands carry their request ID and expected revision to the RPC.
  assert.deepEqual(f.calls[0], {
    name: "demo_command",
    args: {
      command: { type: "approve-plan", loanId: "loan" },
      request_id: "request",
      expected_revision: 4,
    },
  });
});
test("failed remote saves reject rather than returning local success", async () => {
  const f = fake();
  f.setFail(true);
  await /* Verify that a transport failure rejects the service call rather than imply success. */ assert.rejects(
    f.service.execute(
      { type: "send-message", to: "sarah", text: "Hello" },
      "request",
      null,
    ),
    /connection interrupted/,
  );
});
test("photo upload is reused when record finalization is retried", async () => {
  const f = fake();
  const command = {
    type: "record-proof" as const,
    loanId: "loan",
    step: "ownerDropoff" as const,
    code: "code",
    lockerNumber: "12",
    assignmentVerified: true,
    photo: "data:image/png;base64,eA==",
  };
  f.setFail(true);
  await /* Verify that the first simulated handover save fails for the retry scenario. */ assert.rejects(f.service.execute(command, "request", 1));
  f.setFail(false);
  await f.service.execute(command, "request", 1);
  // Verify that retrying a proof save uploads its photo only once.
  assert.equal(f.uploads(), 1);
  // Verify that retrying sends exactly the same command arguments.
  assert.deepEqual(f.calls[0].args, f.calls[1].args);
  // Verify that proof commands send private storage paths instead of image data.
  assert.match(
    (f.calls[1].args as { command: { photo: string } }).command.photo,
    /^eric\/proof\/loan\//,
  );
});
test("loading uses shared repository state while static placeholder assets remain unchanged", async () => {
  const f = fake();
  const store = await f.service.load();
  // Verify that loading shared state retains its active user ID.
  assert.equal(store.activeUserId, "eric");
  // Verify that bundled item placeholders remain public asset paths.
  assert.equal(store.items[0].image.startsWith("/assets/"), true);
  // Verify that loading shared state calls the state RPC.
  assert.equal(f.calls[0].name, "demo_state");
});

test("photo signing is bounded and repeated paths and refreshes reuse valid URLs", async () => {
  let active = 0;
  let peak = 0;
  let signed = 0;
  const service = makeDemoServices({
    rpc: async () => {
      const store = createSeed("2026-11-05");
      store.items = store.items.slice(0, 12).map((item, i) => ({
        ...item,
        images: [`private/${i}.png`, `private/${i}.png`],
      }));
      return { data: store, error: null };
    },
    storage: {
      from: () => ({
        createSignedUrl: async (path: string) => {
          signed++;
          active++;
          peak = Math.max(peak, active);
          await new Promise((resolve) => setTimeout(resolve, 2));
          active--;
          return {
            data: { signedUrl: `https://images.example/${path}` },
            error: null,
          };
        },
      }),
    },
  } as unknown as SupabaseClient);
  const [first, second] = await Promise.all([service.load(), service.load()]);
  // Verify that at most four image-signing requests run simultaneously.
  assert.equal(peak, 4);
  // Verify that each of the twelve distinct image paths is signed once.
  assert.equal(signed, 12);
  // Verify that repeated image paths reuse the same signed URL.
  assert.equal(first.items[0].images[0], second.items[0].images[1]);
  await service.load();
  // Verify that a second refresh reuses still-valid cached URLs.
  assert.equal(signed, 12);
});

test("failed image signing can be retried on the next refresh", async () => {
  let attempts = 0;
  const service = makeDemoServices({
    rpc: async () => {
      const store = createSeed("2026-11-05");
      store.items = store.items
        .slice(0, 1)
        .map((item) => ({ ...item, images: ["private/image.png"] }));
      return { data: store, error: null };
    },
    storage: {
      from: () => ({
        createSignedUrl: async () =>
          ++attempts === 1
            ? { error: new Error("too many connections") }
            : {
                data: { signedUrl: "https://images.example/retry" },
                error: null,
              },
      }),
    },
  } as unknown as SupabaseClient);
  await /* Verify that a signing failure rejects the initial state load. */ assert.rejects(service.load(), /too many connections/);
  // Verify that the next load can recover by signing the image again.
  assert.equal(
    (await service.load()).items[0].image,
    "https://images.example/retry",
  );
  // Verify that recovery makes exactly one additional signing attempt.
  assert.equal(attempts, 2);
});

test("realtime bursts refresh once and unsubscribe cancels pending refreshes", async () => {
  const handlers: (() => void)[] = [];
  let refreshes = 0;
  let removed = 0;
  const channel = {
    on(_event: unknown, _filter: unknown, handler: () => void) {
      handlers.push(handler);
      return channel;
    },
    subscribe() {
      return channel;
    },
  };
  const service = makeDemoServices({
    channel: () => channel,
    auth: { getSession: async () => ({ data: { session: null } }) },
    removeChannel: async () => {
      removed++;
    },
  } as unknown as SupabaseClient);
  const stop = service.subscribe(() => {
    refreshes++;
  });
  for (const handler of handlers) {
    handler();
    handler();
  }
  await new Promise((resolve) => setTimeout(resolve, 180));
  // Verify that a burst of realtime events causes just one refresh.
  assert.equal(refreshes, 1);
  handlers[0]();
  stop();
  await new Promise((resolve) => setTimeout(resolve, 180));
  // Verify that unsubscribe cancels a pending refresh.
  assert.equal(refreshes, 1);
  // Verify that cleanup removes the realtime channel exactly once.
  assert.equal(removed, 1);
});

test("review edits upload replacement photos and reuse uploads on retries", async () => {
  const f = fake();
  const command = {
    type: "edit-review" as const,
    loanId: "loan",
    rating: 4,
    text: "Updated",
    compliments: [],
    photo: "data:image/png;base64,eA==",
  };
  f.setFail(true);
  await /* Verify that the first simulated review-edit save fails before retry. */ assert.rejects(f.service.execute(command, "edit-request", 12));
  f.setFail(false);
  await f.service.execute(command, "edit-request", 12);
  // Verify that retrying a review edit reuses the uploaded replacement image.
  assert.equal(f.uploads(), 1);
  // Verify that review-edit retries send identical command arguments.
  assert.deepEqual(f.calls[0].args, f.calls[1].args);
  // Verify that review photos use the owner's public storage scope.
  assert.match(
    (f.calls[1].args as { command: { photo: string } }).command.photo,
    /^eric\/public\//,
  );
  // Verify that retrying a review edit preserves its expected revision.
  assert.equal(
    (f.calls[1].args as { expected_revision: number }).expected_revision,
    12,
  );
});
test("review edits retain stored photo paths rather than sending expiring signed URLs", async () => {
  const snapshot = createSeed("2026-11-05");
  const loan = snapshot.loans.find((l) => l.status === "complete")!;
  loan.review = {
    rating: 5,
    text: "Original",
    compliments: [],
    at: "2026-11-05T02:00:00Z",
    photo: "eric/public/original.jpg",
  };
  let sent: unknown;
  const service = makeDemoServices({
    rpc: async (name: string, args: unknown) => {
      sent = args;
      return { data: name === "demo_state" ? snapshot : null, error: null };
    },
    storage: {
      from: () => ({
        createSignedUrl: async () => ({
          data: { signedUrl: "https://images.example/signed" },
          error: null,
        }),
      }),
    },
  } as unknown as SupabaseClient);
  const loaded = await service.load();
  const photo = loaded.loans.find((l) => l.id === loan.id)!.review!.photo!;
  await service.execute(
    {
      type: "edit-review",
      loanId: loan.id,
      rating: 5,
      text: "Retained",
      compliments: [],
      photo,
    },
    "request",
    3,
  );
  // Verify that keeping a review photo sends its stored path, not its expiring display URL.
  assert.equal(
    (sent as { command: { photo: string } }).command.photo,
    "eric/public/original.jpg",
  );
});

test('booking lookup uses the provided frontend client and only requests public booking fields', async () => {
  const calls: unknown[] = [];
  const client = {
    from(table: string) {
      calls.push(table);
      return { select(fields: string) {
        calls.push(fields);
        return { async eq(column: string, value: string) {
          calls.push([column, value]);
          return { data: [{id:'booking',item_id:'tent',starts_on:'2026-11-15',ends_on:'2026-11-17',status:'ready'}], error: null };
        }};
      }};
    },
  };
  const rows = await makeDemoServices(client as unknown as SupabaseClient).getItemBookings!('tent');
  assert.deepEqual(calls, ['demo_item_bookings','id,item_id,starts_on,ends_on,status',['item_id','tent']]);
  assert.equal(rows[0].itemId,'tent');
  assert.equal(rows[0].borrowerId,'');
});
