/**
 * 予約ルート
 * Booking routes for Ainaru Massage CMS
 */

const express = require('express');
const joi = require('joi');
const { query, queryOne } = require('../config/database');
const { authenticateToken, requireAdmin, requireTherapist, optionalAuth } = require('../middleware/auth');
const { validateRequest, validateQuery, validateParams, commonSchemas } = require('../middleware/validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendAuditLog } = require('../utils/auditLog');
const SchedulingService = require('../services/schedulingService');

const router = express.Router();
const schedulingService = new SchedulingService();

// バリデーションスキーマ
const createBookingSchema = joi.object({
    serviceId: joi.number().integer().positive().required(),
    therapistId: joi.number().integer().positive(),
    hotelId: joi.number().integer().positive(),
    date: joi.date().iso().min('now').required(),
    startTime: joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).required(),
    endTime: joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).required(),
    totalPrice: joi.number().integer().min(0).required(),
    notes: joi.string().allow('').max(500),
    telegramChatId: joi.string()
});

const updateBookingSchema = joi.object({
    serviceId: joi.number().integer().positive(),
    therapistId: joi.number().integer().positive(),
    hotelId: joi.number().integer().positive(),
    date: joi.date().iso(),
    startTime: joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/),
    endTime: joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/),
    totalPrice: joi.number().integer().min(0),
    status: joi.string().valid('pending', 'confirmed', 'completed', 'cancelled'),
    notes: joi.string().allow('').max(500)
});

const getBookingsQuerySchema = joi.object({
    ...commonSchemas.pagination,
    status: joi.string().valid('pending', 'confirmed', 'completed', 'cancelled'),
    therapistId: joi.number().integer().positive(),
    userId: joi.number().integer().positive(),
    startDate: joi.date().iso(),
    endDate: joi.date().iso(),
    search: joi.string().min(1).max(100)
});

const availabilityQuerySchema = joi.object({
    date: joi.date().iso().required(),
    durationMinutes: joi.number().integer().min(15).max(480).required(),
    therapistId: joi.number().integer().positive(),
    serviceId: joi.number().integer().positive()
});

const calendarQuerySchema = joi.object({
    year: joi.number().integer().min(2024).max(2030).required(),
    month: joi.number().integer().min(1).max(12).required(),
    therapistId: joi.number().integer().positive()
});

/**
 * 予約一覧取得
 * GET /api/v1/bookings
 */
