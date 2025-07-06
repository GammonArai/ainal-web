/**
 * エラーハンドリングミドルウェア
 * Error handling middleware for Ainaru Massage CMS
 */

const { logger } = require('../utils/logger');

/**
 * エラーハンドラー
 */
function errorHandler(err, req, res, next) {
    // リクエスト情報をログに記録
    logger.error('エラーが発生しました:', {
        error: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        user: req.user ? req.user.id : 'anonymous'
    });

    // デフォルトエラーレスポンス
    let statusCode = 500;
    let errorResponse = {
        error: 'Internal Server Error',
        message: 'サーバー内部でエラーが発生しました'
    };

    // エラータイプ別の処理
    if (err.name === 'ValidationError') {
        statusCode = 400;
        errorResponse = {
            error: 'Validation Error',
            message: 'リクエストデータが無効です',
            details: err.details
        };
    } else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
        errorResponse = {
            error: 'Unauthorized',
            message: '認証が必要です'
        };
    } else if (err.name === 'ForbiddenError') {
        statusCode = 403;
        errorResponse = {
            error: 'Forbidden',
            message: 'アクセス権限がありません'
        };
    } else if (err.name === 'NotFoundError') {
        statusCode = 404;
        errorResponse = {
            error: 'Not Found',
            message: 'リソースが見つかりません'
        };
    } else if (err.name === 'ConflictError') {
        statusCode = 409;
        errorResponse = {
            error: 'Conflict',
            message: 'リソースが競合しています'
        };
    } else if (err.code === 'ER_DUP_ENTRY') {
        statusCode = 409;
        errorResponse = {
            error: 'Duplicate Entry',
            message: '既に存在するデータです'
        };
    } else if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        statusCode = 400;
        errorResponse = {
            error: 'Invalid Reference',
            message: '参照先のデータが存在しません'
        };
    } else if (err.code === 'LIMIT_FILE_SIZE') {
        statusCode = 413;
        errorResponse = {
            error: 'File Too Large',
            message: 'ファイルサイズが制限を超えています'
        };
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        statusCode = 400;
        errorResponse = {
            error: 'Invalid File',
            message: '無効なファイルです'
        };
    }

    // 開発環境ではスタックトレースを含める
    if (process.env.NODE_ENV === 'development') {
        errorResponse.stack = err.stack;
    }

    res.status(statusCode).json(errorResponse);
}

/**
 * 非同期エラーをキャッチするラッパー
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * カスタムエラークラス
 */
class CustomError extends Error {
    constructor(message, statusCode = 500, name = 'CustomError') {
        super(message);
        this.name = name;
        this.statusCode = statusCode;
    }
}

class ValidationError extends CustomError {
    constructor(message, details = []) {
        super(message, 400, 'ValidationError');
        this.details = details;
    }
}

class UnauthorizedError extends CustomError {
    constructor(message = '認証が必要です') {
        super(message, 401, 'UnauthorizedError');
    }
}

class ForbiddenError extends CustomError {
    constructor(message = 'アクセス権限がありません') {
        super(message, 403, 'ForbiddenError');
    }
}

class NotFoundError extends CustomError {
    constructor(message = 'リソースが見つかりません') {
        super(message, 404, 'NotFoundError');
    }
}

class ConflictError extends CustomError {
    constructor(message = 'リソースが競合しています') {
        super(message, 409, 'ConflictError');
    }
}

module.exports = {
    errorHandler,
    asyncHandler,
    CustomError,
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError
};