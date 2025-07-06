/**
 * テスト環境セットアップスクリプト
 * Test environment setup script
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../utils/logger');

async function setupTestEnvironment() {
    let connection;
    
    try {
        console.log('🔧 テスト環境をセットアップ中...\n');

        // 1. 環境変数チェック
        console.log('1️⃣ 環境変数をチェック中...');
        const requiredEnvVars = [
            'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME',
            'JWT_SECRET', 'TELEGRAM_BOT_TOKEN'
        ];
        
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            console.error('❌ 以下の環境変数が設定されていません:');
            missingVars.forEach(varName => console.log(`   - ${varName}`));
            console.log('\n📝 .env ファイルを確認してください');
            process.exit(1);
        }
        console.log('✅ 環境変数チェック完了\n');

        // 2. データベース接続テスト
        console.log('2️⃣ データベース接続をテスト中...');
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            multipleStatements: true
        });
        console.log('✅ データベース接続成功\n');

        // 3. データベース初期化
        console.log('3️⃣ データベースを初期化中...');
        
        // スキーマ実行
        const schemaPath = path.join(__dirname, '../../database/schema.sql');
        const schemaSQL = await fs.readFile(schemaPath, 'utf8');
        await connection.query(schemaSQL);
        console.log('✅ スキーマ作成完了');

        // サンプルデータ挿入
        const seedPath = path.join(__dirname, '../../database/seed-data.sql');
        const seedSQL = await fs.readFile(seedPath, 'utf8');
        await connection.query(seedSQL);
        console.log('✅ サンプルデータ挿入完了\n');

        // 4. テストデータ追加
        console.log('4️⃣ テスト用追加データを作成中...');
        await createTestData(connection);
        console.log('✅ テストデータ作成完了\n');

        // 5. Telegram Bot トークンテスト
        console.log('5️⃣ Telegram Bot トークンをテスト中...');
        const TelegramBot = require('telegraf').Telegraf;
        const testBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
        
        try {
            const botInfo = await testBot.telegram.getMe();
            console.log(`✅ Bot接続成功: @${botInfo.username}`);
        } catch (error) {
            console.error('❌ Telegram Bot トークンが無効です');
            console.log('以下の手順でトークンを確認してください:');
            console.log('1. @BotFather にアクセス');
            console.log('2. /mybots でボット一覧を確認');
            console.log('3. 正しいトークンを .env ファイルに設定');
            throw error;
        }
        console.log('');

        // 6. 起動スクリプト実行権限設定
        console.log('6️⃣ 起動スクリプトを準備中...');
        await createStartupScripts();
        console.log('✅ 起動スクリプト準備完了\n');

        console.log('🎉 テスト環境セットアップ完了!\n');
        console.log('📋 次のステップ:');
        console.log('1. npm run test:bot - Telegram Bot単体テスト');
        console.log('2. npm run dev:backend - 完全サーバー起動');
        console.log('3. Telegramで @[ボット名] を検索してテスト開始\n');

        console.log('🔍 テスト用アカウント:');
        console.log('管理者: admin@ainaru-massage.com / admin123');
        console.log('セラピスト1: therapist1@ainaru-massage.com / therapist123');
        console.log('セラピスト2: therapist2@ainaru-massage.com / therapist123\n');

    } catch (error) {
        console.error('❌ セットアップエラー:', error.message);
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.log('\n💡 データベース認証エラーの解決方法:');
            console.log('1. MySQLが起動しているか確認');
            console.log('2. .envファイルのDB_USER, DB_PASSWORDを確認');
            console.log('3. MySQLでユーザー権限を確認');
        } else if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 データベース接続エラーの解決方法:');
            console.log('1. MySQLサーバーを起動: brew services start mysql');
            console.log('2. ポート番号を確認 (デフォルト: 3306)');
        }
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

async function createTestData(connection) {
    // テスト用管理者アカウント（パスワードハッシュ済み）
    const bcrypt = require('bcryptjs');
    const adminPassword = await bcrypt.hash('admin123', 10);
    const therapistPassword = await bcrypt.hash('therapist123', 10);

    await connection.execute(`
        INSERT IGNORE INTO users (username, email, password_hash, role) VALUES
        ('admin_test', 'admin@ainaru-massage.com', ?, 'admin'),
        ('therapist1_test', 'therapist1@ainaru-massage.com', ?, 'therapist'),
        ('therapist2_test', 'therapist2@ainaru-massage.com', ?, 'therapist')
    `, [adminPassword, therapistPassword, therapistPassword]);

    // テスト用追加サービス
    await connection.execute(`
        INSERT IGNORE INTO services (category_id, name, slug, description, duration_minutes, price, tags, is_featured) VALUES
        (1, 'テスト用クイックマッサージ', 'test-quick-massage', 'テスト用の短時間マッサージ', 30, 5000, '["テスト用", "短時間"]', true),
        (2, 'テスト用アカスリ', 'test-akasuri', 'テスト用のアカスリコース', 45, 7000, '["テスト用", "美肌"]', false)
    `);

    // テスト用ホテル
    await connection.execute(`
        INSERT IGNORE INTO hotels (name, area, address, description, features, is_partner) VALUES
        ('テストホテル中洲', '中洲', '福岡市博多区中洲1-1-1', 'テスト用ホテル', '["テスト用", "24時間対応"]', true),
        ('テストホテル博多', '博多', '福岡市博多区博多駅前1-1-1', 'テスト用ホテル', '["テスト用", "駅近"]', false)
    `);

    // テスト用プロモーション
    await connection.execute(`
        INSERT IGNORE INTO promotions (title, description, discount_type, discount_value, code, start_date, end_date, banner_text, show_on_home_banner) VALUES
        ('テストキャンペーン', 'テスト用の割引キャンペーン', 'percentage', 30, 'TEST30', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 'テスト用30%OFF', true)
    `);
}

async function createStartupScripts() {
    // テスト用パッケージスクリプト追加
    const packageJsonPath = path.join(__dirname, '../../package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    
    packageJson.scripts = {
        ...packageJson.scripts,
        'test:bot': 'node backend/scripts/test-telegram-bot.js',
        'setup:test': 'node backend/scripts/setup-test-env.js',
        'test:api': 'node backend/scripts/test-api.js'
    };
    
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

// メイン実行
setupTestEnvironment().catch(console.error);