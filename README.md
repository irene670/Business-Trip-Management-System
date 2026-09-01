# 集團差旅事後報支系統（Node.js + React）

這是提供員工申報自費代墊支出的 Node.js + React 系統，保留三角色流程與 UI 架構：

- 員工事後報支
- 主管審核
- 會計／行政逐筆核銷

## 這版的附件規則

每一筆員工代墊核銷項目都直接上傳對應票據照片，並在該項目內顯示縮圖，例如車票、住宿發票／收據、加油、停車、計程車或門票憑證。不需上傳活動照片或任務現場照片。

公司已付款或使用公司信用卡支付的項目不需在本系統申請。

## 開發環境啟動

```bash
npm install
npm run dev
```

- React / Vite: http://localhost:5173
- Node API: http://localhost:8787

## 建置正式版

```bash
npm run build
npm start
```

Node.js 會直接提供 `dist` 靜態檔案與 API。

## 資料與附件

目前為適合內部測試的檔案式後端：

- 案件／設定：`server/data/store.json`
- 附件：`server/uploads/`

因此不同電腦連到同一台 Node.js 主機時，資料與附件可以真正共用，不再受單機 localStorage / IndexedDB 限制。

正式對外或多人長期使用時，建議再換成 PostgreSQL / MySQL、公司登入與權限驗證、備份及物件儲存。

## Render 部署

專案包含 `render.yaml`，可以建立 Render Web Service。正式使用時請掛載持久化磁碟，並設定：

- `DATA_DIR=/var/data`
- `UPLOAD_DIR=/var/data/uploads`

免費方案的本機檔案系統不是永久儲存，只適合流程預覽，不應保存正式員工資料或票據。
