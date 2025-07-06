/**
 * レビュー・評価システム データモデル
 * Review and Rating System Data Model
 */

const mysql = require('mysql2/promise');
const { logger } = require('../utils/logger');

class ReviewModel {
    constructor(dbConnection) {
        this.db = dbConnection;
    }

    /**
     * レビューテーブル作成
     */
    async createTables() {
        try {
            // レビューテーブル
            await this.db.execute(`
                CREATE TABLE IF NOT EXISTS reviews (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT,
                    booking_id INT,
                    service_type VARCHAR(100) NOT NULL,
                    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
                    title VARCHAR(200),
                    comment TEXT,
                    therapist_rating INT CHECK (therapist_rating >= 1 AND therapist_rating <= 5),
                    service_rating INT CHECK (service_rating >= 1 AND service_rating <= 5),
                    value_rating INT CHECK (value_rating >= 1 AND value_rating <= 5),
                    cleanliness_rating INT CHECK (cleanliness_rating >= 1 AND cleanliness_rating <= 5),
                    communication_rating INT CHECK (communication_rating >= 1 AND communication_rating <= 5),
                    photos JSON,
                    is_verified BOOLEAN DEFAULT FALSE,
                    is_approved BOOLEAN DEFAULT FALSE,
                    is_featured BOOLEAN DEFAULT FALSE,
                    admin_response TEXT,
                    helpful_count INT DEFAULT 0,
                    report_count INT DEFAULT 0,
                    status ENUM('pending', 'approved', 'rejected', 'hidden') DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    
                    INDEX idx_service_type (service_type),
                    INDEX idx_rating (rating),
                    INDEX idx_status (status),
                    INDEX idx_created_at (created_at),
                    INDEX idx_is_approved (is_approved),
                    INDEX idx_is_featured (is_featured)
                )
            `);

            // レビューヘルプフル投票テーブル
            await this.db.execute(`
                CREATE TABLE IF NOT EXISTS review_helpful_votes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    review_id INT NOT NULL,
                    user_id INT,
                    session_id VARCHAR(255),
                    ip_address VARCHAR(45),
                    is_helpful BOOLEAN NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    
                    FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
                    UNIQUE KEY unique_vote (review_id, user_id, session_id),
                    INDEX idx_review_id (review_id)
                )
            `);

            // レビュー通報テーブル
            await this.db.execute(`
                CREATE TABLE IF NOT EXISTS review_reports (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    review_id INT NOT NULL,
                    reporter_id INT,
                    reporter_ip VARCHAR(45),
                    reason ENUM('spam', 'inappropriate', 'fake', 'harassment', 'other') NOT NULL,
                    details TEXT,
                    status ENUM('pending', 'reviewed', 'resolved', 'dismissed') DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    
                    FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
                    INDEX idx_review_id (review_id),
                    INDEX idx_status (status)
                )
            `);

            // レビュー統計テーブル
            await this.db.execute(`
                CREATE TABLE IF NOT EXISTS review_statistics (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    service_type VARCHAR(100) NOT NULL,
                    total_reviews INT DEFAULT 0,
                    average_rating DECIMAL(3,2) DEFAULT 0.00,
                    rating_distribution JSON,
                    total_therapist_rating DECIMAL(3,2) DEFAULT 0.00,
                    total_service_rating DECIMAL(3,2) DEFAULT 0.00,
                    total_value_rating DECIMAL(3,2) DEFAULT 0.00,
                    total_cleanliness_rating DECIMAL(3,2) DEFAULT 0.00,
                    total_communication_rating DECIMAL(3,2) DEFAULT 0.00,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    
                    UNIQUE KEY unique_service (service_type),
                    INDEX idx_service_type (service_type)
                )
            `);

            logger.info('Review tables created successfully');
        } catch (error) {
            logger.error('Failed to create review tables:', error);
            throw error;
        }
    }

