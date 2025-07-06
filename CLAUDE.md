# 愛なるマッサージ CMS プロジェクト

愛なるマッサージの出張マッサージ・アカスリ専門店向け統合CMS（コンテンツ管理システム）です。Telegram Bot統合による予約システム、スケジューリング機能、PayPay決済連携を含む包括的なプラットフォームです。

## 🎯 プロジェクト概要

**ビジネス**: 福岡市（中洲・博多・天神エリア）でのプレミアム出張マッサージサービス
**特徴**: 完全プライベート、1日1客限定、24時間対応、PayPay決済専用

## 🏗️ システム構成

### Frontend (静的サイト)
- **フレームワーク**: Vanilla HTML/CSS/JavaScript
- **スタイル**: Modern CSS with CSS Variables
- **UI**: レスポンシブデザイン、日本語最適化
- **ページ**: 20+ pages including admin dashboard

### Backend (Node.js API)
- **フレームワーク**: Express.js 4.18.2
- **認証**: JWT + bcryptjs
- **データベース**: MySQL 8.0+ (mysql2)
- **バリデーション**: Joi
- **ログ**: Winston
- **セキュリティ**: Helmet, CORS, Rate Limiting

### 外部統合
- **Telegram Bot**: telegraf 4.15.6 (予約システム)
- **決済**: PayPay API (予定)
- **通知**: Telegram webhooks

## 📁 プロジェクト構造

```
twitter/                          # プロジェクトルート
├── README.md                     # プロジェクト概要
├── SETUP.md                      # セットアップガイド  
├── CLAUDE.md                     # このファイル
├── package.json                  # 依存関係・スクリプト
├── .gitignore                    # Git除外設定
│
├── backend/                      # バックエンドAPI
│   ├── .env                      # 環境変数（本番では除外）
│   ├── .env.example              # 環境変数テンプレート
│   ├── server.js                 # メインサーバーファイル
│   ├── config/
│   │   └── database.js           # データベース設定
│   ├── middleware/
│   │   ├── auth.js               # JWT認証
│   │   ├── validator.js          # リクエストバリデーション
│   │   └── errorHandler.js       # エラーハンドリング
│   ├── routes/
│   │   ├── auth.routes.js        # 認証エンドポイント
│   │   ├── user.routes.js        # ユーザー管理
│   │   ├── service.routes.js     # サービス管理
│   │   ├── booking.routes.js     # 予約・スケジューリング
│   │   ├── therapist.routes.js   # セラピスト管理
│   │   ├── hotel.routes.js       # ホテル管理
│   │   └── admin.routes.js       # 管理機能
│   ├── services/
│   │   ├── telegramBot.js        # Telegram Bot サービス
│   │   └── schedulingService.js  # スケジューリング機能
│   ├── utils/
│   │   ├── logger.js             # ログ管理
│   │   └── auditLog.js           # 監査ログ
│   ├── scripts/
│   │   ├── init-database.js      # DB初期化
│   │   ├── setup-test-env.js     # テスト環境セットアップ
│   │   ├── setup-local-dev.js    # ローカル開発環境
│   │   ├── test-telegram-bot.js  # Bot単体テスト
│   │   ├── test-api.js           # API統合テスト
│   │   └── test-minimal.js       # 最小構成テスト
│   ├── logs/                     # ログファイル（自動生成）
│   └── uploads/                  # アップロードファイル
│
├── database/                     # データベース関連
│   ├── README.md                 # DB設定ガイド
│   ├── schema.sql                # データベーススキーマ
│   └── seed-data.sql             # サンプルデータ
│
├── frontend files/               # フロントエンドファイル
│   ├── index.html                # ランディングページ
│   ├── services.html             # サービス案内
│   ├── hotels.html               # 対応ホテル一覧
│   ├── therapists.html           # セラピスト紹介
│   ├── safety.html               # 感染対策
│   ├── login.html                # 会員ログイン
│   ├── admin.html                # 管理ダッシュボード
│   ├── admin-login.html          # 管理者ログイン
│   ├── admin-calendar.html       # 予約カレンダー
│   ├── modern-styles.css         # メインスタイル
│   ├── services-styles.css       # サービス用スタイル
│   ├── premium-styles.css        # プレミアムスタイル
│   └── site-config.js            # 統一サイト設定
│
└── documentation/                # ドキュメント（必要に応じて）
```

## 🔑 主要機能

### 1. Telegram Bot予約システム ✅ 完了
- **Bot名**: @AnalSenseiBot (設定による)
- **機能**: フル予約フロー（サービス→日時→ホテル→確認）
- **特徴**: インタラクティブUI、セッション管理、エラーハンドリング
- **統合**: データベース直接連携、リアルタイム空き時間確認

### 2. スケジューリングシステム ✅ 完了
- **空き時間管理**: 15分単位、重複チェック、営業時間考慮
- **カレンダー機能**: 月間ビュー、セラピスト別表示
- **予約管理**: 作成・更新・キャンセル・確認・完了
- **制約**: 24時間前キャンセル、営業時間外制限

### 3. 認証・権限システム ✅ 完了
- **JWT認証**: アクセス・リフレッシュトークン
- **役割**: admin, therapist, member
- **権限制御**: エンドポイント別アクセス制御
- **セキュリティ**: bcrypt, rate limiting, audit logging

