# 愛なるマッサージ データベース設定

このディレクトリには、愛なるマッサージCMSのデータベーススキーマとセットアップスクリプトが含まれています。

## 必要要件

- MySQL 8.0以上 または MariaDB 10.5以上
- Node.js 16以上（初期化スクリプト実行用）

## セットアップ手順

### 1. MySQLのインストール

```bash
# macOS (Homebrew)
brew install mysql
brew services start mysql

# Ubuntu/Debian
sudo apt update
sudo apt install mysql-server
sudo systemctl start mysql

# Windows
# MySQL公式サイトからインストーラーをダウンロード
```

### 2. データベースの初期化

```bash
# プロジェクトルートディレクトリで実行
cd /path/to/twitter

# 必要なパッケージをインストール
npm install mysql2 dotenv

# データベース初期化スクリプトを実行
node backend/scripts/init-database.js
```

### 3. 環境変数の設定

```bash
# .envファイルを作成
cp backend/.env.example backend/.env

# .envファイルを編集してデータベース接続情報を設定
# DB_USER, DB_PASSWORD などを適切に設定
```

## データベース構造

### 主要テーブル

- **users**: ユーザー情報（管理者、セラピスト、会員）
- **therapists**: セラピストの詳細プロフィール
- **services**: 提供サービス情報
- **bookings**: 予約情報
- **hotels**: 対応可能ホテル情報
- **reviews**: レビュー・評価
- **promotions**: キャンペーン・プロモーション情報

### セキュリティ機能

- パスワードはbcryptでハッシュ化
- JWTトークンによる認証
- 監査ログによる操作履歴記録
- SQLインジェクション対策済み

## 管理コマンド

### データベースに直接接続

```bash
mysql -u root -p ainaru_massage_db
```

### バックアップ

```bash
mysqldump -u root -p ainaru_massage_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### リストア

```bash
mysql -u root -p ainaru_massage_db < backup_file.sql
```

## トラブルシューティング

### 接続エラーが発生する場合

1. MySQLサービスが起動しているか確認
   ```bash
   # macOS
   brew services list
   
   # Linux
   sudo systemctl status mysql
   ```

2. ユーザー権限を確認
   ```sql
   GRANT ALL PRIVILEGES ON ainaru_massage_db.* TO 'your_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

### 文字化けが発生する場合

データベースの文字セットがutf8mb4になっているか確認：
```sql
SHOW VARIABLES LIKE 'character_set%';
```

## 開発時の注意事項

- 本番環境では必ず強力なパスワードを使用してください
- 定期的なバックアップを実施してください
- データベースのアップデートは必ずバックアップを取ってから実行してください