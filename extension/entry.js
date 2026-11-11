(() => {
  "use strict";

  const core = globalThis.NjuPurchaseCore;
  // The script runs on the whole site and waits for 我的订单, because the site switches
  // pages without reloading. Hidden frames (the detail reader) never need the button.
  if (window !== window.top) return;
  if (document.getElementById("nju-purchase-launcher")) return;

  const launcher = document.createElement("button");
  launcher.id = "nju-purchase-launcher";
  launcher.type = "button";
  launcher.textContent = "导出xmol入库单";
  launcher.className = "ant-btn ant-btn-primary";
  Object.assign(launcher.style, {
    marginInlineStart: "8px", whiteSpace: "nowrap", cursor: "pointer",
    color: "#fff", background: "#63065f", borderColor: "#63065f", fontWeight: "600"
  });

  // After the extension is reloaded or updated, this old content script loses its
  // chrome.* access and Chrome only reports "Extension context invalidated".
  function extension() {
    if (!chrome.runtime?.id) throw new Error("扩展已更新或重新加载，请刷新「我的订单」页面后再打开。");
    return chrome;
  }

  async function exportRequest(type, key, fields) {
    const result = await extension().runtime.sendMessage({ type, key, ...fields });
    if (result?.error) throw new Error(result.error);
    if (!result) throw new Error("未收到扩展响应，请重新加载订单页。");
    return result;
  }

  const services = {
    async read(key) {
      const { [key]: saved } = await extension().storage.local.get(key);
      return saved ?? { orders: {}, stocked: {} };
    },
    async write(key, database) {
      await extension().storage.local.set({ [key]: database });
    },
    createDetailReader(signal) {
      return globalThis.NjuPurchaseDetail.createReader(document, signal);
    },
    async readExportHistory(key) {
      const result = await exportRequest("nju-purchase/read-exports", key);
      return result.history;
    },
    watchExportHistory(update) {
      // Skip silently here; open() then reports the reload hint from read().
      if (!chrome.runtime?.id) return;
      chrome.storage.onChanged.addListener((changes, area) => {
        const change = changes[core.exportStorageKey];
        if (area === "local" && change) update(change.newValue?.accounts ?? {});
      });
    },
    async exportRows(key, rows) {
      const { bytes, nameFallbacks, missingFields } = globalThis.NjuPurchaseXls.buildFile(rows);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.ms-excel" }));
      try {
        const result = await exportRequest("nju-purchase/export", key, {
          url, items: rows.map(row => row.key)
        });
        return { ...result, nameFallbacks, missingFields };
      } finally {
        // Give the browser time to open the file stream before freeing the URL.
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
      }
    },
    markOldExport(key, rows) {
      return exportRequest("nju-purchase/mark-old-export", key, { items: rows.map(row => row.key) });
    },
    lock(key, action) {
      return navigator.locks.request(key, { ifAvailable: true }, lock => {
        if (!lock) throw new Error("另一个标签页正在处理采购台账，请稍后重试。");
        return action();
      });
    }
  };

  let panel;
  launcher.addEventListener("click", () => {
    panel ??= globalThis.NjuPurchasePanel.mount(document, services);
    void panel.open();
  });

  function placeLauncher() {
    if (!core.isOrderList(location.href)) {
      launcher.remove();
      return;
    }
    if (launcher.isConnected) return;
    const exportButton = [...document.querySelectorAll("button")].find(
      button => core.clean(button.textContent) === "导出"
    );
    exportButton?.after(launcher);
  }

  // Page switches inside the site arrive as DOM changes; check at most once per frame.
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      placeLauncher();
    });
  }

  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  addEventListener("popstate", schedule);
  placeLauncher();
})();
