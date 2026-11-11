"use strict";

importScripts("core.js");

const core = globalThis.NjuPurchaseCore;

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
  if (message?.type !== "nju-purchase/load-detail") return;
  const source = core.detailLink(message.url);
  if (sender.id !== chrome.runtime.id || !sender.tab ||
    !core.isOrderList(sender.url) || !source) {
    respond({ error: "请从南京大学试剂系统的「我的订单」发起同步。" });
    return;
  }
  readDetail(source, sender.tab.windowId).then(
    respond, () => respond({ error: "未能读取订单详情，请稍后重试。" })
  );
  return true;
});
