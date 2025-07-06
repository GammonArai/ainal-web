/**
 * 認証ミドルウェア
 * Authentication middleware for Ainaru Massage CMS
 */

const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { logger } = require('../utils/logger');

/**
 * JWTトークンを検証
 */
async function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: '認証トークンが必要です'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // ユーザー情報を取得
        const user = await query(
            'SELECT id, username, email, role FROM users WHERE id = ? AND is_active = TRUE',
            [decoded.userId]
        );

        if (!user || user.length === 0) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: '無効な認証トークンです'
            });
        }

        req.user = user[0];
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token Expired',
                message: '認証トークンの有効期限が切れています'
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Invalid Token',
                message: '無効な認証トークンです'
            });
        }

        logger.error('認証エラー:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: '認証処理中にエラーが発生しました'
        });
    }
}

/**
 * 管理者権限をチェック
 */
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            error: 'Forbidden',
            message: '管理者権限が必要です'
        });
    }
    next();
}

/**
 * セラピスト権限をチェック
 */
function requireTherapist(req, res, next) {
    if (!req.user || (req.user.role !== 'therapist' && req.user.role !== 'admin')) {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'セラピスト権限が必要です'
        });
    }
    next();
}

/**
 * 会員権限をチェック
 */
function requireMember(req, res, next) {
    if (!req.user) {
        return res.status(403).json({
            error: 'Forbidden',
            message: '会員権限が必要です'
        });
    }
    next();
}

/**
 * オプショナル認証（ログインしていなくてもアクセス可能）
 */
async function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            req.user = null;
            return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const user = await query(
            'SELECT id, username, email, role FROM users WHERE id = ? AND is_active = TRUE',
            [decoded.userId]
        );

        req.user = user && user.length > 0 ? user[0] : null;
        next();
    } catch (error) {
        req.user = null;
        next();
    }
}

/**
 * JWTトークンを生成
 */
function generateToken(userId, expiresIn = process.env.JWT_EXPIRES_IN || '7d') {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn }
    );
}

/**
 * リフレッシュトークンを生成
 */
function generateRefreshToken(userId) {
    return jwt.sign(
        { userId, type: 'refresh' },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );
}

module.exports = {
    authenticateToken,
    requireAdmin,
    requireTherapist,
    requireMember,
    optionalAuth,
    generateToken,
    generateRefreshToken
};