/**
 * ローカル開発環境セットアップスクリプト
 * Local development environment setup script (without MySQL requirement)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs').promises;
const path = require('path');

async function setupLocalDevelopment() {
    try {
        console.log('🔧 ローカル開発環境をセットアップ中...\n');

        // 1. 環境確認
        console.log('1️⃣ 環境をチェック中...');
        await checkEnvironment();
        console.log('✅ 環境チェック完了\n');

        // 2. ディレクトリ作成
        console.log('2️⃣ 必要なディレクトリを作成中...');
        await createDirectories();
        console.log('✅ ディレクトリ作成完了\n');

        // 3. パッケージ設定更新
        console.log('3️⃣ パッケージ設定を更新中...');
        await updatePackageScripts();
        console.log('✅ パッケージ設定更新完了\n');

        // 4. Telegram Bot トークン設定ガイド
        console.log('4️⃣ Telegram Bot セットアップガイド...');
        await showTelegramBotGuide();
        console.log('');

        // 5. MySQL セットアップガイド
        console.log('5️⃣ MySQL セットアップガイド...');
        await showMySQLGuide();
        console.log('');

        console.log('🎉 ローカル開発環境セットアップ完了!\n');
        console.log('📋 次のステップ:');
        console.log('1. MySQL をインストール・設定');
        console.log('2. Telegram Bot トークンを取得・設定');
        console.log('3. npm run init:db でデータベース初期化');
        console.log('4. npm run test:api でAPI動作確認');
        console.log('5. npm run test:bot で Telegram Bot テスト\n');

    } catch (error) {
        console.error('❌ セットアップエラー:', error.message);
        process.exit(1);
    }
}

async function checkEnvironment() {
    // Node.js バージョンチェック
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion < 16) {
        throw new Error(`Node.js 16以上が必要です。現在のバージョン: ${nodeVersion}`);
    }
    console.log(`   ✅ Node.js ${nodeVersion}`);

    // .env ファイル存在チェック
    const envPath = path.join(__dirname, '../.env');
    try {
        await fs.access(envPath);
        console.log('   ✅ .env ファイル存在');
    } catch (error) {
        console.log('   ⚠️ .env ファイルが存在しません');
        console.log('   📝 backend/.env.example を backend/.env にコピーしてください');
    }

    // package.json 存在チェック
    const packagePath = path.join(__dirname, '../../package.json');
    try {
        await fs.access(packagePath);
        console.log('   ✅ package.json 存在');
    } catch (error) {
        throw new Error('package.json が見つかりません');
    }
}

async function createDirectories() {
    const directories = [
        path.join(__dirname, '../logs'),
        path.join(__dirname, '../uploads'),
        path.join(__dirname, '../uploads/images'),
        path.join(__dirname, '../uploads/documents')
    ];

    for (const dir of directories) {
        try {
            await fs.mkdir(dir, { recursive: true });
            console.log(`   📁 ${path.relative(process.cwd(), dir)}`);
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }
}

async function updatePackageScripts() {
    const packageJsonPath = path.join(__dirname, '../../package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    
    // テスト用スクリプト追加
    packageJson.scripts = {
        ...packageJson.scripts,
        'setup:local': 'node backend/scripts/setup-local-dev.js',
        'test:bot': 'node backend/scripts/test-telegram-bot.js',
        'test:api': 'node backend/scripts/test-api.js'
    };
    
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('   ✅ npm scripts 追加完了');
}

async function showTelegramBotGuide() {
    console.log(`
📱 Telegram Bot セットアップ手順:

1. Telegram で @BotFather を検索して開く
2. /newbot コマンドを送信
3. ボット名を入力（例: Ainaru Massage Test Bot）
4. ユーザー名を入力（例: AinaruMassageTestBot）
5. 取得したトークンを backend/.env の TELEGRAM_BOT_TOKEN に設定

例:
TELEGRAM_BOT_TOKEN=1234567890:ABCDefGhIjKlMnOpQrStUvWxYz

⚠️ 現在の設定: ${process.env.TELEGRAM_BOT_TOKEN || '未設定'}
    `);
}

async function showMySQLGuide() {
    console.log(`
🗄️ MySQL セットアップ手順:

macOS (Homebrew):
brew install mysql
brew services start mysql
mysql_secure_installation

Ubuntu/Debian:
sudo apt update
sudo apt install mysql-server
sudo systemctl start mysql
sudo mysql_secure_installation

Windows:
MySQL公式サイトからインストーラーをダウンロード
https://dev.mysql.com/downloads/mysql/

設定後、backend/.env ファイルを更新:
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=ainaru_massage_db
    `);
}

// gitignore も作成
async function createGitignore() {
    const gitignoreContent = `
# Environment variables
backend/.env

# Logs
backend/logs/
*.log

# Dependencies
node_modules/

# Uploads
backend/uploads/

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Database
*.sql.backup
*.db
    `.trim();

    const gitignorePath = path.join(__dirname, '../../.gitignore');
    
    try {
        await fs.access(gitignorePath);
        console.log('   ⚠️ .gitignore は既に存在します');
    } catch (error) {
        await fs.writeFile(gitignorePath, gitignoreContent);
        console.log('   ✅ .gitignore 作成完了');
    }
}

// メイン実行
setupLocalDevelopment().catch(console.error);