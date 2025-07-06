/**
 * 決済ルート
 * Payment routes for PayPay integration - Ainaru Massage CMS
 */

const express = require('express');
const joi = require('joi');
const { query, queryOne } = require('../config/database');
const { authenticateToken, requireAdmin, optionalAuth } = require('../middleware/auth');
const { validateRequest, validateQuery, validateParams, commonSchemas } = require('../middleware/validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendAuditLog } = require('../utils/auditLog');
const PaymentService = require('../services/paymentService');

const router = express.Router();
const paymentService = new PaymentService();

// バリデーションスキーマ
const createPaymentSchema = joi.object({
    bookingId: joi.number().integer().positive().required(),
    userAgent: joi.string().max(200),
    returnUrl: joi.string().uri().max(500),
    metadata: joi.object()
});

const paymentStatusSchema = joi.object({
    paymentId: joi.string().pattern(/^PAY\d+[A-F0-9]+$/).required()
});

const cancelPaymentSchema = joi.object({
    reason: joi.string().max(200)
});

const paymentHistorySchema = joi.object({
    ...commonSchemas.pagination,
    status: joi.string().valid('pending', 'processing', 'completed', 'cancelled', 'failed'),
    startDate: joi.date().iso(),
    endDate: joi.date().iso(),
    bookingId: joi.number().integer().positive()
});

/**
 * 決済リクエスト作成
 * POST /api/v1/payments/create
 */
router.post('/create',
    optionalAuth,
    validateRequest(createPaymentSchema),
    asyncHandler(async (req, res) => {
        const { bookingId, userAgent, returnUrl, metadata } = req.body;

        // 予約データを取得
        let whereClause = 'WHERE b.id = ? AND b.payment_status IN ("pending", "failed")';
        const params = [bookingId];

        // 権限チェック（ログインユーザーの場合）
        if (req.user) {
            if (req.user.role === 'member') {
                whereClause += ' AND b.user_id = ?';
                params.push(req.user.id);
            }
        }

        const booking = await queryOne(
            `SELECT b.*, s.name as service_name, s.duration_minutes,
                    h.name as hotel_name, h.area as hotel_area
             FROM bookings b
             LEFT JOIN services s ON b.service_id = s.id
             LEFT JOIN hotels h ON b.hotel_id = h.id
             ${whereClause}`,
            params
        );

        if (!booking) {
            return res.status(404).json({
                error: 'Not Found',
                message: '決済対象の予約が見つかりません'
            });
        }

        // 重複決済チェック
        const existingPayment = await queryOne(
            'SELECT * FROM payments WHERE booking_id = ? AND status IN ("pending", "processing", "completed")',
            [bookingId]
        );

        if (existingPayment) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'この予約は既に決済処理中または完了済みです',
                existingPaymentId: existingPayment.payment_id
            });
        }

        // 決済リクエスト作成
        const paymentData = {
            userAgent,
            returnUrl,
            metadata
        };

        const result = await paymentService.createPaymentRequest(booking, paymentData);

        // 監査ログ
        if (req.user) {
            await sendAuditLog(
                req.user.id, 
                'payment_created', 
                'payments', 
                null, 
                null, 
                { bookingId, paymentId: result.paymentId }
            );
        }

        res.status(201).json({
            message: '決済リクエストを作成しました',
            ...result
        });
    })
);

/**
 * 決済ステータス確認
 * GET /api/v1/payments/status/:paymentId
 */
router.get('/status/:paymentId',
    optionalAuth,
    validateParams(paymentStatusSchema),
    asyncHandler(async (req, res) => {
        const { paymentId } = req.params;

        // 権限チェック（ログインユーザーの場合）
        if (req.user && req.user.role === 'member') {
            const payment = await queryOne(
                `SELECT p.* FROM payments p
                 JOIN bookings b ON p.booking_id = b.id
                 WHERE p.payment_id = ? AND b.user_id = ?`,
                [paymentId, req.user.id]
            );

            if (!payment) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: '決済情報が見つかりません'
                });
            }
        }

        const result = await paymentService.checkPaymentStatus(paymentId);

        res.json(result);
    })
);

/**
 * 決済完了処理（内部API）
 * POST /api/v1/payments/complete/:paymentId
 */
router.post('/complete/:paymentId',
    authenticateToken,
    requireAdmin,
    validateParams(paymentStatusSchema),
    asyncHandler(async (req, res) => {
        const { paymentId } = req.params;
        const webhookData = req.body;

        const result = await paymentService.completePayment(paymentId, webhookData);

        // 監査ログ
        await sendAuditLog(
            req.user.id, 
            'payment_completed_admin', 
            'payments', 
            null, 
            null, 
            { paymentId, adminUserId: req.user.id }
        );

        res.json(result);
    })
);

/**
 * 決済キャンセル
 * POST /api/v1/payments/cancel/:paymentId
 */