router.get('/',
    authenticateToken,
    validateQuery(getBookingsQuerySchema),
    asyncHandler(async (req, res) => {
        const { 
            page, limit, sort, sortBy, 
            status, therapistId, userId, startDate, endDate, search 
        } = req.query;

        let whereClause = 'WHERE 1=1';
        const params = [];

        // 権限に基づくフィルタリング
        if (req.user.role === 'member') {
            whereClause += ' AND b.user_id = ?';
            params.push(req.user.id);
        } else if (req.user.role === 'therapist') {
            // セラピストは自分の予約のみ表示
            const therapist = await queryOne(
                'SELECT id FROM therapists WHERE user_id = ?',
                [req.user.id]
            );
            if (therapist) {
                whereClause += ' AND b.therapist_id = ?';
                params.push(therapist.id);
            }
        }

        // フィルター適用
        if (status) {
            whereClause += ' AND b.status = ?';
            params.push(status);
        }

        if (therapistId && req.user.role === 'admin') {
            whereClause += ' AND b.therapist_id = ?';
            params.push(therapistId);
        }

        if (userId && req.user.role === 'admin') {
            whereClause += ' AND b.user_id = ?';
            params.push(userId);
        }

        if (startDate) {
            whereClause += ' AND b.booking_date >= ?';
            params.push(startDate);
        }

        if (endDate) {
            whereClause += ' AND b.booking_date <= ?';
            params.push(endDate);
        }

        if (search) {
            whereClause += ' AND (b.booking_code LIKE ? OR s.name LIKE ? OR h.name LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        // 総件数取得
        const totalResult = await query(
            `SELECT COUNT(*) as total 
             FROM bookings b
             LEFT JOIN services s ON b.service_id = s.id
             LEFT JOIN hotels h ON b.hotel_id = h.id
             ${whereClause}`,
            params
        );
        const total = totalResult[0].total;

        // データ取得
        const offset = (page - 1) * limit;
        const bookings = await query(
            `SELECT 
                b.*,
                s.name as service_name,
                s.duration_minutes,
                t.display_name as therapist_name,
                h.name as hotel_name,
                h.area as hotel_area,
                u.username
             FROM bookings b
             LEFT JOIN services s ON b.service_id = s.id
             LEFT JOIN therapists t ON b.therapist_id = t.id
             LEFT JOIN hotels h ON b.hotel_id = h.id
             LEFT JOIN users u ON b.user_id = u.id
             ${whereClause}
             ORDER BY b.${sortBy} ${sort}
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        res.json({
            bookings,
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
 * 予約詳細取得
 * GET /api/v1/bookings/:id
 */
router.get('/:id',
    authenticateToken,
    validateParams(joi.object({ id: commonSchemas.id })),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        let whereClause = 'WHERE b.id = ?';
        const params = [id];

        // 権限チェック
        if (req.user.role === 'member') {
            whereClause += ' AND b.user_id = ?';
            params.push(req.user.id);
        } else if (req.user.role === 'therapist') {
            const therapist = await queryOne(
                'SELECT id FROM therapists WHERE user_id = ?',
                [req.user.id]
            );
            if (therapist) {
                whereClause += ' AND b.therapist_id = ?';
                params.push(therapist.id);
            }
        }

        const booking = await queryOne(
            `SELECT 
                b.*,
                s.name as service_name,
                s.duration_minutes,
                s.price as service_price,
                t.display_name as therapist_name,
                t.rating as therapist_rating,
                h.name as hotel_name,
                h.area as hotel_area,
                h.address as hotel_address,
                u.username,
                u.email
             FROM bookings b
             LEFT JOIN services s ON b.service_id = s.id
             LEFT JOIN therapists t ON b.therapist_id = t.id
             LEFT JOIN hotels h ON b.hotel_id = h.id
             LEFT JOIN users u ON b.user_id = u.id
             ${whereClause}`,
            params
        );

        if (!booking) {
            return res.status(404).json({
                error: 'Not Found',
                message: '予約が見つかりません'
            });
        }

        res.json({ booking });
    })
);

/**
 * 新規予約作成
 * POST /api/v1/bookings
 */
router.post('/',
    optionalAuth,
    validateRequest(createBookingSchema),
    asyncHandler(async (req, res) => {
        const bookingData = {
            ...req.body,
            date: req.body.date.split('T')[0] // 日付部分のみ取得
        };

        const booking = await schedulingService.createBooking(
            bookingData, 
            req.user ? req.user.id : null
        );

        res.status(201).json({
            message: '予約を作成しました',
            booking
        });
    })
);

/**
 * 予約更新
 * PUT /api/v1/bookings/:id
 */
router.put('/:id',
    authenticateToken,
    validateParams(joi.object({ id: commonSchemas.id })),
    validateRequest(updateBookingSchema),
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const updates = req.body;

        // 既存予約取得と権限チェック
        let whereClause = 'WHERE id = ?';
        const params = [id];

        if (req.user.role === 'member') {
            whereClause += ' AND user_id = ?';
            params.push(req.user.id);
        } else if (req.user.role === 'therapist') {
            const therapist = await queryOne(
                'SELECT id FROM therapists WHERE user_id = ?',
                [req.user.id]
            );
            if (therapist) {
                whereClause += ' AND therapist_id = ?';
                params.push(therapist.id);
            }
        }

        const existingBooking = await queryOne(
            `SELECT * FROM bookings ${whereClause}`,
            params
        );

        if (!existingBooking) {
            return res.status(404).json({
                error: 'Not Found',
                message: '予約が見つかりません'
            });
        }

        // 予約可能性チェック（時間変更の場合）
        if (updates.date || updates.startTime || updates.endTime) {
            const checkData = {
                date: updates.date || existingBooking.booking_date,
                startTime: updates.startTime || existingBooking.start_time,
                endTime: updates.endTime || existingBooking.end_time,
                therapistId: updates.therapistId || existingBooking.therapist_id,
                serviceId: updates.serviceId || existingBooking.service_id
            };

            const availabilityCheck = await schedulingService.checkBookingAvailability(checkData);
            if (!availabilityCheck.isValid) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: availabilityCheck.message
                });
            }
        }

        // 更新実行
        const updateFields = [];
        const updateValues = [];

        Object.keys(updates).forEach(key => {
            if (key === 'date') {
                updateFields.push('booking_date = ?');
                updateValues.push(updates[key].split('T')[0]);
            } else if (key === 'startTime') {
                updateFields.push('start_time = ?');
                updateValues.push(updates[key]);
            } else if (key === 'endTime') {
                updateFields.push('end_time = ?');
                updateValues.push(updates[key]);
            } else if (key === 'serviceId') {
                updateFields.push('service_id = ?');
                updateValues.push(updates[key]);
            } else if (key === 'therapistId') {
                updateFields.push('therapist_id = ?');
                updateValues.push(updates[key]);
            } else if (key === 'hotelId') {
                updateFields.push('hotel_id = ?');
                updateValues.push(updates[key]);
            } else if (key === 'totalPrice') {
                updateFields.push('total_price = ?');
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
            `UPDATE bookings SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );

        // 監査ログ
        await sendAuditLog(req.user.id, 'booking_updated', 'bookings', id, existingBooking, updates);

        // 更新後データ取得
        const updatedBooking = await queryOne(
            `SELECT 
                b.*,
                s.name as service_name,
                t.display_name as therapist_name,
                h.name as hotel_name
             FROM bookings b
             LEFT JOIN services s ON b.service_id = s.id
             LEFT JOIN therapists t ON b.therapist_id = t.id
             LEFT JOIN hotels h ON b.hotel_id = h.id
             WHERE b.id = ?`,
            [id]
        );

        res.json({
            message: '予約を更新しました',
            booking: updatedBooking
        });
    })
);

/**
 * 予約キャンセル
 * DELETE /api/v1/bookings/:id
 */
router.delete('/:id',
    authenticateToken,
    validateParams(joi.object({ id: commonSchemas.id })),
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { reason } = req.body;

        const result = await schedulingService.cancelBooking(id, req.user.id, reason);

        res.json(result);
    })
);

