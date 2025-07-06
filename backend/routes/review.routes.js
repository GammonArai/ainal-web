/**
 * レビュー・評価システム API ルート
 * Review and Rating System API Routes
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { validateReview, validateReviewUpdate } = require('../middleware/validation');
const { logger } = require('../utils/logger');
const ReviewModel = require('../models/reviewModel');

const router = express.Router();

// multer設定（レビュー画像用）
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads/reviews'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'review-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 5 // 最大5枚
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('画像ファイルのみアップロード可能です'));
        }
    }
});

/**
 * レビュー一覧取得
 * GET /api/v1/reviews
 */
router.get('/', async (req, res) => {
    try {
        const {
            service_type,
            status = 'approved',
            featured,
            page = 1,
            limit = 20,
            sort_by = 'created_at',
            sort_order = 'desc',
            min_rating,
            max_rating
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const reviewModel = new ReviewModel(req.db);
        const reviews = await reviewModel.getReviews({
            serviceType: service_type,
            status,
            featured: featured === 'true',
            limit: parseInt(limit),
            offset,
            sortBy: sort_by,
            sortOrder: sort_order.toUpperCase(),
            minRating: min_rating ? parseInt(min_rating) : null,
            maxRating: max_rating ? parseInt(max_rating) : null
        });

        res.json({
            success: true,
            reviews,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: reviews.length
            }
        });

    } catch (error) {
        logger.error('Failed to get reviews:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'レビューの取得に失敗しました'
        });
    }
});

/**
 * レビュー詳細取得
 * GET /api/v1/reviews/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const reviewId = parseInt(req.params.id);

        const reviewModel = new ReviewModel(req.db);
        const review = await reviewModel.getReviewById(reviewId);

        if (!review) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'レビューが見つかりません'
            });
        }

        res.json({
            success: true,
            review
        });

    } catch (error) {
        logger.error('Failed to get review:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'レビューの取得に失敗しました'
        });
    }
});

/**
 * レビュー投稿
 * POST /api/v1/reviews
 */
router.post('/',
    authenticateToken,
    upload.array('photos', 5),
    validateReview,
    async (req, res) => {
        try {
            const {
                booking_id,
                service_type,
                rating,
                title,
                comment,
                therapist_rating,
                service_rating,
                value_rating,
                cleanliness_rating,
                communication_rating
            } = req.body;

            // 画像ファイル処理
            const photos = req.files ? req.files.map(file => ({
                filename: file.filename,
                originalName: file.originalname,
                path: file.path,
                size: file.size
            })) : [];

            const reviewData = {
                userId: req.user.id,
                bookingId: booking_id ? parseInt(booking_id) : null,
                serviceType: service_type,
                rating: parseInt(rating),
                title,
                comment,
                therapistRating: therapist_rating ? parseInt(therapist_rating) : null,
                serviceRating: service_rating ? parseInt(service_rating) : null,
                valueRating: value_rating ? parseInt(value_rating) : null,
                cleanlinessRating: cleanliness_rating ? parseInt(cleanliness_rating) : null,
                communicationRating: communication_rating ? parseInt(communication_rating) : null,
                photos
            };

            const reviewModel = new ReviewModel(req.db);
            const newReview = await reviewModel.createReview(reviewData);

            logger.info(`Review created by user ${req.user.id}: ${newReview.id}`);

            res.status(201).json({
                success: true,
                message: 'レビューを投稿しました。承認後に公開されます。',
                review: newReview
            });

        } catch (error) {
            logger.error('Failed to create review:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'レビューの投稿に失敗しました'
            });
        }
    }
);

/**
 * レビュー更新
 * PUT /api/v1/reviews/:id
 */
