/**
 * FORGE / 8 - Google Apps Script для збереження тренувань на Google Диск
 *
 * Інструкція зі встановлення:
 * 1. Відкрий https://script.google.com/ і натисни "Новий проєкт" (New project)
 * 2. Видали весь код у редакторі та встав цей файл повністю.
 * 3. (Опційно) Задай свій SECRET_KEY нижче, наприклад: const SECRET_KEY = "mysecret123";
 * 4. Натисни "Розгорнути" (Deploy) -> "Нове розгортання" (New deployment).
 * 5. Обери тип: "Веб-програма" (Web app).
 *    - Опис: FORGE Sync
 *    - Виконувати від імені: "Мене" (Me)
 *    - Хто має доступ: "Усі" (Anyone) — доступ захищений вашим SECRET_KEY та унікальним довгим URL скрипта!
 * 6. Натисни "Розгорнути" (Deploy) та надай дозволи своєму обліковому запису Google.
 * 7. Скопіюй отриману "URL-адресу веб-програми" (Web app URL) та встав у налаштуваннях FORGE / 8 (Профіль -> Google Диск).
 */

const SECRET_KEY = ""; // Встанови секретний пароль або залиш пустим

function getOrCreateFolder() {
  const folderName = "FORGE_8_Data";
  const folders = DriveApp.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
}

function getWorkoutsFile(folder) {
  const fileName = "forge_workouts.json";
  const files = folder.getFilesByName(fileName);
  if (files.hasNext()) {
    return files.next();
  }
  return folder.createFile(fileName, "[]", "application/json");
}

function doPost(e) {
  try {
    const raw = e.postData ? e.postData.contents : "{}";
    const data = JSON.parse(raw);

    if (SECRET_KEY && data.secret !== SECRET_KEY) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Unauthorized" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const folder = getOrCreateFolder();
    const file = getWorkoutsFile(folder);
    let workouts = [];
    try {
      workouts = JSON.parse(file.getBlob().getDataAsString() || "[]");
    } catch (_) {
      workouts = [];
    }

    if (data.log) {
      const idx = workouts.findIndex(w => w.id === data.log.id);
      if (idx >= 0) {
        workouts[idx] = data.log;
      } else {
        workouts.push(data.log);
      }
    } else if (Array.isArray(data.logs)) {
      workouts = data.logs;
    }

    file.setContent(JSON.stringify(workouts, null, 2));

    // Оновлюємо повний стан, якщо передано
    if (data.state) {
      const stateFiles = folder.getFilesByName("forge_state.json");
      const stateFile = stateFiles.hasNext()
        ? stateFiles.next()
        : folder.createFile("forge_state.json", "{}", "application/json");
      stateFile.setContent(JSON.stringify(data.state, null, 2));
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "ok",
      count: workouts.length,
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

    const folder = getOrCreateFolder();
    const file = getWorkoutsFile(folder);
    const content = file.getBlob().getDataAsString() || "[]";

    return ContentService.createTextOutput(content)
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