    /**
     * レビュー投稿
     */
    async createReview(reviewData) {
        try {
            const {
                userId,
                bookingId,
                serviceType,
                rating,
                title,
                comment,
                therapistRating,
                serviceRating,
                valueRating,
                cleanlinessRating,
                communicationRating,
                photos = []
            } = reviewData;

            const [result] = await this.db.execute(`
                INSERT INTO reviews (
                    user_id, booking_id, service_type, rating, title, comment,
                    therapist_rating, service_rating, value_rating, 
                    cleanliness_rating, communication_rating, photos
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                userId, bookingId, serviceType, rating, title, comment,
                therapistRating, serviceRating, valueRating,
                cleanlinessRating, communicationRating, JSON.stringify(photos)
            ]);

            // 統計更新
            await this.updateStatistics(serviceType);

            return {
                id: result.insertId,
                ...reviewData,
                status: 'pending',
                createdAt: new Date()
            };

        } catch (error) {
            logger.error('Failed to create review:', error);
            throw error;
        }
    }

    /**
     * レビュー一覧取得
     */
    async getReviews(options = {}) {
        try {
            const {
                serviceType,
                status = 'approved',
                featured = false,
                limit = 20,
                offset = 0,
                sortBy = 'created_at',
                sortOrder = 'DESC',
                minRating,
                maxRating
            } = options;

            let query = `
                SELECT r.*, 
                       u.name as user_name,
                       u.avatar_url as user_avatar,
                       b.service_name as booking_service
                FROM reviews r
                LEFT JOIN users u ON r.user_id = u.id
                LEFT JOIN bookings b ON r.booking_id = b.id
                WHERE 1=1
            `;

            const params = [];

            if (serviceType) {
                query += ' AND r.service_type = ?';
                params.push(serviceType);
            }

            if (status) {
                query += ' AND r.status = ?';
                params.push(status);
            }

            if (featured) {
                query += ' AND r.is_featured = TRUE';
            }

            if (minRating) {
                query += ' AND r.rating >= ?';
                params.push(minRating);
            }

            if (maxRating) {
                query += ' AND r.rating <= ?';
                params.push(maxRating);
            }

            query += ` ORDER BY r.${sortBy} ${sortOrder} LIMIT ? OFFSET ?`;
            params.push(limit, offset);

            const [reviews] = await this.db.execute(query, params);

            // 写真データをパース
            return reviews.map(review => ({
                ...review,
                photos: review.photos ? JSON.parse(review.photos) : []
            }));

        } catch (error) {
            logger.error('Failed to get reviews:', error);
            throw error;
        }
    }

    /**
     * レビュー詳細取得
     */
    async getReviewById(reviewId) {
        try {
            const [reviews] = await this.db.execute(`
                SELECT r.*, 
                       u.name as user_name,
                       u.avatar_url as user_avatar,
                       b.service_name as booking_service
                FROM reviews r
                LEFT JOIN users u ON r.user_id = u.id
                LEFT JOIN bookings b ON r.booking_id = b.id
                WHERE r.id = ?
            `, [reviewId]);

            if (reviews.length === 0) {
                return null;
            }

            const review = reviews[0];
            review.photos = review.photos ? JSON.parse(review.photos) : [];

            return review;

        } catch (error) {
            logger.error('Failed to get review by ID:', error);
            throw error;
        }
    }

    /**
     * レビュー更新
     */
    async updateReview(reviewId, updateData) {
        try {
            const fields = [];
            const values = [];

            Object.keys(updateData).forEach(key => {
                if (updateData[key] !== undefined) {
                    if (key === 'photos') {
                        fields.push(`${key} = ?`);
                        values.push(JSON.stringify(updateData[key]));
                    } else {
                        fields.push(`${key} = ?`);
                        values.push(updateData[key]);
                    }
                }
            });

            if (fields.length === 0) {
                return false;
            }

            values.push(reviewId);

            const [result] = await this.db.execute(`
                UPDATE reviews SET ${fields.join(', ')} WHERE id = ?
            `, values);

            return result.affectedRows > 0;

        } catch (error) {
            logger.error('Failed to update review:', error);
            throw error;
        }
    }

    /**
     * レビュー削除
     */
    async deleteReview(reviewId) {
        try {
            const [result] = await this.db.execute('DELETE FROM reviews WHERE id = ?', [reviewId]);
            return result.affectedRows > 0;

        } catch (error) {
            logger.error('Failed to delete review:', error);
            throw error;
        }
    }

    /**
     * ヘルプフル投票
     */
    async voteHelpful(reviewId, userId, sessionId, ipAddress, isHelpful) {
        try {
            // 既存の投票チェック
            const [existing] = await this.db.execute(`
                SELECT id FROM review_helpful_votes 
                WHERE review_id = ? AND (user_id = ? OR session_id = ?)
            `, [reviewId, userId, sessionId]);

            if (existing.length > 0) {
                throw new Error('Already voted');
            }

            // 投票記録
            await this.db.execute(`
                INSERT INTO review_helpful_votes 
                (review_id, user_id, session_id, ip_address, is_helpful)
                VALUES (?, ?, ?, ?, ?)
            `, [reviewId, userId, sessionId, ipAddress, isHelpful]);

            // ヘルプフルカウント更新
            if (isHelpful) {
                await this.db.execute(`
                    UPDATE reviews SET helpful_count = helpful_count + 1 
                    WHERE id = ?
                `, [reviewId]);
            }

            return true;

        } catch (error) {
            logger.error('Failed to vote helpful:', error);
            throw error;
        }
    }

    /**
     * レビュー通報
     */
    async reportReview(reviewId, reporterId, reporterIp, reason, details) {
        try {
            await this.db.execute(`
                INSERT INTO review_reports 
                (review_id, reporter_id, reporter_ip, reason, details)
                VALUES (?, ?, ?, ?, ?)
            `, [reviewId, reporterId, reporterIp, reason, details]);

            // 通報カウント更新
            await this.db.execute(`
                UPDATE reviews SET report_count = report_count + 1 
                WHERE id = ?
            `, [reviewId]);

            return true;

        } catch (error) {
            logger.error('Failed to report review:', error);
            throw error;
        }
    }

    /**
     * 統計更新
     */
    async updateStatistics(serviceType) {
        try {
            const [stats] = await this.db.execute(`
                SELECT 
                    COUNT(*) as total_reviews,
                    AVG(rating) as average_rating,
                    AVG(therapist_rating) as avg_therapist,
                    AVG(service_rating) as avg_service,
                    AVG(value_rating) as avg_value,
                    AVG(cleanliness_rating) as avg_cleanliness,
                    AVG(communication_rating) as avg_communication
                FROM reviews 
                WHERE service_type = ? AND status = 'approved'
            `, [serviceType]);

            // 評価分布計算
            const [distribution] = await this.db.execute(`
                SELECT rating, COUNT(*) as count
                FROM reviews 
                WHERE service_type = ? AND status = 'approved'
                GROUP BY rating
            `, [serviceType]);

            const ratingDistribution = {};
            distribution.forEach(item => {
                ratingDistribution[item.rating] = item.count;
            });

            const stat = stats[0];

            await this.db.execute(`
                INSERT INTO review_statistics 
                (service_type, total_reviews, average_rating, rating_distribution,
                 total_therapist_rating, total_service_rating, total_value_rating,
                 total_cleanliness_rating, total_communication_rating)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                total_reviews = VALUES(total_reviews),
                average_rating = VALUES(average_rating),
                rating_distribution = VALUES(rating_distribution),
                total_therapist_rating = VALUES(total_therapist_rating),
                total_service_rating = VALUES(total_service_rating),
                total_value_rating = VALUES(total_value_rating),
                total_cleanliness_rating = VALUES(total_cleanliness_rating),
                total_communication_rating = VALUES(total_communication_rating)
            `, [
                serviceType,
                stat.total_reviews,
                stat.average_rating,
                JSON.stringify(ratingDistribution),
                stat.avg_therapist,
                stat.avg_service,
                stat.avg_value,
                stat.avg_cleanliness,
                stat.avg_communication
            ]);

        } catch (error) {
            logger.error('Failed to update statistics:', error);
            throw error;
        }
    }

    /**
     * 統計取得
     */
    async getStatistics(serviceType = null) {
        try {
            let query = 'SELECT * FROM review_statistics';
            const params = [];

            if (serviceType) {
                query += ' WHERE service_type = ?';
                params.push(serviceType);
            }

            const [stats] = await this.db.execute(query, params);

            return stats.map(stat => ({
                ...stat,
                rating_distribution: JSON.parse(stat.rating_distribution || '{}')
            }));

        } catch (error) {
            logger.error('Failed to get statistics:', error);
            throw error;
        }
    }
}

module.exports = ReviewModel;