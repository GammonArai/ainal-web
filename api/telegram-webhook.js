/**
 * Vercel Serverless Function for Telegram Bot Webhook
 * /api/telegram-webhook
 */

const { Telegraf, Markup } = require('telegraf');

// Botインスタンスをグローバルで保持（コールドスタート対策）
let bot;

// サービスメニュー
const SERVICES = [
    { id: 'oil90', name: 'オイルマッサージ90分', price: '25,000円' },
    { id: 'oil120', name: 'オイルマッサージ120分', price: '30,000円' },
    { id: 'aroma90', name: 'アロママッサージ90分', price: '28,000円' },
    { id: 'aroma120', name: 'アロママッサージ120分', price: '33,000円' },
    { id: 'akasuri60', name: 'アカスリ60分', price: '20,000円' },
    { id: 'set120', name: 'アカスリ+オイル120分', price: '35,000円' }
];

// 対応エリアのホテル
const HOTELS = [
    '中洲エリアのホテル',
    '博多駅周辺のホテル',
    '天神エリアのホテル',
    'その他（チャットで相談）'
];

// 時間帯
const TIME_SLOTS = [
    '10:00-12:00', '12:00-14:00', '14:00-16:00',
    '16:00-18:00', '18:00-20:00', '20:00-22:00',
    '22:00-24:00', '24:00-26:00'
];

function getBot() {
    if (!bot) {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) {
            throw new Error('TELEGRAM_BOT_TOKEN is not set');
        }
        
        bot = new Telegraf(token);
        
        // スタートコマンド
        bot.start((ctx) => {
            const welcomeMessage = `
🌸 愛なるマッサージへようこそ！

福岡市内の出張マッサージ・アカスリ専門店です。
完全予約制・女性セラピストが真心込めて施術いたします。

📍 対応エリア：中洲・博多・天神
⏰ 営業時間：10:00〜26:00
💳 お支払い：現金のみ

ご予約は /book コマンドでお願いします。`;
            
            ctx.reply(welcomeMessage, 
                Markup.keyboard([['📅 予約する', 'ℹ️ 料金表', '📞 お問い合わせ']])
                    .resize()
            );
        });
        
        // 予約コマンド
        bot.command('book', startBooking);
        bot.hears('📅 予約する', startBooking);
        
        // 料金表
        bot.hears('ℹ️ 料金表', (ctx) => {
            let priceList = '💆‍♀️ **施術メニュー**\n\n';
            SERVICES.forEach(service => {
                priceList += `• ${service.name}：${service.price}\n`;
            });
            priceList += '\n※ 指名料：2,000円\n※ 延長30分：10,000円';
            ctx.reply(priceList, { parse_mode: 'Markdown' });
        });
        
        // お問い合わせ
        bot.hears('📞 お問い合わせ', (ctx) => {
            ctx.reply('お問い合わせは以下の方法でお願いします：\n\n📱 LINE: @ainaru_massage\n☎️ 電話: 080-xxxx-xxxx\n\n営業時間内にご連絡ください。');
        });
        
        // コールバッククエリハンドラー
        bot.on('callback_query', handleCallbackQuery);
        
        // テキストメッセージハンドラー
        bot.on('text', handleTextMessage);
    }
    
    return bot;
}

// 予約開始
function startBooking(ctx) {
    ctx.reply(
        '施術メニューをお選びください：',
        Markup.inlineKeyboard(
            SERVICES.map(service => 
                [Markup.button.callback(`${service.name} ${service.price}`, `service:${service.id}`)]
            )
        )
    );
}