router.post('/cancel/:paymentId',
    optionalAuth,
    validateParams(paymentStatusSchema),
    validateRequest(cancelPaymentSchema),
    asyncHandler(async (req, res) => {
        const { paymentId } = req.params;
        const { reason } = req.body;

        // 権限チェック（ログインユーザーの場合）
        if (req.user && req.user.role === 'member') {
            const payment = await queryOne(
                `SELECT p.* FROM payments p
                 JOIN bookings b ON p.booking_id = b.id
                 WHERE p.payment_id = ? AND b.user_id = ?`,
                [paymentId, req.user.id]
            );

            if (!payment) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: '決済情報が見つかりません'
                });
            }
        }

        const result = await paymentService.cancelPayment(paymentId, reason);

        // 監査ログ
        if (req.user) {
            await sendAuditLog(
                req.user.id, 
                'payment_cancelled', 
                'payments', 
                null, 
                null, 
                { paymentId, reason }
            );
        }

        res.json(result);
    })
);

/**
 * 決済履歴取得
 * GET /api/v1/payments/history
 */
router.get('/history',
    authenticateToken,
    validateQuery(paymentHistorySchema),
    asyncHandler(async (req, res) => {
        const { page, limit, status, startDate, endDate, bookingId } = req.query;

        const options = {
            limit,
            offset: (page - 1) * limit,
            status,
            startDate,
            endDate,
            bookingId
        };

        // 権限に基づくフィルタリング
        if (req.user.role === 'member') {
            options.userId = req.user.id;
        }

        const payments = await paymentService.getPaymentHistory(options);

        // 総件数取得（簡略化）
        const totalResult = await query(
            `SELECT COUNT(*) as total FROM payments p
             JOIN bookings b ON p.booking_id = b.id
             ${req.user.role === 'member' ? 'WHERE b.user_id = ?' : 'WHERE 1=1'}`,
            req.user.role === 'member' ? [req.user.id] : []
        );
        const total = totalResult[0].total;

        res.json({
            payments,
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
 * 決済統計取得（管理者のみ）
 * GET /api/v1/payments/stats
 */
router.get('/stats',
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
        const { startDate, endDate } = req.query;

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (startDate) {
            whereClause += ' AND p.created_at >= ?';
            params.push(startDate);
        }

        if (endDate) {
            whereClause += ' AND p.created_at <= ?';
            params.push(endDate);
        }

        // 基本統計
        const basicStats = await queryOne(
            `SELECT 
                COUNT(*) as total_payments,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_payments,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payments,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_payments,
                SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_revenue,
                AVG(CASE WHEN status = 'completed' THEN amount ELSE NULL END) as average_amount
             FROM payments p ${whereClause}`,
            params
        );

        // 日別売上
        const dailyRevenue = await query(
            `SELECT 
                DATE(p.created_at) as date,
                COUNT(*) as payment_count,
                SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as revenue
             FROM payments p ${whereClause}
             GROUP BY DATE(p.created_at)
             ORDER BY date DESC
             LIMIT 30`,
            params
        );

        // サービス別売上
        const revenueByService = await query(
            `SELECT 
                s.name as service_name,
                COUNT(*) as payment_count,
                SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END) as revenue
             FROM payments p
             JOIN bookings b ON p.booking_id = b.id
             JOIN services s ON b.service_id = s.id
             ${whereClause}
             GROUP BY s.id, s.name
             ORDER BY revenue DESC`,
            params
        );

        res.json({
            basicStats: {
                ...basicStats,
                total_revenue: parseInt(basicStats.total_revenue) || 0,
                average_amount: Math.round(parseFloat(basicStats.average_amount)) || 0
            },
            dailyRevenue,
            revenueByService
        });
    })
);

/**
 * PayPay Webhook受信
 * POST /api/v1/payments/webhook/paypay
 */
router.post('/webhook/paypay',
    express.raw({ type: 'application/json' }),
    asyncHandler(async (req, res) => {
        try {
            const webhookData = JSON.parse(req.body.toString());
            const { merchantPaymentId, status } = webhookData;

            if (!merchantPaymentId) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'merchantPaymentId が必要です'
                });
            }

            // Webhook署名検証（本来は必要）
            // const isValidSignature = verifyWebhookSignature(req.headers, req.body);
            // if (!isValidSignature) {
            //     return res.status(401).json({ error: 'Unauthorized' });
            // }

            if (status === 'COMPLETED') {
                await paymentService.completePayment(merchantPaymentId, webhookData);
            } else if (status === 'CANCELED' || status === 'FAILED') {
                await paymentService.cancelPayment(merchantPaymentId, `PayPay status: ${status}`);
            }

            res.status(200).json({ received: true });

        } catch (error) {
            logger.error('PayPay Webhook処理エラー:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Webhook処理に失敗しました'
            });
        }
    })
);

module.exports = router;