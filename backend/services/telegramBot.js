/**
 * Telegram Bot サービス
 * Telegram Bot service for Ainaru Massage booking system
 */

const { Telegraf, Markup } = require('telegraf');
const { query, queryOne, withTransaction } = require('../config/database');
const { logger } = require('../utils/logger');
const { sendAuditLog } = require('../utils/auditLog');
const SchedulingService = require('./schedulingService');

class TelegramBotService {
    constructor() {
        this.bot = null;
        this.userSessions = new Map(); // ユーザーセッション管理
        this.schedulingService = new SchedulingService();
        this.bookingSteps = {
            START: 'start',
            SELECT_SERVICE: 'select_service',
            SELECT_DATE: 'select_date',
            SELECT_TIME: 'select_time',
            SELECT_HOTEL: 'select_hotel',
            CONFIRM_DETAILS: 'confirm_details',
            PROVIDE_CONTACT: 'provide_contact',
            PAYMENT: 'payment',
            COMPLETED: 'completed'
        };
    }

    /**
     * ボット初期化
     */
    async initialize() {
        try {
            const token = process.env.TELEGRAM_BOT_TOKEN;
            if (!token) {
                throw new Error('TELEGRAM_BOT_TOKEN が設定されていません');
            }

            this.bot = new Telegraf(token);
            this.setupCommands();
            this.setupCallbacks();
            this.setupMiddleware();

            // ボット情報を取得
            const botInfo = await this.bot.telegram.getMe();
            logger.info(`Telegram Bot 初期化完了: @${botInfo.username}`);

            return this.bot;
        } catch (error) {
            logger.error('Telegram Bot 初期化エラー:', error);
            throw error;
        }
    }

    /**
     * ミドルウェア設定
     */
    setupMiddleware() {
        // セッション管理
        this.bot.use((ctx, next) => {
            const userId = ctx.from.id;
            if (!this.userSessions.has(userId)) {
                this.userSessions.set(userId, {
                    step: this.bookingSteps.START,
                    bookingData: {},
                    messageHistory: []
                });
            }
            ctx.session = this.userSessions.get(userId);
            return next();
        });

        // ログ記録
        this.bot.use((ctx, next) => {
            logger.info('Telegram メッセージ受信:', {
                userId: ctx.from.id,
                username: ctx.from.username,
                firstName: ctx.from.first_name,
                messageType: ctx.updateType,
                text: ctx.message?.text || ctx.callbackQuery?.data
            });
            return next();
        });

        // エラーハンドリング
        this.bot.catch((err, ctx) => {
            logger.error('Telegram Bot エラー:', err);
            ctx.reply('申し訳ございませんが、エラーが発生しました。しばらくしてから再度お試しください。');
        });
    }

    /**
     * コマンド設定
     */
    setupCommands() {
        // /start コマンド
        this.bot.start(async (ctx) => {
            const user = ctx.from;
            
            // ユーザー情報を記録
            await this.recordTelegramUser(user);
            
            const welcomeMessage = `
🌸 愛なるマッサージへようこそ 🌸

心と体に愛を込めた癒しの出張マッサージ・アカスリ専門店です。

📍 対応エリア: 福岡市中洲・博多・天神エリア
💳 決済方法: PayPay
⏰ 営業時間: 10:00-03:00（最終受付 02:00）

ご予約は以下のボタンから始めていただけます。
            `;

            await ctx.reply(welcomeMessage, Markup.inlineKeyboard([
                [Markup.button.callback('📅 新規予約', 'start_booking')],
                [Markup.button.callback('📋 予約確認', 'check_booking')],
                [Markup.button.callback('ℹ️ サービス情報', 'service_info')],
                [Markup.button.callback('📞 お問い合わせ', 'contact_info')]
            ]));

            ctx.session.step = this.bookingSteps.START;
        });

        // /help コマンド
        this.bot.help((ctx) => {
            const helpMessage = `
🤖 愛なるマッサージ Botの使い方

📋 利用可能なコマンド:
/start - ボットを開始
/book - 新規予約
/status - 予約状況確認
/cancel - 予約キャンセル
/help - ヘルプ表示

📞 お困りの場合:
直接お電話またはメッセージでお問い合わせください。
営業時間: 10:00-03:00
            `;
            ctx.reply(helpMessage);
        });

        // /book コマンド - 直接予約開始
        this.bot.command('book', (ctx) => {
            this.startBookingProcess(ctx);
        });

        // /status コマンド - 予約状況確認
        this.bot.command('status', async (ctx) => {
            await this.showBookingStatus(ctx);
        });

        // /cancel コマンド - 予約キャンセル
        this.bot.command('cancel', async (ctx) => {
            await this.showCancelOptions(ctx);
        });
    }

