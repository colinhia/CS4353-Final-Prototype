import assert from "node:assert/strict";
import { build } from "vite";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdir, writeFile, stat, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const entry = join(root, "node_modules/.cache/cs4353-rendered-entry.ts");
const out = join(root, "node_modules/.cache/cs4353-rendered");
await mkdir(dirname(entry), { recursive: true });
// One bundle keeps the production provider and consumers on the same context.
await writeFile(
  entry,
  `export { ItemImage } from ${JSON.stringify(join(root,"src/components/ui/ItemImage.tsx"))};\nexport { ItemCard } from ${JSON.stringify(join(root,"src/pages/borrow/ItemCard.tsx"))};\nexport { ItemDetails } from ${JSON.stringify(join(root,"src/pages/borrow/ItemDetails.tsx"))};\nexport { createSeed } from ${JSON.stringify(join(root, "src/app/seed.ts"))};\nexport { AppProvider } from ${JSON.stringify(join(root, "src/app/context.tsx"))};\nexport { RouteContent } from ${JSON.stringify(join(root, "src/App.tsx"))};\nexport { QrCode } from ${JSON.stringify(join(root, "src/components/ui/QrCode.tsx"))};\n`,
);
await build({
  root,
  logLevel: "warn",
  build: { ssr: entry, outDir: out, emptyOutDir: true },
});
await writeFile(join(out, "package.json"), '{"type":"module"}\n');
const module = await import(
  pathToFileURL(join(out, "cs4353-rendered-entry.js")).href
);
const noop = () => {};
const htmls = [];
for (const [route, expected] of [
  [{ page: "loans" }, ["Borrowing", "Sharing", "Portable projector"]],
  [
    { page: "loans", id: "demo-active" },
    ["Weighing scale", "Show QR", "Loan Start"],
  ],
  [{ page: "share" }, ["Your items", "Portable projector"]],
  [{ page: "friends" }, ["Friend requests", "Your friends", "Find people"]],
  [
    { page: "me" },
    ["About this preview", "Version:", "Edit profile", "Sign out"],
  ],
  [{ page: "chats" }, ["Messages", "New chat", "Sarah"]],
  [{ page: "chats", id: "sarah" }, ["Type a message", "Modify plan"]],
  [{ page: "notifications" }, ["Updates", "Portable projector"]],
]) {
  const html = renderToStaticMarkup(
    createElement(
      module.AppProvider,
      { initialStore: module.createSeed("2026-11-05") },
      createElement(module.RouteContent, {
        route,
        navigate: noop,
        onItem: noop,
        onHandover: noop,
        onReview: noop,
        onReset: noop,
      }),
    ),
  );
  for (const text of expected)
    // Verify that each route renders its expected page content.
    assert.ok(
      html.includes(text),
      `${JSON.stringify(route)} must render ${text}`,
    );
  // Verify that implemented pages replace the generic staging placeholder.
  assert.ok(
    !html.includes("Your community is ready to share."),
    "A real page must replace the staging placeholder",
  );
  htmls.push(html);
}
for (const src of new Set(
  htmls.flatMap((html) =>
    [...html.matchAll(/src="(\/assets\/[^\"]+)"/g)].map((match) => match[1]),
  ),
))
  // Verify that every referenced public asset exists and is nonempty.
  assert.ok((await stat(join(root, "public", src))).size > 0, src);
const qr = renderToStaticMarkup(
  createElement(module.QrCode, {
    value: "CS4353:demo-active:borrowerPickup:DEMO-ACTIVE",
  }),
);
// Verify that the rendered QR has its accessible handover label.
assert.ok(qr.includes("Handover QR code"));
// Verify that the QR contains substantial module geometry rather than an empty image.
assert.ok((qr.match(/h1v1h-1z/g) || []).length > 100);
console.log(
  "Rendered UI checks passed: all 8 routed views, local assets, and generated QR matrix.",
);

