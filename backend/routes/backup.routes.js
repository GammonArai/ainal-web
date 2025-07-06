/**
 * バックアップAPI ルート
 * Backup API routes for system backup and restoration
 */

const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { adminAuditLogger } = require('../middleware/auditLogger');
const { logger } = require('../utils/logger');
const BackupService = require('../services/backupService');

const router = express.Router();
const backupService = new BackupService();

/**
 * バックアップ一覧取得
 * GET /api/v1/backup/list
 */
router.get('/list',
    authenticateToken,
    requireRole(['admin']),
    async (req, res) => {
        try {
            const backups = await backupService.listBackups();
            
            res.json({
                success: true,
                backups: backups,
                total: backups.length
            });
            
        } catch (error) {
            logger.error('Failed to list backups:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'バックアップ一覧の取得に失敗しました'
            });
        }
    }
);

/**
 * システム状態取得
 * GET /api/v1/backup/status
 */
router.get('/status',
    authenticateToken,
    requireRole(['admin']),
    async (req, res) => {
        try {
            const status = await backupService.getSystemStatus();
            
            res.json({
                success: true,
                status: status
            });
            
        } catch (error) {
            logger.error('Failed to get backup status:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'システム状態の取得に失敗しました'
            });
        }
    }
);

/**
 * データベースバックアップ作成
 * POST /api/v1/backup/database
 */
router.post('/database',
    authenticateToken,
    requireRole(['admin']),
    adminAuditLogger(),
    async (req, res) => {
        try {
            logger.info(`Database backup requested by user: ${req.user.id}`);
            
            const result = await backupService.backupDatabase();
            
            res.json({
                success: true,
                message: 'データベースバックアップが完了しました',
                backup: result
            });
            
        } catch (error) {
            logger.error('Database backup failed:', error);
            res.status(500).json({
                error: 'Backup Failed',
                message: 'データベースバックアップに失敗しました'
            });
        }
    }
);

/**
 * ファイルバックアップ作成
 * POST /api/v1/backup/files
 */
router.post('/files',
    authenticateToken,
    requireRole(['admin']),
    adminAuditLogger(),
    async (req, res) => {
        try {
            logger.info(`Files backup requested by user: ${req.user.id}`);
            
            const result = await backupService.backupFiles();
            
            res.json({
                success: true,
                message: 'ファイルバックアップが完了しました',
                backup: result
            });
            
        } catch (error) {
            logger.error('Files backup failed:', error);
            res.status(500).json({
                error: 'Backup Failed',
                message: 'ファイルバックアップに失敗しました'
            });
        }
    }
);

/**
 * フルバックアップ作成
 * POST /api/v1/backup/full
 */
router.post('/full',
    authenticateToken,
    requireRole(['admin']),
    adminAuditLogger(),
    async (req, res) => {
        try {
            logger.info(`Full backup requested by user: ${req.user.id}`);
            
            const result = await backupService.createFullBackup();
            
            res.json({
                success: true,
                message: 'フルバックアップが完了しました',
                backup: result
            });
            
        } catch (error) {
            logger.error('Full backup failed:', error);
            res.status(500).json({
                error: 'Backup Failed',
                message: 'フルバックアップに失敗しました'
            });
        }
    }
);

/**
 * データベース復元
 * POST /api/v1/backup/restore/database
 */
router.post('/restore/database',
    authenticateToken,
    requireRole(['admin']),
    adminAuditLogger(),
    async (req, res) => {
        try {
            const { backupPath } = req.body;
            
            if (!backupPath) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'バックアップファイルパスが指定されていません'
                });
            }
            
            logger.info(`Database restoration requested by user: ${req.user.id}, backup: ${backupPath}`);
            
            const result = await backupService.restoreDatabase(backupPath);
            
            res.json({
                success: true,
                message: 'データベース復元が完了しました',
                restoration: result
            });
            
        } catch (error) {
            logger.error('Database restoration failed:', error);
            res.status(500).json({
                error: 'Restoration Failed',
                message: 'データベース復元に失敗しました'
            });
        }
    }
);

/**
 * ファイル復元
 * POST /api/v1/backup/restore/files
 */