    /**
     * コールバック設定
     */
    setupCallbacks() {
        // メイン機能
        this.bot.action('start_booking', (ctx) => {
            this.startBookingProcess(ctx);
        });

        this.bot.action('check_booking', async (ctx) => {
            await this.showBookingStatus(ctx);
        });

        this.bot.action('service_info', async (ctx) => {
            await this.showServiceInfo(ctx);
        });

        this.bot.action('contact_info', (ctx) => {
            this.showContactInfo(ctx);
        });

        // サービス選択
        this.bot.action(/^service_(\d+)$/, async (ctx) => {
            const serviceId = parseInt(ctx.match[1]);
            await this.selectService(ctx, serviceId);
        });

        // 日付選択
        this.bot.action(/^date_(.+)$/, async (ctx) => {
            const date = ctx.match[1];
            await this.selectDate(ctx, date);
        });

        // 時間選択
        this.bot.action(/^time_(.+)$/, async (ctx) => {
            const time = ctx.match[1];
            await this.selectTime(ctx, time);
        });

        // ホテル選択
        this.bot.action(/^hotel_(\d+)$/, async (ctx) => {
            const hotelId = parseInt(ctx.match[1]);
            await this.selectHotel(ctx, hotelId);
        });

        // 予約確認
        this.bot.action('confirm_booking', async (ctx) => {
            await this.confirmBooking(ctx);
        });

        this.bot.action('edit_booking', (ctx) => {
            this.startBookingProcess(ctx);
        });

        // 予約管理
        this.bot.action(/^cancel_booking_(\d+)$/, async (ctx) => {
            const bookingId = parseInt(ctx.match[1]);
            await this.cancelBooking(ctx, bookingId);
        });

        // 戻るボタン
        this.bot.action('back_to_main', (ctx) => {
            ctx.session.step = this.bookingSteps.START;
            ctx.editMessageText('メインメニューに戻りました。', 
                Markup.inlineKeyboard([
                    [Markup.button.callback('📅 新規予約', 'start_booking')],
                    [Markup.button.callback('📋 予約確認', 'check_booking')],
                    [Markup.button.callback('ℹ️ サービス情報', 'service_info')]
                ])
            );
        });
    }

    /**
     * 予約プロセス開始
     */
    async startBookingProcess(ctx) {
        try {
            ctx.session.step = this.bookingSteps.SELECT_SERVICE;
            ctx.session.bookingData = {};

            const services = await query(
                'SELECT * FROM services WHERE is_active = TRUE ORDER BY display_order, price'
            );

            if (services.length === 0) {
                await ctx.reply('申し訳ございません。現在利用可能なサービスがありません。');
                return;
            }

            let message = '✨ ご利用希望のサービスをお選びください\n\n';
            
            const serviceButtons = services.map(service => {
                const tags = service.tags ? JSON.parse(service.tags).join(' ') : '';
                const serviceText = `${service.name} (${service.duration_minutes}分)\n💰 ¥${service.price.toLocaleString()} ${tags}`;
                return [Markup.button.callback(serviceText, `service_${service.id}`)];
            });

            serviceButtons.push([Markup.button.callback('🔙 メインメニューに戻る', 'back_to_main')]);

            if (ctx.callbackQuery) {
                await ctx.editMessageText(message, Markup.inlineKeyboard(serviceButtons));
            } else {
                await ctx.reply(message, Markup.inlineKeyboard(serviceButtons));
            }
        } catch (error) {
            logger.error('予約プロセス開始エラー:', error);
            await ctx.reply('エラーが発生しました。もう一度お試しください。');
        }
    }

