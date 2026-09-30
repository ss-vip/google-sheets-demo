# Google sheets demo

Google 試算表 CRUD 範例
- 前端使用 `index.html` 靜態網頁。
- 後端使用 `Google Apps Script` GAS 作為後端 API，回傳 JSON 格式內容。
- 資料庫使用 `Google Sheets` 試算表做資料儲存。

## 怎麼使用呢？

### 1. 部署後端（GAS）

1. 到 Google 試算表建立檔案，在網址取得 `試算表 ID` → 到「擴充功能」→「Apps Script」。
2. 把 `api.gs` 的內容貼到編輯器儲存。
3. 進行「部署」→「新增部署」→ 類型選「網頁應用程式」：
   - 執行身分：**我**（對該試算表有寫入權限的帳號）
   - 具有存取權的使用者：**任何人**
4. 複製產生的完整 `/exec` 網址（該網址與試算表 ID 不同）。

註：如果有需要調整試算表欄位測試，可調整 `api.gs` 檔案內容的設定：`SHEET_NAME`（工作表名稱）與欄位順序 `COL`。

### 2. 設定前端

編輯 `index.html` 檔案：
1. 找到 `SHEETS_ID` 換成上一步的 `試算表 ID`。
2. 找到 `API_URL` 換成上一步的 `/exec` 網址。

註：前端網頁可以直接進行測試，或部署在任意可運行 html 網頁的環境。

## API 說明

所有回應皆為 JSON：成功 `{ status: true, ... }`、失敗 `{ status: false, error: "..." }`。

| action  | 方法 | 參數               | 說明                       |
|---------|------|--------------------|----------------------------|
| `list`  | GET  | —                  | 列出全部資料（不含標題列） |
| `select`| GET  | `uid`              | 查單筆                     |
| `insert`| POST | `uid`, `name`      | 新增（編號重複會拒絕）     |
| `update`| POST | `uid`, `money`     | 更新獎金（0–999999）       |
| `delete`| POST | `uid`              | 刪除整列                   |

範例：

```bash
# 查全部
curl -L "https://script.google.com/macros/s/Your_Google_Sheets_ID/exec?action=list"

# 新增
curl -L -X POST "https://script.google.com/macros/s/XXXX/exec" \
     -H "Content-Type: text/plain" \
     -d '{"action":"insert","uid":"a11","name":"體育老師"}'
```

## 工作表格式

| 員工編號 | 姓名 | 年資 | 獎金 | 其他 | Email       |
|----------|------|------|------|------|-------------|
| a01      | 小明 | 3    | 100  | 0    | a01@mail.com |

- 第一列為標題列；`SHEET_NAME` 請對應你的工作表名稱。
- 寫入操作都有 `LockService` 保護，避免併發造成重複新增或刪錯列。

## 比較舊版（PHP）的差異

- 不再需要 PHP、Google Auth Key 與 vendor package。
- 授權由 GAS 平台處理（執行身分＝你的帳號），沒有 token 過期問題。
- 回應從純文字改為 JSON；前端渲染一律用 `textContent`，避免 XSS。
- `sheetId` 寫死、`error_reporting(0)` 吞錯誤、`$_REQUEST` 等舊問題一併移除。
