(() => {
  "use strict";

  const core = globalThis.NjuPurchaseCore;
  if (!core.isOrderList(location.href)) return;
  if (document.getElementById("nju-purchase-launcher")) return;

  const launcher = document.createElement("button");
  launcher.id = "nju-purchase-launcher";
  launcher.type = "button";
  launcher.textContent = "同步采购";
  launcher.className = "ant-btn ant-btn-primary";
  Object.assign(launcher.style, {
    marginInlineStart: "8px", whiteSpace: "nowrap", cursor: "pointer",
    color: "#fff", background: "#651d5e", borderColor: "#651d5e", fontWeight: "600"
  });

  async function exportRequest(type, key, fields) {
    const result = await chrome.runtime.sendMessage({ type, key, ...fields });
    if (result?.error) throw new Error(result.error);
    if (!result) throw new Error("未收到扩展响应，请重新加载订单页。");
    return result;
  }

  const services = {
    async read(key) {
      const { [key]: saved } = await chrome.storage.local.get(key);
      return saved ?? { orders: {}, stocked: {} };
    },
    write(key, database) {
      return chrome.storage.local.set({ [key]: database });
    },
    loadDetail(url) {
      return chrome.runtime.sendMessage({ type: "nju-purchase/load-detail", url });
    },
    async readExportHistory(key) {
      const result = await exportRequest("nju-purchase/read-exports", key);
      return result.history;
    },
    watchExportHistory(update) {
      chrome.storage.onChanged.addListener((changes, area) => {
        const change = changes[core.exportStorageKey];
        if (area === "local" && change) update(change.newValue?.accounts ?? {});
      });
    },
    async exportRows(key, rows, options) {
      const { bytes, nameFallbacks, missingFields } = globalThis.NjuPurchaseXls.buildFile(rows, options);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.ms-excel" }));
      try {
        const result = await exportRequest("nju-purchase/export", key, {
          url, items: rows.map(row => row.key), intake: options?.intake === true
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

  function addLauncher() {
    if (launcher.isConnected || !core.isOrderList(location.href)) return;
    const exportButton = [...document.querySelectorAll("button")].find(
      button => core.clean(button.textContent) === "导出"
    );
    exportButton?.after(launcher);
  }

  new MutationObserver(addLauncher).observe(document.body, { childList: true, subtree: true });
  addLauncher();
})();
