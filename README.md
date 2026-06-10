# CoDraw - 多人即時協作畫布與你畫我猜遊戲房 🎨🧠

一個基於 **WebSockets**、**React**、**Node.js** 與 **Redis** 開發的即時協作白板及「你畫我猜」遊戲平台。本專案完全基於 **Docker** 進行容器化管理，並整合 **Git** 開發工作流，非常適合作為大專院校課程專案（如：系統整合、網路程式設計、容器化部署）的期末成果展現。

---

## 🚀 專案亮點

1. **即時雙向通訊**：使用 Socket.io 達成低延遲的畫筆軌跡同步與猜題聊天互動。
2. **跨解析度畫布縮放**：採用「相對比例座標系統（0.0 到 1.0）」，即便不同玩家的螢幕解析度不同，畫筆軌跡也能完美對齊，不發生位移。
3. **防作弊機制與規則引導**：
   - 遊戲進行時，只有畫家能繪製，其餘玩家僅能猜題。
   - 畫家在該回合中禁用聊天室，避免透露答案。
   - 玩家猜對後，輸入框鎖定以防止向其他玩家劇透答案。
4. **遊戲積分機制與慶祝特效**：每回合第一個猜對的玩家獲得高分（100分），後續猜對者獲得基礎分（70分），畫家則根據猜對人數獲得加分。玩家猜對時會動態觸發畫面的**彩帶慶祝特效 (Confetti)**。
5. **多容器微服務架構**：整合 Frontend, Backend, Redis 三個獨立容器，並透過 Redis Pub/Sub 實作多個 Socket 伺服器間的訊息同步（Scalability 擴充性）。
6. **雙 Compose 環境設計**：提供 `docker-compose.yml`（生產/演示環境，含 Nginx 靜態分流）與 `docker-compose.dev.yml`（開發環境，支援程式碼熱重載與 Volume 掛載）。

---

## 🛠️ 技術棧 (Tech Stack)

- **前端 (Frontend)**: React (Vite) + Lucide Icons + Canvas-Confetti (CSS 採用精美深色磨砂玻璃風 Glassmorphism)
- **後端 (Backend)**: Node.js + Express + Socket.io
- **快取/配接器 (Cache/Adapter)**: Redis
- **伺服器分流 (Web Server)**: Nginx (用於生產環境部署 React 靜態資源)
- **容器化 (Containerization)**: Docker & Docker Compose
- **版本控制 (Version Control)**: Git

---

## 📂 專案結構

```text
co-draw-game/
├── docker-compose.yml          # 生產/示範環境 Compose 設定檔 (Frontend 透過 Nginx 載入)
├── docker-compose.dev.yml      # 本機開發環境 Compose 設定檔 (前端/後端程式碼熱重載)
├── README.md                   # 專案說明文件
├── .gitignore                  # Git 排除清單
├── backend/
│   ├── Dockerfile              # 後端映像檔建置規則
│   ├── package.json            # 後端套件定義
│   ├── server.js               # Express + Socket.io 主程式
│   └── words.json              # 題庫資料庫 (可自行擴充單字)
└── frontend/
    ├── Dockerfile              # 前端多階段建置 (Multi-stage) 映像檔建置規則
    ├── nginx.conf              # Nginx 伺召器配置 (生產環境)
    ├── package.json            # 前端套件定義
    ├── vite.config.js          # Vite 設定檔 (包含 HMR 與 Port 連接埠設定)
    ├── index.html              # HTML 模板與 Google Fonts 引用
    └── src/
        ├── main.jsx            # 程式入口點
        ├── App.jsx             # 狀態控制與 WebSocket 事件監聽中心
        ├── api.js              # Socket.io 位址動態解析
        ├── index.css           # Glassmorphism 風格主視覺 CSS
        └── components/
            ├── Lobby.jsx       # 大廳介面 (填寫名稱、創建/加入房間)
            ├── Board.jsx       # 協作畫布 (包含畫筆、橡皮擦、線條粗細、清除及下載圖片)
            ├── GameStatus.jsx  # 遊戲狀態儀表板 (計時器、題庫分類、隱藏單字與積分榜)
            └── Chat.jsx        # 聊天與猜題視窗 (整合權限限制)
```

---

## 🏃 如何啟動與執行專案

請先確保您的電腦上已安裝並啟動 **Docker Desktop**。

### 1. 本機開發模式 (支援熱重載，適合開發與修改程式碼)
在開發模式下，容器會自動將您本機上的程式碼掛載進容器中，只要您修改本機的檔案，前端 (Vite) 和後端 (Nemon) 就會立刻更新，不需要重新建置映像檔。

請在 `co-draw-game` 目錄下執行以下指令：
```bash
# 啟動開發環境 (首次執行會自動安裝 npm 套件)
docker compose -f docker-compose.dev.yml up --build
```
- **前端網址**: [http://localhost:5173](http://localhost:5173)
- **後端 API / WebSocket 埠**: `http://localhost:4000`

### 2. 生產演示模式 (Nginx 靜態代理，適合呈交作業與部署)
此模式下會先對前端進行壓縮打包 (Build)，並將靜態檔案移入輕量化的 Nginx 伺服器中以 Port 80 運行，能發揮最優異的伺服器效能。

請在 `co-draw-game` 目錄下執行以下指令：
```bash
# 啟動生產環境
docker compose up --build
```
- **前端網址**: [http://localhost](http://localhost) (預設 Port 80，直接瀏覽即可)
- **後端 API / WebSocket 埠**: `http://localhost:4000`

---

## 📈 Git 與 Docker 呈交指南 (給老師的演示重點)

在跟老師 Demo 時，建議可以從以下兩個角度切入，展現你比其他同學更專業的架構思考：

### 1. 💡 展現 Git 版本控制的專業度 (Git Workflow)
在跟組員協作或開發時，請遵循標準的 Git 分支規範：
*   **提交訊息規範 (Conventional Commits)**:
    - 新增功能: `git commit -m "feat: add canvas-confetti victory effect"`
    - 修復 bug: `git commit -m "fix: prevent drawer from guessing own word"`
    - 更新文件: `git commit -m "docs: add setup instructions to README"`
*   **分支策略 (Git Branching)**:
    - 勿直接在 `main` 分支開發。
    - 建立 `develop` 分支進行整合測試。
    - 新功能請開 `feature/lobby-ui` 或 `feature/game-loop`，測試完成後再 Pull Request 合併回 `develop` 與 `main`。

### 2. 🐳 展現 Docker 網路架構 (Docker Networking & Pub/Sub)
*   **Docker 內部網路隔離**：透過 Docker Compose，前端、後端與 Redis 容器運行在同一個橋接網路中。後端容器可以直接利用 `redis://redis:6379` 連接 Redis，而不用將 Redis 的連接埠向公網暴露，提高了資料安全性。
*   **Redis 適配器擴充性 (Scalability)**：後端配置了 `@socket.io/redis-adapter`。如果未來遊戲上線有十萬人同時遊玩，我們可以隨時將 `backend` 服務擴充成 5 個容器（`docker compose up --scale backend=5`），所有玩家的畫筆軌跡與聊天訊息依然能透過 Redis 進行完美同步！這點在學術報告中非常加分。
