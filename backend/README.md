# 愛なるマッサージ バックエンドAPI

愛なるマッサージCMSのRESTful APIサーバーです。

## 技術スタック

- **Node.js** 16以上
- **Express.js** - Webフレームワーク
- **MySQL** 8.0以上 - データベース
- **JWT** - 認証
- **bcryptjs** - パスワードハッシュ化
- **joi** - バリデーション
- **Winston** - ログ管理

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

```bash
cp backend/.env.example backend/.env
```

`.env`ファイルを編集して適切な値を設定してください。

### 3. データベースの初期化

```bash
npm run init:db
```

### 4. サーバー起動

```bash
# 本番モード
npm run start:backend

# 開発モード（ホットリロード）
npm run dev:backend
```

## API エンドポイント

### 認証 (`/api/v1/auth`)

- `POST /register` - ユーザー登録
- `POST /login` - ログイン
- `POST /logout` - ログアウト
- `POST /refresh` - トークンリフレッシュ
- `POST /change-password` - パスワード変更
- `GET /me` - 現在のユーザー情報取得

### ユーザー (`/api/v1/users`)

- `GET /` - ユーザー一覧取得（管理者のみ）
- `GET /:id` - ユーザー詳細取得
- `PUT /:id` - プロフィール更新
- `PATCH /:id/toggle-active` - アクティブ状態切り替え（管理者のみ）

### サービス (`/api/v1/services`)

- `GET /` - サービス一覧取得
- `GET /:id` - サービス詳細取得
- `POST /` - サービス作成（管理者のみ）
- `PUT /:id` - サービス更新（管理者のみ）
- `DELETE /:id` - サービス削除（管理者のみ）

### 予約 (`/api/v1/bookings`)

- 実装予定

### セラピスト (`/api/v1/therapists`)

- 実装予定

### ホテル (`/api/v1/hotels`)

- 実装予定

### 管理者 (`/api/v1/admin`)

- 実装予定

## 認証

APIは JWT（JSON Web Token）を使用した認証システムを採用しています。

### ログイン

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### 認証が必要なエンドポイントの呼び出し

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/v1/users/me
```

## セキュリティ機能

- **JWT認証** - ステートレスな認証システム
- **bcrypt** - パスワードハッシュ化
- **ヘルメット** - セキュリティヘッダー設定
- **CORS** - クロスオリジンリクエスト制御
- **レート制限** - DoS攻撃対策
- **監査ログ** - 全ての操作を記録

## ログ機能

- **Winston** を使用したログ管理
- 本番環境では自動的にファイルにログを出力
- エラーログと通常ログを分離
- 監査ログによる操作履歴追跡

## 開発

### ディレクトリ構造

```
backend/
├── config/          # 設定ファイル
├── middleware/      # ミドルウェア
├── routes/         # ルート定義
├── utils/          # ユーティリティ
├── scripts/        # スクリプト
├── logs/           # ログファイル（本番）
└── uploads/        # アップロードファイル
```

### 新しいエンドポイントの追加

1. `routes/` ディレクトリに新しいルートファイルを作成
2. `server.js` でルートを登録
3. 適切なバリデーションスキーマを定義
4. 監査ログを記録

### エラーハンドリング

すべてのエンドポイントは統一されたエラーレスポンス形式を使用します：

```json
{
  "error": "Error Type",
  "message": "エラーメッセージ",
  "details": []
}
```

## トラブルシューティング

### データベース接続エラー

- MySQL サーバーが起動しているか確認
- `.env` ファイルの接続情報を確認
- データベースユーザーの権限を確認

### 認証エラー

- JWT_SECRET が設定されているか確認
- トークンの有効期限を確認
- ブラウザの認証ヘッダーを確認