# 純瀏覽器 Word 匯出試驗版（版本 1.6）

修訂日期：2026年8月18日

此目錄是方案 C 試驗版，與原本 `public/`、`server.py` 及 V1 分開。

- 所有填寫資料只會儲存在瀏覽器的 `teaching-progress-plan-browser-v1`。
- 按「下載 Word」時，瀏覽器以 `template.docx` 為基礎直接建立 DOCX，不會呼叫 Python 或任何匯出服務。
- `jszip.min.js` 已隨試驗版一併提供；匯出不依賴外部 CDN、Python 或伺服器。
- 發佈時請透過一般靜態網址測試；直接以 `file:///` 開啟時，下載前會要求使用者手動選擇同目錄的 `template.docx`，因為瀏覽器不允許網頁自動讀取本機檔案。
