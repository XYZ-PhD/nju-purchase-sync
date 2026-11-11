(() => {
  "use strict";

  const core = globalThis.NjuPurchaseCore;
  function createReader(doc, signal) {
    let closed = false;
    let activeFrame = null;

    async function read(url) {
      const source = core.detailLink(url);
      if (!source) throw new Error("订单详情地址无效。");
      if (closed || activeFrame) throw new Error("订单详情读取器不可用。");
      signal?.throwIfAborted();
      const frame = doc.createElement("iframe");
      frame.hidden = true;
      frame.title = "导出xmol入库单 · 订单详情";
      frame.setAttribute("sandbox", "allow-same-origin allow-scripts");
      activeFrame = frame;
      let reachedDetail = false;
      try {
        // Give each detail its own frame and detach it before loading the next.
        frame.src = source.url;
        doc.body.append(frame);
        const rows = await core.waitFor(() => {
          if (closed) throw new Error("订单详情读取已关闭。");
          const current = frame.contentDocument;
          if (!current || core.detailLink(current.URL)?.id !== source.id) return null;
          reachedDetail = true;
          return core.readOrderDetail(current);
        }, 14_000, signal).catch(error => {
          if (signal?.aborted || closed) throw error;
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
        frame.remove();
        activeFrame = null;
      }
    }

    return {
      read,
      close() {
        closed = true;
        activeFrame?.remove();
      }
    };
  }

  globalThis.NjuPurchaseDetail = { createReader };
})();
