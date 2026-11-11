"use strict";

importScripts("core.js");

const core = globalThis.NjuPurchaseCore;
const exportKey = core.exportStorageKey;
let exportWrites = Promise.resolve();

async function readExportState() {
  const { [exportKey]: saved } = await chrome.storage.local.get(exportKey);
  return saved ?? { accounts: {}, pending: {} };
}

function changeExportState(change) {
  const write = exportWrites.then(async () => {
    const state = await readExportState();
    const changed = await change(state);
    if (changed) await chrome.storage.local.set({ [exportKey]: state });
    return changed;
  });
  exportWrites = write.catch(() => {});
  return write;
}

function countExport(state, batch, oldExport = false) {
  const history = state.accounts[batch.key] ??= { orders: {}, items: {} };
  let changed = false;
  for (const [counts, ids] of [[history.orders, batch.orders], [history.items, batch.items]]) {
    for (const id of ids) {
      const record = counts[id] ??= { count: 0, oldExport: false };
      if (oldExport && record.oldExport) continue;
      record.count++;
      if (oldExport) record.oldExport = true;
      changed = true;
    }
  }
  return changed;
}

function settleExport(id, outcome) {
  return changeExportState(async state => {
    const batch = state.pending[id];
    if (!batch) return false;
    if (outcome === "interrupted") {
      const [download] = await chrome.downloads.search({ id });
      if (download?.canResume || download?.state === "in_progress") return false;
      outcome = download?.state ?? outcome;
    }
    if (outcome === "complete") countExport(state, batch);
    // Save the counts and remove the pending download in one storage write.
    delete state.pending[id];
    return true;
  });
}

async function checkDownload(id) {
  const [download] = await chrome.downloads.search({ id });
  const outcome = download?.state ?? "erased";
  if (outcome !== "in_progress") await settleExport(id, outcome);
  return outcome;
}

async function readExportHistory(key) {
  let state = await readExportState();
  const pending = Object.keys(state.pending).filter(id => state.pending[id].key === key);
  if (pending.length) {
    await Promise.all(pending.map(id => checkDownload(Number(id))));
    state = await readExportState();
  }
  return { history: state.accounts[key] ?? {} };
}

async function readExportBatch(key, items) {
  if (!Array.isArray(items) || !items.length || items.some(item => typeof item !== "string")) {
    throw new Error("请先勾选商品。");
  }
  const { [key]: database } = await chrome.storage.local.get(key);
  const selected = new Set(items);
  const rows = core.records(database ?? {}).filter(row => selected.has(row.key));
  if (rows.length !== selected.size) throw new Error("订单明细已变更，请同步后重新勾选。");
  return { key, orders: [...new Set(rows.map(row => row.order.id))], items: rows.map(row => row.key) };
}

async function exportPurchase(message, sender) {
  const { key } = message;
  if (typeof key !== "string" || !key.startsWith(core.purchaseKeyPrefix) ||
    key.length === core.purchaseKeyPrefix.length) throw new Error("请先登录试剂系统。");
  if (message.type === "nju-purchase/read-exports") return readExportHistory(key);
  const batch = await readExportBatch(key, message.items);
  if (message.type === "nju-purchase/mark-old-export") {
    const changed = await changeExportState(state => countExport(state, batch, true));
    return { changed };
  }

  const url = new URL(message.url);
  if (url.protocol !== "blob:" || url.origin !== new URL(sender.url).origin) {
    throw new Error("导出文件来源无效。");
  }
  const now = new Date();
  const stamp = [now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(),
    now.getMinutes(), now.getSeconds()].map(value => String(value).padStart(2, "0")).join("");
  const id = await chrome.downloads.download({
    url: url.href, filename: "x-mol_iv_products_" + stamp + ".xls", conflictAction: "uniquify"
  });
  try {
    await changeExportState(state => {
      state.pending[id] = batch;
      return true;
    });
  } catch {
    throw new Error("下载已发起，但导出记录未能保存。");
  }
  // A small workbook may finish before its download ID has been stored.
  const state = await checkDownload(id).catch(() => "in_progress");
  return { state };
}

chrome.downloads.onChanged.addListener(({ id, state }) => {
  if (state?.current === "complete" || state?.current === "interrupted") {
    void settleExport(id, state.current).catch(console.error);
  }
});

chrome.downloads.onErased.addListener(id => {
  void settleExport(id, "erased").catch(console.error);
});

async function readDetail(source, windowId) {
  const tab = await chrome.tabs.create({ url: source.url, active: false, windowId });
  try {
    const deadline = Date.now() + 14_000;
    do {
      let result;
      try {
        result = await chrome.tabs.sendMessage(tab.id, {
          type: "nju-purchase/read-detail", orderId: source.id
        });
      } catch {
        // A newly created tab has no receiver until its detail script loads.
      }
      if (result?.rows || result?.error) return result;
      await new Promise(resolve => setTimeout(resolve, 300));
    } while (Date.now() < deadline);
    return { error: "订单详情加载超时，可能需要重新登录。" };
  } finally {
    await chrome.tabs.remove(tab.id).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  const type = message?.type;
  if (!["nju-purchase/load-detail", "nju-purchase/read-exports",
    "nju-purchase/export", "nju-purchase/mark-old-export"].includes(type)) return;
  if (sender.id !== chrome.runtime.id || !sender.tab || !core.isOrderList(sender.url)) {
    respond({ error: "请从南京大学试剂系统的「我的订单」使用同步采购。" });
    return;
  }
  if (type === "nju-purchase/load-detail") {
    const source = core.detailLink(message.url);
    if (!source) {
      respond({ error: "订单详情地址无效。" });
      return;
    }
    readDetail(source, sender.tab.windowId).then(
      respond, () => respond({ error: "未能读取订单详情，请稍后重试。" })
    );
  } else {
    exportPurchase(message, sender).then(respond, error => respond({ error: error.message }));
  }
  return true;
});
