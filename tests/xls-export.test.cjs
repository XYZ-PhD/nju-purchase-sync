"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const extension = path.resolve(__dirname, "../extension");
require(path.join(extension, "core.js"));
require(path.join(extension, "xls-template.js"));
require(path.join(extension, "xls-export.js"));
const { buildFile } = globalThis.NjuPurchaseXls;

const example = { name: "硫酸铜", cas: "7758-98-7", brand: "示例品牌", pack: "100mg" };

test("selected data is serialized as a compound Excel file, with name fallback when CAS is invalid", () => {
  const output = buildFile([
    example,
    { ...example, pack: "25ml" },
    { name: "研究样品", cas: "7758-98-1", brand: "", pack: "5 g" },
    { name: "Demo mixture", cas: "", brand: "Vendor", pack: "10 mL" },
    { name: "Demo text", cas: "64-17-5", brand: "=literal brand", pack: "001g" }
  ]);
  assert.deepEqual([...output.bytes.subarray(0, 8)], [208, 207, 17, 224, 161, 177, 26, 225]);
  assert.equal(output.nameFallbacks, 2);
  assert.equal(output.missingFields, 1);
  fs.writeFileSync(path.join(__dirname, "test-selected.xls"), output.bytes);
});

test("long exports cross both BIFF row blocks and shared-string records", () => {
  const items = Array.from({ length: 260 }, (_, i) => ({
    ...example, brand: "第" + i + "个化学试剂品牌名称".repeat(5), pack: String(i) + "mg"
  }));
  const output = buildFile(items);
  assert.ok(output.bytes.length > 65536);
  fs.writeFileSync(path.join(__dirname, "test-many-rows.xls"), output.bytes);
});

test("empty and overlength input is rejected without truncation", () => {
  assert.throws(() => buildFile([]), /勾选/);
  assert.throws(() => buildFile([{ name: "", cas: "", brand: "", pack: "" }]), /有效 CAS/);
  assert.throws(() => buildFile([{ ...example, pack: "规".repeat(51) }]), /50 字符/);
});
