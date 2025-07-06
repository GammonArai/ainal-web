# セキュリティガイド - 愛なるマッサージ CMS

## 🔐 セキュリティ概要

本プロジェクトでは、顧客の個人情報と予約データを保護するため、多層的なセキュリティ対策を実装しています。

## 🛡️ 実装済みセキュリティ機能

### 1. 認証・認可
- **JWT認証**: アクセストークン + リフレッシュトークン
- **パスワードハッシュ化**: bcrypt（10ラウンド）
- **Role-based Access Control**: admin, therapist, member
- **セッション管理**: 安全なトークン管理

### 2. データ保護
- **データ暗号化**: AES-256-GCM
- **機密情報暗号化**: 電話番号、Telegram ID、個人情報
- **ハッシュ化**: パスワード、セキュリティ問答
- **データマスキング**: ログ出力時の機密情報隠蔽

### 3. API保護
- **レート制限**: 
  - 一般API: 15分間100リクエスト
  - 認証API: 15分間5回試行
  - 管理者API: 5分間50リクエスト
- **入力検証**: Joi による厳密なバリデーション
- **セキュリティヘッダー**: Helmet.js + 追加設定

### 4. 監査・ログ
- **監査ログ**: 全操作の記録・追跡
- **セキュリティイベント**: 不審なアクティビティ検出
- **アクセスログ**: 詳細なリクエスト記録
- **エラー追跡**: 構造化エラーログ

## 🔧 セキュリティ設定

### 環境変数の設定

```bash
# 必須セキュリティ設定
JWT_SECRET=your_very_secure_jwt_secret_key_at_least_32_characters
ENCRYPTION_KEY=your_32_character_encryption_key_here_very_secure
SESSION_SECRET=your_session_secret_key_for_express_sessions

# データベース
DB_PASSWORD=your_secure_database_password

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_from_botfather
```

### 本番環境での追加設定

```bash
# HTTPS必須
HTTPS_ENABLED=true
SSL_KEY_PATH=./ssl/private-key.pem
SSL_CERT_PATH=./ssl/certificate.pem

# セキュリティ強化
NODE_ENV=production
TRUST_PROXY=true
HSTS_MAX_AGE=31536000
```

## 🚨 セキュリティベストプラクティス

### 1. パスワード・キー管理
- **強力なパスワード**: 最低12文字、大小英字・数字・記号混合
- **キーローテーション**: 定期的な更新（3-6ヶ月）
- **キー分離**: 環境別のキー使用
- **秘密情報の管理**: 環境変数、設定ファイルでの管理

### 2. データベースセキュリティ
- **最小権限の原則**: 必要最小限のDBアクセス権限
- **接続暗号化**: SSL/TLS接続
- **バックアップ暗号化**: データバックアップの暗号化
- **定期監査**: データアクセスパターンの監視

### 3. API セキュリティ
- **HTTPS必須**: 本番環境では必ずHTTPS
- **CORS設定**: 信頼できるオリジンのみ許可
- **入力サニタイゼーション**: SQLインジェクション対策
- **出力エスケープ**: XSS対策

### 4. 監視・対応
- **ログ監視**: 不審なアクティビティの早期発見
- **アラート設定**: 重要セキュリティイベントの通知
- **インシデント対応**: セキュリティ事案への迅速な対応
- **定期監査**: セキュリティ設定の定期見直し

## 🔍 セキュリティ監査項目

### 日次チェック
- [ ] 不審なログインアクティビティ
- [ ] 異常なAPIアクセスパターン
- [ ] エラー率の監視
- [ ] システムリソース使用状況

### 週次チェック
- [ ] セキュリティログの詳細分析
- [ ] ユーザーアクセスパターンの確認
- [ ] 失敗した認証試行の分析
- [ ] データベースパフォーマンス

### 月次チェック
- [ ] 脆弱性スキャン実行
- [ ] 依存関係の更新確認
- [ ] セキュリティ設定の見直し
- [ ] バックアップの整合性確認

## 🚨 インシデント対応手順

### 1. 検出・初期対応
1. セキュリティアラートの確認
2. 影響範囲の特定
3. 関係者への連絡
4. 緊急措置の実行

### 2. 調査・分析
1. ログ分析
2. 攻撃ベクターの特定
3. 被害範囲の評価
4. 証拠保全

### 3. 対策・復旧
1. 脆弱性の修正
2. セキュリティ強化
3. サービス復旧
4. 再発防止策の実装

### 4. 事後対応
1. インシデントレポート作成
2. 関係者への報告
3. セキュリティ対策の見直し
4. 教訓の共有

## 📋 コンプライアンス

### 個人情報保護
- **個人情報保護法**: 適切な個人情報取り扱い
- **データ最小化**: 必要最小限のデータ収集
- **同意管理**: 明示的な利用同意
- **削除権**: データ削除要求への対応

### 業界標準
- **OWASP Top 10**: Webアプリケーション脆弱性対策
- **ISO 27001**: 情報セキュリティ管理
- **PCI DSS**: 決済データ保護（PayPay連携時）

## 🔗 参考資料

### セキュリティガイドライン
- [OWASP Web Application Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

### ツール・ライブラリ
- [Helmet.js](https://helmetjs.github.io/) - セキュリティヘッダー
- [bcrypt](https://www.npmjs.com/package/bcrypt) - パスワードハッシュ化
- [jsonwebtoken](https://www.npmjs.com/package/jsonwebtoken) - JWT実装
- [express-rate-limit](https://www.npmjs.com/package/express-rate-limit) - レート制限

---

## 📞 セキュリティ連絡先

セキュリティに関する問題や報告は、以下の手順で連絡してください：

1. **緊急時**: システム管理者に即座に連絡
2. **脆弱性報告**: 責任ある開示プロセスに従う
3. **質問・相談**: 開発チームまで

**重要**: セキュリティ情報は機密として取り扱い、公開チャンネルでの議論は避けてください。