    /**
     * サービス選択
     */
    async selectService(ctx, serviceId) {
        try {
            const service = await queryOne(
                'SELECT * FROM services WHERE id = ? AND is_active = TRUE',
                [serviceId]
            );

            if (!service) {
                await ctx.reply('選択されたサービスは利用できません。');
                return;
            }

            ctx.session.bookingData.serviceId = serviceId;
            ctx.session.bookingData.service = service;
            ctx.session.step = this.bookingSteps.SELECT_DATE;

            // 利用可能な日付を生成（今日から30日先まで）
            const dates = this.getAvailableDates();
            const dateButtons = dates.map(date => [
                Markup.button.callback(date.display, `date_${date.value}`)
            ]);
            
            dateButtons.push([Markup.button.callback('🔙 サービス選択に戻る', 'start_booking')]);

            const message = `
📅 ご希望の日付をお選びください

選択されたサービス:
${service.name} (${service.duration_minutes}分)
料金: ¥${service.price.toLocaleString()}
            `;

            await ctx.editMessageText(message, Markup.inlineKeyboard(dateButtons));
        } catch (error) {
            logger.error('サービス選択エラー:', error);
            await ctx.reply('エラーが発生しました。もう一度お試しください。');
        }
    }

    /**
     * 日付選択
     */
    async selectDate(ctx, dateValue) {
        try {
            ctx.session.bookingData.date = dateValue;
            ctx.session.step = this.bookingSteps.SELECT_TIME;

            // 利用可能な時間を取得
            const availableTimes = await this.getAvailableTimes(dateValue, ctx.session.bookingData.serviceId);
            
            if (availableTimes.length === 0) {
                await ctx.reply('申し訳ございません。選択された日付に空きがありません。別の日付をお選びください。');
                return;
            }

            const timeButtons = availableTimes.map(time => [
                Markup.button.callback(time.display, `time_${time.value}`)
            ]);
            
            timeButtons.push([Markup.button.callback('🔙 日付選択に戻る', 'start_booking')]);

            const message = `
⏰ ご希望の時間をお選びください

選択された日付: ${this.formatDate(dateValue)}
            `;

            await ctx.editMessageText(message, Markup.inlineKeyboard(timeButtons));
        } catch (error) {
            logger.error('日付選択エラー:', error);
            await ctx.reply('エラーが発生しました。もう一度お試しください。');
        }
    }

    /**
     * 時間選択
     */
    async selectTime(ctx, timeValue) {
        try {
            ctx.session.bookingData.time = timeValue;
            ctx.session.step = this.bookingSteps.SELECT_HOTEL;

            // 利用可能なホテルを取得
            const hotels = await query(
                'SELECT * FROM hotels WHERE is_active = TRUE ORDER BY is_partner DESC, area, name'
            );

            if (hotels.length === 0) {
                await ctx.reply('申し訳ございません。現在利用可能なホテルがありません。');
                return;
            }

            const hotelButtons = hotels.map(hotel => {
                const partnerBadge = hotel.is_partner ? '⭐' : '';
                const hotelText = `${partnerBadge} ${hotel.name}\n📍 ${hotel.area}`;
                return [Markup.button.callback(hotelText, `hotel_${hotel.id}`)];
            });
            
            hotelButtons.push([Markup.button.callback('🔙 時間選択に戻る', 'start_booking')]);

            const message = `
🏨 ご利用予定のホテルをお選びください

選択された時間: ${this.formatDateTime(ctx.session.bookingData.date, timeValue)}

⭐ パートナーホテル（割引特典あり）
            `;

            await ctx.editMessageText(message, Markup.inlineKeyboard(hotelButtons));
        } catch (error) {
            logger.error('時間選択エラー:', error);
            await ctx.reply('エラーが発生しました。もう一度お試しください。');
        }
    }

