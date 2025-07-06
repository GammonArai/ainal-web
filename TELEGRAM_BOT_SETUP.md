# Telegram Bot セットアップガイド

## 🤖 Vercelでの運用について

### メリット
- 既存プロジェクトと統合
- 無料枠で運用可能
- GitHubと連携した自動デプロイ

### デメリット
- 10秒の実行時間制限
- コールドスタート（初回応答が遅い）
- 複雑な対話型処理には不向き

## 📋 セットアップ手順

### 1. Telegram Botの作成

1. Telegramで [@BotFather](https://t.me/botfather) を開く
2. `/newbot` コマンドを送信
3. Bot名を入力（例：愛なるマッサージ予約）
4. Usernameを入力（例：AinaruMassageBot）
5. **BOT TOKEN**をコピー

### 2. Vercel環境変数の設定

Vercelダッシュボードで以下を設定：

```bash
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_WEBHOOK_SECRET=random_secret_string
ADMIN_TOKEN=admin_secret_token
VERCEL_URL=https://ainal-web.vercel.app
```

### 3. Webhookの設定

デプロイ後、以下のURLにアクセス：

```bash
curl -X POST https://ainal-web.vercel.app/api/set-telegram-webhook \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 4. 動作確認

Telegramでボットを検索して `/start` を送信

## 🚀 推奨される本格運用環境

### 1. Railway（推奨）
```yaml
# railway.toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm start"
restartPolicyType = "always"
```

### 2. VPSでの運用
```bash
# PM2での永続化
pm2 start backend/server.js --name "ainaru-bot"
pm2 save
pm2 startup
```

### 3. Docker Compose
```yaml
version: '3.8'
services:
  bot:
    build: .
    environment:
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - DATABASE_URL=${DATABASE_URL}
    restart: always
```

## 📊 機能比較

| 機能 | Vercel | Railway | VPS |
|------|--------|---------|-----|
| 無料枠 | ✅ | ✅ (制限あり) | ❌ |
| 常時稼働 | ❌ | ✅ | ✅ |
| 実行時間制限 | 10秒 | なし | なし |
| WebSocket | ❌ | ✅ | ✅ |
| データベース永続化 | 外部DB必要 | 内蔵可能 | 自由 |
| 月額コスト | $0〜 | $0〜5 | $5〜 |

## 🔧 高度な機能実装

Vercelでは制限があるため、以下の機能は別サービス推奨：

1. **予約リマインダー** → Cloud Scheduler
2. **画像処理** → Cloudinary API
3. **決済処理** → Stripe/PayPay Webhook
4. **長時間処理** → Background Jobs (Railway/Render)

## 💡 ハイブリッド構成の提案

```
┌─────────────────┐     ┌─────────────────┐
│   Vercel        │     │   Railway       │
│  (Webサイト)    │────▶│  (Bot/API)      │
│                 │     │                 │
└─────────────────┘     └─────────────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
              ┌─────────────┐
              │  Database   │
              │ (Supabase)  │
              └─────────────┘
```

この構成により：
- Webサイト: Vercel（高速配信）
- Bot/API: Railway（常時稼働）
- DB: Supabase（無料枠あり）

## 📞 サポート

質問がある場合は、READMEのサポート情報を参照してください。