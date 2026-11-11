(() => {
  "use strict";

  const intake = globalThis.NjuPurchaseIntake;

  function mount(doc, root, services) {
    const dialog = doc.createElement("dialog");
    dialog.className = "intake-dialog";
    dialog.setAttribute("aria-labelledby", "intake-title");
    dialog.innerHTML = `
      <div class="layout">
        <header class="head">
          <h1 id="intake-title"></h1>
          <button id="intake-close" type="button">关闭</button>
        </header>
        <div class="meta" id="intake-status" role="status" aria-live="polite"></div>
        <form class="intake-form">
          <div class="filters" id="intake-fields" hidden></div>
          <div class="surface" id="intake-surface"></div>
          <footer class="foot"><p id="intake-summary"></p><div class="actions" id="intake-actions"></div></footer>
        </form>
      </div>
    `;
    root.append(dialog);
    const get = selector => dialog.querySelector(selector);
    const title = get("#intake-title");
    const close = get("#intake-close");
    const status = get("#intake-status");
    const form = get("form");
    const fields = get("#intake-fields");
    const surface = get("#intake-surface");
    const summary = get("#intake-summary");
    const actions = get("#intake-actions");
    let submit;
    let busy = false;
    let receipts = [];
    let numbers = new Map();
    let batchLocation = "";

    function element(tag, text, className) {
      const node = doc.createElement(tag);
      if (text !== undefined) node.textContent = text;
      if (className) node.className = className;
      return node;
    }

    function announce(text, error = false) {
      status.textContent = text;
      status.classList.toggle("error", error);
    }

    function button(text, action) {
      const node = element("button", text);
      node.type = "button";
      node.addEventListener("click", action);
      return node;
    }

    function screen(heading, instruction, columns, label, action, otherButtons = []) {
      title.textContent = heading;
      announce(instruction);
      fields.replaceChildren();
      fields.hidden = true;
      submit = action;
      const primary = element("button", label, "primary");
      primary.type = "submit";
      actions.replaceChildren(...otherButtons, primary);
      const table = element("table");
      table.setAttribute("aria-label", heading);
      const head = table.createTHead().insertRow();
      for (const name of columns) {
        const header = element("th", name);
        header.scope = "col";
        head.append(header);
      }
      const body = table.createTBody();
      surface.replaceChildren(table);
      return { head, body, primary };
    }

    function product(cell, row) {
      cell.className = "name";
      cell.append(element("div", row.name), element("span",
        [row.cas, row.brand, row.pack].filter(Boolean).join(" · ") || "商品信息待核对", "sub"),
      element("span", row.orderNumber ?? row.order.number, "sub"));
    }

    function input(label, options) {
      const control = element("input");
      control.setAttribute("aria-label", label);
      Object.assign(control, options);
      return control;
    }

    async function run(action) {
      if (busy) return;
      busy = true;
      close.disabled = true;
      form.inert = true;
      try {
        await action();
      } catch (error) {
        announce(error.message || "入库操作未完成，请重试。", true);
      } finally {
        form.inert = false;
        close.disabled = false;
        busy = false;
      }
    }

    function showReceipts() {
      const { body } = screen("准备入库", "核对本次实际收到、尚未入库的瓶数。",
        ["试剂及订单", "待入库瓶数", "本次实收瓶数"], "填写产品编号", () => {
          const total = receipts.reduce((sum, receipt) => sum + receipt.count, 0);
          if (total < 1 || total > intake.maxBatchSize) {
            announce("X-MOL 每批可导入 1 至 " + intake.maxBatchSize + " 条记录，请调整本次瓶数。", true);
            return;
          }
          showNumbers();
        });
      const updateTotal = () => {
        summary.textContent = "本次 " + receipts.reduce((sum, receipt) => sum + receipt.count, 0) + " 瓶";
      };
      for (const receipt of receipts) {
        const row = body.insertRow();
        product(row.insertCell(), receipt.row);
        const remaining = intake.remaining(receipt.row);
        row.insertCell().textContent = remaining;
        const count = input(receipt.row.name + " 本次实收瓶数",
          { type: "number", required: true, min: 0, max: remaining, step: 1, value: receipt.count });
        count.addEventListener("input", () => {
          receipt.count = count.valueAsNumber || 0;
          updateTotal();
        });
        row.insertCell().append(count);
      }
      updateTotal();
    }

    function showNumbers() {
      const bottles = [];
      const { body } = screen("填写产品编号", "每瓶填一个产品编号。单瓶库存地留空时，使用本批库存地。",
        ["试剂及订单", "产品编号", "单瓶库存地"], "生成并下载入库表", () => run(async () => {
          announce("正在生成入库表…");
          const entries = bottles.map(({ key, number, location }) => ({
            key, productNumber: number.value, stockLocation: location.value.trim() || batchLocation
          }));
          const batch = await services.save(database => {
            const prepared = intake.prepareBatch(database, entries, doc.defaultView.crypto.randomUUID());
            globalThis.NjuPurchaseXls.buildFile(prepared.rows, { intake: true });
            database.intakeBatch = prepared;
            return prepared;
          });
          showBatch(batch);
          await download(batch);
        }), [button("返回核对瓶数", showReceipts)]);
      const commonLabel = element("label", "本批库存地");
      const common = input("本批库存地", { maxLength: 50, value: batchLocation, placeholder: "例如 A-01" });
      common.addEventListener("input", () => { batchLocation = common.value.trim(); });
      commonLabel.append(common);
      fields.append(commonLabel);
      fields.hidden = false;
      for (const { row, count } of receipts) {
        for (let index = 0; index < count; index++) {
          const id = JSON.stringify([row.key, index]);
          const saved = numbers.get(id) ?? { number: "", location: "" };
          numbers.set(id, saved);
          const tr = body.insertRow();
          product(tr.insertCell(), row);
          const label = row.name + " 第 " + (index + 1) + " 瓶";
          const number = input(label + " 产品编号", { required: true, maxLength: 100, value: saved.number });
          const location = input(label + " 库存地",
            { maxLength: 50, value: saved.location, placeholder: "使用本批库存地" });
          number.addEventListener("input", () => { saved.number = number.value; });
          location.addEventListener("input", () => { saved.location = location.value; });
          tr.insertCell().append(number);
          tr.insertCell().append(location);
          bottles.push({ key: row.key, number, location });
        }
      }
      summary.textContent = "将生成 " + bottles.length + " 条入库记录";
      common.focus();
    }

    async function download(batch) {
      const result = await services.download(batch);
      if (result.state === "interrupted" || result.state === "erased") {
        announce("下载未完成，可再次下载待确认表格。", true);
        return;
      }
      announce("已生成 " + result.filename + "。在 X-MOL 导入后，请勾选成功的瓶号。" +
        (result.nameFallbacks ? " " + result.nameFallbacks + " 条缺有效 CAS，已填写产品名称。" : "") +
        (result.missingFields ? " " + result.missingFields + " 条的品牌或包装规格待补。" : ""));
    }

    function showBatch(batch) {
      const checks = new Map();
      const { head, body, primary } = screen("待确认入库",
        "在 X-MOL 的「库存导入记录」核对结果，勾选实际导入成功的瓶号。",
        ["选择成功项", "试剂及订单", "产品编号", "库存地"], "确认所选已入库", () => run(async () => {
          const selected = [...checks].filter(([, checkbox]) => checkbox.checked).map(([number]) => number);
          const result = await services.save(database => intake.confirmBatch(database, batch, selected));
          services.message("已记录 " + result.confirmed + " 瓶入库。");
          if (result.batch) {
            showBatch(result.batch);
            announce("已记录 " + result.confirmed + " 瓶。剩余表格可单独下载。");
          } else {
            dialog.close();
          }
        }), [
          button("取消剩余批次", () => {
            if (!doc.defaultView.confirm("请核对剩余瓶号尚未导入 X-MOL。确定取消这批剩余记录吗？")) return;
            void run(async () => {
              await services.save(database => {
                intake.currentBatch(database, batch);
                delete database.intakeBatch;
              });
              services.message("已取消剩余待确认的记录。");
              dialog.close();
            });
          }),
          button("下载待确认 .xls", () => { void run(() => download(batch)); })
        ]);
      const all = input("全选待确认瓶号", { type: "checkbox" });
      head.cells[0].className = "select-cell";
      head.cells[0].replaceChildren(all);
      const updateSelection = () => {
        const checked = [...checks.values()].filter(checkbox => checkbox.checked).length;
        primary.disabled = checked === 0;
        all.checked = checked === batch.rows.length;
        all.indeterminate = checked > 0 && checked < batch.rows.length;
        summary.textContent = "待确认 " + batch.rows.length + " 瓶，已选 " + checked + " 瓶";
      };
      all.addEventListener("change", () => {
        for (const checkbox of checks.values()) checkbox.checked = all.checked;
        updateSelection();
      });
      for (const row of batch.rows) {
        const tr = body.insertRow();
        const choice = tr.insertCell();
        choice.className = "select-cell";
        const checkbox = input("选择 " + row.productNumber, { type: "checkbox" });
        checkbox.addEventListener("change", updateSelection);
        checks.set(row.productNumber, checkbox);
        choice.append(checkbox);
        product(tr.insertCell(), row);
        tr.insertCell().textContent = row.productNumber;
        tr.insertCell().textContent = row.stockLocation;
      }
      updateSelection();
    }

    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
    form.addEventListener("submit", event => {
      event.preventDefault();
      if (!busy) submit();
    });

    return {
      prepare(rows) {
        receipts = rows.map(row => ({ row, count: intake.remaining(row) }));
        numbers = new Map();
        batchLocation = "";
        showReceipts();
        dialog.showModal();
      },
      review(batch) {
        showBatch(batch);
        dialog.showModal();
      }
    };
  }

  globalThis.NjuPurchaseIntakePanel = { mount };
})();
