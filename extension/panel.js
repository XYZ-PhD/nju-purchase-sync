(() => {
  "use strict";

  const core = globalThis.NjuPurchaseCore;
  const pageSize = 25;
  const syncBatchSize = 6;
  const syncBatchPauseMs = 300;
  const maxDetailReadsPerPage = 40;
  const ring = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E" +
    "%3Cg fill='none' stroke='white' stroke-opacity='.16' stroke-width='1.4'%3E" +
    "%3Cpolygon points='60,8 105,34 105,86 60,112 15,86 15,34'/%3E%3Ccircle cx='60' cy='60' r='29'/%3E" +
    "%3Cpath d='M105 34 L140 14 M105 86 L140 106'/%3E%3C/g%3E%3C/svg%3E\")";
  const style = `
    :host { all: initial;
      --ink: #2b2130; --ink-2: #5d5364; --ink-3: #8a8090;
      --brand: #63065f; --brand-hover: #761a71; --brand-tint: #f5edf4; --brand-line: #e6d6e4;
      --canvas: #f6f5f8; --paper: #fff; --line: #e6e2e9; --line-soft: #efecf1;
      --ok: #1d7148; --ok-bg: #e4f3ea; --warn: #9a5800; --warn-bg: #fcf0db;
      --err: #b42318; --err-bg: #fdeceb;
      color: var(--ink);
      font: 14px/1.5 "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei UI", "Microsoft YaHei",
        system-ui, sans-serif; }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }

    dialog { inset: 0; width: min(1240px, calc(100% - 48px)); max-width: none;
      height: min(820px, calc(100% - 48px)); max-height: none; margin: auto; padding: 0;
      border: 0; border-radius: 14px; color: inherit; background: var(--canvas);
      box-shadow: 0 28px 90px rgb(38 8 36 / .38), 0 2px 8px rgb(38 8 36 / .12); overflow: hidden; }
    dialog[open] { animation: rise .18s ease-out; }
    dialog::backdrop { background: rgb(30 14 30 / .52); }
    @keyframes rise { from { opacity: 0; transform: translateY(8px) scale(.99); } }
    @media (prefers-reduced-motion: reduce) { dialog[open] { animation: none; } }
    .layout { display: flex; flex-direction: column; height: 100%; }

    button, input { font: inherit; }
    button { cursor: pointer; color: var(--ink); padding: 6px 14px; min-height: 34px;
      border: 1px solid var(--line); border-radius: 8px; background: var(--paper);
      font-weight: 600; font-size: 13px; white-space: nowrap; }
    button:hover:enabled { border-color: var(--brand-line); background: var(--brand-tint); }
    button:disabled { opacity: .45; cursor: default; }
    :focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
    .primary { color: #fff; background: var(--brand); border-color: var(--brand); }
    .primary:hover:enabled { background: var(--brand-hover); border-color: var(--brand-hover); }

    /* Header band */
    .head { position: relative; padding: 20px 24px 18px; color: #fff;
      background: var(--brand) ${ring} no-repeat right 64px top -38px / 190px; }
    .title-row { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px 14px; padding-right: 48px; }
    h1 { margin: 0; font-size: 22px; line-height: 1.25; font-weight: 700; letter-spacing: .02em; }
    .account { padding: 1px 10px; border-radius: 99px; color: #f6e9f5; background: rgb(255 255 255 / .14);
      font-size: 12px; }
    .head .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    .head button { color: #fff; background: rgb(255 255 255 / .08); border-color: rgb(255 255 255 / .34); }
    .head button:hover:enabled { background: rgb(255 255 255 / .18); border-color: rgb(255 255 255 / .6); }
    .head .primary { color: var(--brand); background: #fff; border-color: #fff; }
    .head .primary:hover:enabled { background: #f8eff7; border-color: #f8eff7; }
    .head #stop { border-color: #ffd0cc; }
    .head :focus-visible { outline-color: #fff; }
    .close { position: absolute; top: 14px; right: 14px; display: grid; place-items: center;
      width: 36px; min-height: 36px; padding: 0; border-radius: 50%; font-size: 20px; line-height: 1; }
    .head .close { background: transparent; border-color: transparent; }

    /* Status line */
    .meta { position: relative; padding: 10px 24px; color: var(--ink-2); background: var(--paper);
      border-bottom: 1px solid var(--line); font-size: 13px; }
    .meta.error { color: var(--err); background: var(--err-bg); border-bottom-color: #f6d3d0; }
    .progress { position: absolute; inset: 0 0 auto; height: 3px; background: var(--brand-tint); }
    .progress span { display: block; height: 100%; width: calc(var(--done, 0) * 100%);
      background: var(--brand); transition: width .25s ease; }
    .error-detail { margin-top: 4px; overflow-wrap: anywhere; }
    .error-detail summary { cursor: pointer; font-weight: 600; }
    .error-detail div div { padding: 2px 0 0 14px; }

    /* Filters */
    .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; padding: 16px 24px 4px; }
    input { min-height: 36px; padding: 6px 10px; color: var(--ink); border: 1px solid var(--line);
      border-radius: 8px; background: var(--paper); }
    input:hover { border-color: #d6cfd9; }
    .search { flex: 1 1 280px; display: flex; }
    .search input { width: 100%; padding-left: 34px; background: var(--paper)
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cg fill='none' stroke='%238a8090' stroke-width='1.6'%3E%3Ccircle cx='7' cy='7' r='5'/%3E%3Cpath d='M11 11l3.5 3.5'/%3E%3C/g%3E%3C/svg%3E")
      no-repeat 11px center / 15px; }
    .dates { display: flex; align-items: center; gap: 8px; color: var(--ink-3); font-size: 13px; }
    .dates input { width: 142px; }

    .toggle { display: inline-flex; align-items: center; gap: 7px; min-height: 36px; padding: 0 12px;
      color: var(--ink-2); background: var(--paper); border: 1px solid var(--line); border-radius: 8px;
      font-size: 13px; font-weight: 600; cursor: pointer; user-select: none; white-space: nowrap; }
    .toggle input { min-height: 0; width: 15px; height: 15px; margin: 0; accent-color: var(--ok); cursor: pointer; }
    .toggle:hover { border-color: #d6cfd9; }
    .toggle:has(input:checked) { color: var(--ok); background: var(--ok-bg); border-color: #b9dfc8; }
    .toggle:has(input:focus-visible) { outline: 2px solid var(--brand); outline-offset: 2px; }

    /* Tabs */
    .tabs-line { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;
      gap: 0 16px; margin: 0 24px; border-bottom: 1px solid var(--line); }
    .tabs { display: flex; flex-wrap: wrap; gap: 4px 22px; }
    .link { min-height: 30px; padding: 3px 8px; color: var(--brand); background: none; border-color: transparent; }
    .link:hover:enabled { background: var(--brand-tint); border-color: transparent; }
    .tabs button { display: flex; align-items: center; gap: 7px; margin-bottom: -1px; padding: 12px 2px 10px;
      color: var(--ink-2); background: none; border: 0; border-bottom: 2px solid transparent;
      border-radius: 0; font-size: 14px; }
    .tabs button:hover:enabled { background: none; color: var(--ink); }
    .tabs button[aria-pressed=true] { color: var(--brand); border-bottom-color: var(--brand); }
    .count { min-width: 22px; padding: 0 7px; border-radius: 99px; color: var(--ink-2);
      background: #ebe7ee; font-size: 12px; font-weight: 600; text-align: center;
      font-variant-numeric: tabular-nums; }
    .count:empty { display: none; }
    [aria-pressed=true] .count { color: var(--brand); background: var(--brand-tint); }
    .count.attention { color: var(--warn); background: var(--warn-bg); }

    /* Table */
    .surface { flex: 1; min-height: 120px; margin: 14px 24px 0; overflow: auto;
      border: 1px solid var(--line); border-radius: 10px; background: var(--paper); }
    table { width: 100%; min-width: 760px; border-collapse: separate; border-spacing: 0;
      text-align: left; font-size: 13px; font-variant-numeric: tabular-nums; }
    th { position: sticky; top: 0; z-index: 1; padding: 10px 14px; color: var(--ink-3);
      background: #faf9fb; border-bottom: 1px solid var(--line); font-size: 12px; font-weight: 500; }
    td { padding: 11px 14px; vertical-align: middle; color: var(--ink-2); border-bottom: 1px solid var(--line-soft); }
    tbody tr:hover td { background: #fbfafc; }
    tbody tr:last-child td { border-bottom: 0; }
    tbody tr.selectable { cursor: pointer; }
    tbody tr.is-selected td { background: var(--brand-tint); }
    tbody tr.is-selected td:first-child { box-shadow: inset 3px 0 var(--brand); }
    .select-cell { width: 44px; text-align: center; }
    .select-cell input { min-height: 0; width: 16px; height: 16px; margin: 0;
      accent-color: var(--brand); vertical-align: middle; cursor: pointer; }
    .sub { display: block; margin-top: 2px; color: var(--ink-3); font-size: 12px; }
    .name { min-width: 170px; max-width: 340px; overflow-wrap: anywhere; }
    .name > div, .strong { color: var(--ink); font-size: 14px; font-weight: 600; }
    a { color: var(--brand); text-decoration: none; }
    a:hover { text-decoration: underline; text-underline-offset: 2px; }
    .cas { min-height: 0; margin: -2px -6px; padding: 2px 6px; color: var(--brand);
      background: none; border: 0; border-radius: 5px; font-weight: 600; letter-spacing: .02em; }
    .cas:hover:enabled { background: var(--brand-tint); }
    .muted { color: var(--ink-3); }
    .chip { display: inline-block; padding: 1px 8px; border-radius: 5px; color: var(--ink-2);
      background: #efecf1; white-space: nowrap; font-size: 12px; }
    .export-count { white-space: nowrap; }
    .green { color: var(--ok); background: var(--ok-bg); }
    .gray { color: var(--ink-3); background: #f3f2f4; }
    .chip.gray { text-decoration: line-through; text-decoration-color: rgb(0 0 0 / .25); }
    .export-count .chip.gray { text-decoration: none; }
    .amber { color: var(--warn); }
    .sub.amber { font-weight: 600; }
    td input[type=number] { width: 76px; text-align: right; }

    .empty { display: grid; justify-items: center; gap: 14px; padding: 64px 24px; text-align: center;
      color: var(--ink-3); }
    .empty::before { content: ""; width: 54px; height: 54px; opacity: .55; background:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Cg fill='none' stroke='%2363065f' stroke-width='4'%3E%3Cpolygon points='60,8 105,34 105,86 60,112 15,86 15,34'/%3E%3Ccircle cx='60' cy='60' r='29'/%3E%3C/g%3E%3C/svg%3E")
      no-repeat center / contain; }

    /* Selection bar */
    .selection { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px;
      margin: 10px 24px 0; padding: 8px 8px 8px 16px; color: #fff; background: var(--ink);
      border-radius: 10px; box-shadow: 0 8px 24px rgb(43 33 48 / .22); }
    .selection:not([hidden]) { animation: rise .16s ease-out; }
    @media (prefers-reduced-motion: reduce) { .selection:not([hidden]) { animation: none; } }
    .selected-count { font-weight: 600; font-variant-numeric: tabular-nums; }
    .selection .spacer { flex: 1; }
    .selection-note { color: #ffcf8a; font-size: 12px; }
    .selection button { color: #fff; background: transparent; border-color: rgb(255 255 255 / .25); }
    .selection button:hover:enabled { background: rgb(255 255 255 / .1); border-color: rgb(255 255 255 / .45); }
    .selection #clear-selected { border-color: transparent; color: #d9d2dc; font-weight: 500; }
    .selection .primary { color: var(--ink); background: #fff; border-color: #fff; }
    .selection .primary:hover:enabled { color: var(--brand); background: #fff; }
    .selection :focus-visible { outline-color: #fff; }

    .foot { display: flex; align-items: center; justify-content: space-between;
      gap: 8px 16px; flex-wrap: wrap; min-height: 52px; padding: 8px 24px; }
    .foot p { margin: 0; color: var(--ink-3); font-size: 12px; }
    .pager { display: flex; align-items: center; gap: 10px; color: var(--ink-2); font-size: 12px;
      font-variant-numeric: tabular-nums; }
    .pager button { min-height: 30px; padding: 3px 10px; font-size: 12px; }

    @media (max-width: 720px) {
      dialog { width: calc(100% - 14px); height: calc(100% - 14px); border-radius: 12px; }
      .head { padding: 14px 14px 12px; background-size: 130px; background-position: right -30px top -30px; }
      h1 { font-size: 19px; }
      .meta, .toolbar, .foot { padding-left: 14px; padding-right: 14px; }
      .tabs-line, .surface, .selection { margin-left: 14px; margin-right: 14px; }
      .dates input { width: 128px; }
    }
  `;
  const markup = `
    <dialog aria-labelledby="sync-title">
      <div class="layout">
        <header class="head">
          <div class="title-row">
            <h1 id="sync-title">导出xmol入库单</h1>
            <span id="account" class="account" hidden></span>
          </div>
          <button id="close" class="close" type="button" aria-label="关闭" title="关闭">✕</button>
          <div class="actions">
            <button class="primary" id="sync-page" type="button"
              title="只读取新订单和状态有变化的订单。按住 Shift 点击可全部重新读取。">同步本页</button>
            <button id="sync-all" type="button"
              title="只读取新订单和状态有变化的订单。按住 Shift 点击可全部重新读取。">同步筛选范围全部页</button>
            <button id="resume-sync" type="button" hidden>继续上次同步</button>
            <button id="refresh-order-page" type="button" hidden>刷新订单页</button>
            <button id="stop" type="button" hidden>停止</button>
          </div>
        </header>
        <div class="meta">
          <div id="progress" class="progress" hidden><span></span></div>
          <div id="status" role="status" aria-live="polite"></div>
          <details id="errors" class="error-detail" hidden><summary>查看未同步订单</summary><div id="error-list"></div></details>
        </div>
        <div class="toolbar">
          <label class="search"><span class="sr">搜索</span>
            <input id="query" type="search" placeholder="搜索试剂名、品牌、CAS、货号或订单号"></label>
          <div class="dates" role="group" aria-label="下单日期">
            <span>下单日期</span>
            <input id="since" type="date" aria-label="下单日期起">
            <span>至</span>
            <input id="until" type="date" aria-label="下单日期止">
          </div>
          <label class="toggle"><input id="ready-only" type="checkbox">只看已到货未导出</label>
        </div>
        <div class="tabs-line">
        <nav class="tabs" aria-label="采购视图">
          <button type="button" data-view="detail" aria-pressed="true">
            <span class="tab-label">采购明细</span><span class="count" data-count="detail"></span></button>
          <button type="button" data-view="summary" aria-pressed="false">
            <span class="tab-label">品牌与 CAS 汇总</span><span class="count" data-count="summary"></span></button>
          <button type="button" data-view="arrival" aria-pressed="false">
            <span class="tab-label">到货核对</span><span class="count" data-count="arrival"></span></button>
        </nav>
          <button id="select-all" class="link" type="button" hidden></button>
        </div>
        <div class="surface" id="surface"></div>
        <div class="selection" id="selection" hidden>
          <span id="selected-count" class="selected-count" aria-live="polite">已选 0 条</span>
          <span id="selection-note" class="selection-note" hidden></span>
          <button id="clear-selected" type="button" disabled>清空选择</button>
          <span class="spacer"></span>
          <button id="mark-old-export" type="button" disabled
            title="为选中的旧版已导出商品补记 1 次">补记旧版导出</button>
          <button id="export-selected" class="primary" type="button" disabled>导出所选 .xls</button>
        </div>
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
      syncPage: get("sync-page"), syncAll: get("sync-all"), resumeSync: get("resume-sync"),
      refreshOrderPage: get("refresh-order-page"), stop: get("stop"),
      close: get("close"), query: get("query"), since: get("since"), until: get("until"),
      account: get("account"), progress: get("progress"), selection: get("selection"),
      status: get("status"), errors: get("errors"),
      errorList: get("error-list"), surface: get("surface"), foot: get("footnote"),
      prev: get("prev"), next: get("next"), position: get("position"),
      selectedCount: get("selected-count"), clearSelected: get("clear-selected"),
      exportSelected: get("export-selected"), markOldExport: get("mark-old-export"),
      readyOnly: get("ready-only"), selectAll: get("select-all"), selectionNote: get("selection-note")
    };
    let database = { orders: {}, stocked: {} };
    let storageKey = "";
    let view = "detail";
    let tablePage = 1;
    let opening = false;
    let activeSync = null;
    let detailReads = 0;
    let updatingExport = false;
    let exportHistory = {};
    let exportRevision = 0;
    const selectedKeys = new Set();
    let recordIndex = new Map();
    let listed = [];

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

    // Item-level count, so an order with some items already exported keeps its other items.
    const exportCount = row => exportHistory.items?.[row.key]?.count ?? 0;
    const readyToExport = row => core.isArrival(row) && exportCount(row) === 0;

    function filteredRecords(records) {
      const query = core.clean(elements.query.value).toLowerCase();
      const readyOnly = elements.readyOnly.checked;
      return records.filter(row => {
        if (readyOnly && !readyToExport(row)) return false;
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
      elements.selection.hidden = count === 0;
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

      elements.selectAll.hidden = listed.length === 0;
      const allListed = listed.length > 0 && listed.every(row => selectedKeys.has(row.key));
      elements.selectAll.textContent = allListed
        ? "取消勾选这 " + listed.length + " 条"
        : "勾选全部 " + listed.length + " 条";

      // Flag what usually should not go into an intake sheet.
      let notArrived = 0;
      let exported = 0;
      for (const key of selectedKeys) {
        const row = recordIndex.get(key);
        if (!row) continue;
        if (!core.isArrival(row)) notArrived++;
        if (exportCount(row) > 0) exported++;
      }
      const notes = [];
      if (notArrived) notes.push(notArrived + " 条未到货或已取消");
      if (exported) notes.push(exported + " 条导出过");
      elements.selectionNote.textContent = notes.length ? "其中 " + notes.join("，") : "";
      elements.selectionNote.hidden = notes.length === 0;
    }

    function render() {
      const records = core.records(database);
      recordIndex = new Map(records.map(row => [row.key, row]));
      if (selectedKeys.size) {
        const available = new Set(records.map(row => row.key));
        for (const key of selectedKeys) if (!available.has(key)) selectedKeys.delete(key);
      }
      const rows = filteredRecords(records);
      const arrivals = rows.filter(core.isArrival);
      const summary = core.aggregate(rows);
      const pending = arrivals.filter(row => row.quantity === null || row.stocked !== row.quantity);
      const counts = {
        detail: [rows.length, rows.length + " 条采购商品"],
        summary: [summary.groups.length, summary.groups.length + " 个品牌与 CAS 组合"],
        arrival: [pending.length || "", pending.length + " 条到货待核对"]
      };
      for (const badge of root.querySelectorAll("[data-count]")) {
        const [count, description] = counts[badge.dataset.count];
        badge.textContent = count;
        badge.title = description;
        badge.classList.toggle("attention", badge.dataset.count === "arrival" && pending.length > 0);
      }

      const content = view === "summary" ? summary.groups : view === "arrival" ? arrivals : rows;
      listed = view === "summary" ? [] : content;
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
          : elements.readyOnly.checked
            ? "只显示已到货、还没导出过的商品。点「勾选全部」后导出，导出完成的商品会从这里移走。"
            : "勾选商品行后可导出 .xls，支持跨页选择。点击 CAS 号可复制。";

      if (!content.length) {
        const neverSynced = !Object.keys(database.orders ?? {}).length;
        const empty = neverSynced ? "还没有同步记录。先同步当前订单页，采购明细会保存在本浏览器。" :
          view === "arrival" ? "当前结果中没有平台标记到货的商品。" :
          view === "summary" ? "当前结果中没有可汇总的品牌和 CAS。" :
          elements.readyOnly.checked ? "已到货的商品都导出过了。有新到货时先同步订单页。" :
          "没有匹配的记录。换个关键词或调整下单日期。";
        const box = node("div", undefined, "empty");
        box.append(node("div", empty));
        if (neverSynced && storageKey && !elements.syncPage.disabled) {
          const start = node("button", "同步本页", "primary");
          start.type = "button";
          start.addEventListener("click", () => { void sync("page"); });
          box.append(start);
        }
        elements.surface.replaceChildren(box);
        updateSelection();
        return;
      }

      const table = node("table");
      table.setAttribute("aria-label",
        root.querySelector('[data-view="' + view + '"] .tab-label').textContent);
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
          tr.insertCell().append(node("span", row.brand, "strong"));
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
        : node("span", "未导出", "muted"));
      if (itemCount !== count) {
        cell.append(node("span", itemCount ? "本商品 " + itemCount + " 次" : "本商品无记录", "sub"));
      }
    }

    function showExportHistory(history) {
      exportHistory = history;
      if (elements.readyOnly.checked) {
        render();
        return;
      }
      for (const cell of elements.surface.querySelectorAll(".export-count")) showExportCount(cell);
      updateSelection();
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
      let failure = null;
      try {
        for (let page = 1; page <= lastPage; page++) {
          message("正在读取订单列表，第 " + page + " / " + lastPage + " 页。");
          progress((page - 1) / lastPage);
          await goToPage(page, signal);
          const entries = await core.waitFor(pageOrders, 7000, signal);
          for (const entry of entries) orders.set(entry.id, entry);
        }
      } catch (error) {
        failure = error;
        throw error;
      } finally {
        // Return to the user's page, but never let that hide the original list error.
        if (!signal.aborted) {
          try {
            await goToPage(originalPage, signal);
          } catch (error) {
            if (!failure) throw error;
          }
        }
      }
      return [...orders.values()];
    }

    function controls() {
      const running = activeSync !== null;
      const needsRefresh = detailReads >= maxDetailReadsPerPage;
      elements.syncPage.disabled = running || needsRefresh || !storageKey;
      elements.syncAll.disabled = running || needsRefresh || !storageKey;
      const checkpoint = database.syncCheckpoint;
      const remaining = checkpoint
        ? checkpoint.orders.length - checkpoint.next + (checkpoint.failed?.length ?? 0)
        : 0;
      elements.resumeSync.hidden = remaining <= 0 || !storageKey;
      elements.resumeSync.disabled = running || needsRefresh;
      if (remaining > 0) elements.resumeSync.textContent = "继续上次同步（剩余 " + remaining + " 笔）";
      elements.refreshOrderPage.hidden = running || !needsRefresh;
      elements.stop.hidden = !running;
      elements.stop.disabled = activeSync?.signal.aborted ?? false;
      elements.close.title = running ? "停止同步" : "关闭";
      elements.close.setAttribute("aria-label", elements.close.title);
      if (!running) progress(null);
    }

    function progress(done) {
      elements.progress.hidden = done === null;
      if (done !== null) elements.progress.style.setProperty("--done", String(Math.min(1, Math.max(0, done))));
    }

    function savedAt() {
      return database.lastSync
        ? " 最近保存 " + new Date(database.lastSync).toLocaleString("zh-CN", { hour12: false }) + "。"
        : "";
    }

    // An order needs no new detail read once it is saved, its list status has not changed,
    // and it is finished: the order itself is closed, or every item has arrived or been cancelled.
    const finishedOrder = /已结算|已完成|已取消|已关闭|已退货|已退款/;
    function isSettled(order) {
      const saved = database.orders?.[order.id];
      if (!saved?.items?.length || saved.status !== order.status) return false;
      return finishedOrder.test(order.status) || saved.items.every(item => {
        const row = { ...item, order: saved };
        return core.isArrival(row) || core.isExcluded(row);
      });
    }

    async function sync(mode, rereadAll = false) {
      if (activeSync || !storageKey || detailReads >= maxDetailReadsPerPage) return;
      const account = core.readAccount(doc);
      const key = storageKey;
      if (!account || core.purchaseKeyPrefix + account !== key) {
        message("登录账号已变化，请关闭后重新打开「导出xmol入库单」。");
        return;
      }
      const controller = new AbortController();
      activeSync = controller;
      controls();
      render();
      const failures = [];
      let completed = 0;
      let total = 0;
      let paused = false;
      let skipped = 0;
      const signal = controller.signal;
      try {
        await services.lock(key, async () => {
          database = await services.read(key);
          render();
          const saved = mode === "resume" ? database.syncCheckpoint : null;
          if (mode === "resume" && !saved) return;
          let orders;
          if (saved) {
            orders = saved.orders.slice(saved.next).concat(saved.failed ?? []);
          } else {
            message("正在读取订单列表…");
            orders = await collectOrders(mode === "all", signal);
            if (!rereadAll) {
              const listedCount = orders.length;
              orders = orders.filter(order => !isSettled(order));
              skipped = listedCount - orders.length;
            }
          }
          if (!orders.length || signal.aborted) return;
          if (core.readAccount(doc) !== account) throw new Error("登录账号已变化，请重新打开「导出xmol入库单」。");
          let checkpoint = mode === "page" ? null : { orders, next: 0, failed: [] };
          if (!checkpoint && orders.length > maxDetailReadsPerPage - detailReads) {
            // A page larger than one load's read budget must stay resumable, otherwise
            // "同步本页" restarts from the first order after every refresh and never finishes.
            // Keep any unfinished earlier sync queued behind this page.
            const earlier = database.syncCheckpoint;
            const pageIds = new Set(orders.map(order => order.id));
            const leftover = earlier
              ? earlier.orders.slice(earlier.next).concat(earlier.failed ?? [])
                .filter(order => !pageIds.has(order.id))
              : [];
            orders = orders.concat(leftover);
            checkpoint = { orders, next: 0, failed: [] };
          }
          total = orders.length;
          if (checkpoint) {
            database.syncCheckpoint = checkpoint;
            await services.write(key, database);
          }
          const reader = services.createDetailReader(signal);
          let inBatch = 0;
          let dirty = false;
          let next = 0;
          async function saveProgress() {
            if (!dirty) return;
            await services.write(key, database);
            dirty = false;
          }
          try {
            for (let index = 0; index < orders.length; index++) {
              if (signal.aborted) break;
              if (detailReads >= maxDetailReadsPerPage) {
                paused = true;
                break;
              }
              if (core.readAccount(doc) !== account) throw new Error("登录账号已变化，请重新打开「导出xmol入库单」。");
              const order = orders[index];
              message("正在读取订单详情，已处理 " + index + " / " + orders.length + " 笔。");
              progress(index / orders.length);
              let items;
              let detailError;
              try {
                detailReads++;
                items = await reader.read(order.url);
              } catch (error) {
                if (signal.aborted) break;
                if (error.detailUnavailable) throw error;
                detailError = order.number + " · " + (error.message || "未读取到商品明细。");
              }
              if (core.readAccount(doc) !== account) throw new Error("登录账号已变化，请重新打开「导出xmol入库单」。");
              if (detailError) {
                failures.push(detailError);
                checkpoint?.failed.push(order);
              }
              if (items) {
                database.orders[order.id] = { ...order, items };
                database.lastSync = new Date().toISOString();
                dirty = true;
                completed++;
              }
              next = index + 1;
              if (checkpoint) {
                checkpoint.next = next;
                dirty = true;
              }
              inBatch++;
              if (inBatch >= syncBatchSize && next < orders.length) {
                await saveProgress();
                inBatch = 0;
                render();
                if (!signal.aborted) await new Promise(resolve => setTimeout(resolve, syncBatchPauseMs));
              }
            }
          } finally {
            reader.close();
            if (checkpoint && next === orders.length) {
              if (checkpoint.failed.length) {
                database.syncCheckpoint = { orders: checkpoint.failed, next: 0, failed: [] };
              } else {
                delete database.syncCheckpoint;
              }
              dirty = true;
            }
            await saveProgress();
          }
        });
        const note = signal.aborted ? "已停止" : paused ? "本批已保存" : failures.length ? "同步结束" :
          total ? "同步完成" : skipped ? "没有需要更新的订单" : "当前筛选没有订单";
        const skipHint = skipped
          ? " 跳过 " + skipped + " 笔已结束的订单（按住 Shift 点同步按钮可全部重新读取）。"
          : "";
        // A pause always leaves a checkpoint, including a large "同步本页".
        const refreshHint = paused ? " 请刷新订单页，打开面板后点「继续上次同步」。" : "";
        message(note + "。" + (total ? "已更新 " + completed + " / " + total + " 笔订单。" : "") +
          skipHint + savedAt() +
          (failures.length ? " " + failures.length + " 笔需要重试。" : "") + refreshHint, failures);
      } catch (error) {
        if (signal.aborted && error.name === "AbortError") {
          message("已停止。已保存的订单仍可查看。");
        } else {
          message("同步中断。已保存的订单仍可查看。", [...failures, error.message]);
        }
        database = await services.read(key).catch(() => database);
      } finally {
        activeSync = null;
        controls();
        render();
      }
    }

    async function open() {
      if (dialog.open || opening) return;
      opening = true;
      try {
        const account = core.readAccount(doc);
        storageKey = account ? core.purchaseKeyPrefix + account : "";
        database = { orders: {}, stocked: {} };
        exportHistory = {};
        const revision = ++exportRevision;
        selectedKeys.clear();

        let status = "请先登录南京大学试剂系统。";
        const errors = [];
        if (storageKey) {
          const [ledger, history] = await Promise.allSettled([
            services.read(storageKey), services.readExportHistory(storageKey)
          ]);
          if (core.readAccount(doc) !== account) {
            storageKey = "";
            exportHistory = {};
            status = "登录账号已变化，请关闭后重新打开「导出xmol入库单」。";
          } else {
            if (ledger.status === "fulfilled") {
              database = ledger.value;
              const count = Object.keys(database.orders ?? {}).length;
              status = count
                ? "已载入 " + count + " 笔已保存的订单。" + savedAt()
                : "还没有同步记录。";
            } else {
              status = "暂时无法读取上次保存的采购明细，请关闭后重试。";
              if (ledger.reason?.message) errors.push(ledger.reason.message);
            }
            if (revision === exportRevision) {
              if (history.status === "fulfilled") {
                exportHistory = history.value ?? {};
              } else {
                errors.push("导出次数暂未读取，请关闭后重试。");
              }
            }
          }
        }
        elements.account.textContent = storageKey ? "账号 " + account : "";
        elements.account.hidden = !storageKey;
        controls();
        render();
        message(status, errors);
        dialog.showModal();
      } finally {
        opening = false;
      }
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
    elements.syncPage.addEventListener("click", event => { void sync("page", event.shiftKey); });
    elements.syncAll.addEventListener("click", event => { void sync("all", event.shiftKey); });
    elements.resumeSync.addEventListener("click", () => { void sync("resume"); });
    elements.refreshOrderPage.addEventListener("click", () => doc.defaultView.location.reload());
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
          for (const row of rows) selectedKeys.delete(row.key);
          return;
        }
        const result = await services.exportRows(key, rows);
        if (!dialog.open || storageKey !== key || activeSync) return;
        if (result.state === "interrupted" || result.state === "erased") {
          message("下载未完成，未计入导出次数。");
          return;
        }
        // Exported rows leave the selection so the next export cannot repeat them by accident.
        for (const row of rows) selectedKeys.delete(row.key);
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
      if ((!dialog.open && !opening) || !storageKey) return;
      exportRevision++;
      const history = accounts[storageKey] ?? {};
      if (dialog.open) showExportHistory(history);
      else exportHistory = history;
    });
    elements.exportSelected.addEventListener("click", () => { void recordSelection(false); });
    elements.markOldExport.addEventListener("click", () => { void recordSelection(true); });
    elements.prev.addEventListener("click", () => { tablePage--; render(); });
    elements.next.addEventListener("click", () => { tablePage++; render(); });
    elements.readyOnly.addEventListener("change", () => { tablePage = 1; render(); });
    elements.selectAll.addEventListener("click", () => {
      const allListed = listed.every(row => selectedKeys.has(row.key));
      for (const row of listed) {
        if (allListed) selectedKeys.delete(row.key);
        else selectedKeys.add(row.key);
      }
      updateSelection();
    });
    for (const input of [elements.query, elements.since, elements.until]) {
      input.addEventListener("input", () => { tablePage = 1; render(); });
    }
    for (const button of root.querySelectorAll("button[data-view]")) {
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
