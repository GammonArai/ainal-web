# 🚨 セキュリティ通知

## Telegram Bot Tokenの露出について

### 発生した問題
- login.html内にTelegram Bot Tokenがハードコードされていました
- GitHubのSecret Scanningにより検出されました
- 該当トークンは既に削除済みです

### 必要な対応

#### 1. 即座に実施すべきこと
1. **BotFatherでトークンを無効化**
   - Telegramで @BotFather を開く
   - `/mybots` コマンドを送信
   - 該当のBotを選択
   - 「API Token」→「Revoke current token」を選択
   - 新しいトークンを生成

2. **環境変数の設定**
   - Vercelダッシュボード → Settings → Environment Variables
   - `TELEGRAM_BOT_TOKEN` として新しいトークンを設定
   - 本番環境のみに適用

### 今後の対策

#### クライアントサイドでBotトークンを使用しない
```javascript
// ❌ 悪い例（クライアントサイド）
const token = 'actual-token-here';

// ✅ 良い例（サーバーサイドAPI経由）
fetch('/api/telegram-webhook', {
    method: 'POST',
    body: JSON.stringify({ action: 'send', data })
});
```

#### .gitignoreの確認
```
# 環境変数ファイル
.env
.env.local
.env.*.local

# 秘密情報を含むファイル
secrets/
*.key
*.pem
```

### セキュリティベストプラクティス

1. **秘密情報は絶対にコードに含めない**
2. **環境変数を使用する**
3. **クライアントサイドには公開可能な情報のみ**
4. **定期的なSecret Scanning確認**
5. **トークンのローテーション**

### 影響範囲
- 露出期間：約14時間
- 影響：Botへの不正アクセスの可能性
- 対策：トークン無効化により影響を最小化

## 重要
このような事態を防ぐため、開発時は必ず：
- 環境変数を使用
- コミット前に秘密情報の確認
- GitHub Secret Scanningを有効化