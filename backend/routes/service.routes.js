/**
 * サービスルート
 * Service routes for Ainaru Massage CMS
 */

const express = require('express');
const joi = require('joi');
const { query, queryOne } = require('../config/database');
const { authenticateToken, requireAdmin, optionalAuth } = require('../middleware/auth');
const { validateRequest, validateQuery, validateParams, commonSchemas } = require('../middleware/validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendAuditLog } = require('../utils/auditLog');

const router = express.Router();

// バリデーションスキーマ
const createServiceSchema = joi.object({
    name: joi.string().min(1).max(200).required(),
    description: joi.string().allow(''),
    category: joi.string().valid('massage', 'scrub', 'set').required(),
    duration_minutes: joi.number().integer().min(15).max(480).required(),
    price: joi.number().integer().min(0).required(),
    display_order: joi.number().integer().min(1).default(1),
    tags: joi.array().items(joi.string()).default([]),
    is_active: joi.boolean().default(true)
});

const updateServiceSchema = joi.object({
    name: joi.string().min(1).max(200),
    description: joi.string().allow(''),
    category: joi.string().valid('massage', 'scrub', 'set'),
    duration_minutes: joi.number().integer().min(15).max(480),
    price: joi.number().integer().min(0),
    display_order: joi.number().integer().min(1),
    tags: joi.array().items(joi.string()),
    is_active: joi.boolean()
});

const getServicesQuerySchema = joi.object({
    ...commonSchemas.pagination,
    category: joi.string().valid('massage', 'scrub', 'set'),
    is_active: joi.boolean(),
    search: joi.string().min(1).max(100),
    minPrice: joi.number().integer().min(0),
    maxPrice: joi.number().integer().min(0),
    minDuration: joi.number().integer().min(0),
    maxDuration: joi.number().integer().min(0)
});

/**
 * サービス一覧取得
 * GET /api/v1/services
 */
router.get('/',
    optionalAuth,
    validateQuery(getServicesQuerySchema),
    asyncHandler(async (req, res) => {
        const { 
            page, limit, sort, sortBy, 
            categoryId, featured, active, search, 
            minPrice, maxPrice, minDuration, maxDuration 
        } = req.query;

        let whereClause = 'WHERE 1=1';
        const params = [];

        // 一般ユーザーはアクティブなサービスのみ表示
        if (!req.user || req.user.role !== 'admin') {
            whereClause += ' AND s.is_active = TRUE';
        } else if (active !== undefined) {
            whereClause += ' AND s.is_active = ?';
            params.push(active);
        }

        if (categoryId) {
            whereClause += ' AND s.category_id = ?';
            params.push(categoryId);
        }

        if (featured !== undefined) {
            whereClause += ' AND s.is_featured = ?';
            params.push(featured);
        }

        if (search) {
            whereClause += ' AND (s.name LIKE ? OR s.description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        if (minPrice !== undefined) {
            whereClause += ' AND s.price >= ?';
            params.push(minPrice);
        }

        if (maxPrice !== undefined) {
            whereClause += ' AND s.price <= ?';
            params.push(maxPrice);
        }

        if (minDuration !== undefined) {
            whereClause += ' AND s.duration_minutes >= ?';
            params.push(minDuration);
        }

        if (maxDuration !== undefined) {
            whereClause += ' AND s.duration_minutes <= ?';
            params.push(maxDuration);
        }

        // 総件数取得
        const totalResult = await query(
            `SELECT COUNT(*) as total 
             FROM services s 
             JOIN service_categories sc ON s.category_id = sc.id 
             ${whereClause}`,
            params
        );
        const total = totalResult[0].total;

        // データ取得
        const offset = (page - 1) * limit;
        const services = await query(
            `SELECT 
                s.*,
                sc.name as category_name,
                sc.slug as category_slug
             FROM services s
             JOIN service_categories sc ON s.category_id = sc.id
             ${whereClause}
             ORDER BY s.${sortBy} ${sort}
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        // JSONフィールドをパース
        const parsedServices = services.map(service => ({
            ...service,
            tags: service.tags ? JSON.parse(service.tags) : []
        }));

        res.json({
            services: parsedServices,
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
 * サービス詳細取得
 * GET /api/v1/services/:id
 */
router.get('/:id',
    optionalAuth,
    validateParams(joi.object({ id: commonSchemas.id })),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        let whereClause = 'WHERE s.id = ?';
        const params = [id];

        // 一般ユーザーはアクティブなサービスのみ表示
        if (!req.user || req.user.role !== 'admin') {
            whereClause += ' AND s.is_active = TRUE';
        }

        const service = await queryOne(
            `SELECT 
                s.*,
                sc.name as category_name,
                sc.slug as category_slug,
                sc.description as category_description
             FROM services s
             JOIN service_categories sc ON s.category_id = sc.id
             ${whereClause}`,
            params
        );

        if (!service) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'サービスが見つかりません'
            });
        }

        // JSONフィールドをパース
        service.tags = service.tags ? JSON.parse(service.tags) : [];

        res.json({ service });
    })
);

/**
 * サービス作成（管理者のみ）
 * POST /api/v1/services
 */
router.post('/',
    authenticateToken,
    requireAdmin,
    validateRequest(createServiceSchema),
    asyncHandler(async (req, res) => {
        const serviceData = req.body;

        // スラグの重複チェック
        const existingService = await queryOne(
            'SELECT id FROM services WHERE slug = ?',
            [serviceData.slug]
        );

        if (existingService) {
            return res.status(409).json({
                error: 'Conflict',
                message: 'このスラグは既に使用されています'
            });
        }

        // カテゴリの存在チェック
        const category = await queryOne(
            'SELECT id FROM service_categories WHERE id = ? AND is_active = TRUE',
            [serviceData.categoryId]
        );

        if (!category) {
            return res.status(400).json({
                error: 'Bad Request',
                message: '指定されたカテゴリが見つかりません'
            });
        }

        const result = await query(
            `INSERT INTO services 
             (category_id, name, slug, description, duration_minutes, price, tags, is_featured, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                serviceData.categoryId,
                serviceData.name,
                serviceData.slug,
                serviceData.description || '',
                serviceData.durationMinutes,
                serviceData.price,
                JSON.stringify(serviceData.tags),
                serviceData.isFeatured,
                serviceData.isActive
            ]
        );

        const serviceId = result.insertId;

        // 監査ログ
        await sendAuditLog(req.user.id, 'service_create', 'services', serviceId, null, serviceData);

        // 作成されたサービスを取得
        const newService = await queryOne(
            `SELECT 
                s.*,
                sc.name as category_name,
                sc.slug as category_slug
             FROM services s
             JOIN service_categories sc ON s.category_id = sc.id
             WHERE s.id = ?`,
            [serviceId]
        );

        newService.tags = JSON.parse(newService.tags);

        res.status(201).json({
            message: 'サービスを作成しました',
            service: newService
        });
    })
);

/**
 * サービス更新（管理者のみ）
 * PUT /api/v1/services/:id
 */
router.put('/:id',
    authenticateToken,
    requireAdmin,
    validateParams(joi.object({ id: commonSchemas.id })),
    validateRequest(updateServiceSchema),
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const updates = req.body;

        // 既存サービス取得
        const existingService = await queryOne(
            'SELECT * FROM services WHERE id = ?',
            [id]
        );

        if (!existingService) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'サービスが見つかりません'
            });
        }

        // スラグの重複チェック（自分以外）
        if (updates.slug) {
            const duplicateSlug = await queryOne(
                'SELECT id FROM services WHERE slug = ? AND id != ?',
                [updates.slug, id]
            );

            if (duplicateSlug) {
                return res.status(409).json({
                    error: 'Conflict',
                    message: 'このスラグは既に使用されています'
                });
            }
        }

        // カテゴリの存在チェック
        if (updates.categoryId) {
            const category = await queryOne(
                'SELECT id FROM service_categories WHERE id = ? AND is_active = TRUE',
                [updates.categoryId]
            );

            if (!category) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: '指定されたカテゴリが見つかりません'
                });
            }
        }

        // 更新フィールド構築
        const updateFields = [];
        const updateValues = [];

        Object.keys(updates).forEach(key => {
            if (key === 'categoryId') {
                updateFields.push('category_id = ?');
                updateValues.push(updates[key]);
            } else if (key === 'durationMinutes') {
                updateFields.push('duration_minutes = ?');
                updateValues.push(updates[key]);
            } else if (key === 'isFeatured') {
                updateFields.push('is_featured = ?');
                updateValues.push(updates[key]);
            } else if (key === 'isActive') {
                updateFields.push('is_active = ?');
                updateValues.push(updates[key]);
            } else if (key === 'tags') {
                updateFields.push('tags = ?');
                updateValues.push(JSON.stringify(updates[key]));
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
            `UPDATE services SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );

        // 監査ログ
        await sendAuditLog(req.user.id, 'service_update', 'services', id, existingService, updates);

        // 更新後のデータを取得
        const updatedService = await queryOne(
            `SELECT 
                s.*,
                sc.name as category_name,
                sc.slug as category_slug
             FROM services s
             JOIN service_categories sc ON s.category_id = sc.id
             WHERE s.id = ?`,
            [id]
        );

        updatedService.tags = JSON.parse(updatedService.tags);

        res.json({
            message: 'サービスを更新しました',
            service: updatedService
        });
    })
);

/**
 * サービス削除（管理者のみ）
 * DELETE /api/v1/services/:id
 */
router.delete('/:id',
    authenticateToken,
    requireAdmin,
    validateParams(joi.object({ id: commonSchemas.id })),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        const service = await queryOne(
            'SELECT * FROM services WHERE id = ?',
            [id]
        );

        if (!service) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'サービスが見つかりません'
            });
        }

        // 予約の確認
        const bookingCount = await queryOne(
            'SELECT COUNT(*) as count FROM bookings WHERE service_id = ?',
            [id]
        );

        if (bookingCount.count > 0) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'このサービスには予約が存在するため削除できません'
            });
        }

        await query('DELETE FROM services WHERE id = ?', [id]);

        // 監査ログ
        await sendAuditLog(req.user.id, 'service_delete', 'services', id, service, null);

        res.json({
            message: 'サービスを削除しました'
        });
    })
);

module.exports = router;