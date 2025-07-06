/**
 * 監査ログミドルウェア
 * Audit logging middleware for security compliance
 */

const { logger } = require('../utils/logger');
const { getClientIP } = require('./security');

/**
 * 監査ログエントリーの作成
 */
async function createAuditLog({
    userId = null,
    action,
    resource,
    resourceId = null,
    oldValues = null,
    newValues = null,
    ipAddress,
    userAgent,
    requestId,
    success = true,
    errorMessage = null,
    metadata = {}
}) {
    const auditEntry = {
        timestamp: new Date().toISOString(),
        userId,
        action,
        resource,
        resourceId,
        oldValues: oldValues ? JSON.stringify(oldValues) : null,
        newValues: newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        userAgent,
        requestId,
        success,
        errorMessage,
        metadata: JSON.stringify(metadata)
    };

    // データベースに保存する場合
    try {
        // TODO: データベースのaudit_logsテーブルに保存
        // await db.query('INSERT INTO audit_logs SET ?', auditEntry);
        
        // ファイルログとしても記録
        logger.info('AUDIT_LOG', auditEntry);
        
    } catch (error) {
        logger.error('Failed to create audit log:', error);
    }
}

/**
 * 監査ログミドルウェア
 */
function auditLogger(options = {}) {
    const {
        actions = ['CREATE', 'UPDATE', 'DELETE'],
        resource = 'UNKNOWN',
        skipSuccessful = false
    } = options;

    return async (req, res, next) => {
        const startTime = Date.now();
        const clientIP = getClientIP(req);
        const userAgent = req.get('User-Agent') || '';
        const requestId = req.requestId;
        const userId = req.user ? req.user.id : null;

        // リクエストメソッドからアクションを決定
        const methodToAction = {
            POST: 'CREATE',
            PUT: 'UPDATE',
            PATCH: 'UPDATE',
            DELETE: 'DELETE',
            GET: 'READ'
        };

        const action = methodToAction[req.method] || 'UNKNOWN';

        // 監査対象のアクションかチェック
        if (!actions.includes(action)) {
            return next();
        }

        // 元のレスポンス処理をラップ
        const originalSend = res.send;
        let responseData = null;
        let oldValues = null;

        // リクエストボディを保存（新しい値として）
        const newValues = req.body || null;

        res.send = function(data) {
            try {
                responseData = typeof data === 'string' ? JSON.parse(data) : data;
            } catch (e) {
                responseData = data;
            }
            return originalSend.call(this, data);
        };

        // レスポンス完了時の処理
        res.on('finish', async () => {
            const success = res.statusCode < 400;
            const duration = Date.now() - startTime;

            // 成功したリクエストをスキップする設定の場合
            if (skipSuccessful && success) {
                return;
            }

            // リソースIDを抽出
            const resourceId = req.params.id || 
                              (responseData && responseData.id) || 
                              (req.body && req.body.id) || 
                              null;

            // エラーメッセージの抽出
            const errorMessage = !success && responseData ? 
                                (responseData.message || responseData.error || 'Unknown error') : 
                                null;

            // メタデータの構築
            const metadata = {
                path: req.path,
                method: req.method,
                statusCode: res.statusCode,
                duration: `${duration}ms`,
                query: req.query || {},
                params: req.params || {}
            };

            // 監査ログの作成
            await createAuditLog({
                userId,
                action,
                resource,
                resourceId,
                oldValues,
                newValues,
                ipAddress: clientIP,
                userAgent,
                requestId,
                success,
                errorMessage,
                metadata
            });
        });

        next();
    };
}

/**
 * 認証イベント用監査ログ
 */
async function logAuthEvent(eventType, userId, success = true, details = {}) {
    const auditEntry = {
        timestamp: new Date().toISOString(),
        userId,
        action: eventType,
        resource: 'AUTH',
        resourceId: userId,
        success,
        metadata: JSON.stringify({
            eventType,
            ...details
        })
    };

    try {
        logger.info('AUTH_AUDIT_LOG', auditEntry);
    } catch (error) {
        logger.error('Failed to log auth event:', error);
    }
}

/**
 * データ変更用監査ログ
 */
async function logDataChange(req, resource, action, resourceId, oldData = null, newData = null) {
    const clientIP = getClientIP(req);
    const userAgent = req.get('User-Agent') || '';
    const userId = req.user ? req.user.id : null;

    await createAuditLog({
        userId,
        action,
        resource,
        resourceId,
        oldValues: oldData,
        newValues: newData,
        ipAddress: clientIP,
        userAgent,
        requestId: req.requestId,
        success: true,
        metadata: {
            path: req.path,
            method: req.method
        }
    });
}

/**
 * セキュリティイベント用ログ
 */
async function logSecurityEvent(eventType, details = {}) {
    const securityEntry = {
        timestamp: new Date().toISOString(),
        eventType,
        severity: details.severity || 'MEDIUM',
        description: details.description || '',
        ipAddress: details.ipAddress || 'unknown',
        userAgent: details.userAgent || '',
        userId: details.userId || null,
        metadata: JSON.stringify(details)
    };

    try {
        logger.warn('SECURITY_EVENT', securityEntry);
        
        // 高重要度のセキュリティイベントは別途アラート
        if (details.severity === 'HIGH' || details.severity === 'CRITICAL') {
            logger.error('HIGH_PRIORITY_SECURITY_EVENT', securityEntry);
            // TODO: アラート通知システムと連携
        }
        
    } catch (error) {
        logger.error('Failed to log security event:', error);
    }
}

/**
 * 管理者アクション用監査ログ
 */
function adminAuditLogger() {
    return auditLogger({
        actions: ['CREATE', 'UPDATE', 'DELETE', 'READ'],
        resource: 'ADMIN',
        skipSuccessful: false
    });
}

/**
 * ユーザーアクション用監査ログ
 */
function userAuditLogger() {
    return auditLogger({
        actions: ['CREATE', 'UPDATE', 'DELETE'],
        resource: 'USER',
        skipSuccessful: true
    });
}

/**
 * 予約システム用監査ログ
 */
function bookingAuditLogger() {
    return auditLogger({
        actions: ['CREATE', 'UPDATE', 'DELETE'],
        resource: 'BOOKING',
        skipSuccessful: false
    });
}

module.exports = {
    createAuditLog,
    auditLogger,
    logAuthEvent,
    logDataChange,
    logSecurityEvent,
    adminAuditLogger,
    userAuditLogger,
    bookingAuditLogger
};