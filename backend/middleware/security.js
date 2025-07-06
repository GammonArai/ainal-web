/**
 * セキュリティミドルウェア集約
 * Centralized security middleware for Ainaru Massage API
 */

const rateLimit = require('express-rate-limit');
const { logger } = require('../utils/logger');
const crypto = require('crypto');

/**
 * IPアドレス取得（プロキシ対応）
 */
function getClientIP(req) {
    return req.headers['x-forwarded-for'] || 
           req.headers['x-real-ip'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null);
}

/**
 * セキュリティヘッダー設定
 */
function securityHeaders(req, res, next) {
    // X-Request-ID for tracking
    req.requestId = crypto.randomUUID();
    res.setHeader('X-Request-ID', req.requestId);
    
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // Remove server identification
    res.removeHeader('X-Powered-By');
    
    next();
}

/**
 * API専用レート制限
 */
const createAPILimiter = (options = {}) => {
    const defaults = {
        windowMs: 15 * 60 * 1000, // 15分
        max: 100, // リクエスト数
        message: {
            error: 'Rate Limit Exceeded',
            message: 'リクエスト数が制限を超えました。しばらくしてから再度お試しください。',
            retryAfter: Math.ceil(options.windowMs / 1000) || 900
        },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            const clientIP = getClientIP(req);
            logger.warn(`Rate limit exceeded for IP: ${clientIP}, Path: ${req.path}`, {
                ip: clientIP,
                path: req.path,
                userAgent: req.get('User-Agent'),
                requestId: req.requestId
            });
            
            res.status(429).json(options.message || defaults.message);
        }
    };

    return rateLimit({ ...defaults, ...options });
};

/**
 * 認証試行用厳重なレート制限
 */
const authLimiter = createAPILimiter({
    windowMs: 15 * 60 * 1000, // 15分
    max: 5, // 最大5回
    message: {
        error: 'Auth Rate Limit Exceeded',
        message: '認証の試行回数が制限を超えました。15分後に再度お試しください。',
        retryAfter: 900
    },
    skipSuccessfulRequests: true // 成功したリクエストはカウントしない
});

/**
 * 管理者API用レート制限
 */
const adminLimiter = createAPILimiter({
    windowMs: 5 * 60 * 1000, // 5分
    max: 50, // 最大50回
    message: {
        error: 'Admin Rate Limit Exceeded',
        message: '管理者APIの利用制限を超えました。しばらくしてから再度お試しください。',
        retryAfter: 300
    }
});

/**
 * Telegram Webhook用レート制限
 */
const telegramLimiter = createAPILimiter({
    windowMs: 1 * 60 * 1000, // 1分
    max: 30, // 最大30回
    message: {
        error: 'Telegram Rate Limit Exceeded',
        message: 'Telegram APIの利用制限を超えました。',
        retryAfter: 60
    }
});

/**
 * ファイルアップロード用レート制限
 */
const uploadLimiter = createAPILimiter({
    windowMs: 60 * 60 * 1000, // 1時間
    max: 10, // 最大10回
    message: {
        error: 'Upload Rate Limit Exceeded',
        message: 'ファイルアップロードの制限を超えました。1時間後に再度お試しください。',
        retryAfter: 3600
    }
});

/**
 * リクエスト検証
 */
function validateRequest(req, res, next) {
    // Content-Type検証（POST/PUT/PATCHの場合）
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const contentType = req.get('Content-Type');
        if (!contentType || (!contentType.includes('application/json') && !contentType.includes('multipart/form-data'))) {
            return res.status(400).json({
                error: 'Invalid Content-Type',
                message: '無効なContent-Typeです。'
            });
        }
    }

    // Request body size validation
    const contentLength = parseInt(req.get('Content-Length') || '0');
    if (contentLength > 10 * 1024 * 1024) { // 10MB
        return res.status(413).json({
            error: 'Payload Too Large',
            message: 'リクエストサイズが大きすぎます。'
        });
    }

    next();
}

/**
 * セキュリティログ
 */
function securityLogger(req, res, next) {
    const startTime = Date.now();
    const clientIP = getClientIP(req);
    
    // リクエスト開始ログ
    logger.info('Request started', {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        ip: clientIP,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
    });

    // レスポンス完了時のログ
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
        
        logger[logLevel]('Request completed', {
            requestId: req.requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: clientIP,
            timestamp: new Date().toISOString()
        });
    });

    next();
}

/**
 * 不審なアクティビティ検出
 */
function detectSuspiciousActivity(req, res, next) {
    const clientIP = getClientIP(req);
    const userAgent = req.get('User-Agent') || '';
    const path = req.path;

    // Bot検出パターン
    const suspiciousBots = [
        /bot/i, /crawler/i, /spider/i, /scraper/i,
        /curl/i, /wget/i, /python/i, /php/i
    ];

    // 不審なパス
    const suspiciousPaths = [
        /\.(php|asp|jsp)$/, /\/wp-/, /\/admin\//, 
        /\/phpmyadmin/, /\/config/, /\/_/
    ];

    // User-Agentチェック
    if (suspiciousBots.some(pattern => pattern.test(userAgent))) {
        logger.warn('Suspicious bot detected', {
            ip: clientIP,
            userAgent: userAgent,
            path: path,
            requestId: req.requestId
        });
    }

    // パスチェック
    if (suspiciousPaths.some(pattern => pattern.test(path))) {
        logger.warn('Suspicious path access', {
            ip: clientIP,
            path: path,
            userAgent: userAgent,
            requestId: req.requestId
        });
        
        return res.status(404).json({
            error: 'Not Found',
            message: 'リソースが見つかりません。'
        });
    }

    next();
}

module.exports = {
    securityHeaders,
    createAPILimiter,
    authLimiter,
    adminLimiter,
    telegramLimiter,
    uploadLimiter,
    validateRequest,
    securityLogger,
    detectSuspiciousActivity,
    getClientIP
};