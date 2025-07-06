/**
 * バリデーションミドルウェア
 * Validation middleware for API requests
 */

const Joi = require('joi');
const { logger } = require('../utils/logger');

/**
 * レビュー投稿バリデーション
 */
const validateReview = (req, res, next) => {
    const schema = Joi.object({
        booking_id: Joi.number().integer().positive().optional(),
        service_type: Joi.string().max(100).required(),
        rating: Joi.number().integer().min(1).max(5).required(),
        title: Joi.string().max(200).optional(),
        comment: Joi.string().max(2000).optional(),
        therapist_rating: Joi.number().integer().min(1).max(5).optional(),
        service_rating: Joi.number().integer().min(1).max(5).optional(),
        value_rating: Joi.number().integer().min(1).max(5).optional(),
        cleanliness_rating: Joi.number().integer().min(1).max(5).optional(),
        communication_rating: Joi.number().integer().min(1).max(5).optional()
    });

    const { error } = schema.validate(req.body);

    if (error) {
        logger.warn('Review validation failed:', error.details[0].message);
        return res.status(400).json({
            error: 'Validation Error',
            message: error.details[0].message,
            field: error.details[0].path[0]
        });
    }

    next();
};

/**
 * レビュー更新バリデーション
 */
const validateReviewUpdate = (req, res, next) => {
    const schema = Joi.object({
        rating: Joi.number().integer().min(1).max(5).optional(),
        title: Joi.string().max(200).optional(),
        comment: Joi.string().max(2000).optional(),
        therapist_rating: Joi.number().integer().min(1).max(5).optional(),
        service_rating: Joi.number().integer().min(1).max(5).optional(),
        value_rating: Joi.number().integer().min(1).max(5).optional(),
        cleanliness_rating: Joi.number().integer().min(1).max(5).optional(),
        communication_rating: Joi.number().integer().min(1).max(5).optional()
    });

    const { error } = schema.validate(req.body);

    if (error) {
        logger.warn('Review update validation failed:', error.details[0].message);
        return res.status(400).json({
            error: 'Validation Error',
            message: error.details[0].message,
            field: error.details[0].path[0]
        });
    }

    next();
};

/**
 * ユーザー登録バリデーション
 */
const validateUserRegistration = (req, res, next) => {
    const schema = Joi.object({
        name: Joi.string().min(2).max(50).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(8).max(128).required(),
        phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).max(20).optional(),
        preferred_language: Joi.string().valid('ja', 'en', 'ko', 'zh').default('ja')
    });

    const { error } = schema.validate(req.body);

    if (error) {
        logger.warn('User registration validation failed:', error.details[0].message);
        return res.status(400).json({
            error: 'Validation Error',
            message: error.details[0].message,
            field: error.details[0].path[0]
        });
    }

    next();
};

/**
 * ログインバリデーション
 */
const validateLogin = (req, res, next) => {
    const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required()
    });

    const { error } = schema.validate(req.body);

    if (error) {
        logger.warn('Login validation failed:', error.details[0].message);
        return res.status(400).json({
            error: 'Validation Error',
            message: error.details[0].message,
            field: error.details[0].path[0]
        });
    }

    next();
};

/**
 * 予約作成バリデーション
 */
const validateBooking = (req, res, next) => {
    const schema = Joi.object({
        service_type: Joi.string().max(100).required(),
        service_name: Joi.string().max(200).required(),
        preferred_date: Joi.date().min('now').required(),
        preferred_time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
        duration: Joi.number().integer().min(30).max(480).required(),
        location: Joi.string().max(500).required(),
        special_requests: Joi.string().max(1000).optional(),
        contact_method: Joi.string().valid('telegram', 'phone', 'email').required(),
        emergency_contact: Joi.string().max(50).optional()
    });

    const { error } = schema.validate(req.body);

    if (error) {
        logger.warn('Booking validation failed:', error.details[0].message);
        return res.status(400).json({
            error: 'Validation Error',
            message: error.details[0].message,
            field: error.details[0].path[0]
        });
    }

    next();
};

/**
 * お問い合わせバリデーション
 */
const validateContact = (req, res, next) => {
    const schema = Joi.object({
        name: Joi.string().min(2).max(100).required(),
        email: Joi.string().email().required(),
        phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).max(20).optional(),
        subject: Joi.string().max(200).required(),
        message: Joi.string().min(10).max(2000).required(),
        preferred_contact_method: Joi.string().valid('email', 'phone', 'telegram').default('email'),
        privacy_consent: Joi.boolean().valid(true).required()
    });

    const { error } = schema.validate(req.body);

    if (error) {
        logger.warn('Contact validation failed:', error.details[0].message);
        return res.status(400).json({
            error: 'Validation Error',
            message: error.details[0].message,
            field: error.details[0].path[0]
        });
    }

    next();
};

/**
 * パスワードリセットバリデーション
 */
const validatePasswordReset = (req, res, next) => {
    const schema = Joi.object({
        email: Joi.string().email().required()
    });

    const { error } = schema.validate(req.body);

    if (error) {
        logger.warn('Password reset validation failed:', error.details[0].message);
        return res.status(400).json({
            error: 'Validation Error',
            message: error.details[0].message,
            field: error.details[0].path[0]
        });
    }

    next();
};

/**
 * パスワード更新バリデーション
 */
const validatePasswordUpdate = (req, res, next) => {
    const schema = Joi.object({
        token: Joi.string().required(),
        new_password: Joi.string().min(8).max(128).required(),
        confirm_password: Joi.string().valid(Joi.ref('new_password')).required()
    });

    const { error } = schema.validate(req.body);

    if (error) {
        logger.warn('Password update validation failed:', error.details[0].message);
        return res.status(400).json({
            error: 'Validation Error',
            message: error.details[0].message,
            field: error.details[0].path[0]
        });
    }

    next();
};

/**
 * プロフィール更新バリデーション
 */
const validateProfileUpdate = (req, res, next) => {
    const schema = Joi.object({
        name: Joi.string().min(2).max(50).optional(),
        phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).max(20).optional(),
        preferred_language: Joi.string().valid('ja', 'en', 'ko', 'zh').optional(),
        notification_preferences: Joi.object({
            email_notifications: Joi.boolean().optional(),
            sms_notifications: Joi.boolean().optional(),
            push_notifications: Joi.boolean().optional()
        }).optional()
    });

    const { error } = schema.validate(req.body);

    if (error) {
        logger.warn('Profile update validation failed:', error.details[0].message);
        return res.status(400).json({
            error: 'Validation Error',
            message: error.details[0].message,
            field: error.details[0].path[0]
        });
    }

    next();
};

/**
 * 管理者用バリデーション
 */
const validateAdminReviewUpdate = (req, res, next) => {
    const schema = Joi.object({
        status: Joi.string().valid('pending', 'approved', 'rejected', 'hidden').optional(),
        is_featured: Joi.boolean().optional(),
        admin_response: Joi.string().max(1000).optional()
    });

    const { error } = schema.validate(req.body);

    if (error) {
        logger.warn('Admin review update validation failed:', error.details[0].message);
        return res.status(400).json({
            error: 'Validation Error',
            message: error.details[0].message,
            field: error.details[0].path[0]
        });
    }

    next();
};

module.exports = {
    validateReview,
    validateReviewUpdate,
    validateUserRegistration,
    validateLogin,
    validateBooking,
    validateContact,
    validatePasswordReset,
    validatePasswordUpdate,
    validateProfileUpdate,
    validateAdminReviewUpdate
};