    /**
     * ホテル選択
     */
    async selectHotel(ctx, hotelId) {
        try {
            const hotel = await queryOne(
                'SELECT * FROM hotels WHERE id = ? AND is_active = TRUE',
                [hotelId]
            );

            if (!hotel) {
                await ctx.reply('選択されたホテルは利用できません。');
                return;
            }

            ctx.session.bookingData.hotelId = hotelId;
            ctx.session.bookingData.hotel = hotel;
            ctx.session.step = this.bookingSteps.CONFIRM_DETAILS;

            const bookingData = ctx.session.bookingData;
            const service = bookingData.service;
            const endTime = this.calculateEndTime(bookingData.time, service.duration_minutes);

            const confirmMessage = `
📝 予約内容をご確認ください

🎯 サービス: ${service.name}
⏱️ 施術時間: ${service.duration_minutes}分
📅 日時: ${this.formatDateTime(bookingData.date, bookingData.time)} - ${endTime}
🏨 ホテル: ${hotel.name} (${hotel.area})
💰 料金: ¥${service.price.toLocaleString()}

💳 支払い方法: PayPay決済
⚠️ キャンセルは24時間前まで可能です

この内容で予約を確定しますか？
            `;

            await ctx.editMessageText(confirmMessage, Markup.inlineKeyboard([
                [Markup.button.callback('✅ 予約確定', 'confirm_booking')],
                [Markup.button.callback('✏️ 内容を変更', 'edit_booking')],
                [Markup.button.callback('❌ キャンセル', 'back_to_main')]
            ]));
        } catch (error) {
            logger.error('ホテル選択エラー:', error);
            await ctx.reply('エラーが発生しました。もう一度お試しください。');
        }
    }

    /**
     * 予約確定
     */
    async confirmBooking(ctx) {
        try {
            const bookingData = ctx.session.bookingData;
            const telegramUser = ctx.from;

            // スケジューリングサービスを使用して予約作成
            const bookingRequest = {
                serviceId: bookingData.serviceId,
                hotelId: bookingData.hotelId,
                date: bookingData.date,
                startTime: bookingData.time,
                endTime: this.calculateEndTime(bookingData.time, bookingData.service.duration_minutes),
                totalPrice: bookingData.service.price,
                telegramChatId: ctx.chat.id.toString(),
                notes: `Telegram Bot経由予約 (${telegramUser.username || telegramUser.first_name})`
            };

            const booking = await this.schedulingService.createBooking(bookingRequest);
            const bookingCode = booking.booking_code;

            // セッションをリセット
            ctx.session.step = this.bookingSteps.COMPLETED;
            ctx.session.bookingData = {};

            const confirmationMessage = `
✅ 予約が完了しました！

📋 予約番号: ${bookingCode}
🎯 サービス: ${bookingData.service.name}
📅 日時: ${this.formatDateTime(bookingData.date, bookingData.time)}
🏨 ホテル: ${bookingData.hotel.name}
💰 料金: ¥${bookingData.service.price.toLocaleString()}

📞 ご質問やお困りのことがございましたら、いつでもメッセージでお気軽にお問い合わせください。

心よりお待ちしております 🌸
            `;

            await ctx.editMessageText(confirmationMessage, Markup.inlineKeyboard([
                [Markup.button.callback('📋 予約確認', 'check_booking')],
                [Markup.button.callback('🏠 メインメニュー', 'back_to_main')]
            ]));

            logger.info('Telegram予約完了:', {
                bookingId: booking.id,
                bookingCode,
                telegramUserId: telegramUser.id,
                serviceId: bookingData.serviceId
            });

        } catch (error) {
            logger.error('予約確定エラー:', error);
            await ctx.reply('予約の保存中にエラーが発生しました。お手数ですが、再度お試しいただくか、直接お電話でお問い合わせください。');
        }
    }

