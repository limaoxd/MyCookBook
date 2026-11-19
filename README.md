# 食譜工具 Recipe Cloud

純前端（HTML / CSS / JavaScript）食譜 app，沒有自己的 Server。介面是 app 風格，底部三個圖示分頁：搜尋、首頁、新增。

## 功能

- **首頁**：只有「我的食譜」（存在這台裝置）。
  - **篩選**：點「篩選」展開標籤（依分類上色），選取後可切換「交集」（同時包含）或「聯集」（包含任一）。
  - **隨機選取**：從目前（篩選後）的食譜裡抽一份並直接開始做菜，會盡量避免連續抽到同一份。
  - 每份食譜可編輯、發布到雲端、匯出 JSON、刪除；也可匯入備份。
- **搜尋**：圖片瀑布流（正方形圖片 + 名稱與標籤）。點搜尋欄才會出現標籤面板，可自己輸入標籤或點預設標籤，同樣支援交集 / 聯集。點食譜即可開始做菜，右上角書籤可存到「我的食譜」。
- **新增 / 編輯**：版型與做菜頁相同。
  - 封面：從相簿選照片（自動裁成正方形並壓縮），或選預設圖示；不選的話依標題與食材自動挑圖示。
  - 備料：食材名稱自動成為搜尋標籤，單位可選。
  - 步驟：節點可上下移動、刪除；每個步驟可設定計時（計時框在步驟框裡面）。
- **做菜**：步驟以一條線串成時間軸，目前步驟為黃色，其他為深色；計時框在步驟框裡，會跟著一起反白。
  - 手機：拇指上下滑動。
  - 電腦：滑鼠滾輪一格一步、↑ ↓ 鍵、滑鼠拖曳；空白鍵開始／暫停目前步驟的計時；Esc 離開。
  - 計時結束會響鈴並震動，1.2 秒後自動切到下一步（下一步的計時需要自己點開始）。

## 標籤顏色

標籤是圓角框，顏色依分類（顏色變數在 `style.css` 最上方）：

| 分類 | 顏色 | 例子 |
| --- | --- | --- |
| 肉類（含蛋、豆腐） | 紅 | 雞肉、雞蛋、火腿、鮭魚 |
| 菜類 | 綠 | 蔥、蒜、番茄、高麗菜 |
| 水果 | 粉 | 檸檬、蘋果 |
| 澱粉類 | 米 | 白飯、麵條、馬鈴薯 |
| 菇類 | 棕 | 香菇、木耳 |
| 醬類 | 黑 | 醬油、味噌、咖哩 |
| 調味 | 白 | 鹽巴、糖、橄欖油、起司 |
| 湯 | 藍 | 高湯、雞湯 |

分類是用名稱關鍵字自動判斷（見 `app.js` 的 `KEYWORDS`），判斷不出來的標籤是灰色。要新增或調整，改 `KEYWORDS` 即可。

## 直接使用（不設定雲端）

用瀏覽器打開 `index.html` 即可。未設定雲端時，搜尋頁顯示四份示範食譜，新增的食譜只存在本機。
`logo.png` 是首頁上方與網頁圖示用的圖片，需和其他檔案放在同一個資料夾。

## 啟用雲端（Firebase Firestore，約 5 分鐘）

1. 到 https://console.firebase.google.com 建立專案
2. 「Build → Firestore Database」建立資料庫（正式模式）
3. 「專案設定 → 一般 → 您的應用程式」新增 Web 應用程式，取得 `apiKey` 與 `projectId`
4. 填入 `app.js` 最上方的 `CLOUD`
5. Firestore「規則」貼上（任何人可讀、可新增，但不能改或刪）。**這版多了 `cover` 欄位，舊規則要更新**：
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /recipes/{id} {
         allow read: if true;
         allow create: if request.resource.data.keys().hasOnly(['title','tags','json','cover','createdAt'])
           && request.resource.data.title is string
           && request.resource.data.title.size() <= 60
           && request.resource.data.json is string
           && request.resource.data.json.size() < 50000
           && request.resource.data.cover is string
           && request.resource.data.cover.size() < 100000;
         allow update, delete: if false;
       }
     }
   }
   ```
6. （建議）Google Cloud Console → API 和服務 → 憑證，把 API key 限制為你的網站網域（HTTP referrer）。

## 注意事項

- Web API key 本來就會公開在前端，安全性靠 Firestore 規則，不是靠藏 key。
- 照片會壓成約 20–50 KB 的小圖，直接存在 Firestore 文件裡；搜尋頁一次載入最新 100 份食譜，食譜與照片變多之後，建議改用 Firebase Storage 存圖、並用 Firestore 的 `array-contains` 做標籤查詢（`tags` 欄位已預先寫入）。
- 目前任何人都能上傳，可能出現垃圾內容；之後可加入 Firebase App Check 或人工審核。
- 已發布的食譜無法修改雲端版本（規則禁止 update），在本機編輯只會改本機那份。
- 鬧鈴聲音需要使用者先點過計時框才能播放（瀏覽器限制）。
