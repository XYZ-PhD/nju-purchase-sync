(() => {
  "use strict";

  const template = globalThis.NjuPurchaseXlsTemplate;
  const core = globalThis.NjuPurchaseCore;
  const recordLimit = 8224;
  const sectorSize = 512;
  const endOfChain = 0xfffffffe;
  const freeSector = 0xffffffff;
  const fatSector = 0xfffffffd;
  const view = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decode = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));

  function join(parts) {
    const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
    let offset = 0;
    for (const part of parts) {
      result.set(part, offset);
      offset += part.length;
    }
    return result;
  }

  function record(type, payload) {
    const header = new Uint8Array(4);
    view(header).setUint16(0, type, true);
    view(header).setUint16(2, payload.length, true);
    return join([header, payload]);
  }

  function unicode(text) {
    const bytes = new Uint8Array(text.length * 2);
    const data = view(bytes);
    for (let i = 0; i < text.length; i++) data.setUint16(2 * i, text.charCodeAt(i), true);
    return bytes;
  }

  function textRecord(text) {
    const header = new Uint8Array(3);
    view(header).setUint16(0, text.length, true);
    header[2] = 1;
    return join([header, unicode(text)]);
  }

  function exportRows(rows) {
    const columns = template.columns;
    let nameFallbacks = 0;
    let missingFields = 0;
    const cells = rows.map(row => {
      const result = [];
      const cas = core.clean(row.cas);
      const brand = core.clean(row.brand);
      const pack = core.clean(row.pack);
      const name = core.clean(row.name);
      function add(column, text, limit, label) {
        if (!text) return;
        if (text.length > limit) {
          throw new Error((name || "所选商品") + "的" + label + "超过模板允许的 " + limit + " 字符。");
        }
        result.push({ column, text });
      }
      if (core.isCas(cas)) {
        add(columns.cas, cas, 20, "CAS 号");
      } else {
        if (!name) throw new Error("所选记录缺少有效 CAS 号和产品名称。");
        const nameColumn = /[\u3400-\u9fff]/.test(name) ? columns.chineseName : columns.englishName;
        add(nameColumn, name, 1000, "产品名称");
        nameFallbacks++;
      }
      add(columns.brand, brand, 100, "品牌");
      add(columns.pack, pack, 50, "包装规格");
      if (!brand || !pack) missingFields++;
      return result;
    });
    return { cells, nameFallbacks, missingFields };
  }

  function sharedStrings(cells, streamOffset) {
    const original = decode(template.headerSst);
    const index = new Map(template.headerStrings.map((text, position) => [text, position]));
    const added = [];
    let references = view(original).getUint32(0, true);
    for (const row of cells) {
      for (const cell of row) {
        if (!index.has(cell.text)) {
          index.set(cell.text, template.headerStrings.length + added.length);
          added.push(cell.text);
        }
        cell.stringIndex = index.get(cell.text);
        references++;
      }
    }
    view(original).setUint32(0, references, true);
    view(original).setUint32(4, template.headerStrings.length + added.length, true);
    const positions = template.headerStringOffsets.map(offset => ({
      absolute: streamOffset + 4 + offset, relative: 4 + offset
    }));
    const records = [];
    let parts = [original];
    let payloadLength = original.length;
    let recordStart = streamOffset;
    for (const text of added) {
      const encoded = textRecord(text);
      if (payloadLength + encoded.length > recordLimit) {
        records.push(record(records.length ? 0x003c : 0x00fc, join(parts)));
        recordStart += 4 + payloadLength;
        parts = [];
        payloadLength = 0;
      }
      // Split between strings so a Continue record never needs a character encoding flag.
      const relative = 4 + payloadLength;
      positions.push({ absolute: recordStart + relative, relative });
      parts.push(encoded);
      payloadLength += encoded.length;
    }
    records.push(record(records.length ? 0x003c : 0x00fc, join(parts)));

    const interval = Math.max(8, Math.floor(positions.length / 128) + 1);
    const buckets = positions.filter((_, i) => i % interval === 0);
    const extension = new Uint8Array(2 + 8 * buckets.length);
    view(extension).setUint16(0, interval, true);
    buckets.forEach(({ absolute, relative }, i) => {
      view(extension).setUint32(2 + 8 * i, absolute, true);
      view(extension).setUint16(6 + 8 * i, relative, true);
    });
    return join([...records, record(0x00ff, extension)]);
  }

  function sheetRow(rowIndex, cells) {
    const payload = decode(template.headerRow);
    const row = view(payload);
    row.setUint16(0, rowIndex, true);
    row.setUint16(2, cells[0].column, true);
    row.setUint16(4, cells.at(-1).column + 1, true);
    row.setUint16(6, template.defaultRowHeight, true);
    const strings = cells.map(cell => {
      const label = new Uint8Array(10);
      const data = view(label);
      data.setUint16(0, rowIndex, true);
      data.setUint16(2, cell.column, true);
      data.setUint16(4, 15, true); // The template's default cell style.
      data.setUint32(6, cell.stringIndex, true);
      return record(0x00fd, label);
    });
    return { row: record(0x0208, payload), cells: join(strings) };
  }

  function rowBlock(rows) {
    const rowBytes = join(rows.map(row => row.row));
    const cellBytes = join(rows.map(row => row.cells));
    const offset = rowBytes.length + cellBytes.length;
    const index = new Uint8Array(4 + 2 * rows.length);
    view(index).setUint32(0, offset, true);
    view(index).setUint16(4, rowBytes.length - rows[0].row.length, true);
    for (let i = 1; i < rows.length; i++) {
      view(index).setUint16(4 + 2 * i, rows[i - 1].cells.length, true);
    }
    return { bytes: join([rowBytes, cellBytes, record(0x00d7, index)]), offset };
  }

  function worksheet(cells, streamOffset) {
    const first = decode(template.sheetBeforeIndex);
    const columns = decode(template.sheetBeforeDimensions);
    const dimensions = decode(template.dimensions);
    view(dimensions).setUint32(4, cells.length + 1, true);
    const dimensionRecord = record(0x0200, dimensions);
    const rows = [{ row: record(0x0208, decode(template.headerRow)), cells: decode(template.headerCells) }];
    rows.push(...cells.map((row, i) => sheetRow(i + 1, row)));
    const index = new Uint8Array(16 + 4 * Math.ceil(rows.length / 32));
    const indexView = view(index);
    indexView.setUint32(8, rows.length, true);
    const beforeColumns = streamOffset + first.length + 4 + index.length;
    indexView.setUint32(12, beforeColumns + template.colWidthOffsetAfterIndex, true);
    let blockStart = beforeColumns + columns.length + dimensionRecord.length;
    const blocks = [];
    for (let i = 0; i < rows.length; i += 32) {
      const block = rowBlock(rows.slice(i, i + 32));
      indexView.setUint32(16 + 4 * blocks.length, blockStart + block.offset, true);
      blocks.push(block.bytes);
      blockStart += block.bytes.length;
    }
    return join([first, record(0x020b, index), columns, dimensionRecord,
      ...blocks, decode(template.sheetAfterRows)]);
  }

  function compoundFile(workbook) {
    // Version 3 OLE compound file with one regular Workbook stream and no mini streams.
    const size = Math.max(4096, workbook.length);
    const workbookSectors = Math.ceil(size / sectorSize);
    const directorySector = workbookSectors;
    const firstFat = directorySector + 1;
    const fatCount = Math.ceil(firstFat / 127);
    if (fatCount > 109) throw new Error("所选数据超过单文件导出范围，请分批导出。");
    const result = new Uint8Array((1 + firstFat + fatCount) * sectorSize);
    result.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    const data = view(result);
    data.setUint16(24, 0x3e, true);
    data.setUint16(26, 3, true);
    data.setUint16(28, 0xfffe, true);
    data.setUint16(30, 9, true);
    data.setUint16(32, 6, true);
    data.setUint32(44, fatCount, true);
    data.setUint32(48, directorySector, true);
    data.setUint32(56, 4096, true);
    data.setUint32(60, endOfChain, true);
    data.setUint32(68, endOfChain, true);
    result.fill(0xff, 76, 512);
    for (let i = 0; i < fatCount; i++) data.setUint32(76 + 4 * i, firstFat + i, true);
    result.set(workbook, sectorSize);

    const directory = (directorySector + 1) * sectorSize;
    function directoryEntry(offset, name, type, child, start, length) {
      const label = unicode(name + "\0");
      result.set(label, offset);
      data.setUint16(offset + 64, label.length, true);
      result[offset + 66] = type;
      result[offset + 67] = 1;
      data.setUint32(offset + 68, freeSector, true);
      data.setUint32(offset + 72, freeSector, true);
      data.setUint32(offset + 76, child, true);
      data.setUint32(offset + 116, start, true);
      data.setUint32(offset + 120, length, true);
    }
    directoryEntry(directory, "Root Entry", 5, 1, endOfChain, 0);
    directoryEntry(directory + 128, "Workbook", 2, freeSector, 0, size);
    const allocation = (firstFat + 1) * sectorSize;
    result.fill(0xff, allocation);
    for (let i = 0; i < workbookSectors; i++) {
      data.setUint32(allocation + 4 * i, i + 1 < workbookSectors ? i + 1 : endOfChain, true);
    }
    data.setUint32(allocation + 4 * directorySector, endOfChain, true);
    for (let i = 0; i < fatCount; i++) {
      data.setUint32(allocation + 4 * (firstFat + i), fatSector, true);
    }
    return result;
  }

  function buildFile(rows) {
    if (!rows.length || rows.length > 65535) throw new Error("请勾选 1 到 65535 条商品。");
    const { cells, nameFallbacks, missingFields } = exportRows(rows);
    const prefix = decode(template.globalsBeforeSst);
    const suffix = decode(template.globalsAfterSst);
    const strings = sharedStrings(cells, prefix.length);
    const sheetOffset = prefix.length + strings.length + suffix.length;
    view(prefix).setUint32(template.boundSheetPointer, sheetOffset, true);
    const bytes = compoundFile(join([prefix, strings, suffix, worksheet(cells, sheetOffset)]));
    return { bytes, nameFallbacks, missingFields };
  }

  globalThis.NjuPurchaseXls = { buildFile };
})();
