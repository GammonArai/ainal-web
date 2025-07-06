/**
 * ユーザールート
 * User routes for Ainaru Massage CMS
 */

const express = require('express');
const joi = require('joi');
const { query, queryOne } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validateRequest, validateQuery, validateParams, commonSchemas } = require('../middleware/validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendAuditLog } = require('../utils/auditLog');

const router = express.Router();

// バリデーションスキーマ
const updateProfileSchema = joi.object({
    username: joi.string().alphanum().min(3).max(30),
    email: joi.string().email(),
    memberTier: joi.string().valid('bronze', 'silver', 'gold')
});

const getUsersQuerySchema = joi.object({
    ...commonSchemas.pagination,
    role: joi.string().valid('admin', 'therapist', 'member'),
    search: joi.string().min(1).max(100)
});

/**
 * ユーザー一覧取得（管理者のみ）
 * GET /api/v1/users
 */
router.get('/', 
    authenticateToken, 
    requireAdmin, 
    validateQuery(getUsersQuerySchema),
    asyncHandler(async (req, res) => {
        const { page, limit, sort, sortBy, role, search } = req.query;

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (role) {
            whereClause += ' AND role = ?';
            params.push(role);
        }

        if (search) {
            whereClause += ' AND (username LIKE ? OR email LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        // 総件数取得
        const totalResult = await query(
            `SELECT COUNT(*) as total FROM users ${whereClause}`,
            params
        );
        const total = totalResult[0].total;

        // データ取得
        const offset = (page - 1) * limit;
        const users = await query(
            `SELECT 
                id, username, email, role, member_tier, 
                is_active, created_at, last_login
             FROM users 
             ${whereClause}
             ORDER BY ${sortBy} ${sort}
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        res.json({
            users,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    })
);

/**
 * ユーザー詳細取得
 * GET /api/v1/users/:id
 */
router.get('/:id',
    authenticateToken,
    validateParams(joi.object({ id: commonSchemas.id })),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        // 管理者以外は自分の情報のみ取得可能
        if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: '他のユーザーの情報にはアクセスできません'
            });
        }

        const user = await queryOne(
            `SELECT 
                id, username, email, role, member_tier, 
                is_active, created_at, last_login
             FROM users 
             WHERE id = ?`,
            [id]
        );

        if (!user) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'ユーザーが見つかりません'
            });
        }

        // セラピストの場合は追加情報を取得
        if (user.role === 'therapist') {
            const therapist = await queryOne(
                'SELECT * FROM therapists WHERE user_id = ?',
                [user.id]
            );
            user.therapistProfile = therapist;
        }

        res.json({ user });
    })
);

/**
 * プロフィール更新
 * PUT /api/v1/users/:id
 */
router.put('/:id',
    authenticateToken,
    validateParams(joi.object({ id: commonSchemas.id })),
    validateRequest(updateProfileSchema),
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const updates = req.body;

        // 管理者以外は自分の情報のみ更新可能
        if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: '他のユーザーの情報は更新できません'
            });
        }

        // 既存データ取得
        const existingUser = await queryOne(
            'SELECT * FROM users WHERE id = ?',
            [id]
        );

        if (!existingUser) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'ユーザーが見つかりません'
            });
        }

        // 更新フィールド構築
        const updateFields = [];
        const updateValues = [];

        Object.keys(updates).forEach(key => {
            if (key === 'memberTier') {
                updateFields.push('member_tier = ?');
                updateValues.push(updates[key]);
            } else if (updates[key] !== undefined) {
                updateFields.push(`${key} = ?`);
                updateValues.push(updates[key]);
            }
        });

        if (updateFields.length === 0) {
            return res.status(400).json({
                error: 'Bad Request',
                message: '更新するフィールドがありません'
            });
        }

        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateValues.push(id);

        await query(
            `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );

        // 監査ログ
        await sendAuditLog(req.user.id, 'user_update', 'users', id, existingUser, updates);

        // 更新後のデータを取得
        const updatedUser = await queryOne(
            `SELECT 
                id, username, email, role, member_tier, 
                is_active, created_at, updated_at, last_login
             FROM users 
             WHERE id = ?`,
            [id]
        );

        res.json({
            message: 'プロフィールを更新しました',
            user: updatedUser
        });
    })
);

/**
 * ユーザーのアクティブ状態切り替え（管理者のみ）
 * PATCH /api/v1/users/:id/toggle-active
 */
router.patch('/:id/toggle-active',
    authenticateToken,
    requireAdmin,
    validateParams(joi.object({ id: commonSchemas.id })),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        const user = await queryOne(
            'SELECT id, username, is_active FROM users WHERE id = ?',
            [id]
        );

        if (!user) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'ユーザーが見つかりません'
            });
        }

        const newStatus = !user.is_active;

        await query(
            'UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [newStatus, id]
        );

        // 監査ログ
        await sendAuditLog(
            req.user.id, 
            'user_toggle_active', 
            'users', 
            id, 
            { is_active: user.is_active }, 
            { is_active: newStatus }
        );

        res.json({
            message: `ユーザー「${user.username}」を${newStatus ? '有効' : '無効'}にしました`,
            isActive: newStatus
        });
    })
);

module.exports = router;