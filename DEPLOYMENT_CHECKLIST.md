# 愛なるマッサージCMS デプロイメントチェックリスト

## 📋 本番環境デプロイ前チェックリスト

### 🔧 サーバー準備
- [ ] サーバーの要件確認（CPU: 2vCPU以上, RAM: 2GB以上, SSD: 20GB以上）
- [ ] Ubuntu 20.04 LTS / CentOS 8以降のインストール
- [ ] ドメイン名の取得・DNS設定完了
- [ ] SSH鍵認証の設定完了
- [ ] ファイアウォール（UFW）設定完了

### 🛠️ 必須ソフトウェアインストール
- [ ] Node.js 18.x LTS インストール
- [ ] MySQL 8.0 / MariaDB 10.5以降インストール
- [ ] Nginx インストール・設定
- [ ] PM2 プロセス管理ツールインストール
- [ ] Git インストール
- [ ] Certbot (Let's Encrypt) インストール

### 📁 ファイル配置
- [ ] プロジェクトファイルを /var/www/ainaru-massage に配置
- [ ] npm install --production 実行
- [ ] uploads/ ディレクトリの権限設定（755）
- [ ] logs/ ディレクトリ作成・権限設定
- [ ] backups/ ディレクトリ作成・権限設定

### 🗃️ データベース設定
- [ ] MySQL セキュア設定実行 (mysql_secure_installation)
- [ ] データベース「ainaru_massage_cms」作成
- [ ] 専用ユーザー「cms_user」作成・権限付与
- [ ] 初期テーブル作成（npm run init:db または schema.sql実行）
- [ ] 管理者アカウント作成

### ⚙️ 環境設定
- [ ] .env ファイル作成・設定
  - [ ] データベース接続情報
  - [ ] JWT_SECRET設定（32文字以上）
  - [ ] SESSION_SECRET設定
  - [ ] NODE_ENV=production設定
  - [ ] バックアップ設定
- [ ] ecosystem.config.js 設定ファイル作成

### 🌐 Webサーバー設定
- [ ] Nginx設定ファイル作成（/etc/nginx/sites-available/ainaru-massage）
- [ ] サイト有効化（sites-enabled へのシンボリックリンク作成）
- [ ] Nginx設定テスト（nginx -t）
- [ ] Nginx設定リロード
- [ ] SSL証明書取得・設定（certbot --nginx）

### 🚀 アプリケーション起動
- [ ] PM2でアプリケーション起動（pm2 start ecosystem.config.js）
- [ ] PM2設定保存（pm2 save）
- [ ] PM2自動起動設定（pm2 startup）
- [ ] アプリケーション動作確認

### 🔒 セキュリティ設定
- [ ] ファイアウォール設定確認
- [ ] 管理画面IP制限設定（推奨）
- [ ] SSL/HTTPS強制リダイレクト設定
- [ ] セキュリティヘッダー設定
- [ ] 管理者アカウント初期パスワード変更

### 📊 監視・ログ設定
- [ ] アプリケーションログ設定確認
- [ ] Nginxアクセスログ・エラーログ設定確認
- [ ] ログローテーション設定
- [ ] システムリソース監視設定
- [ ] 定期バックアップスケジュール設定

### ✅ 動作確認
- [ ] フロントエンド表示確認
- [ ] 管理画面ログイン確認
- [ ] データベース接続確認
- [ ] ファイルアップロード機能確認
- [ ] メール送信機能確認（設定済みの場合）
- [ ] バックアップ機能動作確認
- [ ] SSL証明書動作確認
- [ ] レスポンシブデザイン確認（スマートフォン・タブレット）

---

## 🚀 デプロイ実行コマンド

### 1. 基本環境セットアップ
```bash
# システム更新
sudo apt update && sudo apt upgrade -y

# 必須パッケージインストール
sudo apt install nginx mysql-server git curl ufw -y

# Node.js インストール
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs -y

# PM2インストール
sudo npm install -g pm2

# Certbotインストール
sudo apt install certbot python3-certbot-nginx -y
```

### 2. セキュリティ設定
```bash
# ファイアウォール設定
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

# MySQL セキュア設定
sudo mysql_secure_installation
```

### 3. データベース設定
```bash
# MySQL接続
sudo mysql -u root -p

# データベース・ユーザー作成
CREATE DATABASE ainaru_massage_cms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'cms_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON ainaru_massage_cms.* TO 'cms_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 4. アプリケーション配置
```bash
# ディレクトリ作成
sudo mkdir -p /var/www/ainaru-massage
sudo chown $USER:$USER /var/www/ainaru-massage

# ファイル配置（例：ローカルからアップロード）
cd /var/www/ainaru-massage
# ファイルをアップロード

# 依存関係インストール
npm install --production

# 必要ディレクトリ作成
mkdir -p logs uploads backups

# 権限設定
chmod 755 uploads
chmod 755 backups
```

### 5. 環境変数設定
```bash
# .envファイル作成
cat > /var/www/ainaru-massage/.env << 'EOF'
# データベース設定
DB_HOST=localhost
DB_USER=cms_user
DB_PASSWORD=your_secure_password
DB_NAME=ainaru_massage_cms

# アプリケーション設定
PORT=3000
NODE_ENV=production

# セキュリティ
JWT_SECRET=your_jwt_secret_key_here_minimum_32_characters
SESSION_SECRET=your_session_secret_here

# バックアップ設定
BACKUP_STORAGE_PATH=/var/www/ainaru-massage/backups
BACKUP_RETENTION_DAYS=30
BACKUP_SCHEDULE=0 2 * * *
EOF
```

### 6. PM2設定
```bash
# ecosystem.config.js作成
cat > /var/www/ainaru-massage/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'ainaru-massage-cms',
    script: 'backend/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF
```

### 7. データベース初期化
```bash
cd /var/www/ainaru-massage

# テーブル作成
npm run init:db
# または
mysql -u cms_user -p ainaru_massage_cms < database/schema.sql
```

### 8. Nginx設定
```bash
# 設定ファイル作成
sudo tee /etc/nginx/sites-available/ainaru-massage << 'EOF'
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    root /var/www/ainaru-massage;
    index index.html;

    # セキュリティヘッダー
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # 静的ファイル
    location / {
        try_files $uri $uri/ @backend;
        expires 1h;
    }

    # バックエンド
    location @backend {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # アップロードファイル
    location /uploads/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 管理画面（IP制限推奨）
    location /admin {
        # allow your_office_ip;
        # deny all;
        try_files $uri $uri/ @backend;
    }

    client_max_body_size 10M;

    # gzip圧縮
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/javascript application/json;
}
EOF

# 設定有効化
sudo ln -s /etc/nginx/sites-available/ainaru-massage /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 9. アプリケーション起動
```bash
cd /var/www/ainaru-massage

# PM2でアプリ起動
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 10. SSL証明書設定
```bash
# SSL証明書取得
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 自動更新設定
sudo crontab -e
# 以下を追加
0 12 * * * /usr/bin/certbot renew --quiet
```

---

## 🔍 本番環境動作確認

### Webサイト基本確認
```bash
# HTTP応答確認
curl -I http://your-domain.com

# HTTPS応答確認
curl -I https://your-domain.com

# SSL証明書確認
openssl s_client -connect your-domain.com:443 -servername your-domain.com
```

### アプリケーション確認
```bash
# プロセス状態確認
pm2 status

# ログ確認
pm2 logs
tail -f /var/www/ainaru-massage/logs/combined.log

# データベース接続確認
mysql -u cms_user -p ainaru_massage_cms -e "SHOW TABLES;"
```

### システムリソース確認
```bash
# メモリ使用量
free -h

# ディスク使用量
df -h

# CPU使用率
htop
```

---

## 📝 デプロイ完了後の設定

### 1. 管理者アカウント設定
- [ ] 管理画面（https://your-domain.com/admin-login.html）にアクセス
- [ ] 初期パスワード変更
- [ ] プロフィール情報更新
- [ ] 通知設定確認

### 2. 基本設定
- [ ] サイト基本情報設定
- [ ] サービス情報登録
- [ ] 営業時間・料金設定
- [ ] Telegram Bot設定（使用する場合）

### 3. コンテンツ設定
- [ ] 画像ファイルアップロード
- [ ] サービス詳細ページ作成
- [ ] 利用規約・プライバシーポリシー更新

### 4. 定期メンテナンス設定
```bash
# crontab設定
crontab -e

# 以下を追加
# データベースバックアップ（毎日午前2時）
0 2 * * * cd /var/www/ainaru-massage && npm run backup:database

# ログクリーンアップ（毎週日曜日）
0 0 * * 0 pm2 flush

# システム更新確認（毎月1日）
0 3 1 * * apt update && apt list --upgradable | mail -s "Available Updates" admin@your-domain.com
```

---

## 🆘 トラブルシューティング

### よくある問題

**1. アプリケーションが起動しない**
```bash
# ログ確認
pm2 logs ainaru-massage-cms
cat /var/www/ainaru-massage/logs/err.log

# 手動起動でエラー確認
cd /var/www/ainaru-massage
node backend/server.js
```

**2. データベース接続エラー**
```bash
# MySQL接続テスト
mysql -u cms_user -p ainaru_massage_cms

# .env設定確認
cat /var/www/ainaru-massage/.env
```

**3. Nginx設定エラー**
```bash
# 設定テスト
sudo nginx -t

# エラーログ確認
sudo tail -f /var/log/nginx/error.log
```

**4. SSL証明書エラー**
```bash
# 証明書状態確認
sudo certbot certificates

# 手動更新
sudo certbot renew --dry-run
```

---

## 📞 デプロイ後サポート

### サポート体制
- **緊急時対応**: [連絡先]
- **定期メンテナンス**: [スケジュール]
- **技術サポート**: [連絡先]

### ドキュメント
- システム要件書: `SYSTEM_REQUIREMENTS.md`
- 管理者認証情報: `ADMIN_CREDENTIALS.md`
- 運用マニュアル: 別途提供

---

**✅ デプロイ完了日**: _______________
**✅ 担当者**: _______________
**✅ 確認者**: _______________

このチェックリストのすべての項目を完了してから本番運用を開始してください。