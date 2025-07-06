/**
 * 監査ログユーティリティ
 * Audit log utility for Ainaru Massage CMS
 */

const { query } = require('../config/database');
const { logger } = require('./logger');

/**
 * 監査ログを記録
 * @param {number} userId - ユーザーID
 * @param {string} action - アクション
 * @param {string} entityType - エンティティタイプ
 * @param {number} entityId - エンティティID
 * @param {object} oldValues - 変更前の値
 * @param {object} newValues - 変更後の値
 * @param {string} ipAddress - IPアドレス
 * @param {string} userAgent - ユーザーエージェント
 */
async function sendAuditLog(
    userId,
    action,
    entityType = null,
    entityId = null,
    oldValues = null,
    newValues = null,
    ipAddress = null,
    userAgent = null
) {
    try {
        await query(
            `INSERT INTO audit_logs 
             (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                action,
                entityType,
                entityId,
                oldValues ? JSON.stringify(oldValues) : null,
                newValues ? JSON.stringify(newValues) : null,
                ipAddress,
                userAgent
            ]
        );

        logger.info('監査ログ記録', {
            userId,
            action,
            entityType,
            entityId
        });
    } catch (error) {
        logger.error('監査ログ記録エラー:', error);
        // 監査ログの失敗は業務処理を止めない
    }
}

/**
 * 監査ログを取得
 * @param {object} filters - フィルター条件
 * @param {number} page - ページ番号
 * @param {number} limit - 取得件数
 */
async function getAuditLogs(filters = {}, page = 1, limit = 50) {
    try {
        let whereClause = 'WHERE 1=1';
        const params = [];

        // フィルター処理
        if (filters.userId) {
            whereClause += ' AND user_id = ?';
            params.push(filters.userId);
        }

        if (filters.action) {
            whereClause += ' AND action = ?';
            params.push(filters.action);
        }

        if (filters.entityType) {
            whereClause += ' AND entity_type = ?';
            params.push(filters.entityType);
        }

        if (filters.entityId) {
            whereClause += ' AND entity_id = ?';
            params.push(filters.entityId);
        }

        if (filters.startDate) {
            whereClause += ' AND created_at >= ?';
            params.push(filters.startDate);
        }

        if (filters.endDate) {
            whereClause += ' AND created_at <= ?';
            params.push(filters.endDate);
        }

        // 総件数取得
        const totalCountQuery = `
            SELECT COUNT(*) as total 
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            ${whereClause}
        `;
        const totalResult = await query(totalCountQuery, params);
        const total = totalResult[0].total;

        // データ取得
        const offset = (page - 1) * limit;
        const dataQuery = `
            SELECT 
                al.*,
                u.username,
                u.email
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            ${whereClause}
            ORDER BY al.created_at DESC
            LIMIT ? OFFSET ?
        `;
        
        const logs = await query(dataQuery, [...params, limit, offset]);

        // JSONフィールドをパース
        const parsedLogs = logs.map(log => ({
            ...log,
            old_values: log.old_values ? JSON.parse(log.old_values) : null,
            new_values: log.new_values ? JSON.parse(log.new_values) : null
        }));

        return {
            logs: parsedLogs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    } catch (error) {
        logger.error('監査ログ取得エラー:', error);
        throw error;
    }
}

/**
 * 特定エンティティの変更履歴を取得
 * @param {string} entityType - エンティティタイプ
 * @param {number} entityId - エンティティID
 */
async function getEntityHistory(entityType, entityId) {
    try {
        const logs = await query(
            `SELECT 
                al.*,
                u.username,
                u.email
             FROM audit_logs al
             LEFT JOIN users u ON al.user_id = u.id
             WHERE al.entity_type = ? AND al.entity_id = ?
             ORDER BY al.created_at DESC`,
            [entityType, entityId]
        );

        return logs.map(log => ({
            ...log,
            old_values: log.old_values ? JSON.parse(log.old_values) : null,
            new_values: log.new_values ? JSON.parse(log.new_values) : null
        }));
    } catch (error) {
        logger.error('エンティティ履歴取得エラー:', error);
        throw error;
    }
}

/**
 * ユーザーの操作履歴を取得
 * @param {number} userId - ユーザーID
 * @param {number} limit - 取得件数
 */
async function getUserActivityLog(userId, limit = 100) {
    try {
        const logs = await query(
            `SELECT * FROM audit_logs 
             WHERE user_id = ? 
             ORDER BY created_at DESC 
             LIMIT ?`,
            [userId, limit]
        );

        return logs.map(log => ({
            ...log,
            old_values: log.old_values ? JSON.parse(log.old_values) : null,
            new_values: log.new_values ? JSON.parse(log.new_values) : null
        }));
    } catch (error) {
        logger.error('ユーザー活動ログ取得エラー:', error);
        throw error;
    }
}

/**
 * 統計情報を取得
 */
async function getAuditStatistics(days = 30) {
    try {
        const stats = await query(
            `SELECT 
                action,
                COUNT(*) as count,
                DATE(created_at) as date
             FROM audit_logs 
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
             GROUP BY action, DATE(created_at)
             ORDER BY date DESC, count DESC`,
            [days]
        );

        // アクション別統計
        const actionStats = await query(
            `SELECT 
                action,
                COUNT(*) as total_count,
                COUNT(DISTINCT user_id) as unique_users
             FROM audit_logs 
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
             GROUP BY action
             ORDER BY total_count DESC`,
            [days]
        );

        return {
            dailyStats: stats,
            actionStats
        };
    } catch (error) {
        logger.error('監査統計取得エラー:', error);
        throw error;
    }
}

module.exports = {
    sendAuditLog,
    getAuditLogs,
    getEntityHistory,
    getUserActivityLog,
    getAuditStatistics
};