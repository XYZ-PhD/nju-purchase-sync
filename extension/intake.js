(() => {
  "use strict";

  const core = globalThis.NjuPurchaseCore;
  const maxBatchSize = 3000;
  const numberKey = number => "product:" + number.toLowerCase();

  function remaining(row) {
    return Number.isSafeInteger(row.quantity) && Number.isSafeInteger(row.stocked)
      ? Math.max(0, row.quantity - row.stocked) : null;
  }

  function canPrepare(row) {
    return core.isArrival(row) && remaining(row) > 0;
  }

  function checkCapacity(database, bottles, requireArrival) {
    const rows = new Map(core.records(database).map(row => [row.key, row]));
    const counts = new Map();
    for (const bottle of bottles) counts.set(bottle.key, (counts.get(bottle.key) ?? 0) + 1);
    for (const [key, count] of counts) {
      const row = rows.get(key);
      if (!row || (requireArrival && !canPrepare(row)) || !(remaining(row) >= count)) {
        throw new Error((row?.name || "所选商品") + "的到货或待入库数量已变更，请重新核对。");
      }
    }
    return { rows, counts };
  }

  function prepareBatch(database, bottles, id) {
    if (database.intakeBatch) throw new Error("请先处理当前待确认入库的批次。");
    if (!bottles.length || bottles.length > maxBatchSize) {
      throw new Error("X-MOL 每批可导入 1 至 " + maxBatchSize + " 条入库记录。");
    }
    const { rows } = checkCapacity(database, bottles, true);
    const numbers = new Set();
    const entries = bottles.map(bottle => {
      const row = rows.get(bottle.key);
      const productNumber = bottle.productNumber.trim();
      const stockLocation = bottle.stockLocation.trim();
      if (!productNumber || productNumber.length > 100) {
        throw new Error(row.name + "的产品编号需要填写，最多 100 字符。");
      }
      if (!stockLocation || stockLocation.length > 50) {
        throw new Error(row.name + "的库存地需要填写，最多 50 字符。");
      }
      const code = numberKey(productNumber);
      if (numbers.has(code) || Object.hasOwn(database.intakeNumbers ?? {}, code)) {
        throw new Error("产品编号「" + productNumber + "」在本批或已确认入库的记录中重复。");
      }
      numbers.add(code);
      return {
        key: row.key, name: row.name, cas: row.cas, brand: row.brand, pack: row.pack,
        orderNumber: row.order.number, productNumber, stockLocation
      };
    });
    return { id, rows: entries };
  }

  function currentBatch(database, expected) {
    const batch = database.intakeBatch;
    if (!batch || batch.id !== expected.id || batch.rows.length !== expected.rows.length) {
      throw new Error("待确认批次已变更，请关闭后重新打开。");
    }
    return batch;
  }

  function batchForDownload(database, expected) {
    const batch = currentBatch(database, expected);
    checkCapacity(database, batch.rows, true);
    return batch;
  }

  function confirmBatch(database, expected, numbers) {
    const batch = currentBatch(database, expected);
    const selected = new Set(numbers);
    const confirmed = batch.rows.filter(row => selected.has(row.productNumber));
    if (!confirmed.length || confirmed.length !== selected.size) {
      throw new Error("请勾选已在 X-MOL 导入成功的产品编号。");
    }
    const { rows, counts } = checkCapacity(database, confirmed, false);
    const knownNumbers = database.intakeNumbers ?? {};
    for (const bottle of confirmed) {
      if (Object.hasOwn(knownNumbers, numberKey(bottle.productNumber))) {
        throw new Error("产品编号「" + bottle.productNumber + "」已确认入库，请先核对记录。");
      }
    }

    database.stocked ??= {};
    for (const [key, count] of counts) database.stocked[key] = rows.get(key).stocked + count;
    for (const bottle of confirmed) knownNumbers[numberKey(bottle.productNumber)] = true;
    database.intakeNumbers = knownNumbers;
    const unconfirmed = batch.rows.filter(row => !selected.has(row.productNumber));
    if (unconfirmed.length) database.intakeBatch = { id: batch.id, rows: unconfirmed };
    else delete database.intakeBatch;
    return { confirmed: confirmed.length, batch: database.intakeBatch };
  }

  globalThis.NjuPurchaseIntake = {
    maxBatchSize, remaining, canPrepare, prepareBatch, currentBatch, batchForDownload, confirmBatch
  };
})();
