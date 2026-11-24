/**
 * @OnlyCurrentDoc
 * FORGE / 8 - Google Apps Script для Google Таблиць
 */

const SECRET_KEY = ""; // За бажанням вкажи секретний пароль або залиш пустим

const HEADERS = [
  "Дата",
  "День",
  "Назва",
  "Хвилини",
  "Віджимання",
  "Підтягування (турнік)",
  "Тяга резинки",
  "Присідання/Випади",
  "Кор (колесо/жук)",
  "Біль",
  "RPE",
  "Запас",
  "Завершено",
  "ID",
  "Повні_Дані_JSON"
];

const ID_COL = 14; // Колонка "ID" (1-based)

function getOrCreateWorkoutsSheet(ss) {
  let sheet = ss.getSheetByName("Тренування");
  if (!sheet) {
    sheet = ss.insertSheet("Тренування");
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#21271D").setFontColor("#CEFA42");
    sheet.setFrozenRows(1);
  } else {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#21271D").setFontColor("#CEFA42");
  }
  return sheet;
}

function parseLogToRow(l) {
  let pushups = "";
  let pullups = "";
  let bandPulls = "";
  let legs = "";
  let core = "";

  if (Array.isArray(l.entries)) {
    const pe = l.entries.filter(x => x.name && x.name.includes("Віджимання") && x.reps != null);
    if (pe.length) pushups = pe.map(x => x.reps).join(" / ");

    const ple = l.entries.filter(x => x.name && x.name.toLowerCase().includes("підтягуван") && !x.name.toLowerCase().includes("тяга") && x.reps != null);
    if (ple.length) pullups = ple.map(x => x.reps).join(" / ");

    const be = l.entries.filter(x => x.name && x.name.toLowerCase().includes("тяга") && x.reps != null);
    if (be.length) bandPulls = be.map(x => x.reps).join(" / ");

    const legEntries = l.entries.filter(x => x.name && (x.name.includes("Присідання") || x.name.includes("випади") || x.name.includes("міст")) && x.reps != null);
    if (legEntries.length) legs = legEntries.map(x => x.reps).join(" / ");

    const coreEntries = l.entries.filter(x => x.name && (x.name.includes("Колесо") || x.name.includes("жук") || x.name.includes("Прес")) && x.reps != null);
    if (coreEntries.length) core = coreEntries.map(x => x.reps).join(" / ");
  }

  return [
    l.date || "",
    l.day != null ? l.day : "",
    l.title || "Тренування",
    l.minutes ? Math.round(l.minutes) : "",
    pushups,
    pullups,
    bandPulls,
    legs,
    core,
    l.pain != null ? l.pain : 0,
    l.rpe != null ? l.rpe : "",
    l.pullReserve != null ? l.pullReserve : "",
    l.completed ? "Так" : "Ні",
    l.id || "",
    JSON.stringify(l)
  ];
}

function upsertLogs(sheet, logsToSave) {
  const lastRow = sheet.getLastRow();
  const idToRow = {};
  if (lastRow > 1) {
    const idValues = sheet.getRange(2, ID_COL, lastRow - 1, 1).getValues();
    for (let i = 0; i < idValues.length; i++) {
      const id = String(idValues[i][0] || "").trim();
      if (id) idToRow[id] = i + 2;
    }
  }

  for (let i = 0; i < logsToSave.length; i++) {
    const l = logsToSave[i];
    if (!l) continue;
    const row = parseLogToRow(l);
    const id = String(l.id || "").trim();
    if (id && idToRow[id]) {
      sheet.getRange(idToRow[id], 1, 1, HEADERS.length).setValues([row]);
    } else {
      sheet.appendRow(row);
      if (id) idToRow[id] = sheet.getLastRow();
    }
  }
}

function doPost(e) {
  try {
    const raw = e.postData ? e.postData.contents : "{}";
    const data = JSON.parse(raw);

    if (SECRET_KEY && data.secret !== SECRET_KEY) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Unauthorized" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateWorkoutsSheet(ss);

    if (data.action === "clear_and_reload" && Array.isArray(data.logs)) {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
      data.logs.forEach(l => sheet.appendRow(parseLogToRow(l)));
      return ContentService.createTextOutput(JSON.stringify({ status: "ok", count: data.logs.length }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const toSave = [];
    if (data.log) toSave.push(data.log);
    if (Array.isArray(data.logs)) {
      data.logs.forEach(l => toSave.push(l));
    }

    if (toSave.length > 0) {
      upsertLogs(sheet, toSave);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "ok",
      count: Math.max(0, sheet.getLastRow() - 1),
      updatedAt: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const token = e.parameter ? e.parameter.secret : "";
    if (SECRET_KEY && token !== SECRET_KEY) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Unauthorized" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const action = e.parameter ? e.parameter.action : "get";
    if (action === "ping") {
      return ContentService.createTextOutput(JSON.stringify({ status: "ok", ping: "pong" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateWorkoutsSheet(ss);
    const lastRow = sheet.getLastRow();
    const workouts = [];

    if (lastRow > 1) {
      const jsonCol = HEADERS.length;
      const values = sheet.getRange(2, jsonCol, lastRow - 1, 1).getValues();
      for (let i = 0; i < values.length; i++) {
        const rawJson = values[i][0];
        if (rawJson) {
          try {
            workouts.push(JSON.parse(rawJson));
          } catch (_) {}
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify(workouts))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