### 4. 管理画面システム 🚧 部分完了
- **ダッシュボード**: 売上・予約統計
- **カレンダー**: 予約一覧・状況管理 ✅
- **CRUD操作**: ユーザー・サービス・ホテル管理
- **レポート**: エクスポート機能

### 5. PayPay決済統合 📅 予定
- **API連携**: PayPay for Business
- **機能**: 決済処理、webhook、返金処理
- **セキュリティ**: トークン管理、fraud detection

## 🔐 セキュリティ実装

### 認証・認可
- **JWT**: HS256, 7日間有効期限
- **パスワード**: bcrypt 10ラウンド
- **セッション**: Redis/メモリ管理
- **権限**: Role-based access control (RBAC)

### API保護
- **Rate Limiting**: 15分間で100リクエスト
- **CORS**: 特定オリジンのみ許可
- **Helmet**: セキュリティヘッダー設定
- **Validation**: Joi による入力検証

### データ保護
- **監査ログ**: 全操作の記録・追跡
- **暗号化**: 機密データの暗号化保存
- **HTTPS**: 本番環境では必須
- **DB**: 適切なインデックス・制約設定

## 📊 データベース設計

### 主要テーブル
- **users**: ユーザー情報（Telegram統合）
- **therapists**: セラピスト詳細・スケジュール
- **services**: サービス定義・料金
- **bookings**: 予約データ・状態管理
- **hotels**: 対応ホテル情報
- **reviews**: レビュー・評価システム
- **audit_logs**: 監査ログ・操作履歴

### 設計原則
- **正規化**: 適切な関係設計
- **インデックス**: パフォーマンス最適化
- **制約**: データ整合性保証
- **監査**: 変更履歴追跡

## 🧪 テスト戦略

### 自動テスト
```bash
npm run test:minimal      # コード構造テスト
npm run test:api         # API統合テスト  
npm run test:bot         # Telegram Bot テスト
```

### 手動テスト
- **Telegram Bot**: 予約フロー完全テスト
- **Admin UI**: 管理画面機能テスト
- **API**: Postman/curl でのエンドポイントテスト

## 📈 パフォーマンス最適化

### フロントエンド
- **CSS**: Variables, モダンレイアウト
- **JavaScript**: Vanilla JS, 最小限依存
- **画像**: WebP対応、lazy loading
- **キャッシュ**: 適切なキャッシュヘッダー

### バックエンド
- **データベース**: 適切なインデックス、クエリ最適化
- **API**: レスポンス時間監視
- **ログ**: 構造化ログ、レベル分け
- **監視**: ヘルスチェック、メトリクス

## 🚀 デプロイメント

### ローカル開発
```bash
npm run setup:local      # 初期セットアップ
npm run init:db          # データベース初期化
npm run dev:backend      # バックエンド起動
npm run dev              # フロントエンド起動
```

### 本番デプロイ
1. **VPS/クラウド**: AWS, GCP, さくらVPS
2. **リバースプロキシ**: Nginx + SSL
3. **プロセス管理**: PM2
4. **データベース**: MySQL/PostgreSQL
5. **監視**: ログ監視、アラート設定

## 📝 開発ガイドライン

### コーディング規約
- **JavaScript**: ES6+, async/await優先
- **SQL**: 適切なクエリ、プリペアドステートメント
- **CSS**: BEM記法、CSS Variables
- **命名**: camelCase (JS), kebab-case (CSS)

### Git ワークフロー
- **ブランチ**: feature/, fix/, release/
- **コミット**: 日本語OK、簡潔に
- **PR**: レビュー必須、テスト通過

### エラーハンドリング
- **統一フォーマット**: JSONエラーレスポンス
- **ログ**: 構造化ログ、適切なレベル
- **ユーザー**: 分かりやすいエラーメッセージ

## 🔄 継続的改善

### 次期実装予定
1. **PayPay決済統合** - 決済フロー完成
2. **詳細カレンダー** - 週・日ビュー実装
3. **レビューシステム** - 評価・コメント機能
4. **通知システム** - メール・SMS通知
5. **多言語対応** - 英語・中国語・韓国語

### 技術的改善
- **TypeScript導入** - 型安全性向上
- **GraphQL採用** - API効率化
- **Redis導入** - キャッシュ・セッション管理
- **Docker化** - デプロイメント簡素化

## 📞 サポート・問い合わせ

### 開発関連
- **ドキュメント**: README.md, SETUP.md
- **テストガイド**: 各scriptディレクトリ
- **API仕様**: Postman collection (今後作成予定)

### 運用関連
- **ログ**: backend/logs/ ディレクトリ
- **監査**: audit_logs テーブル
- **バックアップ**: データベースダンプ推奨

---

## 🏆 実装状況サマリー

### ✅ 完了済み
- [x] ブランド統一（愛なるマッサージ専用化）
- [x] データベース設計・実装
- [x] REST API + JWT認証システム
- [x] Telegram Bot 予約システム
- [x] スケジューリング機能
- [x] 管理画面カレンダー

### 🚧 進行中
- [ ] PayPay決済統合
- [ ] 管理画面CRUD完成
- [ ] セキュリティ強化

### 📅 予定
- [ ] 画像アップロード機能
- [ ] 多言語対応
- [ ] 本番デプロイ