    /**
     * 予約状況確認
     */
    async showBookingStatus(ctx) {
        try {
            const chatId = ctx.chat.id;
            
            const bookings = await query(
                `SELECT b.*, s.name as service_name, h.name as hotel_name, h.area 
                 FROM bookings b
                 JOIN services s ON b.service_id = s.id
                 LEFT JOIN hotels h ON b.hotel_id = h.id
                 WHERE b.telegram_chat_id = ? 
                 ORDER BY b.booking_date DESC, b.start_time DESC
                 LIMIT 5`,
                [chatId]
            );

            if (bookings.length === 0) {
                const message = '現在、予約はありません。\n\n新しい予約をお取りしますか？';
                
                if (ctx.callbackQuery) {
                    await ctx.editMessageText(message, Markup.inlineKeyboard([
                        [Markup.button.callback('📅 新規予約', 'start_booking')],
                        [Markup.button.callback('🏠 メインメニュー', 'back_to_main')]
                    ]));
                } else {
                    await ctx.reply(message, Markup.inlineKeyboard([
                        [Markup.button.callback('📅 新規予約', 'start_booking')]
                    ]));
                }
                return;
            }

            let message = '📋 あなたの予約一覧\n\n';

            const buttons = [];
            bookings.forEach((booking, index) => {
                const statusIcon = this.getStatusIcon(booking.status);
                const dateTime = this.formatDateTime(booking.booking_date, booking.start_time);
                
                message += `${statusIcon} ${booking.booking_code}\n`;
                message += `${booking.service_name}\n`;
                message += `${dateTime}\n`;
                message += `${booking.hotel_name} (${booking.area})\n`;
                message += `¥${booking.total_price.toLocaleString()}\n\n`;

                if (booking.status === 'pending' || booking.status === 'confirmed') {
                    buttons.push([Markup.button.callback(
                        `❌ ${booking.booking_code}をキャンセル`, 
                        `cancel_booking_${booking.id}`
                    )]);
                }
            });

            buttons.push([Markup.button.callback('🏠 メインメニュー', 'back_to_main')]);

            if (ctx.callbackQuery) {
                await ctx.editMessageText(message, Markup.inlineKeyboard(buttons));
            } else {
                await ctx.reply(message, Markup.inlineKeyboard(buttons));
            }

        } catch (error) {
            logger.error('予約状況確認エラー:', error);
            await ctx.reply('予約情報の取得中にエラーが発生しました。');
        }
    }

    /**
     * Telegramユーザー情報を記録
     */
    async recordTelegramUser(user) {
        try {
            const existingUser = await queryOne(
                'SELECT id FROM users WHERE telegram_user_id = ?',
                [user.id]
            );

            if (!existingUser) {
                await query(
                    `INSERT INTO users (username, email, telegram_user_id, telegram_username, role) 
                     VALUES (?, ?, ?, ?, 'member')
                     ON DUPLICATE KEY UPDATE 
                     telegram_username = VALUES(telegram_username), 
                     updated_at = CURRENT_TIMESTAMP`,
                    [
                        user.username || `telegram_${user.id}`,
                        `telegram_${user.id}@temp.com`,
                        user.id,
                        user.username
                    ]
                );
            }
        } catch (error) {
            logger.error('Telegramユーザー記録エラー:', error);
        }
    }

    /**
     * ユーティリティメソッド
     */
    generateBookingCode() {
        const prefix = 'AM';
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.random().toString(36).slice(-3).toUpperCase();
        return `${prefix}${timestamp}${random}`;
    }

    getAvailableDates() {
        const dates = [];
        const today = new Date();
        
        for (let i = 0; i < 14; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            
            dates.push({
                value: date.toISOString().split('T')[0],
                display: i === 0 ? '今日' : i === 1 ? '明日' : 
                        `${date.getMonth() + 1}/${date.getDate()} (${this.getDayOfWeek(date)})`
            });
        }
        
        return dates;
    }

