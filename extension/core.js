(() => {
  "use strict";

  const origin = "https://reagent.nju.edu.cn";
  const listPath = "/labmai/cloudbean/personal/order";
  const detailPath = "/labmai/cloudbean/personal/orderDetail/";
  const purchaseKeyPrefix = "nju-purchase-v1:";
  const exportStorageKey = "nju-purchase-exports-v1";
  const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
  const label = value => clean(value).replace(/[：:]\s*$/, "");

  function urlAtSite(value) {
    if (typeof value !== "string" || !value) return null;
    try {
      const url = new URL(value, origin);
      return url.origin === origin && !url.username && !url.password ? url : null;
    } catch {
      return null;
    }
  }

  function isSite(value) {
    return urlAtSite(value) !== null;
  }

  function isOrderList(value) {
    const url = urlAtSite(value);
    return url?.pathname.replace(/\/$/, "") === listPath;
  }

  function detailLink(value) {
    const url = urlAtSite(value);
    if (!url?.pathname.startsWith(detailPath)) return null;
    const id = url.pathname.slice(detailPath.length).replace(/\/$/, "");
    if (!/^\d{1,64}$/.test(id)) return null;
    return { id, url: url.href, number: clean(url.searchParams.get("voucher")) || id };
  }

  function readAccount(doc) {
    const greeting = [...doc.querySelectorAll("a.ant-dropdown-trigger")]
      .map(anchor => clean(anchor.textContent))
      .find(text => /^您好[，,]/.test(text));
    return clean(greeting?.replace(/^您好[，,]/, ""));
  }

  function readOrderList(doc) {
    const entries = new Map();
    for (const anchor of doc.querySelectorAll('a[href*="/personal/orderDetail/"]')) {
      if (clean(anchor.textContent) !== "查看详情") continue;
      const source = detailLink(anchor.getAttribute("href"));
      if (!source) continue;
      const header = anchor.parentElement?.parentElement;
      const numberLink = [...(header?.querySelectorAll("a[href]") ?? [])].find(candidate =>
        candidate !== anchor && detailLink(candidate.getAttribute("href"))?.id === source.id
      );
      const dateLabel = [...(header?.querySelectorAll("span") ?? [])].find(
        node => label(node.textContent) === "下单时间"
      );
      entries.set(source.id, {
        ...source,
        number: clean(numberLink?.textContent) || source.number,
        status: clean(numberLink?.nextElementSibling?.textContent),
        date: clean(dateLabel?.nextElementSibling?.textContent) ||
          (header?.textContent ?? "").match(/\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}:\d{2})?/)?.[0] || ""
      });
    }
    return [...entries.values()];
  }

  function normalizeCas(value) {
    return clean(value).replace(/[‐‑‒–—−]/g, "-").replace(/\s*-\s*/g, "-");
  }

  function isCas(value) {
    if (!/^\d{2,7}-\d{2}-\d$/.test(value)) return false;
    const digits = value.replace(/-/g, "");
    const total = [...digits.slice(0, -1)].reverse().reduce(
      (sum, digit, index) => sum + Number(digit) * (index + 1), 0
    );
    return total % 10 === Number(digits.at(-1));
  }

  function readOrderDetail(doc) {
    const needed = ["商品", "数量", "状态"];
    for (const table of doc.querySelectorAll("table")) {
      const labels = [...table.querySelectorAll("thead th")].map(cell => clean(cell.textContent));
      if (!needed.every(name => labels.includes(name))) continue;
      const [productIndex, quantityIndex, statusIndex] = needed.map(name => labels.indexOf(name));
      const rows = [...table.querySelectorAll("tbody tr[data-row-key]")];
      if (!rows.length) return null;
      return rows.map(row => {
        const product = row.cells[productIndex];
        const quantityText = clean(row.cells[quantityIndex]?.textContent);
        const fields = Object.fromEntries(
          [...(product?.querySelectorAll(".ant-tag") ?? [])]
            .map(tag => clean(tag.textContent).match(/^([^：:]+)[：:]\s*(.*)$/))
            .filter(Boolean)
            .map(match => [clean(match[1]).replace(/\s+/g, "").toUpperCase(), clean(match[2])])
        );
        const name = clean(product?.querySelector(".underline.text-primary-default")?.textContent) ||
          clean(product?.querySelector(".ant-tag")?.parentElement?.previousElementSibling?.textContent);
        return {
          id: row.getAttribute("data-row-key"),
          name,
          brand: fields["品牌"] || "",
          cas: normalizeCas(fields["CAS号"] || fields.CAS),
          code: fields["货号"] || "",
          pack: fields["包装"] || fields["规格"] || "",
          quantity: /^\d+$/.test(quantityText) && Number.isSafeInteger(Number(quantityText))
            ? Number(quantityText) : null,
          quantityText,
          status: clean(row.cells[statusIndex]?.textContent)
        };
      });
    }
    return null;
  }

  function lineKey(orderId, lineId) {
    return JSON.stringify([orderId, lineId]);
  }

  function records(database) {
    return Object.values(database.orders ?? {}).flatMap(order => order.items.map(item => ({
      ...item,
      order,
      key: lineKey(order.id, item.id),
      stocked: database.stocked?.[lineKey(order.id, item.id)] ?? 0
    }))).sort((a, b) => b.order.date.localeCompare(a.order.date) ||
      b.order.number.localeCompare(a.order.number));
  }

  function isExcluded(row) {
    return /已取消|已退货|已退款/.test(row.order.status) ||
      /已取消|已退货|已退款|退货中|退款中/.test(row.status);
  }

  function isArrival(row) {
    return !isExcluded(row) && /^(已到货|已收货|已确认收货|已签收)$/.test(row.status);
  }

  function aggregate(rows) {
    const groups = new Map();
    let needsReview = 0;
    for (const row of rows) {
      if (isExcluded(row)) continue;
      if (!row.brand || !isCas(row.cas) || row.quantity === null) {
        needsReview++;
        continue;
      }
      const key = JSON.stringify([row.brand, row.cas]);
      const group = groups.get(key) ?? {
        brand: row.brand, cas: row.cas, quantity: 0, orders: new Set(), names: new Set()
      };
      group.quantity += row.quantity;
      group.orders.add(row.order.id);
      if (row.name) group.names.add(row.name);
      groups.set(key, group);
    }
    return {
      groups: [...groups.values()].sort((a, b) => b.quantity - a.quantity ||
        a.brand.localeCompare(b.brand, "zh-CN") || a.cas.localeCompare(b.cas)),
      needsReview
    };
  }

  async function waitFor(read, timeoutMs, signal) {
    const deadline = Date.now() + timeoutMs;
    do {
      signal?.throwIfAborted();
      const result = read();
      if (result) return result;
      await new Promise(resolve => setTimeout(resolve, 120));
    } while (Date.now() < deadline);
    throw new Error("页面等待超时，请确认登录状态后重试。");
  }

  globalThis.NjuPurchaseCore = {
    purchaseKeyPrefix, exportStorageKey,
    clean, isSite, isOrderList, detailLink, readAccount, readOrderList, readOrderDetail,
    isCas, records, isExcluded, isArrival, aggregate, waitFor
  };
})();