// Exercise missing and failed sources through the same shared component as the UI.
const dom = new JSDOM('<div id="image-test"></div>', {url:'https://local.test/'});
Object.assign(globalThis, {window:dom.window, document:dom.window.document, IS_REACT_ACT_ENVIRONMENT:true});
const imageRoot = createRoot(document.getElementById('image-test'));
const draw = async src => { await act(async()=>imageRoot.render(createElement(module.ItemImage,{src,alt:'Shared item',width:44,height:44}))); return document.querySelector('#image-test img'); };
for (const src of [undefined, null, '', '   ', '/assets/item-placeholder.png']) {
 const img = await draw(src); assert.equal(img.getAttribute('src'),'/assets/item-placeholder.png'); assert.equal(img.dataset.placeholder,'true');
}
const storage = 'https://example.supabase.co/storage/v1/object';
const legacy = `${storage}/sign/demo-images/demo-id/public/seed-item-placeholder.png?token=test-token`;
for (const src of [legacy, `${storage}/public/demo-images/demo-id/public/seed-item-placeholder.png`, `${storage}/authenticated/demo-images/demo-id/public/seed-item-placeholder.png?download=1`]) {
 const img = await draw(src);
 assert.equal(img.getAttribute('src'), '/assets/item-placeholder.png', 'Seeded objects must use the local artwork even when they load successfully');
 assert.equal(img.dataset.placeholder, 'true');
 assert.ok(img.classList.contains('item-image'), 'Keep the shared rounded styling');
}
for (const src of [
 `${storage}/sign/demo-images/demo-id/uploads/photo.png?token=user-token`,
 `${storage}/sign/demo-images/demo-id/uploads/seed-item-placeholder.png?token=user-token`,
 `${storage}/sign/demo-images/demo-id/public/seed-item-placeholder.png.backup?token=user-token`,
 `${storage}/sign/demo-images/demo-id/public/photo.png?name=seed-item-placeholder.png`,
 '/assets/denim-jacket.png',
 'data:image/png;base64,iVBORw0KGgo=',
 'blob:https://local.test/user-upload',
]) {
 const img = await draw(src); assert.equal(img.getAttribute('src'),src,'Genuine image URLs must remain byte-for-byte unchanged');
 assert.equal(img.dataset.placeholder, undefined);
}
let img = await draw('/assets/denim-jacket.png');
assert.equal(img.dataset.placeholder,undefined); assert.equal(img.alt,'Shared item');
assert.equal(img.width,44); assert.equal(img.height,44);
await act(async()=>img.dispatchEvent(new dom.window.Event('error')));
assert.equal(img.getAttribute('src'),'/assets/item-placeholder.png');
await act(async()=>img.dispatchEvent(new dom.window.Event('error')));
assert.equal(img.getAttribute('src'),'/assets/item-placeholder.png','Fallback errors must not loop');
img = await draw('/assets/replacement-photo.png');assert.equal(img.getAttribute('src'),'/assets/replacement-photo.png');
img = await draw('/assets/denim-jacket.png');assert.equal(img.getAttribute('src'),'/assets/denim-jacket.png','A source change must allow a previously failed URL to retry');
await act(async()=>imageRoot.unmount());dom.window.close();
console.log('Item image checks passed: missing/legacy sources, error fallback, unchanged alt/dimensions and replacement photo.');

// Preserve the redesigned card's metadata and badges, including when no photo exists.
const seed = module.createSeed('2026-11-05');
const item = {...seed.items.find(i=>i.id==='cake-stand'), ownerId:'sarah', isFriend:true, availability:'on-loan', backOn:'2026-11-20'};
const card = renderToStaticMarkup(createElement(module.AppProvider,{initialStore:seed},createElement(module.ItemCard,{item,onOpen:noop})));
for(const text of ['item-byline','Sarah','Friend','item-status--on-loan','Back 20 Nov','item-meta','Clementi','data-placeholder="true"'])assert.ok(card.includes(text),`Latest card must preserve ${text}`);
const availableCard=renderToStaticMarkup(createElement(module.ItemCard,{item:{...item,availability:'available'},onOpen:noop}));assert.ok(availableCard.includes('item-status--available'));
const detail=renderToStaticMarkup(createElement(module.ItemDetails,{item,onBack:noop,onBorrow:noop}));
for(const text of ['details-hero','Back to results','Chat with','details-photo','data-placeholder="true"'])assert.ok(detail.includes(text),`Latest details must preserve ${text}`);
console.log('Upstream architecture checks passed: card owner/friend/location/availability metadata and redesigned detail actions.');

// CSS contract checks do not substitute for viewport/pixel visual acceptance.
const css = await readFile(join(root,'src/components/ui/item-image.css'),'utf8');
const cssDom = new JSDOM(`<style>.item-photo{object-fit:cover}</style><style>${css}</style><div class="borrow-app"><button class="item-card"><img class="item-image item-photo" data-placeholder="true"/><span class="item-info">Card text</span></button><span class="shelf-thumb__ring" style="border-radius:50%"><img class="item-image"/></span><img class="item-image map-item-photo"/></div>`);
const styledImage=cssDom.window.document.querySelector('img');
assert.equal(cssDom.window.getComputedStyle(cssDom.window.document.querySelector('.item-card')).borderRadius,'8px');
assert.equal(cssDom.window.getComputedStyle(styledImage).borderRadius,'0px');
assert.equal(cssDom.window.getComputedStyle(styledImage).objectFit,'contain');
assert.equal(cssDom.window.getComputedStyle(cssDom.window.document.querySelector('.shelf-thumb__ring > img')).borderRadius,'50%');
assert.equal(cssDom.window.getComputedStyle(cssDom.window.document.querySelector('.map-item-photo')).getPropertyValue('--item-image-radius'),'6px');
cssDom.window.close();
console.log('CSS contracts passed: 8px outer card, square inner seam and contained placeholder.');
