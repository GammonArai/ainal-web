# 愛なるマッサージCMS システム要件書

## 📋 概要

本書は「愛なるマッサージ」出張マッサージ・アカスリ専門店のWebサイト・CMSシステムの運用に必要なサーバー要件、技術仕様、および推奨構成をまとめた技術仕様書です。

---

## 🖥️ サーバー要件

### 最小要件（開発・テスト環境）
- **CPU**: 1 vCPU
- **メモリ**: 1GB RAM
- **ストレージ**: 10GB SSD
- **OS**: Ubuntu 18.04 LTS以降 / CentOS 7以降

### 推奨要件（本番環境・小規模）
- **CPU**: 2 vCPU
- **メモリ**: 2GB RAM
- **ストレージ**: 20GB SSD
- **帯域幅**: 月間転送量無制限または100GB以上
- **OS**: Ubuntu 20.04 LTS / CentOS 8以降

### 高性能要件（本番環境・商用）
- **CPU**: 4+ vCPU
- **メモリ**: 8GB+ RAM
- **ストレージ**: 100GB+ SSD
- **帯域幅**: 無制限
- **OS**: Ubuntu 22.04 LTS / Rocky Linux 8以降

---

## 🛠️ 必要ソフトウェア

### ランタイム環境
```
Node.js: 16.x以降（推奨: 18.x LTS）
npm: 8.x以降（Node.jsに付属）
```

### データベース
```
MySQL: 8.0以降
または
MariaDB: 10.5以降
```

### Webサーバー
```
Nginx: 1.18以降（推奨）
または  
Apache HTTP Server: 2.4以降
```

### プロセス管理
```
PM2: 最新版（Node.jsアプリケーション管理）
```

### SSL/TLS証明書
```
Let's Encrypt（無料）
または
商用SSL証明書
```

### その他必須ツール
```
Git: 2.25以降
Certbot: SSL証明書自動更新用
UFW: ファイアウォール設定用
```

---

## 🌐 推奨ホスティングサービス

### 国内VPS（日本語サポート重視）

#### さくらのVPS
- **2GBプラン**: 月額1,738円
- **4GBプラン**: 月額3,520円
- **メリット**: 日本語サポート、安定性、コスパ
- **用途**: 小〜中規模運用

#### ConoHa VPS
- **2GBプラン**: 月額1,958円
- **4GBプラン**: 月額3,608円
- **メリット**: 高速SSD、簡単セットアップ
- **用途**: パフォーマンス重視

#### お名前.com VPS
- **2GBプラン**: 月額1,467円
- **メリット**: 低価格、ドメイン一括管理
- **用途**: コスト重視

### 海外クラウド（高性能・拡張性重視）

#### DigitalOcean
- **2GB Droplet**: $12/月
- **4GB Droplet**: $24/月
- **メリット**: 豊富なドキュメント、1-clickアプリ
- **用途**: 成長期、国際展開

#### Vultr
- **2GB インスタンス**: $12/月
- **メリット**: 東京リージョン、高性能
- **用途**: 低レイテンシ重視

#### Linode (Akamai)
- **2GB プラン**: $12/月
- **メリット**: 高い稼働率、安定性
- **用途**: ミッションクリティカル

### マネージドサービス（運用簡単）

#### Heroku
- **Hobby プラン**: $7/月
- **メリット**: Git連携、自動スケール
- **制約**: スリープ機能有り

#### Railway
- **Pro プラン**: $20/月
- **メリット**: モダンな管理画面、簡単デプロイ
- **用途**: 小〜中規模、迅速な立ち上げ

#### Render
- **Starter プラン**: $7/月
- **メリット**: 無料プランあり、CI/CD統合
- **用途**: 開発〜小規模本番

---

## 🔧 セットアップ手順

### 1. サーバー初期設定

```bash
# システム更新
sudo apt update && sudo apt upgrade -y

# 必須パッケージインストール
sudo apt install nginx mysql-server git curl ufw -y

# ファイアウォール設定
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 2. Node.js環境構築

```bash
# Node.js 18.x LTS インストール
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs -y

# PM2プロセス管理ツールインストール
sudo npm install -g pm2

