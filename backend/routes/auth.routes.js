/**
 * 認証ルート
 * Authentication routes for Ainaru Massage CMS
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const joi = require('joi');
const jwt = require('jsonwebtoken');
const { query, queryOne } = require('../config/database');
const { generateToken, generateRefreshToken, authenticateToken } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validator');
const { logger } = require('../utils/logger');
const { sendAuditLog } = require('../utils/auditLog');

const router = express.Router();

// バリデーションスキーマ
const registerSchema = joi.object({
    username: joi.string().alphanum().min(3).max(30).required(),
    email: joi.string().email().required(),
    password: joi.string().min(8).required(),
    role: joi.string().valid('member', 'therapist').default('member')
});

const loginSchema = joi.object({
    email: joi.string().email().required(),
    password: joi.string().required()
});

const changePasswordSchema = joi.object({
    currentPassword: joi.string().required(),
    newPassword: joi.string().min(8).required()
});

/**
 * ユーザー登録
 * POST /api/v1/auth/register
 */
router.post('/register', validateRequest(registerSchema), async (req, res) => {
    try {
        const { username, email, password, role } = req.body;

        // 既存ユーザーチェック
        const existingUser = await queryOne(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUser) {
            return res.status(409).json({
                error: 'Conflict',
                message: 'このユーザー名またはメールアドレスは既に使用されています'
            });
        }

        // パスワードハッシュ化
        const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 10);

        // ユーザー作成
        const result = await query(
            'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
            [username, email, hashedPassword, role]
        );

        const userId = result.insertId;

        // セラピストの場合は追加テーブルに登録
        if (role === 'therapist') {
            await query(
                'INSERT INTO therapists (user_id, display_name) VALUES (?, ?)',
                [userId, username]
            );
        }

        // 監査ログ
        await sendAuditLog(userId, 'user_register', 'users', userId, null, { username, email, role });

        // トークン生成
        const token = generateToken(userId);
        const refreshToken = generateRefreshToken(userId);

        logger.info(`新規ユーザー登録: ${username} (${email})`);

        res.status(201).json({
            message: 'ユーザー登録が完了しました',
            user: {
                id: userId,
                username,
                email,
                role
            },
            token,
            refreshToken
        });
    } catch (error) {
        logger.error('ユーザー登録エラー:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'ユーザー登録中にエラーが発生しました'
        });
    }
});

/**
 * ログイン
 * POST /api/v1/auth/login
 */
router.post('/login', validateRequest(loginSchema), async (req, res) => {
    try {
        const { email, password } = req.body;

        // ユーザー取得
        const user = await queryOne(
            'SELECT id, username, email, password_hash, role, member_tier, is_active FROM users WHERE email = ?',
            [email]
        );

        if (!user || !user.is_active) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'メールアドレスまたはパスワードが正しくありません'
            });
        }

        // パスワード検証
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'メールアドレスまたはパスワードが正しくありません'
            });
        }

        // 最終ログイン日時更新
        await query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
            [user.id]
        );

        // 監査ログ
        await sendAuditLog(user.id, 'user_login', 'users', user.id);

        // トークン生成
        const token = generateToken(user.id);
        const refreshToken = generateRefreshToken(user.id);

        logger.info(`ユーザーログイン: ${user.username} (${user.email})`);

        res.json({
            message: 'ログインに成功しました',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                memberTier: user.member_tier
            },
            token,
            refreshToken
        });
    } catch (error) {
        logger.error('ログインエラー:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'ログイン処理中にエラーが発生しました'
        });
    }
});

/**
 * ログアウト
 * POST /api/v1/auth/logout
 */
router.post('/logout', authenticateToken, async (req, res) => {
    try {
        // 監査ログ
        await sendAuditLog(req.user.id, 'user_logout', 'users', req.user.id);

        logger.info(`ユーザーログアウト: ${req.user.username}`);

        res.json({
            message: 'ログアウトしました'
        });
    } catch (error) {
        logger.error('ログアウトエラー:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'ログアウト処理中にエラーが発生しました'
        });
    }
});

/**
 * トークンリフレッシュ
 * POST /api/v1/auth/refresh
 */
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'リフレッシュトークンが必要です'
            });
        }

        // リフレッシュトークン検証
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
        
        if (decoded.type !== 'refresh') {
            return res.status(401).json({
                error: 'Unauthorized',
                message: '無効なリフレッシュトークンです'
            });
        }

        // 新しいトークン生成
        const token = generateToken(decoded.userId);
        const newRefreshToken = generateRefreshToken(decoded.userId);

        res.json({
            token,
            refreshToken: newRefreshToken
        });
    } catch (error) {
        logger.error('トークンリフレッシュエラー:', error);
        res.status(401).json({
            error: 'Unauthorized',
            message: '無効なリフレッシュトークンです'
        });
    }
});

/**
 * パスワード変更
 * POST /api/v1/auth/change-password
 */
router.post('/change-password', authenticateToken, validateRequest(changePasswordSchema), async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        // 現在のパスワードを確認
        const user = await queryOne(
            'SELECT password_hash FROM users WHERE id = ?',
            [userId]
        );

        const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: '現在のパスワードが正しくありません'
            });
        }

        // 新しいパスワードをハッシュ化
        const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 10);

        // パスワード更新
        await query(
            'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [hashedPassword, userId]
        );

        // 監査ログ
        await sendAuditLog(userId, 'password_change', 'users', userId);

        logger.info(`パスワード変更: ${req.user.username}`);

        res.json({
            message: 'パスワードを変更しました'
        });
    } catch (error) {
        logger.error('パスワード変更エラー:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'パスワード変更中にエラーが発生しました'
        });
    }
});

/**
 * 現在のユーザー情報取得
 * GET /api/v1/auth/me
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await queryOne(
            'SELECT id, username, email, role, member_tier, created_at, last_login FROM users WHERE id = ?',
            [req.user.id]
        );

        // セラピストの場合は追加情報を取得
        if (user.role === 'therapist') {
            const therapist = await queryOne(
                'SELECT * FROM therapists WHERE user_id = ?',
                [user.id]
            );
            user.therapistProfile = therapist;
        }

        res.json({
            user
        });
    } catch (error) {
        logger.error('ユーザー情報取得エラー:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'ユーザー情報の取得中にエラーが発生しました'
        });
    }
});

module.exports = router;