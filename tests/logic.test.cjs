"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const extension = path.resolve(__dirname, "../extension");
const listUrl = "https://reagent.nju.edu.cn/labmai/cloudbean/personal/order";
const detailPath = "/labmai/cloudbean/personal/orderDetail/2026110000000001?voucher=MTEST01";
const absoluteDetailUrl = "https://reagent.nju.edu.cn" + detailPath;
require(path.join(extension, "core.js"));
const core = globalThis.NjuPurchaseCore;

function detailDocument(products) {
  const headers = ["", "图片", "商品", "单价", "数量", "总价", "状态", "操作"];
  const rows = products.map(product => {
    const tags = ["品牌：" + product.brand, "CAS 号: " + product.cas,
      "货号: " + product.code, "包装：" + product.pack].map(textContent => ({ textContent }));
    const cell = {
      querySelectorAll: () => tags,
      querySelector: selector => selector === ".underline.text-primary-default"
        ? { textContent: product.name } : null
    };
    return {
      cells: [{}, {}, cell, {}, { textContent: product.quantity }, {}, { textContent: product.status }],
      getAttribute: attribute => attribute === "data-row-key" ? product.id : null
    };
  });
  const table = {
    querySelectorAll: selector => selector === "thead th"
      ? headers.map(textContent => ({ textContent })) : rows
  };
  return { querySelectorAll: () => [table] };
}

const product = {
  id: "501", name: "五水硫酸铜", brand: "测试品牌甲", cas: "7758–99–8",
  code: "00017", pack: "25 g", quantity: "2", status: "已到货"
};

test("only the two permitted order paths are accepted", () => {
  assert.equal(core.isOrderList(listUrl), true);
  assert.equal(core.isOrderList(listUrl + "Detail/1"), false);
  assert.equal(core.detailLink(detailPath).number, "MTEST01");
  assert.equal(core.detailLink("https://example.net" + detailPath), null);
  assert.equal(core.detailLink(detailPath.replace("2026110000000001", "__proto__")), null);
  assert.equal(core.detailLink("https://a:b@reagent.nju.edu.cn" + detailPath), null);
});

test("an order header is read through its visible detail link", () => {
  const date = { textContent: "下单时间:", nextElementSibling: { textContent: "2026-11-10 14:35:00" } };
  const numberLink = {
    getAttribute: () => detailPath, textContent: "MTEST01",
    nextElementSibling: { textContent: "已取消" }
  };
  const anchor = {
    getAttribute: () => detailPath, textContent: " 查看详情 ",
    parentElement: {
      parentElement: { querySelectorAll: selector => selector === "span" ? [date] : [numberLink] }
    }
  };
  const orders = core.readOrderList({ querySelectorAll: () => [anchor, anchor] });
  assert.equal(orders.length, 1);
  assert.equal(orders[0].date, "2026-11-10 14:35:00");
  assert.equal(orders[0].status, "已取消");
});

test("multi-item detail preserves each brand, CAS, SKU and actual status", () => {
  const items = core.readOrderDetail(detailDocument([
    product,
    { ...product, id: "502", brand: "", cas: "", quantity: "—", status: "未发货" }
  ]));
  assert.deepEqual(items[0], {
    id: "501", name: "五水硫酸铜", brand: "测试品牌甲", cas: "7758-99-8", code: "00017",
    pack: "25 g", quantity: 2, quantityText: "2", status: "已到货"
  });
  assert.equal(items[1].brand, "");
  assert.equal(items[1].cas, "");
  assert.equal(items[1].quantity, null);
  assert.equal(core.isCas("7758-99-8"), true);
  assert.equal(core.isCas("7758-99-3"), false);
});

test("summary keeps legitimate repeat purchases, avoids repeated snapshots and excludes cancelled items", () => {
  const items = core.readOrderDetail(detailDocument([product]));
  const orders = {};
  function update(id, status, lines) {
    orders[id] = { id, status, date: "2026-11-10", number: "T" + id, items: lines };
  }
  update("1", "待付款", items);
  update("1", "待付款", items);
  update("2", "退货中", [
    { ...items[0], id: "503", quantity: 3, status: "已发货" },
    { ...items[0], id: "504", quantity: 8, status: "退货中" }
  ]);
  update("3", "已取消", [{ ...items[0], id: "505", quantity: 7 }]);
  update("4", "待付款", [{ ...items[0], id: "506", cas: "7758-99-3" }]);
  const rows = core.records({ orders, stocked: { '["1","501"]': 1 } });
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.filter(core.isArrival).map(row => [row.order.id, row.stocked]), [
    ["4", 0], ["1", 1]
  ]);
  const { groups, needsReview } = core.aggregate(rows);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].quantity, 5);
  assert.equal(groups[0].orders.size, 2);
  assert.equal(needsReview, 1);
});

test("background worker retries a not-yet-ready detail tab and closes only its own tab", async () => {
  const calls = [];
  let listener;
  let attempts = 0;
  const worker = {
    URL,
    setTimeout: callback => setImmediate(callback),
    chrome: {
      runtime: { id: "extension", onMessage: { addListener: callback => { listener = callback; } } },
      downloads: { onChanged: { addListener() {} }, onErased: { addListener() {} } },
      tabs: {
        create: async options => { calls.push(["open", options]); return { id: 413 }; },
        sendMessage: async (id, message) => {
          assert.equal(id, 413);
          assert.equal(message.orderId, "2026110000000001");
          if (++attempts === 1) throw new Error("Content script is not ready.");
          if (attempts === 2) return { ready: false };
          return { rows: [product] };
        },
        remove: async id => { calls.push(["close", id]); }
      }
    }
  };
  const context = vm.createContext(worker);
  context.importScripts = name => vm.runInContext(fs.readFileSync(path.join(extension, name), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(extension, "worker.js"), "utf8"), context);
  const request = { type: "nju-purchase/load-detail", url: absoluteDetailUrl };
  const blocked = await new Promise(resolve => listener(request, {
    id: "extension", url: "https://example.net", tab: { windowId: 23 }
  }, resolve));
  assert.equal(typeof blocked.error, "string");
  assert.equal(calls.length, 0);
  const result = await new Promise(resolve => {
    assert.equal(listener(request, {
      id: "extension", url: listUrl, tab: { windowId: 23 }
    }, resolve), true);
  });
  assert.deepEqual(result.rows, [product]);
  assert.equal(attempts, 3);
  assert.equal(calls[0][1].active, false);
  assert.equal(calls[0][1].windowId, 23);
  assert.deepEqual(calls[1], ["close", 413]);
});
