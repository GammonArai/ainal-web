# 愛なるマッサージ CMS セットアップガイド

このガイドに従って、ローカル開発環境でTelegram Bot統合を含む完全なCMSをセットアップできます。

## 前提条件

- **Node.js** 16以上
- **MySQL** 8.0以上 または MariaDB 10.5以上
- **Telegram Bot Token** (テスト用)

## 1. 基本セットアップ

### 依存関係のインストール

```bash
npm install
```

### 環境変数の設定

```bash
cp backend/.env.example backend/.env
```

`.env`ファイルを編集して以下の値を設定:

```env
# データベース設定
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=ainaru_massage_db

# セキュリティ設定
JWT_SECRET=your_very_secure_secret_key_here
SESSION_SECRET=your_session_secret_here

# Telegram Bot設定
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

## 2. Telegram Bot の作成

### BotFather でボットを作成

1. Telegramで [@BotFather](https://t.me/BotFather) を検索
2. `/newbot` コマンドを送信
3. ボット名を入力（例: `Ainaru Massage Test Bot`）
4. ユーザー名を入力（例: `AinaruMassageTestBot`）
5. 取得したトークンを `.env` の `TELEGRAM_BOT_TOKEN` に設定

### ボット設定

```bash
# BotFatherで以下のコマンドを実行
/setdescription - ボットの説明を設定
/setabouttext - About テキストを設定
/setuserpic - ボットのアイコンを設定
```

## 3. データベースセットアップ

### MySQL サーバーの起動

```bash
# macOS (Homebrew)
brew services start mysql

# Ubuntu/Debian
sudo systemctl start mysql

# Windows
# MySQL Workbench または Command Line Client を使用
```

### データベース初期化

```bash
# 自動セットアップスクリプト実行
npm run setup:test
```

このスクリプトが以下を自動実行します:
- 環境変数チェック
- データベース接続テスト
- スキーマ作成
- サンプルデータ挿入
- テストデータ作成
- Telegram Bot トークンテスト

## 4. アプリケーション起動

### 開発モード（推奨）

```bash
# バックエンドサーバー起動（ホットリロード有効）
npm run dev:backend
```

### 本番モード

```bash
# バックエンドサーバー起動
npm run start:backend
```

### フロントエンド（静的ファイル）

```bash
# 別ターミナルで実行
npm run dev
```

## 5. テスト実行

### API テスト

```bash
npm run test:api
```

### Telegram Bot テスト

```bash
npm run test:bot
```

### 手動テスト

1. ブラウザで http://localhost:8080 を開く
2. Telegramで作成したボット（@YourBotName）を検索
3. `/start` コマンドを送信
4. 予約フローをテスト

## 6. テストアカウント

セットアップ完了後、以下のアカウントでテストできます:

### 管理者アカウント
- **Email**: `admin@ainaru-massage.com`
- **Password**: `admin123`
- **権限**: 全機能アクセス可能

### セラピストアカウント
- **Email**: `therapist1@ainaru-massage.com`
- **Password**: `therapist123`
- **権限**: セラピスト機能

### 一般会員
- **Telegram Bot** から新規登録
- **Role**: member

## 7. 機能テスト

### Telegram Bot 機能テスト

1. **基本コマンド**
   - `/start` - ボット開始
   - `/help` - ヘルプ表示
   - `/book` - 予約開始
   - `/status` - 予約確認

2. **予約フロー**
   - サービス選択
   - 日付選択  
   - 時間選択
   - ホテル選択
   - 予約確認・確定

3. **予約管理**
   - 予約一覧表示
   - 予約キャンセル
   - 予約状況確認

### API テスト

```bash
# ヘルスチェック
curl http://localhost:3000/health

# ログイン
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@ainaru-massage.com", "password": "admin123"}'

# サービス一覧取得
curl http://localhost:3000/api/v1/services
```

## 8. トラブルシューティング

### よくある問題

#### データベース接続エラー
```
Error: ER_ACCESS_DENIED_ERROR
```
**解決方法:**
1. MySQL サーバーが起動しているか確認
2. `.env` ファイルの DB_USER, DB_PASSWORD を確認
3. MySQLユーザーの権限を確認

```sql
GRANT ALL PRIVILEGES ON ainaru_massage_db.* TO 'your_user'@'localhost';
FLUSH PRIVILEGES;
```

#### Telegram Bot トークンエラー
```
Error: 401 Unauthorized
```
**解決方法:**
1. BotFather でトークンを再確認
2. `.env` ファイルのトークンを確認
3. ボットが有効化されているか確認

#### ポート競合エラー
```
Error: EADDRINUSE
```
**解決方法:**
1. `.env` ファイルで別のポートを指定
2. 既存プロセスを終了: `lsof -ti:3000 | xargs kill`

### ログ確認

```bash
# アプリケーションログ
tail -f backend/logs/combined.log

# エラーログ
tail -f backend/logs/error.log
```

## 9. 開発Tips

### デバッグモード

```bash
# 詳細ログ出力
LOG_LEVEL=debug npm run dev:backend
```

### データベースリセット

```bash
# データベースを完全リセット
npm run setup:test
```

### Telegram Bot の再起動

```bash
# Bot のみ再起動
npm run test:bot
```

## 10. 次のステップ

開発環境が正常に動作することを確認できたら:

1. **PayPay 決済統合** - 決済機能の実装
2. **カレンダーシステム** - 予約スケジュール管理
3. **管理画面機能** - CRUD操作の完成
4. **本番デプロイ** - VPS/クラウドへのデプロイ

## サポート

問題が発生した場合:
1. このガイドのトラブルシューティングを確認
2. ログファイルでエラー詳細を確認
3. GitHub Issues で報告