    async getAvailableTimes(date, serviceId = null) {
        try {
            // サービス時間を取得
            let durationMinutes = 60; // デフォルト60分
            if (serviceId) {
                const service = await queryOne(
                    'SELECT duration_minutes FROM services WHERE id = ?',
                    [serviceId]
                );
                if (service) {
                    durationMinutes = service.duration_minutes;
                }
            }

            // スケジューリングサービスから空き時間を取得
            const availableSlots = await this.schedulingService.getAvailableTimeSlots(
                date,
                durationMinutes
            );

            // Telegram用のフォーマットに変換
            return availableSlots.slice(0, 20).map(slot => ({
                value: slot.time,
                display: slot.displayTime || slot.time.substring(0, 5)
            }));

        } catch (error) {
            logger.error('利用可能時間取得エラー:', error);
            // フォールバック: 基本的な時間スロットを返す
            const times = [];
            const startHour = 10;
            const endHour = 22; // エラー時は22時まで
            
            for (let hour = startHour; hour < endHour; hour++) {
                const timeValue = `${hour.toString().padStart(2, '0')}:00:00`;
                const displayTime = `${hour.toString().padStart(2, '0')}:00`;
                
                times.push({
                    value: timeValue,
                    display: displayTime
                });
            }
            
            return times;
        }
    }

    calculateEndTime(startTime, durationMinutes) {
        const [hours, minutes] = startTime.split(':').map(Number);
        const startMinutes = hours * 60 + minutes;
        const endMinutes = startMinutes + durationMinutes;
        
        const endHours = Math.floor(endMinutes / 60) % 24;
        const endMins = endMinutes % 60;
        
        return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}:00`;
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        return `${date.getMonth() + 1}月${date.getDate()}日 (${this.getDayOfWeek(date)})`;
    }

    formatDateTime(dateStr, timeStr) {
        const date = new Date(dateStr);
        const [hours] = timeStr.split(':');
        const displayHour = parseInt(hours) >= 24 ? parseInt(hours) - 24 : parseInt(hours);
        
        return `${date.getMonth() + 1}月${date.getDate()}日 (${this.getDayOfWeek(date)}) ${displayHour}:00`;
    }

    getDayOfWeek(date) {
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        return days[date.getDay()];
    }

    getStatusIcon(status) {
        const icons = {
            'pending': '⏳',
            'confirmed': '✅',
            'completed': '💆',
            'cancelled': '❌'
        };
        return icons[status] || '❓';
    }

    showServiceInfo(ctx) {
        const message = `
ℹ️ サービス情報

🎯 提供サービス:
• リラクゼーションマッサージ (60分・90分)
• 韓国式アカスリ
• マッサージ＆アカスリセット

📍 対応エリア:
福岡市中洲・博多・天神エリア

💳 決済方法:
PayPay決済のみ

⏰ 営業時間:
10:00-03:00（最終受付 02:00）

🌸 心と体に愛を込めた癒しをお届けします
        `;

        if (ctx.callbackQuery) {
            ctx.editMessageText(message, Markup.inlineKeyboard([
                [Markup.button.callback('📅 予約する', 'start_booking')],
                [Markup.button.callback('🏠 メインメニュー', 'back_to_main')]
            ]));
        } else {
            ctx.reply(message);
        }
    }

    showContactInfo(ctx) {
        const message = `
📞 お問い合わせ

🤖 Telegram Bot: @AnalSenseiBot
📱 X (Twitter): @ainaru_massage

⏰ 営業時間: 10:00-03:00
📍 対応エリア: 福岡市中洲・博多・天神エリア

ご質問やご要望がございましたら、
いつでもメッセージでお気軽にお問い合わせください。

心よりお待ちしております 🌸
        `;

        if (ctx.callbackQuery) {
            ctx.editMessageText(message, Markup.inlineKeyboard([
                [Markup.button.callback('🏠 メインメニュー', 'back_to_main')]
            ]));
        } else {
            ctx.reply(message);
        }
    }

    /**
     * ボット起動
     */
    async start() {
        try {
            if (!this.bot) {
                throw new Error('ボットが初期化されていません');
            }

            await this.bot.launch();
            logger.info('Telegram Bot 起動完了');

            // Graceful shutdown
            process.once('SIGINT', () => this.bot.stop('SIGINT'));
            process.once('SIGTERM', () => this.bot.stop('SIGTERM'));

        } catch (error) {
            logger.error('Telegram Bot 起動エラー:', error);
            throw error;
        }
    }

    /**
     * ボット停止
     */
    async stop() {
        if (this.bot) {
            await this.bot.stop();
            logger.info('Telegram Bot 停止');
        }
    }
}

module.exports = TelegramBotService;