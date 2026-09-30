/**
 * Google Sheets CRUD API（Google Apps Script）
 *
 * 測試：
 *   curl -L -X POST "https://script.google.com/macros/s/XXXX/exec" \
 *        -H "Content-Type: text/plain" \
 *        -d '{"action":"list"}'
 */

// ====== 設定（依實際的工作表調整） ======
var SHEET_NAME = '工作表1';
// 欄位順序：員工編號、姓名、年資、獎金、其他、Email
var COL = { UID: 1, NAME: 2, SENIORITY: 3, MONEY: 4, EXTRA: 5, EMAIL: 6 };

// ====== 進入點 ======
function doGet(e) {
  var params = (e && e.parameter) || {};
  return json_(handle(params));
}

function doPost(e) {
  var params = {};
  // 前端以 text/plain 送 JSON，避開 CORS preflight
  if (e && e.postData && e.postData.contents) {
    try {
      params = JSON.parse(e.postData.contents);
    } catch (err) {
      return json_({ status: false, error: 'JSON 格式錯誤：' + err.message });
    }
  }
  return json_(handle(params));
}

function handle(p) {
  var action = String(p.action || '');
  try {
    switch (action) {
      case 'list':   return list_();
      case 'select': return select_(p.uid);
      case 'insert': return insert_(p.uid, p.name);
      case 'update': return update_(p.uid, p.money);
      case 'delete': return delete_(p.uid);
      default:       return { status: false, error: '不支援的 action：' + action };
    }
  } catch (err) {
    return { status: false, error: String(err && err.message ? err.message : err) };
  }
}

// ====== CRUD ======

// 查全部（不含標題列）
function list_() {
  var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  var values = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (String(r[COL.UID - 1]) === '') continue; // 跳過空列
    rows.push(rowToObj_(r));
  }
  return { status: true, data: rows };
}

// 查單筆
function select_(uid) {
  if (!validUid_(uid)) return { status: false, error: '員工編號格式錯誤。' };
  var row = findRow_(uid);
  if (!row) return { status: false, error: '查不到 ' + uid + ' 資料' };
  return { status: true, data: rowToObj_(row.values) };
}

// 新增（UID 重複則拒絕）
function insert_(uid, name) {
  uid = String(uid || '').trim();
  name = String(name || '').trim();
  if (!uid || !name) return { status: false, error: '新增資料失敗：編號與姓名皆必填。' };
  if (uid === '員工編號') return { status: false, error: uid + ' 資料怪怪的，請檢查...' };

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (findRow_(uid)) return { status: false, error: '編號重複了！' };
    var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    sheet.appendRow([uid, name, '0', '18', '0', uid + '@mail.com']);
    return { status: true, message: '已新增員工：' + uid + '（' + name + '）' };
  } finally {
    lock.releaseLock();
  }
}

// 更新獎金（E 欄）
function update_(uid, money) {
  if (!validUid_(uid)) return { status: false, error: '員工編號格式錯誤。' };
  if (!/^\d{1,6}$/.test(String(money))) return { status: false, error: '只能輸入小於一百萬的獎金。' };

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var found = findRow_(uid);
    if (!found) return { status: false, error: '查不到 ' + uid + ' 資料' };
    var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    sheet.getRange(found.index, COL.MONEY).setValue(Number(money));
    return { status: true, message: '已給員工：' + uid + ' 發大財獎金：' + money };
  } finally {
    lock.releaseLock();
  }
}

// 刪除整列
function delete_(uid) {
  if (!validUid_(uid)) return { status: false, error: '員工編號格式錯誤。' };

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var found = findRow_(uid);
    if (!found) return { status: false, error: '查不到 ' + uid + ' 資料' };
    var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    sheet.deleteRow(found.index);
    return { status: true, message: '倒楣的' + found.values[COL.NAME - 1] + '已被開除！編號：' + uid };
  } finally {
    lock.releaseLock();
  }
}