router.post('/restore/files',
    authenticateToken,
    requireRole(['admin']),
    adminAuditLogger(),
    async (req, res) => {
        try {
            const { backupPath, targetDir } = req.body;
            
            if (!backupPath) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'バックアップファイルパスが指定されていません'
                });
            }
            
            logger.info(`Files restoration requested by user: ${req.user.id}, backup: ${backupPath}`);
            
            const result = await backupService.restoreFiles(backupPath, targetDir);
            
            res.json({
                success: true,
                message: 'ファイル復元が完了しました',
                restoration: result
            });
            
        } catch (error) {
            logger.error('Files restoration failed:', error);
            res.status(500).json({
                error: 'Restoration Failed',
                message: 'ファイル復元に失敗しました'
            });
        }
    }
);

/**
 * バックアップ削除
 * DELETE /api/v1/backup/:filename
 */
router.delete('/:filename',
    authenticateToken,
    requireRole(['admin']),
    adminAuditLogger(),
    async (req, res) => {
        try {
            const { filename } = req.params;
            const { type } = req.query; // database, files, full
            
            if (!type || !['database', 'files', 'full'].includes(type)) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: '無効なバックアップタイプです'
                });
            }
            
            const backupPath = require('path').join(
                backupService.backupDir,
                type,
                filename
            );
            
            logger.info(`Backup deletion requested by user: ${req.user.id}, file: ${backupPath}`);
            
            const result = await backupService.deleteBackup(backupPath);
            
            res.json({
                success: true,
                message: 'バックアップが削除されました',
                deletion: result
            });
            
        } catch (error) {
            logger.error('Backup deletion failed:', error);
            res.status(500).json({
                error: 'Deletion Failed',
                message: 'バックアップ削除に失敗しました'
            });
        }
    }
);

/**
 * バックアップ検証
 * POST /api/v1/backup/verify
 */
router.post('/verify',
    authenticateToken,
    requireRole(['admin']),
    async (req, res) => {
        try {
            const { backupPath } = req.body;
            
            if (!backupPath) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: 'バックアップファイルパスが指定されていません'
                });
            }
            
            const result = await backupService.verifyBackup(backupPath);
            
            res.json({
                success: true,
                verification: result
            });
            
        } catch (error) {
            logger.error('Backup verification failed:', error);
            res.status(500).json({
                error: 'Verification Failed',
                message: 'バックアップ検証に失敗しました'
            });
        }
    }
);

/**
 * 古いバックアップクリーンアップ
 * POST /api/v1/backup/cleanup
 */
router.post('/cleanup',
    authenticateToken,
    requireRole(['admin']),
    adminAuditLogger(),
    async (req, res) => {
        try {
            logger.info(`Backup cleanup requested by user: ${req.user.id}`);
            
            const deletedCount = await backupService.cleanupOldBackups();
            
            res.json({
                success: true,
                message: `${deletedCount}個の古いバックアップを削除しました`,
                deletedCount: deletedCount
            });
            
        } catch (error) {
            logger.error('Backup cleanup failed:', error);
            res.status(500).json({
                error: 'Cleanup Failed',
                message: 'バックアップクリーンアップに失敗しました'
            });
        }
    }
);

/**
 * バックアップダウンロード
 * GET /api/v1/backup/download/:filename
 */
router.get('/download/:filename',
    authenticateToken,
    requireRole(['admin']),
    async (req, res) => {
        try {
            const { filename } = req.params;
            const { type } = req.query;
            
            if (!type || !['database', 'files', 'full'].includes(type)) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: '無効なバックアップタイプです'
                });
            }
            
            const backupPath = require('path').join(
                backupService.backupDir,
                type,
                filename
            );
            
            // ファイル存在確認
            const fs = require('fs').promises;
            await fs.access(backupPath);
            
            logger.info(`Backup download requested by user: ${req.user.id}, file: ${backupPath}`);
            
            // ファイルをダウンロード
            res.download(backupPath, filename, (error) => {
                if (error) {
                    logger.error('Backup download failed:', error);
                    if (!res.headersSent) {
                        res.status(500).json({
                            error: 'Download Failed',
                            message: 'バックアップダウンロードに失敗しました'
                        });
                    }
                }
            });
            
        } catch (error) {
            logger.error('Backup download failed:', error);
            res.status(500).json({
                error: 'Download Failed',
                message: 'バックアップダウンロードに失敗しました'
            });
        }
    }
);

module.exports = router;