# バージョン確認
node --version
npm --version
```

### 3. データベース設定

```bash
# MySQL セキュリティ設定
sudo mysql_secure_installation

# データベース・ユーザー作成
sudo mysql -u root -p
```

```sql
-- データベース作成
CREATE DATABASE ainaru_massage_cms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ユーザー作成・権限付与
CREATE USER 'cms_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON ainaru_massage_cms.* TO 'cms_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 4. アプリケーション配置

```bash
# アプリケーション配置ディレクトリ作成
sudo mkdir -p /var/www/ainaru-massage
sudo chown $USER:$USER /var/www/ainaru-massage

# プロジェクトファイル配置
cd /var/www/ainaru-massage
# ファイルをアップロードまたはGitクローン

# 依存関係インストール
npm install --production

# 環境変数設定
cp .env.example .env
nano .env
```

### 5. 環境変数設定 (.env)

```bash
# データベース設定
DB_HOST=localhost
DB_USER=cms_user
DB_PASSWORD=your_secure_password
DB_NAME=ainaru_massage_cms

# アプリケーション設定
PORT=3000
NODE_ENV=production

# セキュリティ
JWT_SECRET=your_jwt_secret_key_here
SESSION_SECRET=your_session_secret_here

# バックアップ設定
BACKUP_STORAGE_PATH=/var/www/ainaru-massage/backups
BACKUP_RETENTION_DAYS=30
BACKUP_SCHEDULE=0 2 * * *

# Telegram Bot（オプション）
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
```

### 6. データベース初期化

```bash
# テーブル作成・初期データ投入
npm run init:db

# または手動でSQLファイル実行
mysql -u cms_user -p ainaru_massage_cms < database/schema.sql
```

### 7. アプリケーション起動設定

