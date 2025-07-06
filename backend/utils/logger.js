/**
 * ログユーティリティ
 * Logger utility for Ainaru Massage CMS
 */

const winston = require('winston');
const path = require('path');

// ログレベル
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6
};

// カラー設定
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    verbose: 'white',
    debug: 'blue',
    silly: 'grey'
};

winston.addColors(colors);

// ログフォーマット
const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// コンソール用フォーマット
const consoleFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`
    )
);

// トランスポート設定
const transports = [];

// コンソール出力
transports.push(
    new winston.transports.Console({
        format: consoleFormat,
        level: process.env.LOG_LEVEL || 'info'
    })
);

// ファイル出力（本番環境）
if (process.env.NODE_ENV === 'production') {
    const logDir = path.join(__dirname, '../logs');
    
    // エラーログ
    transports.push(
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            format: format,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        })
    );

    // 結合ログ
    transports.push(
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            format: format,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        })
    );
}

// ロガー作成
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    levels,
    format,
    transports,
    exitOnError: false
});

// 開発環境での詳細ログ
if (process.env.NODE_ENV === 'development') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

// ログヘルパー関数
const logHelpers = {
    /**
     * API リクエストログ
     */
    logRequest: (req, res, responseTime) => {
        logger.http(`${req.method} ${req.originalUrl}`, {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            responseTime: `${responseTime}ms`,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            user: req.user ? req.user.id : 'anonymous'
        });
    },

    /**
     * データベースクエリログ
     */
    logQuery: (query, params, executionTime) => {
        logger.debug('Database Query', {
            query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
            params,
            executionTime: `${executionTime}ms`
        });
    },

    /**
     * セキュリティイベントログ
     */
    logSecurity: (event, details) => {
        logger.warn(`Security Event: ${event}`, details);
    },

    /**
     * ビジネスロジックログ
     */
    logBusiness: (action, details) => {
        logger.info(`Business Action: ${action}`, details);
    }
};

module.exports = {
    logger,
    ...logHelpers
};