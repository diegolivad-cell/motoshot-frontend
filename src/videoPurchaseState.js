export const normalizeVideoId = (id) => String(id ?? "").toLowerCase();

export const purchaseVideoMeta = (row) => {
  const video = row?.video;
  return Array.isArray(video) ? video[0] : video;
};

export const purchaseVideoId = (row) => {
  if (!row) return null;
  const nested = purchaseVideoMeta(row)?.id;
  return row.video_id ?? nested ?? null;
};

export const computeVideoPurchaseStatus = (row, fallbackHqStatus) => {
  const videoMeta = purchaseVideoMeta(row);
  const hqStatus = fallbackHqStatus ?? videoMeta?.hq_status;
  const hqDownloaded = Boolean(row?.hq_downloaded_at) || hqStatus === "downloaded";
  const hqReady = hqStatus === "ready";
  if (hqReady || hqDownloaded) return "entregado";
  return "comprado";
};

export const buildVideoPurchaseStatusMap = (videoRows = []) => {
  const map = {};
  for (const row of videoRows) {
    const id = purchaseVideoId(row);
    if (!id) continue;
    map[normalizeVideoId(id)] = computeVideoPurchaseStatus(row);
  }
  return map;
};

export const resolveVideoPurchaseState = (video, statusMap = {}) => {
  if (!video?.id) return null;
  const fromMap = statusMap[normalizeVideoId(video.id)];
  if (fromMap) return fromMap;
  if (video.buyer_purchase_status) return video.buyer_purchase_status;
  return null;
};

export const mergePurchaseStatusIntoVideos = (list, videoRows = []) => {
  if (!list?.length) return list || [];
  if (!videoRows?.length) return list;
  const statusById = buildVideoPurchaseStatusMap(videoRows);
  return list.map((video) => {
    const status = statusById[normalizeVideoId(video.id)];
    if (!status) return video;
    return { ...video, buyer_purchase_status: status };
  });
};