```bash
# PM2設定ファイル作成
cat > ecosystem.config.js << 'EOF'
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

# ログディレクトリ作成
mkdir -p logs

# アプリケーション起動
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 8. Nginx設定

```bash
# Nginx設定ファイル作成
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
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # 静的ファイル（フロントエンド）
    location / {
        try_files $uri $uri/ @backend;
        expires 1h;
        add_header Cache-Control "public, immutable";
    }

    # API・バックエンド
    location @backend {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # アップロードファイル
    location /uploads/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # バックアップファイル（アクセス拒否）
    location /backups/ {
        deny all;
        return 404;
    }

    # 管理画面（IP制限推奨）
    location /admin {
        # allow your_office_ip;
        # deny all;
        try_files $uri $uri/ @backend;
    }

    # ファイルサイズ制限
    client_max_body_size 10M;

    # gzip圧縮
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
EOF

# 設定有効化
sudo ln -s /etc/nginx/sites-available/ainaru-massage /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 9. SSL証明書設定

```bash
# Certbot インストール
sudo apt install certbot python3-certbot-nginx -y

# SSL証明書取得・設定
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 自動更新設定
sudo crontab -e
# 以下を追加
0 12 * * * /usr/bin/certbot renew --quiet
```

### 10. 定期メンテナンス設定

```bash
# crontab設定
crontab -e
```

```bash
# データベースバックアップ（毎日午前2時）
0 2 * * * cd /var/www/ainaru-massage && npm run backup:database

# ログローテーション（毎週）
0 0 * * 0 pm2 flush

# システム更新チェック（毎月）
0 3 1 * * apt update && apt list --upgradable
```

---

## 📊 パフォーマンス設定

### MySQL最適化 (/etc/mysql/mysql.conf.d/mysqld.cnf)

```ini
[mysqld]
# InnoDB設定
innodb_buffer_pool_size = 1G  # メモリの50-70%
innodb_log_file_size = 256M
innodb_log_buffer_size = 64M
innodb_flush_log_at_trx_commit = 2

# 接続設定
max_connections = 100
thread_cache_size = 8
table_open_cache = 400

# クエリキャッシュ
query_cache_type = 1
query_cache_size = 64M
query_cache_limit = 1M

# 文字セット
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
```

### Node.js最適化

```bash
# PM2設定でメモリ使用量制限
pm2 start ecosystem.config.js --max-memory-restart 500M

# Node.js メモリ制限
export NODE_OPTIONS="--max-old-space-size=512"
```

---

## 🔒 セキュリティ設定

### ファイアウォール設定

```bash
# UFW基本設定
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 必要ポートのみ開放
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### 管理者アクセス制限

```nginx
# Nginx: 管理画面IP制限
location /admin {
    allow 192.168.1.0/24;  # オフィスIP
    allow 203.0.113.0/24;  # 許可IP範囲
    deny all;
    try_files $uri $uri/ @backend;
}
```

### SSH鍵認証設定

```bash
# SSH設定強化 (/etc/ssh/sshd_config)
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
Port 2222  # デフォルトポート変更推奨
```

---

## 📈 監視・ログ設定

### システム監視

```bash
# htop インストール（リソース監視）
sudo apt install htop

# ログ監視
sudo apt install logwatch
```

### アプリケーション監視

```bash
# PM2 Monit（基本監視）
pm2 monit

# PM2 Plus（高度監視・有料）
pm2 plus
```

### ログ設定

```bash
# Nginx ログローテーション
sudo nano /etc/logrotate.d/nginx

# アプリケーションログ
mkdir -p /var/www/ainaru-massage/logs
```

---

## 💰 運用コスト目安

### 小規模運用（月間訪問者 1,000-5,000人）
- **VPS 2GB**: 1,500円〜2,000円/月
- **ドメイン**: 1,000円/年
- **SSL証明書**: 無料（Let's Encrypt）
- **合計**: 約2,000円/月

### 中規模運用（月間訪問者 5,000-20,000人）
- **VPS 4GB**: 3,500円〜4,000円/月
- **CDN**: 無料〜1,000円/月
- **バックアップ**: 500円/月
- **合計**: 約4,500円/月

### 大規模運用（月間訪問者 20,000人以上）
- **VPS 8GB+**: 6,000円〜10,000円/月
- **CDN**: 1,000円〜3,000円/月
- **監視ツール**: 1,000円〜2,000円/月
- **合計**: 約10,000円/月

---

## 🚀 トラブルシューティング

### よくある問題と解決方法

#### 1. アプリケーションが起動しない
```bash
# ログ確認
pm2 logs
tail -f /var/www/ainaru-massage/logs/err.log

# プロセス状態確認
pm2 status

# 再起動
pm2 restart ainaru-massage-cms
```

#### 2. データベース接続エラー
```bash
# MySQL サービス状態確認
sudo systemctl status mysql

# 接続テスト
mysql -u cms_user -p ainaru_massage_cms

# 設定確認
cat /var/www/ainaru-massage/.env
```

#### 3. Nginx設定エラー
```bash
# 設定構文チェック
sudo nginx -t

# エラーログ確認
sudo tail -f /var/log/nginx/error.log

# 設定リロード
sudo systemctl reload nginx
```

#### 4. SSL証明書エラー
```bash
# 証明書状態確認
sudo certbot certificates

# 手動更新
sudo certbot renew

# Nginx設定確認
sudo nginx -t
```

---

## 📞 サポート・ドキュメント

### 技術サポート先
- **Node.js**: https://nodejs.org/docs/
- **MySQL**: https://dev.mysql.com/doc/
- **Nginx**: https://nginx.org/en/docs/
- **PM2**: https://pm2.keymetrics.io/docs/

### 推奨学習リソース
- Ubuntu Server Guide
- MySQL Administration
- Nginx Configuration
- Node.js Production Best Practices

---

## 📝 バージョン履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|----------|
| 1.0.0 | 2024-01-XX | 初版作成 |
| 1.1.0 | 2024-XX-XX | PWA機能追加、レビューシステム追加 |

---

## ⚠️ 重要事項

1. **定期バックアップ**: データベース・ファイルの定期バックアップを必ず設定してください
2. **セキュリティ更新**: OSとソフトウェアの定期更新を行ってください  
3. **監視設定**: システムリソースとアプリケーションの監視を設定してください
4. **ドキュメント保持**: 設定変更時は必ずドキュメントを更新してください

---

このドキュメントに記載された要件に従って設定することで、愛なるマッサージCMSシステムを安定的に運用できます。