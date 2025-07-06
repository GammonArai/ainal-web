/**
 * Vercel Serverless Function for Telegram Bot Webhook
 * /api/telegram-webhook
 */

const { Telegraf } = require('telegraf');

// Botインスタンスをグローバルで保持（コールドスタート対策）
let bot;

function getBot() {
    if (!bot) {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) {
            throw new Error('TELEGRAM_BOT_TOKEN is not set');
        }
        
        bot = new Telegraf(token);
        
        // コマンドハンドラー
        bot.start((ctx) => {
            ctx.reply('🌸 愛なるマッサージへようこそ！\n\n施術のご予約は /book コマンドでお願いします。');
        });
        
        bot.command('book', (ctx) => {
            ctx.reply('ご予約を開始します...\n\n※現在、Vercelでの動作テスト中です。');
        });
        
        bot.on('text', (ctx) => {
            ctx.reply('申し訳ございません。コマンドを使用してください。\n/book - 予約開始');
        });
    }
    
    return bot;
}

// Vercel Serverless Function
export default async function handler(req, res) {
    try {
        // POSTリクエストのみ処理
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }
        
        // Telegram Webhookの検証
        const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
        if (secretToken && req.headers['x-telegram-bot-api-secret-token'] !== secretToken) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        // Botインスタンスを取得
        const bot = getBot();
        
        // Webhookを処理
        await bot.handleUpdate(req.body);
        
        // 成功レスポンス
        res.status(200).json({ ok: true });
        
    } catch (error) {
        console.error('Telegram webhook error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

// Webhook URLの設定（初回のみ実行）
export async function setWebhook() {
    const bot = getBot();
    const webhookUrl = `${process.env.VERCEL_URL}/api/telegram-webhook`;
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET || 'your-secret-token';
    
    try {
        await bot.telegram.setWebhook(webhookUrl, {
            secret_token: secretToken
        });
        console.log('Webhook set successfully:', webhookUrl);
    } catch (error) {
        console.error('Failed to set webhook:', error);
    }
}