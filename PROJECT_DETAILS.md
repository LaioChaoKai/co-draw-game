# 🎨 CoDraw - 多人即時協作畫布與你畫我猜遊戲平台 專案報告書

本文件為 **CoDraw** 專案的詳細技術報告與開發歷程紀錄。內容包含專案的核心特色、技術架構、語意理解 AI 整合設計、雲端部署方案、以及從零到有的開發過程。此專案非常適合作為大專院校課程（如系統整合、網路程式設計、容器化部署、雲端架構設計）的期末成果展現。

---

## 🌐 專案部署資訊
* **前端發布網址 (Static Frontend)**: [https://ischaokai.online](https://ischaokai.online)
* **後端 API 伺服器 (WebSocket Backend)**: [https://co-draw-game-backend.onrender.com](https://co-draw-game-backend.onrender.com)
* **雲端託管平台**: Render (Free tier)
* **自訂網域綁定**: `ischaokai.online` (透過 CNAME 紀錄導向 Render Static)

---

## 🚀 專案核心特點與功能細節

本專案不僅是一個基礎的 WebSocket 畫布同步工具，更包含多項針對多人連線、跨平台適應性、防作弊機制以及 AI 互動的深度整合：

### 1. 即時雙向通訊與同步系統 (Socket.io)
* **低延遲畫筆同步**：當畫家在畫布上移動滑鼠或觸控筆時，前端會以極高頻率捕捉座標點並透過 Socket.io 發送 `draw` 事件，後端伺服器則將資料轉發給同房間的所有連線玩家，在毫秒內於他人螢幕上重繪畫筆軌跡。
* **狀態同步緩衝 (Drawing History)**：當有玩家在遊戲進行中斷線重連或新加入時，後端會將當前局的畫筆軌跡歷史記錄（`draw_history`）一次性推送給該玩家，確保新加入的玩家畫面與其他玩家完全同步。

### 2. 自適應解析度與相對座標系統
* **挑戰**：在多人連線遊戲中，玩家使用的裝置可能包含 4K 螢幕、筆記型電腦、iPad、甚至 iPhone。若直接同步螢幕的絕對座標（像素值 $X, Y$），會導致在不同解析度的螢幕上軌跡發生位移、縮放甚至超出邊界。
* **解決方案**：採用「**相對比例座標系統（0.0 到 1.0）**」。
  * **發送端（畫家）**：
    $$\text{Relative } X = \frac{\text{Absolute } X}{\text{Canvas Width}}$$
    $$\text{Relative } Y = \frac{\text{Absolute } Y}{\text{Canvas Height}}$$
  * **接收端（猜題玩家）**：
    $$\text{Target Absolute } X = \text{Relative } X \times \text{Current Canvas Width}$$
    $$\text{Target Absolute } Y = \text{Relative } Y \times \text{Current Canvas Height}$$
* 藉此演算法，無論玩家螢幕大小、比例如何，畫筆軌跡皆能完美對齊。

### 3. 行動端自適應與觸控繪圖支援 (Mobile Touch Control)
* 本專案深度優化了對觸控螢幕的支援。在 Canvas 上註冊了 `onTouchStart`、`onTouchMove`、`onTouchEnd` 事件。
* 透過解析 `e.touches[0].clientX` 計算觸控點相對於 Canvas 邊界的座標，解決了行動裝置（如 iPad、手機）在網頁畫圖時會滾動螢幕或定位偏移的問題，使手機用戶能順暢繪圖。
* CSS 採用彈性佈局（Flexbox）與響應式媒體查詢（Media Queries），確保在手機直向或橫向畫面下，聊天室、計分板與畫布都不會重疊錯位。

### 4. 完整的遊戲循環與分數系統
遊戲房支援完整的自動化流程：
* **大廳階段 (Lobby)**：玩家可以輸入暱稱、可選的 Gemini API Key，創建新房（隨機產生 6 碼英數字 Room Code）或加入已有房間。需要至少 2 人在線方可點擊「開始遊戲」。
* **單字選取階段 (Selecting Word)**：系統會隨機輪替「畫家」。畫家有 15 秒的時間從系統隨機抽出的 3 個單字中選取一個進行繪製。若超時，系統將自動選取。
* **作畫猜題階段 (Playing)**：每回合為時 120 秒。畫家在此階段無法於聊天室發言（防透露），其他玩家則可於聊天室內瘋狂猜題。
* **回合結束與積分結算 (Round End)**：當時間結束、或所有玩家都猜對/用盡答題次數時，回合結束，顯示正確答案並加分，5 秒後自動進入下一輪。
* **遊戲結束 (Game Over)**：固定進行 10 回合，最後顯示終極積分排行榜（Leaderboard），10 秒後自動將所有玩家帶回大廳重新開始。

#### 題庫難度分類與積分權重對照表
| 難度類別 (Category) | 題庫類型 | 猜對者得分 (Guesser Score) | 畫家基本加分 (Drawer Score) |
|:---:|:---:|:---:|:---:|
| **baby** | 基礎生活單字 | 100 分 | 50 分 |
| **advanced** | 進階/抽象詞彙 | 100 分 | 100 分 |
| **idiom** | 四字成語 | 100 分 | 150 分 |
| **meme** | 流行梗/網路迷因 | 200 分 | 200 分 |

*註：當有猜題者猜對時，畫家也會獲得加分，這能激勵畫家認真作畫，避免胡亂繪製。*

### 5. 防劇透與防作弊機制
* **畫家限制**：遊戲進行時只有畫家能繪製，其餘玩家僅能猜題。畫家在該回合中禁用聊天室，避免畫家用文字直接寫出答案。
* **答題鎖定**：當玩家猜對答案後，聊天室會顯示「🎉 恭喜某某某猜對了答案！」，此時該猜對玩家的輸入框會被鎖定（Lock Input），防止其繼續發送訊息向其他尚未猜出的玩家透露劇透。

### 6. 創新 Gemini 2.5 Flash 智慧畫布語意助理
這是一個創新的 AI 輔助玩法。猜題玩家在毫秒間陷入困局時，可以求助 Gemini AI！

* **安全與成本考量 (Client-Side API Key)**：為確保安全性與避免伺服器端 Key 洩漏或超額被扣款，專案採用「用戶在大廳自行填入 API Key」的設計。API Key 僅存在於瀏覽器記憶體中，隨 Socket 連線暫時傳遞給後端 API 呼叫，伺服器不儲存任何 Key，達成**零後端 AI 授權成本**。
* **嚴格的問答限制**：每人每回合**僅能向 AI 提問一次**，且一旦向 AI 提問，該玩家在該回合的答題次數會立刻被限縮為 **1 次作答機會**（高風險高回報，防止無腦洗 AI 答案）。
* **AI 的兩種有趣響應模式**：
  1. **【看不懂】模式（公開嘲諷）**：若畫布是空白的、極度不完整、或根本看不出在畫什麼，Gemini 會判定為看不懂，此時回答必定以 `【看不懂】` 開頭，並用搞笑、毒舌的台灣流行語（如「笑死、到底在畫三小、超派、可憐啊」）來吐槽畫家。此吐槽會**公開廣播給房間內所有人看**，營造歡樂氣氛。
  2. **提示模式（私人 clues）**：若畫布內容可被識別，AI 將根據畫面上已繪製的圖形以及使用者的問題，給出主觀描述與提示，引導使用者思考。此提示為**私人訊息**，僅發問玩家看得到。AI 知道答案的字數，但**絕對不會直接講出答案單字**。

---

## 🛠️ 專案技術棧 (Tech Stack)

```mermaid
graph TD
    subgraph Frontend (React + Vite)
        A[HTML5 Canvas / Touch Event]
        B[Socket.io-client]
        C[CSS Glassmorphism UI]
        D[Canvas-Confetti 特效]
    end

    subgraph Cloud Backend (Node.js)
        E[Express Web Server]
        F[Socket.io Server]
        G[Gemini API Proxy with Backoff]
    end

    subgraph Scalability / Cache (Redis)
        H[Redis Pub/Sub Socket Adapter]
    end

    B <-->|WebSockets| F
    G <-->|Fetch API| I[Google Gemini API]
    F <-->|Redis Pub/Sub| H
```

* **前端**: React (Vite) + Lucide Icons + Canvas-Confetti (磨砂玻璃風 Glassmorphism 主視覺)
* **後端**: Node.js + Express + Socket.io
* **快取/配接器**: Redis (用於多伺服器水平擴充套件，在 Render 環境會自動優化為免 Redis 運作模式)
* **伺服器分流**: Nginx (在生產環境 Docker 容器中作為靜態資源分流與代理)
* **容器化**: Docker & Docker Compose (提供開發/生產雙 Compose 腳本)

---

## 🐳 Docker 雙 Compose 環境配置說明

專案目錄中包含兩個 Compose 設定檔，分別應對開發與展示場景：

### 1. `docker-compose.dev.yml` (開發環境)
專為本地端快速迭代開發而設計：
* **程式碼熱重載 (Hot Reloading)**：將本地端 `frontend` 與 `backend` 的程式碼目錄以 Volume 掛載方式連入容器內。只要你在 VSCode 中存檔，前端 Vite HMR 與後端 nodemon 會立刻更新，無需重置容器。
* **自動安裝依賴**：在啟動時會自動檢測並執行 `npm install`。

### 2. `docker-compose.yml` (生產演示環境)
專為本地模擬線上生產環境或部署至 VPS 而設計：
* **前端 Nginx 靜態分流**：前端 Dockerfile 採用**多階段建置 (Multi-stage build)**，在第一階段用 Node.js 將 React 專案編譯打包為 HTML/JS/CSS 靜態檔，在第二階段將打包產物移入超輕量 Nginx 容器。
* **安全性**：Nginx 作為網頁伺服器監聽 Port 80，後端服務在內部通訊，不對外暴露 Redis 連接埠，提升安全性。

---

## ☁️ 如何雲端發布與部署 (Render 託管)

本專案完全適應 Render 免費雲端平台的託管特性：

### 1. 後端 Node.js WebSocket 伺服器部署
在 Render 控制台創建一個新的 **Web Service**：
* **連線 Git Repository**：選擇你的專案程式庫。
* **Root Directory**：輸入 `backend`。
* **Runtime**：選擇 `Node`。
* **Build Command**：輸入 `npm install`。
* **Start Command**：輸入 `npm start`。
* **環境變數 (Environment Variables)**：
  * `NODE_ENV`: `production`
  * `PORT`: `10000`

### 2. 前端 React 靜態網頁部署
在 Render 控制台創建一個新的 **Static Site**：
* **Root Directory**：輸入 `frontend`。
* **Build Command**：輸入 `npm install && npm run build`。
* **Publish Directory**：輸入 `dist`。
* **環境變數 (Environment Variables)**：
  * `VITE_SOCKET_URL`: 指向你的後端 Render 網址（例如：`https://co-draw-game-backend.onrender.com`）。

### 3. 免費方案下的 Redis 連線防掛起優化
* **問題**：Render 的免費方案不提供免費的 Redis 服務。如果後端程式碼強行嘗試連線 Redis，在沒有 Redis 服務的情況下，後端伺服器在連線超時前會處於掛起（Hang）狀態，導致健康檢查失敗、服務無法啟動。
* **解決方案**：在 `backend/server.js` 中實現了 **Redis 軟防禦與自動降級機制**：
  ```javascript
  if (REDIS_URL) {
    // 嘗試建立 Redis Client 並套用 Redis Adapter 達成水平擴充
  } else {
    // 輸出 Log: "No REDIS_URL set, using local memory adapter (single-server mode)."
    // 自動降級回記憶體模式，讓 WebSocket 在 Render Free Tier 順利啟動
  }
  ```
  這項改動使專案既保留了「百萬玩家水平擴充（Redis adapter）」的學術加分點，又能在零成本的 Render 免費環境下完美運行。

### 4. 自訂網域繫結
* 註冊一個個人網域（本專案使用 `ischaokai.online`）。
* 在你的網域註冊商 DNS 管理介面，為 `@` 或子網域（如 `www`）新增一條 **CNAME** 紀錄，指向 Render 給予的前端靜態網站別名（例如 `co-draw-game-frontend.onrender.com`）。
* 在 Render Frontend 的 Settings 中新增 Custom Domain，通過驗證後即完成繫結與自動 SSL 證書配置。

---

## 📈 專案開發歷程回顧

本專案的演進歷經了多個階段的打磨與重構：

### 📅 第一階段：基礎即時畫布建置 (2026年6月10日)
* **目標**：完成最核心的多人連線協作畫筆。
* **實作內容**：
  * 初始化 Node.js + Express 與 React 專案結構。
  * 引入 `socket.io` 與 `socket.io-client` 建立長連線。
  * 在 Canvas 上捕捉鼠標移動事件，發送繪圖軌跡。
  * 完成基礎的 `docker-compose.dev.yml`，使前後端能在 Docker 容器中啟動。

### 📅 第二階段：遊戲循環與題庫分數機制 (2026年6月10日-11日)
* **目標**：將畫布擴展為完整的「你畫我猜」小遊戲。
* **實作內容**：
  * 建立狀態機管理：大廳 -> 單字選取 -> 作畫猜題 -> 回合結束。
  * 設計 `words.json` 題庫，包含 baby、advanced、idiom、meme 等多難度分類。
  * 引入 `canvas-confetti` 當玩家答對時噴發彩帶。
  * 新增答題鎖定與畫家禁用聊天室規則，確保遊戲公平。

### 📅 第三階段：安全 AI 畫布助理重構 (2026年6月11日)
* **目標**：加入 Gemini API 當作遊戲 AI 助手，並解決金鑰安全問題。
* **實作內容**：
  * *初期設計*：金鑰置於後端 `.env` 中。但若發布到公開網路，API 呼叫量會造成原作者高額帳單甚至密鑰洩漏。
  * *重構設計*：改為在 Lobby 大廳讓玩家自行選填 API Key。前端將此 Key 暫存，在提問 AI 時發送 `ask_ai` socket 事件，帶上 Key、畫布 Canvas 的 Base64 圖檔與使用者的問題。
  * 後端在獲取 Key 後，作為 Proxy 調用 Gemini 2.5 Flash API。
  * 導入 exponential backoff 重試機制，增加 AI 回應穩定性。
  * 寫入 prompt 規則，限制 AI 不能直接說出謎底，且當畫布是空白或極度不完整時進入「【看不懂】模式」，用台式毒舌搞笑詞彙吐槽。

### 📅 第四階段：Render 雲端部署與 Redis 防掛優化 (2026年6月11日-12日)
* **目標**：將專案發布至公網。
* **實作內容**：
  * 撰寫 `render.yaml` 宣告基礎設施即代碼 (Infrastructure as Code)。
  * 遭遇 Redis 連線掛起問題，實作了 `REDIS_URL` 空值降級邏輯。
  * 在前端加入 `.env.production`，將 `VITE_SOCKET_URL` 設定為後端 Web Service 的公網 URL。

### 📅 第五階段：自訂網域與行動裝置觸控優化 (2026年6月13日)
* **目標**：提升產品完成度與行動端體驗。
* **實作內容**：
  * 綁定 custom domain `ischaokai.online`，達成用專業網址瀏覽。
  * 解決手機繪圖時，拖曳會導致整個網頁被滾動的瀏覽器預設行為。
  * 重構 `Board.jsx` 引入 touch event 處理，調整了 CSS flex 佈局以適應小螢幕。

---

## 💡 老師 Demo / 學術口試演示亮點

若需要將此專案作為學校課程的成果發表，建議向評審教授強調以下**高含金量**的技術亮點：
1. **跨解析度適應算式**：說明如何透過 $(X/\text{width}, Y/\text{height})$ 的比例化公式解決跨螢幕大小的軌跡重合問題。
2. **AI 與安全隱私設計**：說明 client-provided API key 的設計理念。既保護了開發者的荷包，又讓玩家能安全地使用自己的 Google AI Studio Key。
3. **Redis 水平擴充性與 Nginx 靜態代理**：雖然在 Render 免費方案上限縮了 Redis，但在架構上預留了 Redis Adapter。Demo 時可以現場執行 `docker compose up --scale backend=3`，展現透過 Nginx 做 Load Balancing，並利用 Redis 做跨節點 WebSocket 廣播的架構設計。這能直接證明系統具有 Enterprise 級的擴展能力（Scalability）。
4. **完整工程化流程**：使用 Git Conventional Commit 提交規範，並區分開發/生產雙 Compose 容器配置，展現成熟的 CI/CD 與 DevOps 思維。
