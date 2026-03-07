# PAWAWA 產品待辦（Backlog）

## 已列入

### 登入／註冊與帳號體系

- **說明**：目前缺乏登入註冊流程；需建立以帳號（手機號碼或 Email）+ 密碼為主的註冊／登入，並支援後續擴充第三方登入。
- **規格要點**：
  - 註冊：以**手機號碼**或 **Email** 為帳號名（唯一），可設置密碼。
  - 唯一性：每位使用者具 **UUID**，作為系統內唯一識別。
  - 登入：以帳號（手機或 Email）+ 密碼登入，取得 session/token。
  - 第三方登入：預留介面或整合點（如 Google、Apple），可後續實作。
- **實作狀態**：
  - 前後端基礎實作已完成：
    - **後端**：`app/api/auth/register.js`、`app/api/auth/login.js`、`app/api/auth/me.js`；`app/api/_lib/auth.js`（密碼 scrypt、JWT 簽發/驗證）、`app/api/_lib/userStore.js`（in-memory 使用者儲存，正式環境可改為 DB/KV）。
    - **前端**：`AuthProvider` / `useAuth`、登入／註冊畫面（Email 或手機 + 密碼）、token 與 user 存 AsyncStorage、啟動時以 `/api/auth/me` 還原登入狀態；個人頁顯示帳號與登出。
  - 第三方登入：尚未實作，僅預留擴充。
- **正式環境注意**：目前 `userStore` 為 in-memory，Vercel serverless 重啟後會清空。正式環境請改為持久化儲存（如 Vercel KV、Postgres、Supabase），並設定 `AUTH_JWT_SECRET` 環境變數。

---

## 待排優先順序

- 上述項目依產品優先級排入 Sprint 後，可再細拆為子任務（例如：註冊 API、登入 API、前端登入/註冊畫面、第三方 OAuth 串接）。
