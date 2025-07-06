/**
 * 最小テストスクリプト
 * Minimal test script to verify code structure without database
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs').promises;
const path = require('path');

async function testMinimal() {
    console.log('🧪 最小テスト開始...\n');

    try {
        // 1. 必要ファイルの存在確認
        console.log('1️⃣ 必要ファイルの存在確認...');
        await checkRequiredFiles();
        console.log('✅ 必要ファイル確認完了\n');

        // 2. モジュール読み込みテスト
        console.log('2️⃣ モジュール読み込みテスト...');
        await testModuleImports();
        console.log('✅ モジュール読み込み完了\n');

        // 3. 設定ファイルテスト
        console.log('3️⃣ 設定ファイルテスト...');
        await testConfiguration();
        console.log('✅ 設定ファイルテスト完了\n');

        // 4. Telegram Bot クラステスト
        console.log('4️⃣ Telegram Bot クラステスト...');
        await testTelegramBotClass();
        console.log('✅ Telegram Bot クラステスト完了\n');

        console.log('🎉 全ての最小テストが成功しました!\n');
        console.log('📋 次のステップ:');
        console.log('1. MySQL をインストール: brew install mysql');
        console.log('2. MySQL を起動: brew services start mysql');
        console.log('3. データベース初期化: npm run init:db');
        console.log('4. 完全テスト実行: npm run test:api\n');

    } catch (error) {
        console.error('❌ テストエラー:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

async function checkRequiredFiles() {
    const requiredFiles = [
        'backend/server.js',
        'backend/services/telegramBot.js',
        'backend/config/database.js',
        'backend/middleware/auth.js',
        'backend/routes/auth.routes.js',
        'backend/utils/logger.js',
        'database/schema.sql',
        'database/seed-data.sql'
    ];

    for (const file of requiredFiles) {
        const filePath = path.join(__dirname, '../../', file);
        try {
            await fs.access(filePath);
            console.log(`   ✅ ${file}`);
        } catch (error) {
            throw new Error(`必要ファイルが見つかりません: ${file}`);
        }
    }
}

async function testModuleImports() {
    try {
        // Express関連
        console.log('   📦 Express関連モジュール...');
        require('express');
        require('cors');
        require('helmet');
        require('morgan');
        console.log('   ✅ Express関連モジュール読み込み成功');

        // セキュリティ関連
        console.log('   📦 セキュリティ関連モジュール...');
        require('bcryptjs');
        require('jsonwebtoken');
        require('joi');
        console.log('   ✅ セキュリティ関連モジュール読み込み成功');

        // Telegram Bot
        console.log('   📦 Telegram Bot関連モジュール...');
        require('telegraf');
        console.log('   ✅ Telegram Bot関連モジュール読み込み成功');

        // データベース
        console.log('   📦 データベース関連モジュール...');
        require('mysql2/promise');
        console.log('   ✅ データベース関連モジュール読み込み成功');

        // ユーティリティ
        console.log('   📦 ユーティリティモジュール...');
        require('winston');
        require('dotenv');
        console.log('   ✅ ユーティリティモジュール読み込み成功');

    } catch (error) {
        throw new Error(`モジュール読み込みエラー: ${error.message}`);
    }
}

async function testConfiguration() {
    // 環境変数テスト
    const envVars = ['NODE_ENV', 'PORT', 'API_PREFIX', 'JWT_SECRET'];
    
    for (const envVar of envVars) {
        if (process.env[envVar]) {
            console.log(`   ✅ ${envVar}: ${envVar === 'JWT_SECRET' ? '***' : process.env[envVar]}`);
        } else {
            console.log(`   ⚠️ ${envVar}: 未設定`);
        }
    }

    // データベース設定テスト（接続なし）
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        database: process.env.DB_NAME || 'ainaru_massage_db'
    };
    
    console.log('   📊 データベース設定:');
    console.log(`      Host: ${dbConfig.host}:${dbConfig.port}`);
    console.log(`      User: ${dbConfig.user}`);
    console.log(`      Database: ${dbConfig.database}`);
}

async function testTelegramBotClass() {
    try {
        const TelegramBotService = require('../services/telegramBot');
        
        // クラスインスタンス化テスト
        const botService = new TelegramBotService();
        console.log('   ✅ TelegramBotService インスタンス化成功');

        // メソッド存在確認
        const requiredMethods = [
            'initialize', 'start', 'stop', 
            'generateBookingCode', 'getAvailableDates', 
            'formatDate', 'formatDateTime'
        ];

        for (const method of requiredMethods) {
            if (typeof botService[method] === 'function') {
                console.log(`   ✅ ${method} メソッド存在`);
            } else {
                throw new Error(`必要メソッドが見つかりません: ${method}`);
            }
        }

        // ユーティリティメソッドテスト
        const bookingCode = botService.generateBookingCode();
        console.log(`   ✅ 予約コード生成テスト: ${bookingCode}`);

        const dates = botService.getAvailableDates();
        console.log(`   ✅ 利用可能日付取得テスト: ${dates.length}件`);

        const formattedDate = botService.formatDate('2024-06-20');
        console.log(`   ✅ 日付フォーマットテスト: ${formattedDate}`);

    } catch (error) {
        throw new Error(`Telegram Bot クラステストエラー: ${error.message}`);
    }
}

// メイン実行
testMinimal().catch(console.error);