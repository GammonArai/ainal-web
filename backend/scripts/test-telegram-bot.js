/**
 * Telegram Bot テストスクリプト
 * Test script for Telegram Bot local development
 */

require('dotenv').config();
const TelegramBotService = require('../services/telegramBot');
const { initializeDatabase } = require('../config/database');
const { logger } = require('../utils/logger');

async function testTelegramBot() {
    try {
        console.log('🤖 Telegram Bot テスト開始...\n');

        // 環境変数チェック
        if (!process.env.TELEGRAM_BOT_TOKEN) {
            console.error('❌ TELEGRAM_BOT_TOKEN が設定されていません');
            console.log('以下の手順でトークンを取得してください:');
            console.log('1. @BotFather に /newbot と送信');
            console.log('2. ボット名を入力（例: Ainaru Massage Bot）');
            console.log('3. ユーザー名を入力（例: AinaruMassageTestBot）');
            console.log('4. 取得したトークンを .env ファイルに設定');
            console.log('   TELEGRAM_BOT_TOKEN=your_token_here');
            process.exit(1);
        }

        // データベース接続
        console.log('📊 データベースに接続中...');
        await initializeDatabase();
        console.log('✅ データベース接続完了\n');

        // ボット初期化
        console.log('🔧 Telegram Bot を初期化中...');
        const botService = new TelegramBotService();
        await botService.initialize();
        console.log('✅ Telegram Bot 初期化完了\n');

        // ボット情報表示
        const botInfo = await botService.bot.telegram.getMe();
        console.log('🤖 Bot 情報:');
        console.log(`   名前: ${botInfo.first_name}`);
        console.log(`   ユーザー名: @${botInfo.username}`);
        console.log(`   ID: ${botInfo.id}\n`);

        // ボット起動
        console.log('🚀 Telegram Bot を起動中...');
        await botService.start();
        
        console.log('✅ Telegram Bot 起動完了!\n');
        console.log('📱 テスト方法:');
        console.log(`1. Telegram で @${botInfo.username} を検索`);
        console.log('2. /start コマンドを送信');
        console.log('3. 予約フローをテスト');
        console.log('\n⏹️ 停止するには Ctrl+C を押してください\n');

        // 停止処理
        process.once('SIGINT', async () => {
            console.log('\n⏹️ Bot を停止中...');
            await botService.stop();
            console.log('✅ Bot 停止完了');
            process.exit(0);
        });

        process.once('SIGTERM', async () => {
            console.log('\n⏹️ Bot を停止中...');
            await botService.stop();
            console.log('✅ Bot 停止完了');
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ エラー:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// テスト実行
testTelegramBot();