/**
 * 予約確認
 * POST /api/v1/bookings/:id/confirm
 */
router.post('/:id/confirm',
    authenticateToken,
    requireTherapist,
    validateParams(joi.object({ id: commonSchemas.id })),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        const booking = await queryOne(
            'SELECT * FROM bookings WHERE id = ? AND status = "pending"',
            [id]
        );

        if (!booking) {
            return res.status(404).json({
                error: 'Not Found',
                message: '確認可能な予約が見つかりません'
            });
        }

        await query(
            'UPDATE bookings SET status = "confirmed", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [id]
        );

        // 監査ログ
        await sendAuditLog(req.user.id, 'booking_confirmed', 'bookings', id, booking, { status: 'confirmed' });

        res.json({
            message: '予約を確認しました',
            bookingCode: booking.booking_code
        });
    })
);

/**
 * 予約完了
 * POST /api/v1/bookings/:id/complete
 */
router.post('/:id/complete',
    authenticateToken,
    requireTherapist,
    validateParams(joi.object({ id: commonSchemas.id })),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        const booking = await queryOne(
            'SELECT * FROM bookings WHERE id = ? AND status = "confirmed"',
            [id]
        );

        if (!booking) {
            return res.status(404).json({
                error: 'Not Found',
                message: '完了可能な予約が見つかりません'
            });
        }

        await query(
            'UPDATE bookings SET status = "completed", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [id]
        );

        // 監査ログ
        await sendAuditLog(req.user.id, 'booking_completed', 'bookings', id, booking, { status: 'completed' });

        res.json({
            message: '予約を完了しました',
            bookingCode: booking.booking_code
        });
    })
);

/**
 * 空き時間検索
 * GET /api/v1/bookings/availability
 */
router.get('/availability',
    optionalAuth,
    validateQuery(availabilityQuerySchema),
    asyncHandler(async (req, res) => {
        const { date, durationMinutes, therapistId, serviceId } = req.query;

        const availableSlots = await schedulingService.getAvailableTimeSlots(
            date,
            parseInt(durationMinutes),
            therapistId ? parseInt(therapistId) : null
        );

        res.json({
            date,
            durationMinutes: parseInt(durationMinutes),
            availableSlots
        });
    })
);

/**
 * 月間カレンダー取得
 * GET /api/v1/bookings/calendar
 */
router.get('/calendar',
    authenticateToken,
    validateQuery(calendarQuerySchema),
    asyncHandler(async (req, res) => {
        const { year, month, therapistId } = req.query;

        // 権限チェック
        let calendarTherapistId = null;
        
        if (req.user.role === 'therapist') {
            const therapist = await queryOne(
                'SELECT id FROM therapists WHERE user_id = ?',
                [req.user.id]
            );
            calendarTherapistId = therapist ? therapist.id : null;
        } else if (req.user.role === 'admin' && therapistId) {
            calendarTherapistId = parseInt(therapistId);
        }

        const calendar = await schedulingService.getMonthlyCalendar(
            parseInt(year),
            parseInt(month),
            calendarTherapistId
        );

        res.json(calendar);
    })
);

module.exports = router;