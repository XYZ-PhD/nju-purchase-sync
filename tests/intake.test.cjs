"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

require("../extension/core.js");
require("../extension/intake.js");
const { prepareBatch, confirmBatch, batchForDownload } = globalThis.NjuPurchaseIntake;

const key = '["101","1"]';
const bottle = (number, orderKey = key) => ({ key: orderKey, productNumber: number, stockLocation: "A-01" });
function database() {
  const item = { id: "1", name: "苯甲酸", cas: "65-85-0", brand: "示例品牌", pack: "25 g",
    quantity: 3, quantityText: "3", status: "已到货" };
  return {
    orders: {
      "101": { id: "101", number: "TEST101", date: "2026-11-11", status: "已完成",
        items: [item, { ...item, id: "2", status: "已发货" }] }
    },
    stocked: { [key]: 1 }
  };
}

test("a prepared batch respects old stocked quantities and creates one entry per bottle", () => {
  const db = database();
  const batch = prepareBatch(db, [bottle(" 0007 "), bottle("R-008")], "batch-1");
  assert.equal(batch.rows.length, 2);
  assert.deepEqual(batch.rows[0], {
    key, name: "苯甲酸", cas: "65-85-0", brand: "示例品牌", pack: "25 g",
    orderNumber: "TEST101", productNumber: "0007", stockLocation: "A-01"
  });
  assert.deepEqual(db.stocked, { [key]: 1 });
  assert.throws(() => prepareBatch(db, [bottle("1"), bottle("2"), bottle("3")], "too-many"), /待入库数量/);
  assert.throws(() => prepareBatch(db, [bottle("R-009", '["101","2"]')], "not-arrived"), /到货/);
  assert.throws(() => prepareBatch(db, Array(3001).fill(bottle("R-009")), "oversize"), /3000/);
  db.intakeBatch = batch;
  assert.throws(() => prepareBatch(db, [bottle("R-009")], "another"), /当前待确认/);
});

test("partial confirmation only counts selected bottles and preserves a retryable remainder", () => {
  const db = database();
  const batch = prepareBatch(db, [bottle("0007"), bottle("R-008")], "batch-1");
  db.intakeBatch = batch;
  assert.throws(() => confirmBatch(db, batch, ["other"]), /勾选/);
  assert.equal(db.stocked[key], 1);
  const result = confirmBatch(db, batch, ["0007"]);
  assert.equal(result.confirmed, 1);
  assert.equal(db.stocked[key], 2);
  assert.equal(batchForDownload(db, result.batch).rows[0].productNumber, "R-008");
  assert.throws(() => confirmBatch(db, batch, ["0007"]), /已变更/);
  assert.throws(() => batchForDownload(db, batch), /已变更/);
  assert.equal(db.stocked[key], 2);
  confirmBatch(db, result.batch, ["R-008"]);
  assert.equal(db.stocked[key], 3);
  assert.equal(db.intakeBatch, undefined);
});

test("duplicate numbers and changed capacity are rejected without partially updating the ledger", () => {
  const db = database();
  assert.throws(() => prepareBatch(db, [bottle("R-008"), bottle(" r-008 ")], "dup"), /重复/);
  assert.throws(() => prepareBatch(db, [{ ...bottle("R-008"), stockLocation: " " }], "empty"), /库存地/);
  const batch = prepareBatch(db, [bottle("R-008"), bottle("R-009")], "batch-1");
  db.intakeBatch = batch;
  db.orders["101"].items[0].quantity = 2;
  assert.throws(() => confirmBatch(db, batch, ["R-008", "R-009"]), /待入库数量/);
  assert.equal(db.stocked[key], 1);
  assert.equal(db.intakeNumbers, undefined);
  assert.equal(db.intakeBatch.rows.length, 2);
  confirmBatch(db, batch, ["R-008"]);
  delete db.intakeBatch;
  db.orders["101"].items[0].quantity = 3;
  assert.throws(() => prepareBatch(db, [bottle("r-008")], "dup-prior"), /重复/);
});