// コールバッククエリ処理
async function handleCallbackQuery(ctx) {
    const data = ctx.callbackQuery.data;
    
    try {
        // サービス選択
        if (data.startsWith('service:')) {
            const serviceId = data.split(':')[1];
            const service = SERVICES.find(s => s.id === serviceId);
            
            await ctx.answerCbQuery(`${service.name}を選択しました`);
            await ctx.editMessageText(
                `選択: ${service.name}\n\nご希望の日付を選択してください：`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('今日', `date:today:${serviceId}`)],
                    [Markup.button.callback('明日', `date:tomorrow:${serviceId}`)],
                    [Markup.button.callback('明後日', `date:dayafter:${serviceId}`)]
                ])
            );
        }
        
        // 日付選択
        else if (data.startsWith('date:')) {
            const [_, date, serviceId] = data.split(':');
            const dateText = date === 'today' ? '本日' : date === 'tomorrow' ? '明日' : '明後日';
            
            await ctx.answerCbQuery(`${dateText}を選択しました`);
            await ctx.editMessageText(
                `${dateText}のご希望時間帯を選択してください：`,
                Markup.inlineKeyboard(
                    TIME_SLOTS.map((slot, i) => 
                        [Markup.button.callback(slot, `time:${i}:${date}:${serviceId}`)]
                    )
                )
            );
        }
        
        // 時間選択
        else if (data.startsWith('time:')) {
            const [_, timeIndex, date, serviceId] = data.split(':');
            const timeSlot = TIME_SLOTS[timeIndex];
            
            await ctx.answerCbQuery(`${timeSlot}を選択しました`);
            await ctx.editMessageText(
                `ご利用予定のホテルエリアを選択してください：`,
                Markup.inlineKeyboard(
                    HOTELS.map((hotel, i) => 
                        [Markup.button.callback(hotel, `hotel:${i}:${timeIndex}:${date}:${serviceId}`)]
                    )
                )
            );
        }
        
        // ホテル選択
        else if (data.startsWith('hotel:')) {
            const [_, hotelIndex, timeIndex, date, serviceId] = data.split(':');
            const service = SERVICES.find(s => s.id === serviceId);
            const dateText = date === 'today' ? '本日' : date === 'tomorrow' ? '明日' : '明後日';
            const timeSlot = TIME_SLOTS[timeIndex];
            const hotel = HOTELS[hotelIndex];
            
            const confirmMessage = `
📋 **ご予約内容の確認**

• サービス: ${service.name}
• 料金: ${service.price}
• 日付: ${dateText}
• 時間: ${timeSlot}
• 場所: ${hotel}

こちらの内容でよろしいですか？`;
            
            await ctx.answerCbQuery();
            await ctx.editMessageText(
                confirmMessage,
                {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback('✅ 確定する', `confirm:${data}`)],
                        [Markup.button.callback('❌ キャンセル', 'cancel')]
                    ])
                }
            );
        }
        
        // 予約確定
        else if (data.startsWith('confirm:')) {
            await ctx.answerCbQuery('予約を確定しています...');
            await ctx.editMessageText(
                '✅ ご予約ありがとうございます！\n\n担当者より確認のご連絡をさせていただきます。\n\nお名前とお電話番号をメッセージでお送りください。\n\n例：山田太郎 090-1234-5678'
            );
        }
        
        // キャンセル
        else if (data === 'cancel') {
            await ctx.answerCbQuery('キャンセルしました');
            await ctx.editMessageText('予約をキャンセルしました。\n\nまたのご利用をお待ちしております。');
        }
        
    } catch (error) {
        console.error('Callback query error:', error);
        await ctx.answerCbQuery('エラーが発生しました。もう一度お試しください。');
    }
}

// テキストメッセージ処理
function handleTextMessage(ctx) {
    const text = ctx.message.text;
    
    // 電話番号パターンをチェック
    if (text.match(/\d{2,4}-?\d{2,4}-?\d{3,4}/)) {
        ctx.reply(
            '📝 お客様情報を受け付けました。\n\n確認後、担当者よりご連絡させていただきます。\n\nご予約ありがとうございました！',
            Markup.keyboard([['📅 予約する', 'ℹ️ 料金表', '📞 お問い合わせ']]).resize()
        );
    } else {
        ctx.reply('メニューからお選びください：',
            Markup.keyboard([['📅 予約する', 'ℹ️ 料金表', '📞 お問い合わせ']]).resize()
        );
    }
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
        
        // Webhookを処理（タイムアウト対策）
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Processing timeout')), 9000)
        );
        
        await Promise.race([
            bot.handleUpdate(req.body),
            timeoutPromise
        ]);
        
        // 成功レスポンス
        res.status(200).json({ ok: true });
        
    } catch (error) {
        console.error('Telegram webhook error:', error);
        res.status(200).json({ ok: true }); // Telegramには常に200を返す
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