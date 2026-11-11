"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const extension = path.resolve(__dirname, "../extension");
const sender = {
  id: "extension",
  url: "https://reagent.nju.edu.cn/labmai/cloudbean/personal/order",
  tab: { windowId: 5 }
};
const url = "blob:https://reagent.nju.edu.cn/3d05e3bf-4ee1-4364-ab50-afb95af492b0";
const account = "nju-purchase-v1:演示甲";
const otherAccount = "nju-purchase-v1:演示乙";
const order = (id, items) => ({
  id, date: "2026-11-10", number: "TEST" + id, items: items.map(id => ({ id }))
});
const keys = ['["101","501"]', '["101","502"]', '["102","503"]'];

function mockWorker() {
  const orders = { "101": order("101", ["501", "502"]), "102": order("102", ["503"]) };
  const storage = { [account]: { orders, stocked: { [keys[0]]: 1 } }, [otherAccount]: { orders } };
  const downloads = new Map();
  let request;
  let changed;
  let erased;
  let nextId = 1;
  let initialState = "in_progress";
  const chrome = {
    runtime: { id: "extension", onMessage: { addListener: callback => { request = callback; } } },
    storage: { local: {
      get: async key => ({ [key]: structuredClone(storage[key]) }),
      set: async values => {
        await new Promise(resolve => setImmediate(resolve));
        Object.assign(storage, structuredClone(values));
      }
    } },
    downloads: {
      download: async options => {
        assert.equal(options.url, url);
        assert.match(options.filename, /^x-mol_iv_products_\d{14}\.xls$/);
        const id = nextId++;
        downloads.set(id, { state: initialState });
        if (initialState === "complete") changed({ id, state: { current: "complete" } });
        return id;
      },
      search: async ({ id }) => downloads.has(id) ? [downloads.get(id)] : [],
      onChanged: { addListener: callback => { changed = callback; } },
      onErased: { addListener: callback => { erased = callback; } }
    }
  };
  let context;
  function restart() {
    context = vm.createContext({ URL, console, chrome });
    context.importScripts = name => vm.runInContext(fs.readFileSync(path.join(extension, name), "utf8"), context);
    vm.runInContext(fs.readFileSync(path.join(extension, "worker.js"), "utf8"), context);
  }
  restart();
  function message(type, fields = {}, from = sender) {
    return new Promise(resolve => request({ type: "nju-purchase/" + type, key: account, ...fields }, from, resolve));
  }
  return {
    storage, downloads, message, restart,
    async state(id, state, canResume = false) {
      downloads.set(id, { state, canResume });
      changed({ id, state: { current: state } });
      await vm.runInContext("exportWrites", context);
    },
    async erase(id) {
      downloads.delete(id);
      erased(id);
      await vm.runInContext("exportWrites", context);
    },
    setInitialState(state) { initialState = state; }
  };
}

test("a finished workbook increments each order once and each selected item only", async () => {
  const worker = mockWorker();
  const [first, second] = await Promise.all([
    worker.message("export", { items: [keys[0], keys[1], keys[0], keys[2]], url }),
    worker.message("export", { items: [keys[0]], url })
  ]);
  assert.equal(first.state, "in_progress");
  assert.equal(second.state, "in_progress");
  assert.equal((await worker.message("read-exports")).history.orders, undefined);
  await Promise.all([worker.state(1, "complete"), worker.state(2, "complete")]);
  await worker.state(1, "complete"); // A repeat completion cannot count the same download again.
  const { history } = await worker.message("read-exports");
  assert.equal(history.orders["101"].count, 2);
  assert.equal(history.orders["102"].count, 1);
  assert.equal(history.items[keys[0]].count, 2);
  assert.equal(history.items[keys[1]].count, 1);
  assert.equal(history.items[keys[2]].count, 1);
  assert.equal((await worker.message("read-exports", { key: otherAccount })).history.orders, undefined);
  assert.equal(worker.storage[account].stocked[keys[0]], 1);
});

test("cancelled, erased and invalid requests do not mark orders", async () => {
  const worker = mockWorker();
  assert.match((await worker.message("export", { items: ["unknown"], url })).error, /订单明细已变更/);
  assert.match((await worker.message("export", { items: [keys[0]], url: "https://example.net/data.xls" })).error, /来源无效/);
  assert.match((await worker.message("export", { items: [keys[0]], url },
    { ...sender, url: "https://example.net" })).error, /我的订单/);
  assert.equal(worker.downloads.size, 0);
  await worker.message("export", { items: [keys[0]], url });
  await worker.state(1, "interrupted");
  await worker.message("export", { items: [keys[0]], url });
  await worker.erase(2);
  assert.equal((await worker.message("read-exports")).history.orders, undefined);
  assert.deepEqual(worker.storage["nju-purchase-exports-v1"].pending, {});
});

test("a download finishing before registration or after a worker restart is counted once", async () => {
  const worker = mockWorker();
  worker.setInitialState("complete");
  assert.equal((await worker.message("export", { items: [keys[0]], url })).state, "complete");
  worker.setInitialState("in_progress");
  await worker.message("export", { items: [keys[0]], url });
  await worker.state(2, "interrupted", true);
  worker.downloads.set(2, { state: "complete" });
  worker.restart();
  assert.equal((await worker.message("read-exports")).history.orders["101"].count, 2);
  assert.equal((await worker.message("read-exports")).history.orders["101"].count, 2);
});

test("manual old exports are added once per order and once per selected item", async () => {
  const worker = mockWorker();
  worker.setInitialState("complete");
  await worker.message("export", { items: [keys[0]], url });
  assert.equal((await worker.message("mark-old-export", { items: [keys[0]] })).changed, true);
  assert.equal((await worker.message("mark-old-export", { items: [keys[1]] })).changed, true);
  assert.equal((await worker.message("mark-old-export", { items: keys.slice(0, 2) })).changed, false);
  const { history } = await worker.message("read-exports");
  assert.equal(history.orders["101"].count, 2);
  assert.equal(history.items[keys[0]].count, 2);
  assert.equal(history.items[keys[1]].count, 1);
  assert.equal(history.orders["102"], undefined);
});