// ====== Demo 資料還原（定時排程用） ======
/**
 * 還原 demo 資料：清空標題列以外的所有資料，重寫為下方 DEMO_DATA。
 * 與 CRUD 共用同一把 ScriptLock，還原不會截斷正在進行的寫入。
 *
 * 【排程設定方式（二擇一）】
 *   方式一（建議，免設定畫面）：在編輯器選一次 setupRestoreTrigger 執行，
 *     它會建立每 5 分鐘執行一次 restoreDemoData 的觸發條件（重複執行不會重複建立）。
 *   方式二（UI 操作）：左側「觸發條件」（鬧鐘圖示）→「新增觸發條件」→
 *     函式選 restoreDemoData → 事件來源「時間驅動」→「分鐘計時器」→ 每 5 分鐘。
 *
 * 注意：還原會「覆蓋工作表全部資料」，只適合 demo 性質的試算表。
 * DEMO_DATA 內容請依你的需求修改（欄位順序需與工作表一致）。
 */
var DEMO_DATA = [
  ['a01', '實習生', 1, 19,  100, 'a01@mail.com'],
  ['a02', '王小明', 3, 150, 0,   'a02@mail.com'],
  ['a03', '陳大文', 5, 300, 0,   'a03@mail.com'],
  ['a04', '林小美', 2, 80,  0,   'a04@mail.com'],
  ['a05', '張阿財', 10, 999, 0,  'a05@mail.com']
];
var DEMO_HEADER = ['員工編號', '姓名', '年資', '獎金', '其他', 'Email'];

/**
 * 完整還原：涵蓋三種破壞情境——
 *   1. 工作表被刪除 → 重建工作表
 *   2. 標題列被修改 → 重寫標題
 *   3. 資料被新增/修改/刪除 → 清空後重寫 DEMO_DATA
 * 界線：整份「試算表檔案」被丟垃圾桶時，綁定的腳本會跟著失效，無法自救；
 *       靠分享權限防（連結者只給「檢視者」，別給編輯者）。
 */
function restoreDemoData() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = SpreadsheetApp.getActive();
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME); // 情境 1：工作表被刪 → 重建
    }
    // 情境 2：標題列被改 → 重寫
    var header = sheet.getRange(1, 1, 1, DEMO_HEADER.length).getValues()[0];
    if (header.join(',') !== DEMO_HEADER.join(',')) {
      sheet.getRange(1, 1, 1, DEMO_HEADER.length).setValues([DEMO_HEADER]);
    }
    // 情境 3：清掉標題列以外的所有資料，重寫 demo 資料
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }
    sheet.getRange(2, 1, DEMO_DATA.length, DEMO_DATA[0].length).setValues(DEMO_DATA);
  } finally {
    lock.releaseLock();
  }
}

// 執行一次即建立「每 5 分鐘還原」的排程；重複執行會先刪舊觸發，不會疊加
function setupRestoreTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'restoreDemoData') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('restoreDemoData').timeBased().everyMinutes(5).create();
}

// ====== 輔助函式 ======

function validUid_(uid) {
  var u = String(uid || '').trim();
  return u !== '' && u !== '員工編號';
}

// 回傳 { index: 試算表實際列號, values: 該列陣列 }，找不到回 null
function findRow_(uid) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) { // i=0 是標題列
    if (String(values[i][COL.UID - 1]) === String(uid)) {
      return { index: i + 1, values: values[i] };
    }
  }
  return null;
}

function rowToObj_(r) {
  return {
    uid: r[COL.UID - 1],
    name: r[COL.NAME - 1],
    seniority: r[COL.SENIORITY - 1],
    money: r[COL.MONEY - 1],
    extra: r[COL.EXTRA - 1],
    email: r[COL.EMAIL - 1]
  };
}

// Web Apps 的 doGet/doPost 必須回傳 ContentService 輸出，回傳裸物件會得到
// 「指令碼已完成，但傳回值的類型不是支援的傳回類型」錯誤頁
function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
