import assert from "node:assert/strict";
import {
  buildVideoPurchaseStatusMap,
  mergePurchaseStatusIntoVideos,
  purchaseVideoId,
  resolveVideoPurchaseState,
} from "../src/videoPurchaseState.js";

const VIDEO_ID = "Aaaa-Bbbb-CCCC-dddd-111111111111";
const VIDEO_ID_UPPER = VIDEO_ID.toUpperCase();

const pendingPurchase = {
  video_id: VIDEO_ID,
  hq_downloaded_at: null,
  video: { id: VIDEO_ID, hq_status: "pending" },
};

const readyPurchase = {
  video_id: VIDEO_ID,
  video: { hq_status: "ready" },
};

assert.equal(purchaseVideoId({ video_id: VIDEO_ID }), VIDEO_ID);
assert.equal(purchaseVideoId({ video: { id: VIDEO_ID } }), VIDEO_ID);
assert.equal(purchaseVideoId({ video: [{ id: VIDEO_ID }] }), VIDEO_ID);

const map = buildVideoPurchaseStatusMap([pendingPurchase]);
assert.equal(map[VIDEO_ID.toLowerCase()], "comprado");

const readyMap = buildVideoPurchaseStatusMap([readyPurchase]);
assert.equal(readyMap[VIDEO_ID.toLowerCase()], "entregado");

const videos = [{ id: VIDEO_ID_UPPER, price: 5, moto_brand: "Ducati" }];
const merged = mergePurchaseStatusIntoVideos(videos, [pendingPurchase]);
assert.equal(merged[0].buyer_purchase_status, "comprado");
assert.equal(resolveVideoPurchaseState(merged[0], map), "comprado");
assert.equal(resolveVideoPurchaseState({ id: VIDEO_ID_UPPER }, map), "comprado");
assert.equal(resolveVideoPurchaseState({ id: VIDEO_ID_UPPER, buyer_purchase_status: "entregado" }, map), "comprado");

const apiOnly = mergePurchaseStatusIntoVideos(
  [{ id: VIDEO_ID, buyer_purchase_status: "comprado" }],
  []
);
assert.equal(apiOnly[0].buyer_purchase_status, "comprado");
assert.equal(resolveVideoPurchaseState(apiOnly[0], {}), "comprado");

console.log("videoPurchaseState tests passed");
