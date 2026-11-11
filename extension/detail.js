(() => {
  "use strict";

  const core = globalThis.NjuPurchaseCore;
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || message?.type !== "nju-purchase/read-detail") return;
    if (core.detailLink(location.href)?.id !== message.orderId) {
      respond({ error: "详情页与订单不匹配。" });
      return;
    }
    const rows = core.readOrderDetail(document);
    if (!rows) {
      respond({ ready: false });
      return;
    }
    if (rows.some(row => !row.id || !row.name) ||
      new Set(rows.map(row => row.id)).size !== rows.length) {
      respond({ error: "商品明细的行标识或名称不完整。" });
      return;
    }
    respond({ rows });
  });
})();
