import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";
import { JSDOM } from "jsdom";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dom = new JSDOM('<div id="root"></div>', { url: "https://local.test/" });
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  FileReader: dom.window.FileReader,
  File: dom.window.File,
  IS_REACT_ACT_ENVIRONMENT: true,
});
dom.window.HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
dom.window.HTMLDialogElement.prototype.close = function () {
  this.open = false;
};
const channels = new Set();
// Deterministic in-process BroadcastChannel preserves the browser's named-channel
// semantics, exercising the installed Supabase Auth client without a browser.
globalThis.BroadcastChannel = class {
  constructor(name) {
    this.name = name;
    this.listeners = [];
    channels.add(this);
  }
  addEventListener(_event, listener) {
    this.listeners.push(listener);
  }
  postMessage(data) {
    for (const peer of channels)
      // Deliver the mock broadcast only to other channels with the same name.
      if (peer !== this && peer.name === this.name)
        queueMicrotask(() => {
          for (const listener of peer.listeners) void listener({ data });
        });
  }
  close() {
    channels.delete(this);
  }
};
const entry = join(root, "node_modules/.cache/cs4353-connected-entry.ts");
const out = join(root, "node_modules/.cache/cs4353-connected");
await mkdir(dirname(entry), { recursive: true });
await writeFile(
  entry,
  [
    `export {createElement,act} from 'react';`,
    `export {createRoot} from 'react-dom/client';`,
    `export {createClient} from '@supabase/supabase-js';`,
    ...[
      ["AppProvider", "app/context.tsx"],
      ["HelpPage", "features/HelpPage.tsx"],
      ["ReviewForm", "features/ReviewForm.tsx"],
      ["LockerFlow", "features/LockerFlow.tsx"],
      ["createSeed", "app/seed.ts"],
      ["makeDemoServices", "services/demo.ts"],
      ["tabAuthOptions", "services/auth.ts"],
    ].map(
      ([name, file]) =>
        `export {${name}} from ${JSON.stringify(join(root, "src", file))};`,
    ),
  ].join("\n"),
);
await build({
  root,
  logLevel: "warn",
  build: { ssr: entry, outDir: out, emptyOutDir: true },
});
await writeFile(join(out, "package.json"), '{"type":"module"}\n');
process.env.NODE_ENV = "development";
const {
  createElement: h,
  act,
  createRoot,
  createClient,
  AppProvider,
  HelpPage,
  ReviewForm,
  LockerFlow,
  createSeed,
  makeDemoServices,
  tabAuthOptions,
} = await import(pathToFileURL(join(out, "cs4353-connected-entry.js")).href);
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const noop = () => {};
let view;
async function mount(component, backend, initialStore) {
  view = createRoot(document.getElementById("root"));
  await act(async () => {
    view.render(h(AppProvider, { backend, initialStore }, component));
    await settle();
  });
}
async function unmount() {
  await act(async () => view.unmount());
}
async function fill(node, value) {
  const prototype =
    node instanceof dom.window.HTMLTextAreaElement
      ? dom.window.HTMLTextAreaElement.prototype
      : dom.window.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(node, value);
    node.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
}
async function submit() {
  await act(async () => {
    document
      .querySelector("form")
      .dispatchEvent(
        new dom.window.Event("submit", { bubbles: true, cancelable: true }),
      );
    await settle();
  });
}
const snapshot = createSeed("2026-11-05");
const calls = [];
const savedRequests = new Set();
let loseResponse = false;
let rejectSave = false;
let finishSave;
let blockSave = false;
const backend = makeDemoServices({
  auth: {
    onAuthStateChange(listener) {
      queueMicrotask(() =>
        listener("INITIAL_SESSION", {
          user: { id: snapshot.activeUserId, email: "test@example.test" },
        }),
      );
      return { data: { subscription: { unsubscribe: noop } } };
    },
    getSession: async () => ({ data: { session: null } }),
    // The photo step uploads the data URL before the command RPC runs.
    getUser: async () => ({
      data: { user: { id: snapshot.activeUserId, email: "test@example.test" } },
      error: null,
    }),
  },
  // Accept the mock storage upload and hand back a stable object path.
  storage: {
    from: () => ({
      upload: async (path) => ({ data: { path }, error: null }),
    }),
  },
  rpc: async (name, args) => {
    // Return the current remote snapshot for the read RPC.
    if (name === "demo_state")
      return { data: structuredClone(snapshot), error: null };
    calls.push(args);
    // Hold the mock save open to exercise the pending state.
    if (blockSave)
      await new Promise((resolve) => {
        finishSave = resolve;
      });
    // Simulate a server rejection before applying the command.
    if (rejectSave) return { error: { message: "Request rejected by server" } };
    // Ignore a replayed request ID so retries cannot duplicate writes.
    if (savedRequests.has(args.request_id)) return { error: null };
    const c = args.command;
    // Simulate creation of a help request in the remote snapshot.
    if (c.type === "post-help") {
      snapshot.helpRequests ??= [];
      snapshot.helpRequests.unshift({
        id: c.id,
        borrowerId: snapshot.activeUserId,
        title: c.title,
        description: c.description,
        start: c.start,
        end: c.end,
        status: "open",
      });
    }
    // Simulate an owner's offer of an item for a help request.
    if (c.type === "offer-help") {
      snapshot.offers.push({
        id: c.id,
        requestId: c.requestId,
        ownerId: snapshot.activeUserId,
        itemId: c.itemId,
        withdrawn: false,
      });
    }
    // Mark the matching offer withdrawn in the mock backend.
    if (c.type === "withdraw-offer")
      snapshot.offers.find((o) => o.id === c.id).withdrawn = true;
    // Update the completed loan's review in the mock backend.
    if (c.type === "edit-review") {
      const loan = snapshot.loans.find((l) => l.id === c.loanId);
      loan.review = {
        rating: c.rating,
        text: c.text,
        compliments: c.compliments,
        at: new Date().toISOString(),
      };
      loan.revision++;
    }
    savedRequests.add(args.request_id);
    // Simulate a committed write whose response never reaches the client.
    if (loseResponse) {
      loseResponse = false;
      return { error: { message: "network timeout after commit" } };
    }
    return { error: null };
  },
  channel() {
    return {
      on() {
        return this;
      },
      subscribe() {
        return this;
      },
    };
  },
  removeChannel: async () => {},
});
try {
  await mount(h(HelpPage, { onClose: noop, onLoan: noop }), backend);
  await fill(document.querySelector("input:not([type])"), "Need a camera");
  await fill(document.querySelector("textarea"), "For our presentation");
  rejectSave = true;
  await submit();
  // Verify that a server rejection is visible to the user.
  assert.match(document.body.textContent, /Request rejected by server/);
  // Verify that a failed save preserves the typed help-request title.
  assert.equal(
    document.querySelector("input:not([type])").value,
    "Need a camera",
    "failed save preserves draft",
  );
  // Verify that submitting the form sends a help-request creation command.
  assert.equal(calls[0].command.type, "post-help");
  // Verify that the save includes an idempotency key for safe retries.
  assert.ok(calls[0].request_id);
  rejectSave = false;
  blockSave = true;
  await submit();
  // Verify that an in-flight save disables the submit button.
  assert.equal(
    document.querySelector("form button").disabled,
    true,
    "pending remote save disables submit",
  );
  // Verify that the draft stays visible until remote success is confirmed.
  assert.equal(
    document.querySelector("input:not([type])").value,
    "Need a camera",
    "draft remains until remote success",
  );
  await act(async () => {
    blockSave = false;
    finishSave();
    await settle();
  });
  // Verify that a confirmed save clears the help-request draft.
  assert.equal(
    document.querySelector("input:not([type])").value,
    "",
    "successful remote save clears draft",
  );
  // Verify that refreshing displays the newly saved remote request.
  assert.match(
    document.body.textContent,
    /Need a camera/,
    "refreshed remote request appears",
  );
  await fill(document.querySelector("input:not([type])"), "Retry-safe request");
  await fill(document.querySelector("textarea"), "Response lost after commit");
  loseResponse = true;
  await submit();
  // Verify that a lost response is reported as an uncertain network failure.
  assert.match(document.body.textContent, /network timeout after commit/);
  const uncertain = calls.at(-1);
  await submit();
  // Verify that retrying an uncertain save reuses its command and request ID.
  assert.deepEqual(
    calls.at(-1),
    uncertain,
    "retry reuses command ID and request key after an uncertain save",
  );
  // Verify that an uncertain-save retry creates exactly one help request.
  assert.equal(
    snapshot.helpRequests.filter((r) => r.title === "Retry-safe request")
      .length,
    1,
    "retry creates one request",
  );
  await unmount();
  const loan = snapshot.loans.find(
    (l) => l.status === "complete" && l.borrowerId === snapshot.activeUserId,
  );
  loan.review = {
    rating: 5,
    text: "Original review",
    compliments: [],
    at: "2026-11-05T02:00:00Z",
  };
  // Require a completed borrower review in the seed before exercising editing.
  assert.ok(loan, "seed must include the active borrower’s completed review");
  loan.revision = 8;
  await mount(h(ReviewForm, { loanId: loan.id, onClose: noop }), backend);
  await fill(
    document.querySelector("textarea"),
    "Edited through the connected form",
  );
  await submit();
  const edit = calls.at(-1);
  // Verify that editing submits the review-edit command rather than a new review.
  assert.equal(edit.command.type, "edit-review");
  // Verify that review editing sends the loaded revision for concurrency checks.
  assert.equal(edit.expected_revision, 8);
  // Verify that the saved review contains the edited text.
  assert.equal(loan.review.text, "Edited through the connected form");
  await unmount();

  // A committed withdrawal whose response is lost must allow a new offer ID.
  snapshot.activeUserId = "sarah";
  await mount(h(HelpPage, { onClose: noop, onLoan: noop }), backend);
  const button = (text) =>
    [...document.querySelectorAll("button")].find(
      (b) => b.textContent === text,
    );
  await act(async () => {
    button("Offer item").click();
    await settle();
  });
  const offered = calls.at(-1).command;
  loseResponse = true;
  await act(async () => {
    button("Withdraw offer").click();
    await settle();
  });
  // Verify that a lost withdrawal response is reported as an uncertain network failure.
  assert.match(document.body.textContent, /network timeout after commit/);
  await act(async () => {
    button("Offer item").click();
    await settle();
  });
  const reoffered = calls.at(-1).command;
  // Verify that reoffering still uses the offer-help command.
  assert.equal(reoffered.type, "offer-help");
  // Verify that reoffering refers to the same item.
  assert.equal(reoffered.itemId, offered.itemId);
  // Verify that an offer made after withdrawal receives a fresh record ID.
  assert.notEqual(
    reoffered.id,
    offered.id,
    "a new offer after withdrawal must use a new record ID",
  );
  await unmount();

  // The app presents a QR for an external locker; no in-app scanner is needed.
  const handover = snapshot.loans.find((l) => l.id === "demo-active");
  const stages = [
    "ownerDropoff",
    "borrowerPickup",
    "borrowerDropoff",
    "ownerPickup",
  ];
  for (const [index, stage] of stages.entries()) {
    handover.proofs = Object.fromEntries(
      stages.slice(0, index).map((step) => [
        step,
        {
          at: "2026-11-05T02:00:00Z",
          photo: "/assets/item-placeholder.png",
          actor: step.startsWith("owner")
            ? handover.ownerId
            : handover.borrowerId,
          lockerNumber: "12",
        },
      ]),
    );
    handover.status = ["ready", "ready", "active", "returning"][index];
    snapshot.activeUserId = stage.startsWith("owner")
      ? handover.ownerId
      : handover.borrowerId;
    await mount(
      h(LockerFlow, { loanId: handover.id, onClose: noop, onDone: noop }),
      backend,
      structuredClone(snapshot),
    );
    // Verify that every handover stage displays its QR code.
    assert.ok(
      document.querySelector('[aria-label="Handover QR code"]'),
      `${stage} displays QR`,
    );
    // Verify that instructions tell the user to present the code to the locker scanner.
    assert.match(
      document.body.textContent,
      /Show this QR code to the locker scanner/,
    );
    // Verify that presenting a QR code does not activate an in-app camera preview.
    assert.equal(document.querySelector("video"), null);
    // Verify that QR presentation requires no manual code entry.
    assert.equal(
      document.querySelector("input"),
      null,
      "QR presentation does not ask the user to enter or scan a code",
    );
    await act(async () => {
      button("Simulate locker scan").click();
      await settle();
    });
    // Verify that locker confirmation leads toward the photo-evidence step.
    assert.match(document.body.textContent, /Continue to item photo/);
    // Verify that the completed scan explains how the locker was assigned.
    assert.match(document.body.textContent, /assigned you an available locker/);
    // Verify that the locker phase offers no manual number-entry field.
    assert.equal(
      document.querySelector("input"),
      null,
      "the scan assigns the locker; the user does not key one in",
    );
    const assigned = document.querySelector(".locker-position__label strong");
    // Verify that each handover stage displays its assigned locker number.
    assert.equal(
      assigned?.textContent,
      "12",
      `${stage} shows the assigned locker`,
    );
    const grid = document.querySelector('.locker-position__grid');
    assert.equal(grid?.getAttribute('role'), 'img');
    assert.match(grid?.getAttribute('aria-label') ?? '', /Locker 12, row 2, column 4/);
    const cells = [...grid.querySelectorAll('.locker-position__cell')];
    assert.equal(cells.length, 32);
    assert.equal(cells.filter(cell => cell.classList.contains('locker-position__cell--assigned')).length, 1);
    assert.ok(cells[11].classList.contains('locker-position__cell--assigned'), `${stage} highlights locker 12`);

    await unmount();
  }

  // The report-issue option appears only after the handover photo is taken and
  // its note is saved with that handover photo.
  handover.proofs = {
    ownerDropoff: {
      at: "2026-11-05T02:00:00Z",
      photo: "/assets/item-placeholder.png",
      actor: handover.ownerId,
      lockerNumber: "12",
    },
  };
  handover.status = "ready";
  snapshot.activeUserId = handover.borrowerId;
  await mount(
    h(LockerFlow, { loanId: handover.id, onClose: noop, onDone: noop }),
    backend,
    structuredClone(snapshot),
  );
  for (const label of ["Simulate locker scan", "Continue to item photo"])
    await act(async () => {
      button(label).click();
      await settle();
    });
  // Verify that no issue can be reported before the handover photo exists.
  assert.equal(button("Report issue"), undefined, "no report option before a photo");
  assert.equal(document.querySelector('input[type="file"]'), null,
    "handover photos cannot be selected from files");
  assert.equal(button("Choose a photo"), undefined);
  const video = document.querySelector('video');
  assert.ok(video, "photo step offers a live camera preview");
  Object.defineProperties(video, {
    videoWidth: { value: 640 },
    videoHeight: { value: 480 },
  });
  const canvasPrototype = dom.window.HTMLCanvasElement.prototype;
  const originalContext = canvasPrototype.getContext;
  const originalDataUrl = canvasPrototype.toDataURL;
  canvasPrototype.getContext = () => ({ drawImage() {} });
  canvasPrototype.toDataURL = () => "data:image/jpeg;base64,cGhvdG8tYnl0ZXM=";
  try {
    await act(async () => {
      video.dispatchEvent(new dom.window.Event("canplay", { bubbles: true }));
      await settle();
    });
    assert.equal(button("Capture image").disabled, false);
    await act(async () => {
      button("Capture image").click();
      await new Promise((resolve) => setTimeout(resolve, 10));
      await settle();
    });
    assert.ok(button("Retake image"));
    assert.equal(button("Replace image"), undefined);
  } finally {
    canvasPrototype.getContext = originalContext;
    canvasPrototype.toDataURL = originalDataUrl;
  }
  // Verify that the report-issue option appears once the photo is taken.
  assert.ok(button("Report issue"), "report option appears after a photo");
  assert.equal(button("Confirm pickup").disabled, false);
  await act(async () => {
    button("Report issue").click();
    await settle();
  });
  // Verify that the note field appears while reporting an issue.
  assert.ok(
    document.querySelector(".issue-report textarea"),
    "reporting reveals a note field",
  );
  await fill(document.querySelector(".issue-report textarea"), "   ");
  // Verify that the confirm control is blocked until the issue is described.
  assert.equal(
    button("Confirm pickup · issue").disabled,
    true,
    "a short issue note blocks the confirm control",
  );
  await fill(
    document.querySelector(".issue-report textarea"),
    "  The lid hinge is broken.  ",
  );
  await act(async () => {
    button("Confirm pickup · issue").click();
    await settle();
  });
  // Verify that the issue note is submitted with the handover proof.
  assert.equal(
    calls.at(-1).command.type,
    "record-proof",
    "confirming a reported issue records the proof",
  );
  assert.equal(
    calls.at(-1).command.issueNote,
    "The lid hinge is broken.",
    "the trimmed issue note travels with the handover proof",
  );
  assert.ok(
    document.body.textContent.includes("Verified successfully"),
    "the reported handover completes",
  );
  await unmount();

  // Real Supabase Auth clients + separate tab stores: login, sign-out and reload.
  const secondDom = new JSDOM("", { url: "https://local.test/" });
  const authFetch = async (url, options) => {
    // Return the mocked logout response for Supabase sign-out.
    if (String(url).includes("/logout"))
      return new Response("{}", { status: 200 });
    const email = JSON.parse(options.body).email;
    const id = email.startsWith("eric")
      ? "00000000-0000-0000-0000-000000000001"
      : "00000000-0000-0000-0000-000000000002";
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = [
      { alg: "HS256", typ: "JWT" },
      { sub: id, role: "authenticated", aud: "authenticated", exp },
      "signature",
    ]
      .map((x, i) =>
        i < 2 ? Buffer.from(JSON.stringify(x)).toString("base64url") : x,
      )
      .join(".");
    return new Response(
      JSON.stringify({
        access_token: token,
        refresh_token: `refresh-${id}`,
        expires_in: 3600,
        token_type: "bearer",
        user: {
          id,
          email,
          aud: "authenticated",
          role: "authenticated",
          app_metadata: {},
          user_metadata: {},
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  const clients = [];
  function client(storage) {
    const c = createClient("https://supabase.local.test", "public-test-key", {
      auth: { ...tabAuthOptions(storage), autoRefreshToken: false },
      global: { fetch: authFetch },
    });
    clients.push(c);
    return c;
  }
  const first = client(dom.window.sessionStorage),
    second = client(secondDom.window.sessionStorage);
  const firstEvents = [],
    secondEvents = [];
  const one = makeDemoServices(first).observe((identity) =>
    firstEvents.push(identity?.email ?? null),
  );
  const two = makeDemoServices(second).observe((identity) =>
    secondEvents.push(identity?.email ?? null),
  );
  try {
    await first.auth.signInWithPassword({
      email: "eric@example.test",
      password: "test",
    });
    await settle();
    // Verify that the first tab observes its own signed-in account.
    assert.equal(firstEvents.at(-1), "eric@example.test");
    // Verify that signing in the first tab leaves the second tab signed out.
    assert.equal(
      secondEvents.at(-1),
      null,
      "first login must not change the other tab",
    );
    await second.auth.signInWithPassword({
      email: "sarah@example.test",
      password: "test",
    });
    await settle();
    // Verify that signing in the second tab preserves the first tab's account.
    assert.equal(firstEvents.at(-1), "eric@example.test");
    // Verify that the second tab observes its own independently signed-in account.
    assert.equal(secondEvents.at(-1), "sarah@example.test");
    await first.auth.signOut({ scope: "local" });
    await settle();
    // Verify that signing out clears the first tab's identity.
    assert.equal(firstEvents.at(-1), null);
    // Verify that signing out the first tab preserves the second tab's account.
    assert.equal(
      secondEvents.at(-1),
      "sarah@example.test",
      "sign-out must not change another account",
    );
    // Verify that the second tab still holds its own authenticated session.
    assert.equal(
      (await second.auth.getSession()).data.session.user.email,
      "sarah@example.test",
    );
    const reloaded = client(secondDom.window.sessionStorage);
    // Verify that reloading retains the session belonging to that tab.
    assert.equal(
      (await reloaded.auth.getSession()).data.session.user.email,
      "sarah@example.test",
      "reload retains the tab session",
    );
  } finally {
    one();
    two();
    for (const c of clients) {
      c.auth.stopAutoRefresh();
      await c.removeAllChannels();
    }
    secondDom.window.close();
  }
  console.log(
    "Connected interaction checks passed: Help failure/pending/success, review editing/revisions, all four external-scanner handovers, issue reporting after the handover photo, and real Supabase cross-tab auth isolation/reload.",
  );
} finally {
  // Render the requested handover view when a test view is supplied.
  if (view) await act(async () => view.unmount());
  for (const channel of [...channels]) channel.close();
  dom.window.close();
}
