/**
 * バリデーションミドルウェア
 * Validation middleware for Ainaru Massage CMS
 */

const joi = require('joi');
const { logger } = require('../utils/logger');

/**
 * リクエストバリデーション
 */
function validateRequest(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errorDetails = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            logger.warn('バリデーションエラー:', errorDetails);

            return res.status(400).json({
                error: 'Validation Error',
                message: 'リクエストデータが無効です',
                details: errorDetails
            });
        }

        // バリデーション済みのデータで置き換え
        req.body = value;
        next();
    };
}

/**
 * クエリパラメータバリデーション
 */
function validateQuery(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.query, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errorDetails = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                error: 'Validation Error',
                message: 'クエリパラメータが無効です',
                details: errorDetails
            });
        }

        req.query = value;
        next();
    };
}

/**
 * パラメータバリデーション
 */
function validateParams(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.params, {
            abortEarly: false
        });

        if (error) {
            const errorDetails = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                error: 'Validation Error',
                message: 'パスパラメータが無効です',
                details: errorDetails
            });
        }

        req.params = value;
        next();
    };
}

// 共通バリデーションスキーマ
const commonSchemas = {
    id: joi.number().integer().positive().required(),
    
    pagination: joi.object({
        page: joi.number().integer().min(1).default(1),
        limit: joi.number().integer().min(1).max(100).default(20),
        sort: joi.string().valid('asc', 'desc').default('desc'),
        sortBy: joi.string().default('created_at')
    }),

    dateRange: joi.object({
        startDate: joi.date().iso(),
        endDate: joi.date().iso().greater(joi.ref('startDate'))
    }),

    email: joi.string().email().required(),
    
    password: joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])')),
    
    phone: joi.string().pattern(/^[0-9\-\+\(\)\s]+$/),
    
    url: joi.string().uri(),
    
    slug: joi.string().pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    
    timezone: joi.string().default('Asia/Tokyo')
};

module.exports = {
    validateRequest,
    validateQuery,
    validateParams,
    commonSchemas
};