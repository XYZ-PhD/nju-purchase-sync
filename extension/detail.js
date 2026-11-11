(() => {
  "use strict";

  const core = globalThis.NjuPurchaseCore;
  function createReader(doc, signal) {
    const frame = doc.createElement("iframe");
    frame.hidden = true;
    frame.title = "同步采购 · 订单详情";
    frame.setAttribute("sandbox", "allow-same-origin allow-scripts");
    let closed = false;
    let reading = false;

    async function read(url) {
      const source = core.detailLink(url);
      if (!source) throw new Error("订单详情地址无效。");
      if (closed || reading) throw new Error("订单详情读取器不可用。");
      signal?.throwIfAborted();
      reading = true;
      let reachedDetail = false;
      try {
        const previous = frame.contentDocument;
        frame.src = source.url;
        if (!frame.isConnected) doc.body.append(frame);
        const rows = await core.waitFor(() => {
          const current = frame.contentDocument;
          // The previous page can remain readable while the frame is navigating.
          if (!current || current === previous || core.detailLink(current.URL)?.id !== source.id) return null;
          reachedDetail = true;
          return core.readOrderDetail(current);
        }, 14_000, signal).catch(error => {
          if (signal?.aborted) throw error;
          if (reachedDetail) throw new Error("订单商品明细加载超时。");
          const unavailable = new Error("无法在订单页内读取详情，请确认已登录后重试。");
          unavailable.detailUnavailable = true;
          throw unavailable;
        });
        if (rows.some(row => !row.id || !row.name) ||
          new Set(rows.map(row => row.id)).size !== rows.length) {
          throw new Error("商品明细的行标识或名称不完整。");
        }
        return rows;
      } finally {
        reading = false;
      }
    }

    return {
      read,
      close() {
        closed = true;
        frame.remove();
      }
    };
  }

  globalThis.NjuPurchaseDetail = { createReader };
})();
