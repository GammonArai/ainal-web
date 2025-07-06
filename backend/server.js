/**
 * 愛なるマッサージ バックエンドサーバー
 * Backend server for Ainaru Massage CMS
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { initializeDatabase, closeDatabase } = require('./config/database');
const { errorHandler } = require('./middleware/errorHandler');
const { logger } = require('./utils/logger');
const TelegramBotService = require('./services/telegramBot');

// セキュリティミドルウェアのインポート
const { 
    securityHeaders, 
    validateRequest, 
    securityLogger, 
    detectSuspiciousActivity 
} = require('./middleware/security');
const { checkEncryptionSetup } = require('./middleware/dataEncryption');
const { initializeUploadDirectories } = require('./middleware/upload');

// ルートのインポート
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const serviceRoutes = require('./routes/service.routes');
const bookingRoutes = require('./routes/booking.routes');
const therapistRoutes = require('./routes/therapist.routes');
const hotelRoutes = require('./routes/hotel.routes');
const adminRoutes = require('./routes/admin.routes');
const paymentRoutes = require('./routes/payment.routes');
const uploadRoutes = require('./routes/upload.routes');

const app = express();
const PORT = process.env.PORT || 3000;
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

// セキュリティミドルウェア
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            connectSrc: ["'self'", "https://api.telegram.org"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// CORS設定
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:8000',
    credentials: true,
    optionsSuccessStatus: 200
}));

// リクエストログ
app.use(morgan('combined', {
    stream: { write: message => logger.info(message.trim()) }
}));

// レート制限 - 一般的なAPI用
const generalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
        error: 'Too Many Requests',
        message: 'リクエスト数が制限を超えました。しばらくしてから再度お試しください。',
        retryAfter: 900
    },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(generalLimiter);

// 認証用の厳しいレート制限
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分
    max: 5, // 最大5回の試行
    message: {
        error: 'Auth Rate Limit Exceeded',
        message: '認証の試行回数が制限を超えました。15分後に再度お試しください。',
        retryAfter: 900
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true
});

// セキュリティミドルウェア適用
app.use(securityHeaders);
app.use(securityLogger);
app.use(detectSuspiciousActivity);
app.use(validateRequest);

// ボディパーサー
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静的ファイル
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'Ainaru Massage API',
        version: '1.0.0'
    });
});

// APIルート（セキュリティ適用）
app.use(`${API_PREFIX}/auth`, authLimiter, authRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/services`, serviceRoutes);
app.use(`${API_PREFIX}/bookings`, bookingRoutes);
app.use(`${API_PREFIX}/therapists`, therapistRoutes);
app.use(`${API_PREFIX}/hotels`, hotelRoutes);
app.use(`${API_PREFIX}/admin`, adminRoutes);
app.use(`${API_PREFIX}/payments`, paymentRoutes);
app.use(`${API_PREFIX}/upload`, uploadRoutes);

// 404ハンドラー
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'リクエストされたリソースが見つかりません',
        path: req.originalUrl
    });
});

// エラーハンドラー
app.use(errorHandler);

// サーバー起動
async function startServer() {
    let telegramBot;
    
    try {
        // セキュリティ設定チェック
        checkEncryptionSetup();
        logger.info('セキュリティ設定確認完了');
        
        // データベース初期化
        await initializeDatabase();
        logger.info('データベース接続完了');
        
        // アップロードディレクトリ初期化
        await initializeUploadDirectories();
        logger.info('アップロードディレクトリ初期化完了');

        // Telegram Bot初期化
        if (process.env.TELEGRAM_BOT_TOKEN) {
            telegramBot = new TelegramBotService();
            await telegramBot.initialize();
            await telegramBot.start();
            logger.info('Telegram Bot起動完了');
        } else {
            logger.warn('TELEGRAM_BOT_TOKEN が設定されていません。Telegram Botは無効です。');
        }

        // サーバー起動
        app.listen(PORT, () => {
            logger.info(`サーバー起動完了: http://localhost:${PORT}`);
            logger.info(`API エンドポイント: http://localhost:${PORT}${API_PREFIX}`);
            console.log(`
╔═══════════════════════════════════════════╗
║      愛なるマッサージ API サーバー        ║
║                                           ║
║  Status: ✅ Running                       ║
║  Port: ${PORT}                              ║
║  API: ${API_PREFIX}                          ║
║  Telegram Bot: ${telegramBot ? '✅' : '❌'}                 ║
║  Environment: ${process.env.NODE_ENV || 'development'}               ║
╚═══════════════════════════════════════════╝
            `);
        });

        // Graceful shutdown
        const gracefulShutdown = async (signal) => {
            logger.info(`${signal} signal received: closing servers`);
            
            if (telegramBot) {
                await telegramBot.stop();
            }
            
            await closeDatabase();
            process.exit(0);
        };

        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);

    } catch (error) {
        logger.error('サーバー起動エラー:', error);
        if (telegramBot) {
            await telegramBot.stop();
        }
        process.exit(1);
    }
}

// 未処理の例外とPromiseのリジェクション
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// サーバー起動
startServer();