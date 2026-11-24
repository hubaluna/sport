/**
 * @OnlyCurrentDoc
 * FORGE / 8 - Google Apps Script для Google Таблиць
 *
 * Інструкція:
 * 1. Відкрий https://sheets.new (нова Google Таблиця, назви її "FORGE_8").
 * 2. У верхньому меню: Розширення (Extensions) -> Apps Script.
 * 3. Видали весь вміст редактора, встав цей код і натисни іконку дискетки (Зберегти).
 * 4. Натисни "Ввести в дію" (Deploy) -> "Нове розгортання" (New deployment).
 * 5. Обери тип "Веб-програма" (Web app):
 *    - Виконувати від імені: "Мене" (Me)
 *    - Хто має доступ: "Усі" (Anyone)
 * 6. Натисни "Ввести в дію" (Deploy) та дозволь доступ (доступ буде лише до цієї конкретної таблиці, блокування не буде!).
 * 7. Скопіюй URL-адресу веб-програми (/exec) та встав у налаштуваннях FORGE / 8.
 */

const SECRET_KEY = ""; // За бажанням вкажи секретний пароль або залиш пустим

function getOrCreateWorkoutsSheet(ss) {
  let sheet = ss.getSheetByName("Тренування");
  if (!sheet) {
    sheet = ss.insertSheet("Тренування");
    sheet.appendRow([
      "Дата",
      "День",
      "Назва",
      "Хвилини",
      "Віджимання",
      "Підтягування",
      "Біль",
      "RPE",
      "Запас",
      "Завершено",
      "ID",
      "Повні_Дані_JSON"
    ]);
    sheet.getRange(1, 1, 1, 12).setFontWeight("bold").setBackground("#21271D").setFontColor("#CEFA42");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getOrCreateStateSheet(ss) {
  let sheet = ss.getSheetByName("Стан_Системи");
  if (!sheet) {
    sheet = ss.insertSheet("Стан_Системи");
    sheet.appendRow(["Ключ", "Значення"]);
    sheet.getRange(1, 1, 1, 2).setFontWeight("bold");
  }
  return sheet;
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

    // Оновлюємо або додаємо тренування
    if (data.log) {
      const l = data.log;
      let pushups = "";
      let pullups = "";

      if (Array.isArray(l.entries)) {
        const pushEntries = l.entries.filter(x => x.name && x.name.includes("Віджимання") && x.reps != null);
        if (pushEntries.length) pushups = pushEntries.map(x => x.reps).join(" / ");

        const pullEntries = l.entries.filter(x => x.name && (x.name.includes("підтягуван") || x.name.includes("Тяга")) && x.reps != null);
        if (pullEntries.length) pullups = pullEntries.map(x => x.reps).join(" / ");
      }

      sheet.appendRow([
        l.date || "",
        l.day != null ? l.day : "",
        l.title || "Тренування",
        l.minutes ? Math.round(l.minutes) : "",
        pushups,
        pullups,
        l.pain != null ? l.pain : 0,
        l.rpe != null ? l.rpe : "",
        l.pullReserve != null ? l.pullReserve : "",
        l.completed ? "Так" : "Ні",
        l.id || "",
        JSON.stringify(l)
      ]);
    } else if (Array.isArray(data.logs)) {
      data.logs.forEach(l => {
        sheet.appendRow([
          l.date || "",
          l.day != null ? l.day : "",
          l.title || "Тренування",
          l.minutes ? Math.round(l.minutes) : "",
          "",
          "",
          l.pain != null ? l.pain : 0,
          l.rpe != null ? l.rpe : "",
          l.pullReserve != null ? l.pullReserve : "",
          l.completed ? "Так" : "Ні",
          l.id || "",
          JSON.stringify(l)
        ]);
      });
    }

    if (data.state) {
      const stateSheet = getOrCreateStateSheet(ss);
      stateSheet.getRange(2, 1, 1, 2).setValues([["last_state", JSON.stringify(data.state)]]);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "ok",
      count: sheet.getLastRow() - 1,
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
      // 12-та колонка містить повний JSON
      const values = sheet.getRange(2, 12, lastRow - 1, 1).getValues();
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
