"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const extension = path.resolve(__dirname, "../extension");
const listUrl = "https://reagent.nju.edu.cn/labmai/cloudbean/personal/order";
const detailPath = "/labmai/cloudbean/personal/orderDetail/2026110000000001?voucher=MTEST01";
const absoluteDetailUrl = "https://reagent.nju.edu.cn" + detailPath;
require(path.join(extension, "core.js"));
require(path.join(extension, "detail.js"));
const core = globalThis.NjuPurchaseCore;
const { createReader } = globalThis.NjuPurchaseDetail;

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

function readerFixture() {
  const frames = [];
  const navigations = [];
  const attached = new Set();
  const doc = {
    createElement: tag => {
      assert.equal(tag, "iframe");
      const frame = {
        contentDocument: null,
        setAttribute() {},
        set src(value) { navigations.push(value); },
        remove() { attached.delete(this); }
      };
      frames.push(frame);
      return frame;
    },
    body: {
      append: element => {
        assert.equal(attached.size, 0, "a previous detail frame is still attached");
        attached.add(element);
      }
    }
  };
  return { doc, frames, navigations, attached };
}

test("detail sync releases each hidden frame before opening the next order", async () => {
  const { doc, frames, navigations, attached } = readerFixture();
  const reader = createReader(doc);
  await assert.rejects(reader.read("https://example.net" + detailPath), /地址无效/);
  assert.deepEqual(navigations, []);
  const first = reader.read(absoluteDetailUrl);
  frames[0].contentDocument = { ...detailDocument([product]), URL: absoluteDetailUrl };
  assert.equal((await first)[0].name, product.name);
  assert.equal(attached.size, 0);

  const nextUrl = absoluteDetailUrl.replace("0001?", "0002?");
  const next = reader.read(nextUrl);
  const secondProduct = { ...product, id: "502", name: "测试试剂乙" };
  frames[1].contentDocument = { ...detailDocument([secondProduct]), URL: nextUrl };
  assert.equal((await next)[0].name, secondProduct.name);
  assert.deepEqual(navigations, [absoluteDetailUrl, nextUrl]);
  assert.equal(frames.length, 2);
  assert.ok(frames.every(frame => frame.hidden));
  reader.close();
  assert.equal(attached.size, 0);
});

test("stopping a sync cancels the pending detail without starting the next order", async () => {
  const { doc, attached, navigations } = readerFixture();
  const controller = new AbortController();
  const reader = createReader(doc, controller.signal);
  const pending = reader.read(absoluteDetailUrl);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(attached.size, 0);
  await assert.rejects(reader.read(absoluteDetailUrl), { name: "AbortError" });
  reader.close();
  assert.deepEqual(navigations, [absoluteDetailUrl]);
  assert.equal(attached.size, 0);
});
