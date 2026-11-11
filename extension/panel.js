(() => {
  "use strict";

  const core = globalThis.NjuPurchaseCore;
  const pageSize = 25;
  const style = `
    :host { all: initial; color: #292139; font: 14px/1.45 "Microsoft YaHei UI", system-ui, sans-serif; }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    dialog { inset: 0; width: min(1210px, calc(100% - 40px)); max-width: none;
      height: min(800px, calc(100% - 40px)); max-height: none; margin: auto; padding: 0;
      border: 1px solid #e9e1ed; border-radius: 18px; color: inherit; background: #fbf9fc;
      box-shadow: 0 18px 66px #20123040; overflow: hidden; }
    dialog::backdrop { background: #22172b85; }
    .layout { display: flex; flex-direction: column; height: 100%; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 18px;
      padding: 23px 27px 20px; background: #fff; border-bottom: 1px solid #ebe4ef; }
    .eyebrow { color: #75396f; font-size: 12px; font-weight: 650; }
    h1 { margin: 2px 0 0; font-size: 29px; font-weight: 720; letter-spacing: -.04em; }
    .head p { color: #706477; margin: 5px 0 0; font-size: 13px; }
    .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    button, input { font: inherit; }
    button { cursor: pointer; color: #4e3154; padding: 7px 12px; border: 1px solid #e4d9e7;
      border-radius: 7px; background: #fff; font-weight: 620; white-space: nowrap; }
    button:hover:enabled { background: #f2eaf5; }
    button:disabled { opacity: .48; cursor: default; }
    button:focus-visible, input:focus-visible, a:focus-visible { outline: 2px solid #8e4388;
      outline-offset: 2px; }
    .primary { background: #651d5e; border-color: #651d5e; color: #fff; }
    .primary:hover:enabled { background: #7b3474; }
    .meta { padding: 9px 27px; color: #65596b; background: #f4eef6;
      border-bottom: 1px solid #ebe4ef; font-size: 12px; }
    .meta.error { color: #922c39; background: #fff0f0; }
    .error-detail { margin-top: 3px; overflow-wrap: anywhere; }
    .error-detail summary { cursor: pointer; }
    .filters { display: flex; align-items: end; flex-wrap: wrap; gap: 10px 14px;
      padding: 14px 27px 12px; }
    label { display: flex; flex-direction: column; gap: 4px; color: #65596b; font-size: 12px; }
    .search { flex: 1 1 220px; }
    input { min-height: 34px; padding: 6px 9px; color: #282036; border: 1px solid #e4d9e7;
      border-radius: 7px; background: #fff; }
    input[type=number] { width: 68px; }
    .metrics { display: flex; flex-wrap: wrap; gap: 8px 20px; padding: 0 27px 12px; color: #685d70;
      font-size: 12px; }
    .metrics strong { margin-right: 5px; color: #4d1d4c; font-size: 19px; font-weight: 700; }
    .tabs-line { display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 8px 14px; padding: 0 27px; }
    .tabs { display: flex; flex-wrap: wrap; gap: 5px; }
    .tabs button { padding: 8px 13px; background: transparent; border-color: transparent; }
    .tabs button[aria-pressed=true] { background: #eee2f0; color: #551750; }
    .selection { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; }
    .selected-count { color: #65596b; font-size: 12px; }
    .surface { flex: 1; min-height: 120px; margin: 11px 27px 0; overflow: auto;
      border: 1px solid #e9e1ed; border-radius: 10px; background: #fff; }
    table { width: 100%; min-width: 650px; border-collapse: separate; border-spacing: 0;
      text-align: left; font-size: 13px; }
    th { position: sticky; top: 0; z-index: 1; padding: 9px 12px; color: #5b4b63;
      background: #f6f1f7; border-bottom: 1px solid #e9e1ed; font-weight: 700; }
    td { padding: 9px 12px; vertical-align: middle; border-bottom: 1px solid #f1ebf2; }
    tbody tr:hover { background: #fcf9fc; }
    tbody tr:last-child td { border-bottom: 0; }
    tbody tr.selectable { cursor: pointer; }
    tbody tr.is-selected { background: #f5edf7; }
    .select-cell { width: 42px; text-align: center; }
    .select-cell input { min-height: 0; width: 16px; height: 16px; margin: 0;
      accent-color: #651d5e; vertical-align: middle; cursor: pointer; }
    .sub { display: block; margin-top: 3px; color: #706477; font-size: 11px; }
    .name { font-weight: 630; min-width: 155px; max-width: 330px; overflow-wrap: anywhere; }
    a { color: #70406f; text-underline-offset: 2px; }
    .cas { border: 0; padding: 2px 4px; color: #60255f; font-family: Consolas, monospace; }
    .muted { color: #796d80; }
    .chip { display: inline-block; padding: 2px 7px; border-radius: 20px;
      color: #6c5075; background: #f3eaf5; white-space: nowrap; font-size: 11px; }
    .export-count { white-space: nowrap; }
    .green { color: #155e45; background: #e8f5ec; }
    .gray { color: #716872; background: #f1eef2; }
    .amber { color: #884b26; }
    .empty { padding: 30px; text-align: center; color: #716478; }
    .foot { display: flex; align-items: center; justify-content: space-between;
      gap: 8px 14px; flex-wrap: wrap; min-height: 47px; padding: 8px 27px; }
    .foot p { margin: 0; color: #6d6175; font-size: 12px; }
    .pager { display: flex; align-items: center; gap: 8px; font-size: 12px; }
    .pager button { padding: 3px 9px; }
    @media (max-width: 720px) {
      dialog { width: calc(100% - 14px); height: calc(100% - 14px); }
      .head { padding: 12px; align-items: flex-start; flex-direction: column; gap: 7px; }
      .head p { display: none; } h1 { font-size: 22px; }
      .meta, .filters, .metrics, .tabs-line, .foot { padding-left: 12px; padding-right: 12px; }
      .surface { margin-left: 12px; margin-right: 12px; }
    }
  `;
  const markup = `
    <dialog aria-labelledby="sync-title">
      <div class="layout">
        <header class="head">
          <div><div class="eyebrow">南京大学试剂管理系统</div>
          <h1 id="sync-title">同步采购</h1><p>在浏览器里查看采购明细、品牌和 CAS 号。</p></div>
          <div class="actions">
            <button class="primary" id="sync-page" type="button">同步本页</button>
            <button id="sync-all" type="button">同步筛选范围全部页</button>
            <button id="stop" type="button" hidden>停止</button>
            <button id="close" type="button">关闭</button>
          </div>
        </header>
        <div class="meta"><div id="status" role="status" aria-live="polite"></div>
          <details id="errors" class="error-detail" hidden><summary>查看未同步订单</summary><div id="error-list"></div></details>
        </div>
        <div class="filters">
          <label class="search">搜索<input id="query" type="search" placeholder="试剂名、品牌、CAS、货号或订单号"></label>
          <label>下单日期起<input id="since" type="date"></label>
          <label>下单日期止<input id="until" type="date"></label>
        </div>
        <div id="metrics" class="metrics" aria-label="统计概况"></div>
        <div class="tabs-line">
          <nav class="tabs" aria-label="采购视图">
            <button type="button" data-view="detail" aria-pressed="true">采购明细</button>
            <button type="button" data-view="summary" aria-pressed="false">品牌与 CAS 汇总</button>
            <button type="button" data-view="arrival" aria-pressed="false">到货核对</button>
          </nav>
          <div class="selection">
            <span id="selected-count" class="selected-count" aria-live="polite">已选 0 条</span>
            <button id="clear-selected" type="button" disabled>清空选择</button>
            <button id="mark-old-export" type="button" disabled
              title="为选中的旧版已导出商品补记 1 次">补记旧版导出</button>
            <button id="export-selected" class="primary" type="button" disabled>导出所选 .xls</button>
          </div>
        </div>
        <div class="surface" id="surface"></div>
        <footer class="foot">
          <p id="footnote"></p>
          <div class="pager"><button type="button" id="prev">上一页</button>
            <span id="position"></span><button type="button" id="next">下一页</button></div>
        </footer>
      </div>
    </dialog>
  `;

  function mount(doc, services) {
    const host = doc.createElement("div");
    host.id = "nju-purchase-dashboard";
    const root = host.attachShadow({ mode: "open" });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(style);
    root.adoptedStyleSheets = [sheet];
    root.innerHTML = markup;
    doc.body.append(host);

    const get = id => root.getElementById(id);
    const dialog = root.querySelector("dialog");
    const elements = {
      syncPage: get("sync-page"), syncAll: get("sync-all"), stop: get("stop"),
      close: get("close"), query: get("query"), since: get("since"), until: get("until"),
      metrics: get("metrics"), status: get("status"), errors: get("errors"),
      errorList: get("error-list"), surface: get("surface"), foot: get("footnote"),
      prev: get("prev"), next: get("next"), position: get("position"),
      selectedCount: get("selected-count"), clearSelected: get("clear-selected"),
      exportSelected: get("export-selected"), markOldExport: get("mark-old-export")
    };
    let database = { orders: {}, stocked: {} };
    let storageKey = "";
    let view = "detail";
    let tablePage = 1;
    let activeSync = null;
    let updatingExport = false;
    let exportHistory = {};
    let exportRevision = 0;
    const selectedKeys = new Set();

    function node(tag, text, className) {
      const element = doc.createElement(tag);
      if (text !== undefined) element.textContent = text;
      if (className) element.className = className;
      return element;
    }

    function message(text, errors = []) {
      elements.status.textContent = text;
      elements.status.parentElement.classList.toggle("error", errors.length > 0);
      elements.errors.hidden = errors.length === 0;
      elements.errorList.replaceChildren(...errors.map(error => node("div", error)));
    }

    function filteredRecords(records) {
      const query = core.clean(elements.query.value).toLowerCase();
      return records.filter(row => {
        const date = row.order.date.slice(0, 10);
        if (elements.since.value && (!date || date < elements.since.value)) return false;
        if (elements.until.value && (!date || date > elements.until.value)) return false;
        return !query || [row.name, row.brand, row.cas, row.code, row.pack, row.order.number]
          .some(value => value.toLowerCase().includes(query));
      });
    }

    function updateSelection() {
      const count = selectedKeys.size;
      elements.selectedCount.textContent = "已选 " + count + " 条";
      elements.clearSelected.disabled = count === 0;
      const cannotExport = count === 0 || activeSync !== null || updatingExport;
      elements.exportSelected.disabled = cannotExport;
      elements.markOldExport.disabled = cannotExport;
      const inputs = [...elements.surface.querySelectorAll(".row-select")];
      let checked = 0;
      for (const input of inputs) {
        input.checked = selectedKeys.has(input.dataset.rowKey);
        input.closest("tr").classList.toggle("is-selected", input.checked);
        if (input.checked) checked++;
      }
      const pageCheckbox = elements.surface.querySelector(".page-select");
      if (pageCheckbox) {
        pageCheckbox.checked = inputs.length > 0 && checked === inputs.length;
        pageCheckbox.indeterminate = checked > 0 && checked < inputs.length;
      }
    }

    function render() {
      const records = core.records(database);
      if (selectedKeys.size) {
        const available = new Set(records.map(row => row.key));
        for (const key of selectedKeys) if (!available.has(key)) selectedKeys.delete(key);
      }
      const rows = filteredRecords(records);
      const arrivals = rows.filter(core.isArrival);
      const summary = core.aggregate(rows);
      const pending = arrivals.filter(row => row.quantity === null || row.stocked !== row.quantity);
      elements.metrics.replaceChildren(...[
        [rows.length, "采购商品行"],
        [summary.groups.length, "品牌与 CAS 组合"],
        [pending.length, "到货待核对行"]
      ].map(([count, description]) => {
        const metric = node("span");
        metric.append(node("strong", count), description);
        return metric;
      }));

      const content = view === "summary" ? summary.groups : view === "arrival" ? arrivals : rows;
      const pages = Math.max(1, Math.ceil(content.length / pageSize));
      tablePage = Math.min(tablePage, pages);
      elements.prev.disabled = tablePage <= 1;
      elements.next.disabled = tablePage >= pages;
      elements.position.textContent = "第 " + tablePage + " / " + pages + " 页";
      elements.foot.textContent = view === "summary"
        ? "汇总排除取消及退货行。" + (summary.needsReview
          ? " 另有 " + summary.needsReview + " 行品牌、CAS 或数量待核对。" : "")
        : view === "arrival"
          ? "这里只显示平台标记到货的商品。按实物和入库记录填写已入库数量。"
          : "点击商品行或复选框勾选，支持跨页选择。点击 CAS 号可复制。";

      if (!content.length) {
        const empty = view === "arrival" ? "当前结果中没有平台标记到货的商品。" :
          view === "summary" ? "当前结果中没有可汇总的品牌和 CAS。" :
          "当前没有匹配记录。同步订单页或调整筛选条件。";
        elements.surface.replaceChildren(node("div", empty, "empty"));
        updateSelection();
        return;
      }

      const table = node("table");
      table.setAttribute("aria-label", root.querySelector('[data-view="' + view + '"]').textContent);
      const header = table.createTHead().insertRow();
      const visible = content.slice((tablePage - 1) * pageSize, tablePage * pageSize);
      if (view !== "summary") {
        const cell = node("th", undefined, "select-cell");
        cell.scope = "col";
        const checkbox = node("input", undefined, "page-select");
        checkbox.type = "checkbox";
        checkbox.setAttribute("aria-label", "选择当前页商品");
        checkbox.title = "选择当前页商品";
        checkbox.addEventListener("change", () => {
          for (const row of visible) {
            if (checkbox.checked) selectedKeys.add(row.key);
            else selectedKeys.delete(row.key);
          }
          updateSelection();
        });
        cell.append(checkbox);
        header.append(cell);
      }
      const columns = view === "summary"
        ? ["品牌", "CAS 号", "试剂", "订购数量", "订单数"]
        : ["试剂及订单", "品牌", "CAS 号", "货号 / 包装", "订购数量", "商品状态", "订单导出"];
      if (view === "arrival") columns.push("已入库数量");
      for (const title of columns) {
        const cell = node("th", title);
        cell.scope = "col";
        header.append(cell);
      }
      const body = table.createTBody();
      for (const row of visible) {
        const tr = body.insertRow();
        if (view === "summary") {
          tr.insertCell().textContent = row.brand;
          addCas(tr.insertCell(), row.cas);
          tr.insertCell().textContent = [...row.names].join("、") || "—";
          tr.insertCell().textContent = row.quantity;
          tr.insertCell().textContent = row.orders.size;
        } else {
          addOrderRow(tr, row);
        }
      }
      elements.surface.replaceChildren(table);
      updateSelection();
    }

    function addCas(cell, cas) {
      if (!core.isCas(cas)) {
        cell.append(node("span", cas || "缺失", "muted"), node("span", "待核对", "sub amber"));
        return;
      }
      const button = node("button", cas, "cas");
      button.type = "button";
      button.setAttribute("aria-label", "复制 CAS " + cas);
      button.addEventListener("click", async () => {
        try {
          await doc.defaultView.navigator.clipboard.writeText(cas);
          button.textContent = "已复制";
          setTimeout(() => { button.textContent = cas; }, 950);
        } catch {
          button.textContent = "复制失败";
          setTimeout(() => { button.textContent = cas; }, 950);
        }
      });
      cell.append(button);
    }

    function showExportCount(cell) {
      const count = exportHistory.orders?.[cell.dataset.orderId]?.count ?? 0;
      const itemCount = exportHistory.items?.[cell.dataset.itemKey]?.count ?? 0;
      cell.replaceChildren(count
        ? node("span", "已导出 " + count + " 次", "chip green")
        : node("span", "无导出记录", "chip gray"));
      if (itemCount !== count) {
        cell.append(node("span", itemCount ? "本商品 " + itemCount + " 次" : "本商品无记录", "sub"));
      }
    }

    function showExportHistory(history) {
      exportHistory = history;
      for (const cell of elements.surface.querySelectorAll(".export-count")) showExportCount(cell);
    }

    function addOrderRow(tr, row) {
      tr.className = "selectable";
      const selection = tr.insertCell();
      selection.className = "select-cell";
      const checkbox = node("input", undefined, "row-select");
      checkbox.type = "checkbox";
      checkbox.dataset.rowKey = row.key;
      checkbox.setAttribute("aria-label", "选择 " + row.name);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) selectedKeys.add(row.key);
        else selectedKeys.delete(row.key);
        updateSelection();
      });
      tr.addEventListener("click", event => {
        if (!event.target.closest?.("a, button, input, label")) checkbox.click();
      });
      selection.append(checkbox);
      const name = tr.insertCell();
      name.className = "name";
      name.append(node("div", row.name));
      const source = core.detailLink(row.order.url);
      const orderLine = node("span", "", "sub");
      if (source) {
        const link = node("a", row.order.number);
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        orderLine.append(link);
      }
      orderLine.append(" " + row.order.date);
      name.append(orderLine);
      tr.insertCell().append(node("span", row.brand || "缺失", row.brand ? "" : "amber"));
      addCas(tr.insertCell(), row.cas);
      tr.insertCell().append(node("span", row.code || "—"), node("span", row.pack || "—", "sub"));
      tr.insertCell().textContent = row.quantityText || "—";
      const status = tr.insertCell();
      const productState = row.status || "未读取";
      status.append(node("span", productState, "chip" +
        (core.isArrival(row) ? " green" : core.isExcluded(row) ? " gray" : "")));
      if (row.order.status && row.order.status !== productState) {
        status.append(node("span", "订单 " + row.order.status, "sub"));
      }
      const exported = tr.insertCell();
      exported.className = "export-count";
      exported.dataset.orderId = row.order.id;
      exported.dataset.itemKey = row.key;
      showExportCount(exported);
      if (view === "arrival") addStockedControl(tr.insertCell(), row);
    }

    function addStockedControl(cell, row) {
      if (row.quantity === null) {
        cell.append(node("span", "先核对订购数量", "amber"));
        return;
      }
      const input = node("input");
      input.type = "number";
      input.min = 0;
      input.max = row.quantity;
      input.step = 1;
      input.value = row.stocked;
      input.disabled = activeSync !== null;
      input.setAttribute("aria-label", row.name + " 已入库数量");
      input.addEventListener("change", async () => {
        if (input.value === "" || !input.checkValidity()) {
          input.value = row.stocked;
          return;
        }
        input.disabled = true;
        try {
          const value = Number(input.value);
          await services.lock(storageKey, async () => {
            const latest = await services.read(storageKey);
            const current = core.records(latest).find(item => item.key === row.key);
            if (!current || !core.isArrival(current) || current.quantity === null ||
              value > current.quantity) throw new Error("订单状态或数量已变更，请重新打开核对。");
            latest.stocked[row.key] = value;
            await services.write(storageKey, latest);
            database = latest;
          });
          message("已在本浏览器记录入库数量。");
          render();
        } catch (error) {
          message("入库数量未保存。", [error.message]);
          input.value = row.stocked;
          input.disabled = false;
        }
      });
      cell.append(input);
      if (row.stocked > row.quantity) cell.append(node("span", "数量变化待核对", "sub amber"));
    }

    const pagination = () => doc.querySelector("ul.ant-pagination");
    const currentPage = () => Number(pagination()?.querySelector(".ant-pagination-item-active")?.title || 1);
    const pageOrders = () => {
      const region = pagination()?.closest(".ant-spin-nested-loading");
      if (region?.querySelector(".ant-spin-spinning")) return null;
      const orders = core.readOrderList(doc);
      return orders.length || doc.querySelector(".ant-empty-description") ? orders : null;
    };
    const ids = orders => orders.map(order => order.id).join("|");

    async function goToPage(target, signal) {
      while (currentPage() !== target) {
        signal?.throwIfAborted();
        const oldPage = currentPage();
        const oldOrders = await core.waitFor(pageOrders, 7000, signal);
        const control = pagination()?.querySelector('.ant-pagination-item[title="' + target + '"]') ??
          pagination()?.querySelector(target > oldPage
            ? ".ant-pagination-next button:not(:disabled)"
            : ".ant-pagination-prev button:not(:disabled)");
        if (!control) throw new Error("订单列表分页不可用，请重新打开「我的订单」。");
        control.click();
        await core.waitFor(() => {
          const orders = pageOrders();
          return currentPage() !== oldPage && orders && ids(orders) !== ids(oldOrders);
        }, 7000, signal);
      }
    }

    async function collectOrders(all, signal) {
      const first = await core.waitFor(pageOrders, 7000, signal);
      if (!all || !first.length) return first;
      const originalPage = currentPage();
      const lastPage = Math.max(originalPage, ...[...(pagination()?.querySelectorAll(".ant-pagination-item") ?? [])]
        .map(item => Number(item.title)).filter(Number.isFinite));
      const orders = new Map();
      try {
        for (let page = 1; page <= lastPage; page++) {
          message("正在读取订单列表，第 " + page + " / " + lastPage + " 页。");
          await goToPage(page, signal);
          const entries = await core.waitFor(pageOrders, 7000, signal);
          for (const entry of entries) orders.set(entry.id, entry);
        }
      } finally {
        await goToPage(originalPage);
      }
      return [...orders.values()];
    }

    function controls() {
      const running = activeSync !== null;
      elements.syncPage.disabled = running;
      elements.syncAll.disabled = running;
      elements.stop.hidden = !running;
      elements.stop.disabled = activeSync?.signal.aborted ?? false;
    }

    async function sync(all) {
      if (activeSync || !storageKey) return;
      const controller = new AbortController();
      activeSync = controller;
      controls();
      render();
      const failures = [];
      let completed = 0;
      let total = 0;
      const signal = controller.signal;
      try {
        await services.lock(storageKey, async () => {
          database = await services.read(storageKey);
          render();
          message("正在读取订单列表…");
          const orders = await collectOrders(all, signal);
          total = orders.length;
          for (let index = 0; index < total && !signal.aborted; index += 2) {
            const batch = orders.slice(index, index + 2);
            message("正在读取订单详情，已处理 " + index + " / " + total + " 笔。");
            const results = await Promise.allSettled(batch.map(order => services.loadDetail(order.url)));
            let changed = false;
            results.forEach((result, offset) => {
              const order = batch[offset];
              if (result.status === "fulfilled" && result.value?.rows?.length) {
                database.orders[order.id] = { ...order, items: result.value.rows };
                completed++;
                changed = true;
              } else {
                const problem = result.status === "rejected" ? result.reason?.message : result.value?.error;
                failures.push(order.number + " · " + (problem || "未读取到商品明细。"));
              }
            });
            if (changed) {
              database.lastSync = new Date().toISOString();
              await services.write(storageKey, database);
              render();
            }
          }
        });
        const note = signal.aborted ? "已停止" : failures.length ? "同步结束" :
          total ? "同步完成" : "当前筛选没有订单";
        const date = database.lastSync && new Date(database.lastSync).toLocaleString("zh-CN", {
          hour12: false
        });
        message(note + "。已更新 " + completed + " / " + total + " 笔订单。" +
          (date ? " 最近保存 " + date + "。" : "") +
          (failures.length ? " " + failures.length + " 笔需要重试。" : ""), failures);
      } catch (error) {
        if (signal.aborted && error.name === "AbortError") {
          message("已停止。已保存的订单仍可查看。");
        } else {
          message("同步中断。已保存的订单仍可查看。", [...failures, error.message]);
        }
        database = await services.read(storageKey).catch(() => ({ orders: {}, stocked: {} }));
      } finally {
        activeSync = null;
        controls();
        render();
      }
    }

    async function open() {
      if (dialog.open) return;
      const account = core.readAccount(doc);
      storageKey = account ? core.purchaseKeyPrefix + account : "";
      database = { orders: {}, stocked: {} };
      exportHistory = {};
      const revision = ++exportRevision;
      selectedKeys.clear();
      dialog.showModal();
      render();
      if (!storageKey) {
        elements.syncPage.disabled = true;
        elements.syncAll.disabled = true;
        message("请先登录南京大学试剂系统。");
        return;
      }
      const loadHistory = services.readExportHistory(storageKey).then(history => {
        if (revision === exportRevision) showExportHistory(history);
      }).catch(error => {
        if (revision === exportRevision) message("导出次数暂未读取。" + error.message);
      });
      await Promise.all([loadHistory, sync(false)]);
    }

    function stop() {
      if (activeSync) {
        activeSync.abort();
        controls();
        message("正在停止，已保存的订单仍可查看。");
      }
    }

    elements.close.addEventListener("click", () => activeSync ? stop() : dialog.close());
    dialog.addEventListener("cancel", event => {
      if (!activeSync) return;
      event.preventDefault();
      stop();
    });
    elements.syncPage.addEventListener("click", () => { void sync(false); });
    elements.syncAll.addEventListener("click", () => { void sync(true); });
    elements.stop.addEventListener("click", stop);
    elements.clearSelected.addEventListener("click", () => {
      selectedKeys.clear();
      updateSelection();
    });
    async function recordSelection(oldExport) {
      if (!selectedKeys.size || activeSync || updatingExport || !storageKey) return;
      const key = storageKey;
      const rows = core.records(database).filter(row => selectedKeys.has(row.key));
      updatingExport = true;
      updateSelection();
      try {
        if (oldExport) {
          const result = await services.markOldExport(key, rows);
          if (dialog.open && storageKey === key && !activeSync) {
            message(result.changed ? "已补记所选商品的旧版导出。" : "所选商品已补记过旧版导出。");
          }
          return;
        }
        const result = await services.exportRows(key, rows);
        if (!dialog.open || storageKey !== key || activeSync) return;
        if (result.state === "interrupted" || result.state === "erased") {
          message("下载未完成，未计入导出次数。");
          return;
        }
        message("已生成 " + rows.length + " 条商品的 X-MOL .xls。" +
          (result.state === "complete" ? " 导出次数已更新。" : " 下载完成后更新次数。") +
          (result.nameFallbacks ? " " + result.nameFallbacks + " 条缺有效 CAS，已填产品名称。" : "") +
          (result.missingFields ? " " + result.missingFields + " 条的品牌或包装规格待补。" : ""));
      } catch (error) {
        if (dialog.open && storageKey === key && !activeSync) {
          message((oldExport ? "补记失败。" : "导出未完成。") + error.message);
        }
      } finally {
        updatingExport = false;
        updateSelection();
      }
    }
    services.watchExportHistory(accounts => {
      if (!dialog.open || !storageKey) return;
      exportRevision++;
      showExportHistory(accounts[storageKey] ?? {});
    });
    elements.exportSelected.addEventListener("click", () => { void recordSelection(false); });
    elements.markOldExport.addEventListener("click", () => { void recordSelection(true); });
    elements.prev.addEventListener("click", () => { tablePage--; render(); });
    elements.next.addEventListener("click", () => { tablePage++; render(); });
    for (const input of [elements.query, elements.since, elements.until]) {
      input.addEventListener("input", () => { tablePage = 1; render(); });
    }
    for (const button of root.querySelectorAll("[data-view]")) {
      button.addEventListener("click", () => {
        view = button.dataset.view;
        tablePage = 1;
        for (const tab of root.querySelectorAll("[data-view]")) {
          tab.setAttribute("aria-pressed", String(tab === button));
        }
        render();
      });
    }
    return { open };
  }

  globalThis.NjuPurchasePanel = { mount };
})();
