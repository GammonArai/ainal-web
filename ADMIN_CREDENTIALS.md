# 愛なるマッサージCMS 管理者アカウント情報

## 🔐 管理者ログイン情報

### デフォルト管理者アカウント

```
ログインURL: https://your-domain.com/admin-login.html
```

#### メインアドミニストレーター
```
メールアドレス: admin@ainaru-massage.com
パスワード: Admin123!@#
役割: super_admin
```

#### サブアドミニストレーター
```
メールアドレス: manager@ainaru-massage.com  
パスワード: Manager123!@#
役割: admin
```

---

## 🛠️ 初期設定手順

### 1. 初回ログイン後の必須作業

**⚠️ セキュリティのため、初回ログイン時に必ず以下を実行してください：**

1. **パスワード変更**
   - 管理画面 → プロフィール設定 → パスワード変更
   - 強力なパスワードに変更（英数字記号混合、12文字以上推奨）

2. **メールアドレス変更**
   - 実際に使用するメールアドレスに変更
   - 通知設定の確認

3. **二要素認証有効化**（推奨）
   - Google Authenticator等のアプリ使用
   - バックアップコードの安全な保管

### 2. 管理者アカウント追加方法

```sql
-- データベースに直接追加する場合
-- パスワードは事前にbcryptでハッシュ化が必要

INSERT INTO users (
    name, 
    email, 
    password_hash, 
    role, 
    is_verified, 
    created_at
) VALUES (
    '新しい管理者名',
    'new-admin@ainaru-massage.com',
    '$2b$12$hashed_password_here',
    'admin',
    1,
    NOW()
);
```

### 3. パスワードリセット方法

**方法1: 管理画面から**
- ユーザー管理 → 対象ユーザー → パスワードリセット

**方法2: データベース直接操作**
```sql
-- 一時パスワード設定（例：TempPass123!）
UPDATE users 
SET password_hash = '$2b$12$example_hash_for_TempPass123!' 
WHERE email = 'admin@ainaru-massage.com';
```

**方法3: スクリプト実行**
```bash
cd /var/www/ainaru-massage
node backend/scripts/reset-admin-password.js
```

---

## 🎯 管理機能アクセス権限

### Super Admin権限
- ✅ すべての管理機能
- ✅ ユーザー管理（作成・編集・削除）
- ✅ システム設定
- ✅ バックアップ・復元
- ✅ データベース操作
- ✅ ログ閲覧

### Admin権限  
- ✅ 予約管理
- ✅ サービス管理
- ✅ レビュー管理
- ✅ 画像管理
- ✅ 分析・レポート
- ❌ ユーザー管理
- ❌ システム設定

### Manager権限
- ✅ 予約閲覧・編集
- ✅ レビュー閲覧
- ✅ 基本的な分析
- ❌ 削除操作
- ❌ 設定変更

---

## 🚨 セキュリティ設定

### IP制限設定（推奨）

**Nginx設定例:**
```nginx
# 管理画面へのアクセスをオフィスIPのみに制限
location /admin {
    allow 203.0.113.10;    # オフィス固定IP
    allow 192.168.1.0/24;  # 社内ネットワーク
    deny all;
    try_files $uri $uri/ @backend;
}
```

### セッション設定

**環境変数 (.env):**
```bash
# セッション設定
SESSION_SECRET=your_very_secure_session_secret_here
SESSION_TIMEOUT=3600  # 1時間でタイムアウト
JWT_SECRET=your_jwt_secret_key_minimum_32_characters
JWT_EXPIRES_IN=24h
```

### ログイン試行制限

**現在の設定:**
- 5回失敗で30分間ロック
- IPアドレス単位でカウント
- 管理者にメール通知

---

## 🔄 定期メンテナンス

### 週次作業
- [ ] 管理ログの確認
- [ ] ログイン失敗ログの確認
- [ ] システムリソース使用状況確認

### 月次作業
- [ ] パスワード強度の見直し
- [ ] 不要な管理者アカウントの削除
- [ ] バックアップデータの整合性確認
- [ ] セキュリティログの詳細分析

### 四半期作業
- [ ] 管理者権限の見直し
- [ ] パスワードポリシーの更新
- [ ] セキュリティ設定の見直し

---

## 📊 ログ・監査

### アクセスログ確認

```bash
# 管理画面ログイン履歴
grep "admin-login" /var/log/nginx/access.log

# 失敗したログイン試行
grep "401\|403" /var/log/nginx/access.log | grep admin

# アプリケーションログ
tail -f /var/www/ainaru-massage/logs/admin.log
```

### データベース監査ログ

```sql
-- ログイン履歴確認
SELECT user_id, email, login_time, ip_address, user_agent 
FROM admin_login_logs 
ORDER BY login_time DESC 
LIMIT 50;

-- 操作履歴確認
SELECT admin_id, action, target_type, target_id, created_at 
FROM admin_audit_logs 
ORDER BY created_at DESC 
LIMIT 50;
```

---

## 🆘 緊急時対応

### 管理画面にアクセスできない場合

**1. 緊急アクセス用URL**
```
https://your-domain.com/admin-emergency.html
```

**2. 直接データベース操作**
```bash
# MySQLに接続
mysql -u cms_user -p ainaru_massage_cms

# 管理者アカウント確認
SELECT id, email, role, is_active FROM users WHERE role IN ('admin', 'super_admin');

# アカウント有効化
UPDATE users SET is_active = 1 WHERE email = 'admin@ainaru-massage.com';
```

**3. システム復旧用スクリプト**
```bash
# 緊急時復旧スクリプト実行
cd /var/www/ainaru-massage
node backend/scripts/emergency-recovery.js
```

### 不正アクセス発覚時の対応

**即座に実行:**
1. 全管理者アカウントのパスワード変更
2. セッションの全クリア
3. IP制限の強化
4. アクセスログの詳細分析

**証拠保全:**
```bash
# ログバックアップ
cp /var/log/nginx/access.log /backup/incident-$(date +%Y%m%d).log
cp /var/www/ainaru-massage/logs/*.log /backup/app-logs-$(date +%Y%m%d)/
```

---

## 📞 サポート連絡先

### 技術サポート
- **システム開発者**: [連絡先情報]
- **インフラ担当者**: [連絡先情報]  
- **セキュリティ担当者**: [連絡先情報]

### 外部サポート
- **ホスティング会社**: [契約先サポート]
- **ドメイン管理会社**: [契約先サポート]

---

## ⚠️ 重要な注意事項

1. **このファイルの機密性**
   - このファイルは機密情報です
   - バージョン管理システム（Git）にコミットしないでください
   - 安全な場所に保管し、必要な人員のみアクセス可能にしてください

2. **定期的なパスワード変更**
   - 最低3ヶ月に1回はパスワードを変更してください
   - 過去のパスワードを再利用しないでください

3. **アクセス記録**
   - 管理画面へのアクセスはすべて記録されています
   - 不審なアクセスを発見した場合は即座に報告してください

4. **バックアップとの関連**
   - バックアップファイルには暗号化が推奨されます
   - バックアップファイルの管理者認証情報にも注意してください

---

## 📝 変更履歴

| 日付 | 変更者 | 変更内容 |
|------|--------|----------|
| 2024-01-XX | システム管理者 | 初版作成 |
| 2024-XX-XX | システム管理者 | セキュリティ設定追加 |

---

**最終更新**: 2024年1月
**次回見直し予定**: 2024年4月

このドキュメントは定期的に見直し、最新のセキュリティ要件に合わせて更新してください。