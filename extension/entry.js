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
