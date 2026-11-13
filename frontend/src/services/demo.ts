import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Command, Store, Loan } from "../app/domain";
import { tabAuthOptions } from "./auth.ts";
export type Identity = { id: string; email: string };
export interface DemoServices {
  configured: boolean;
  observe(listener: (identity: Identity | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  load(): Promise<Store>;
  getItemBookings?(itemId: string): Promise<Loan[]>;
  execute(
    command: Command,
    requestId: string,
    revision: number | null,
  ): Promise<void>;
  subscribe(refresh: () => void): () => void;
}
const tables = [
  "profiles",
  "items",
  "loans",
  "approvals",
  "proofs",
  "conditions",
  "reviews",
  "friendships",
  "messages",
  "notices",
  "help_requests",
  "offers",
];
const url = import.meta.env?.VITE_SUPABASE_URL;
const key = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key && !key.includes("YOUR_"));
let singleton: DemoServices | undefined;
export function services(): DemoServices {
  // Reuse the existing service client instead of creating another auth subscription.
  if (singleton) return singleton;
  // Report missing backend configuration before creating a Supabase client.
  if (!configured)
    throw new Error(
      "Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY for this demo deployment.",
    );
  const client = createClient(url, key, {
    auth: tabAuthOptions(
      typeof window === "undefined" ? undefined : window.sessionStorage,
    ),
  });
  return (singleton = makeDemoServices(client));
}
export function makeDemoServices(client: SupabaseClient): DemoServices {
  // Keep paths separate from expiring display URLs, including across edit retries.
  const paths = new Map<string, string>();
  const uploads = new Map<string, Promise<string>>();
  const imageUrls = new Map<
    string,
    { expires: number; value: Promise<string> }
  >();
  let signing = 0;
  const signingQueue: (() => void)[] = [];
  // Limit concurrent signing requests; a queued request inherits the released slot.
  async function signImage(path: string): Promise<string> {
    // Queue image signing once all four concurrency slots are occupied.
    if (signing >= 4)
      await new Promise<void>((resolve) => signingQueue.push(resolve));
    else signing++;
    try {
      const result = await client.storage
        .from("demo-images")
        .createSignedUrl(path, 600);
      // Propagate failed signed-URL requests so their cache entries can be retried.
      if (result.error) throw result.error;
      paths.set(result.data.signedUrl, path);
      return result.data.signedUrl;
    } finally {
      const next = signingQueue.shift();
      // Hand the released signing slot to a waiter; otherwise reduce the active count.
      if (next) next();
      else signing--;
    }
  }
  const resolvePath = (value: string) => paths.get(value) || value;
  // Refresh cached URLs before their ten-minute expiry and evict failed requests.
  async function display(path: string): Promise<string> {
    // Leave empty paths and bundled public assets unchanged.
    if (!path || path.startsWith("/assets/")) return path;
    let cached = imageUrls.get(path);
    // Request a fresh signed URL when no valid cached entry remains.
    if (!cached || cached.expires <= Date.now()) {
      cached = { expires: Date.now() + 540_000, value: signImage(path) };
      imageUrls.set(path, cached);
      const entry = cached;
      void entry.value.catch(() => {
        // Evict a failed cache entry only if a newer request has not replaced it.
        if (imageUrls.get(path) === entry) imageUrls.delete(path);
      });
    }
    return cached.value;
  }
  // Share in-flight uploads across retries for the same image and storage scope.
  async function upload(value: string, scope: string): Promise<string> {
    // Resolve an existing stored image path instead of uploading it again.
    if (!value.startsWith("data:")) return resolvePath(value);
    const cacheKey = scope + value;
    let pending = uploads.get(cacheKey);
    // Start an upload only when this image and scope have no in-flight upload.
    if (!pending) {
      pending = (async () => {
        const { data, error } = await client.auth.getUser();
        // Require a successfully authenticated user before writing private storage.
        if (error || !data.user) throw error || new Error("Sign in again.");
        const blob = await (await fetch(value)).blob();
        // Reject unsupported, empty, or oversized image blobs before upload.
        if (
          !["image/jpeg", "image/png", "image/webp"].includes(blob.type) ||
          !blob.size ||
          blob.size > 5242880
        )
          throw new Error("Choose a JPEG, PNG or WebP image up to 5 MB.");
        const path = `${data.user.id}/${scope}/${crypto.randomUUID()}.${blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg"}`;
        const result = await client.storage
          .from("demo-images")
          .upload(path, blob, { upsert: false, contentType: blob.type });
        // Stop before caching a storage path when the upload fails.
        if (result.error) throw result.error;
        return path;
      })();
      uploads.set(cacheKey, pending);
      pending.catch(() => uploads.delete(cacheKey));
    }
    return pending;
  }
  return {
    async getItemBookings(itemId: string) {
      const { data, error } = await client.from('demo_item_bookings')
        .select('id,item_id,starts_on,ends_on,status').eq('item_id', itemId);
      if (error) throw error;
      return (data ?? []).map(r => ({
        id: r.id, itemId: r.item_id, start: r.starts_on, end: r.ends_on,
        status: r.status, borrowerId: '',
      })) as Loan[];
    },
    configured: true,
    observe(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) =>
        listener(
          session
            ? { id: session.user.id, email: session.user.email || "" }
            : null,
        ),
      );
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      // Propagate an authentication failure from sign-in.
      if (error) throw error;
    },
    async signOut() {
      const { error } = await client.auth.signOut({ scope: "local" });
      // Propagate a failure to end the current session.
      if (error) throw error;
      paths.clear();
      uploads.clear();
      imageUrls.clear();
    },
    async load() {
      const { data, error } = await client.rpc("demo_state");
      // Reject a failed state RPC instead of displaying incomplete shared data.
      if (error) throw error;
      const store = data as Store;
      // Reject snapshots whose active user has no profile in the returned people list.
      if (!store.people.some((p) => p.id === store.activeUserId))
        throw new Error(
          "This account has not been provisioned for the connected demo.",
        );
      await Promise.all([
        ...store.people.map(async (p) => {
          // Resolve private avatar paths only for profiles with an avatar.
          if (p.avatar) p.avatar = await display(p.avatar);
        }),
        ...store.items.map(async (i) => {
          i.images = await Promise.all(i.images.map(display));
          i.image = i.images[0] || "/assets/item-placeholder.png";
        }),
        ...store.loans.map(async (l) => {
          await Promise.all(
            Object.values(l.proofs).map(async (p) => {
              // Resolve a recorded proof photo only when that handover stage has evidence.
              if (p) p.photo = await display(p.photo);
            }),
          );
          // Resolve an attached loan-review photo to a temporary display URL.
          if (l.review?.photo) l.review.photo = await display(l.review.photo);
        }),
        ...(store.receivedReviews || []).map(async (r) => {
          // Resolve received-review photos only when the review includes one.
          if (r.review.photo) r.review.photo = await display(r.review.photo);
        }),
      ]);
      return store;
    },
    async execute(command, requestId, revision) {
      const c = structuredClone(command) as Command;
      // Upload handover evidence before sending its storage path to the command RPC.
      if (c.type === "record-proof")
        c.photo = await upload(c.photo, `proof/${c.loanId}`);
      // Upload or resolve the optional photo for a new or edited review.
      if ((c.type === "submit-review" || c.type === "edit-review") && c.photo)
        c.photo = await upload(c.photo, "public");
      // Upload or resolve a supplied profile avatar before saving the profile.
      if (c.type === "update-profile" && c.avatar)
        c.avatar = await upload(c.avatar, "public");
      // Upload listing images for both creation and editing commands.
      if (c.type === "create-item" || c.type === "edit-item")
        c.images = await Promise.all(
          c.images.map((image) => upload(image, "public")),
        );
      const { error } = await client.rpc("demo_command", {
        command: c,
        request_id: requestId,
        expected_revision: revision,
      });
      // Propagate command rejection so the caller can retain its draft and retry metadata.
      if (error)
        throw new Error(
          error.code === "23P01"
            ? "These dates overlap another loan. Choose different dates."
            : error.code === "23505"
              ? "This record already exists, or another tester just completed this action. Refresh and check."
              : error.message,
        );
    },
    subscribe(refresh) {
      let active = true;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const scheduleRefresh = () => {
        // Ignore events after unsubscribe and merge bursts into one scheduled refresh.
        if (!active || timer !== undefined) return;
        timer = setTimeout(() => {
          timer = undefined;
          // Refresh only if this subscription is still active when the timer fires.
          if (active) refresh();
        }, 150);
      };
      const channel = client.channel(`demo:${crypto.randomUUID()}`);
      for (const table of tables)
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table: `demo_${table}` },
          scheduleRefresh,
        );
      void client.auth
        .getSession()
        .then(async ({ data }) => {
          // Join realtime only for an active subscription with an authenticated session.
          if (!active || !data.session) return;
          await client.realtime.setAuth(data.session.access_token);
          // Begin channel subscription only if cleanup has not already run.
          if (active)
            channel.subscribe((status) => {
              // Refresh after the realtime channel joins to cover changes during setup.
              if (status === "SUBSCRIBED") scheduleRefresh();
            });
        })
        .catch(() => {
          // Refresh on subscription-setup failure only while the caller is still subscribed.
          if (active) refresh();
        });
      return () => {
        active = false;
        clearTimeout(timer);
        void client.removeChannel(channel);
      };
    },
  };
}