router.put('/:id',
    authenticateToken,
    upload.array('photos', 5),
    validateReviewUpdate,
    async (req, res) => {
        try {
            const reviewId = parseInt(req.params.id);
            const userId = req.user.id;

            const reviewModel = new ReviewModel(req.db);
            const existingReview = await reviewModel.getReviewById(reviewId);

            if (!existingReview) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'レビューが見つかりません'
                });
            }

            // 所有者チェック（管理者は除く）
            if (existingReview.user_id !== userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    error: 'Forbidden',
                    message: '他のユーザーのレビューは編集できません'
                });
            }

            const updateData = {};
            const allowedFields = [
                'rating', 'title', 'comment', 'therapist_rating',
                'service_rating', 'value_rating', 'cleanliness_rating',
                'communication_rating'
            ];

            allowedFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    updateData[field] = field.includes('rating') ? 
                        parseInt(req.body[field]) : req.body[field];
                }
            });

            // 新しい画像がアップロードされた場合
            if (req.files && req.files.length > 0) {
                updateData.photos = req.files.map(file => ({
                    filename: file.filename,
                    originalName: file.originalname,
                    path: file.path,
                    size: file.size
                }));
            }

            // レビューを pending 状態に戻す（再審査のため）
            if (Object.keys(updateData).length > 0) {
                updateData.status = 'pending';
            }

            const success = await reviewModel.updateReview(reviewId, updateData);

            if (!success) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'レビューの更新に失敗しました'
                });
            }

            logger.info(`Review updated by user ${userId}: ${reviewId}`);

            res.json({
                success: true,
                message: 'レビューを更新しました。再審査後に公開されます。'
            });

        } catch (error) {
            logger.error('Failed to update review:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'レビューの更新に失敗しました'
            });
        }
    }
);

/**
 * レビュー削除
 * DELETE /api/v1/reviews/:id
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const reviewId = parseInt(req.params.id);
        const userId = req.user.id;

        const reviewModel = new ReviewModel(req.db);
        const existingReview = await reviewModel.getReviewById(reviewId);

        if (!existingReview) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'レビューが見つかりません'
            });
        }

        // 所有者チェック（管理者は除く）
        if (existingReview.user_id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({
                error: 'Forbidden',
                message: '他のユーザーのレビューは削除できません'
            });
        }

        const success = await reviewModel.deleteReview(reviewId);

        if (!success) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'レビューの削除に失敗しました'
            });
        }

        logger.info(`Review deleted by user ${userId}: ${reviewId}`);

        res.json({
            success: true,
            message: 'レビューを削除しました'
        });

    } catch (error) {
        logger.error('Failed to delete review:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'レビューの削除に失敗しました'
        });
    }
});

/**
 * ヘルプフル投票
 * POST /api/v1/reviews/:id/helpful
 */
router.post('/:id/helpful',
    optionalAuth,
    async (req, res) => {
        try {
            const reviewId = parseInt(req.params.id);
            const { is_helpful } = req.body;
            
            const userId = req.user ? req.user.id : null;
            const sessionId = req.sessionID || req.headers['x-session-id'];
            const ipAddress = req.ip || req.connection.remoteAddress;

            if (is_helpful === undefined) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'is_helpful パラメータが必要です'
                });
            }

            const reviewModel = new ReviewModel(req.db);
            await reviewModel.voteHelpful(
                reviewId, 
                userId, 
                sessionId, 
                ipAddress, 
                is_helpful
            );

            res.json({
                success: true,
                message: '投票ありがとうございます'
            });

        } catch (error) {
            if (error.message === 'Already voted') {
                return res.status(400).json({
                    error: 'Already Voted',
                    message: '既に投票済みです'
                });
            }

            logger.error('Failed to vote helpful:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: '投票に失敗しました'
            });
        }
    }
);

/**
 * レビュー通報
 * POST /api/v1/reviews/:id/report
 */
router.post('/:id/report',
    optionalAuth,
    async (req, res) => {
        try {
            const reviewId = parseInt(req.params.id);
            const { reason, details } = req.body;
            
            const reporterId = req.user ? req.user.id : null;
            const reporterIp = req.ip || req.connection.remoteAddress;

            if (!reason) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: '通報理由を選択してください'
                });
            }

            const validReasons = ['spam', 'inappropriate', 'fake', 'harassment', 'other'];
            if (!validReasons.includes(reason)) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: '無効な通報理由です'
                });
            }

            const reviewModel = new ReviewModel(req.db);
            await reviewModel.reportReview(reviewId, reporterId, reporterIp, reason, details);

            logger.info(`Review reported: ${reviewId} by ${reporterId || reporterIp}`);

            res.json({
                success: true,
                message: '通報を受け付けました。確認後に対応いたします。'
            });

        } catch (error) {
            logger.error('Failed to report review:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: '通報に失敗しました'
            });
        }
    }
);

/**
 * レビュー統計取得
 * GET /api/v1/reviews/statistics
 */
router.get('/statistics/:service_type?', async (req, res) => {
    try {
        const serviceType = req.params.service_type;

        const reviewModel = new ReviewModel(req.db);
        const statistics = await reviewModel.getStatistics(serviceType);

        res.json({
            success: true,
            statistics
        });

    } catch (error) {
        logger.error('Failed to get review statistics:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: '統計の取得に失敗しました'
        });
    }
});

module.exports = router;