/**
 * アップロードAPI ルート
 * Upload API routes for file management
 */

const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { 
    upload, 
    processImages, 
    handleUploadSuccess, 
    handleUploadError,
    uploadLimiter,
    deleteFile,
    UPLOAD_CATEGORIES 
} = require('../middleware/upload');
const { adminAuditLogger } = require('../middleware/auditLogger');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * 画像アップロード（単一ファイル）
 * POST /api/v1/upload/image/:category
 */
router.post('/image/:category', 
    uploadLimiter,
    authenticateToken,
    requireRole(['admin', 'therapist']),
    adminAuditLogger(),
    (req, res, next) => {
        const category = req.params.category;
        
        // カテゴリ検証
        if (!Object.keys(UPLOAD_CATEGORIES).includes(category)) {
            return res.status(400).json({
                error: 'Invalid Category',
                message: `無効なカテゴリです。対応カテゴリ: ${Object.keys(UPLOAD_CATEGORIES).join(', ')}`
            });
        }
        
        next();
    },
    upload.single('image'),
    processImages,
    handleUploadSuccess,
    (req, res) => {
        const uploadedFile = req.uploadedFiles[0];
        
        if (!uploadedFile) {
            return res.status(400).json({
                error: 'No File',
                message: 'アップロードするファイルが選択されていません。'
            });
        }
        
        res.json({
            success: true,
            message: 'ファイルアップロードが完了しました。',
            file: uploadedFile
        });
    },
    handleUploadError
);

/**
 * 複数画像アップロード
 * POST /api/v1/upload/images/:category
 */
router.post('/images/:category',
    uploadLimiter,
    authenticateToken,
    requireRole(['admin', 'therapist']),
    adminAuditLogger(),
    (req, res, next) => {
        const category = req.params.category;
        
        if (!Object.keys(UPLOAD_CATEGORIES).includes(category)) {
            return res.status(400).json({
                error: 'Invalid Category',
                message: `無効なカテゴリです。対応カテゴリ: ${Object.keys(UPLOAD_CATEGORIES).join(', ')}`
            });
        }
        
        next();
    },
    upload.array('images', 5),
    processImages,
    handleUploadSuccess,
    (req, res) => {
        const uploadedFiles = req.uploadedFiles;
        
        if (!uploadedFiles || uploadedFiles.length === 0) {
            return res.status(400).json({
                error: 'No Files',
                message: 'アップロードするファイルが選択されていません。'
            });
        }
        
        res.json({
            success: true,
            message: `${uploadedFiles.length}個のファイルアップロードが完了しました。`,
            files: uploadedFiles,
            count: uploadedFiles.length
        });
    },
    handleUploadError
);

/**
 * セラピスト用プロフィール画像アップロード
 * POST /api/v1/upload/therapist/profile/:therapistId
 */
router.post('/therapist/profile/:therapistId',
    uploadLimiter,
    authenticateToken,
    requireRole(['admin', 'therapist']),
    adminAuditLogger(),
    (req, res, next) => {
        // セラピストは自分の画像のみアップロード可能
        if (req.user.role === 'therapist' && req.user.id !== parseInt(req.params.therapistId)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: '他のセラピストの画像はアップロードできません。'
            });
        }
        
        req.params.category = 'therapists';
        next();
    },
    upload.single('profileImage'),
    processImages,
    handleUploadSuccess,
    async (req, res) => {
        const uploadedFile = req.uploadedFiles[0];
        const therapistId = req.params.therapistId;
        
        if (!uploadedFile) {
            return res.status(400).json({
                error: 'No File',
                message: 'プロフィール画像が選択されていません。'
            });
        }
        
        try {
            // TODO: データベースのtherapistsテーブルを更新
            // await db.query('UPDATE therapists SET profile_image = ? WHERE id = ?', [uploadedFile.filename, therapistId]);
            
            logger.info(`Therapist profile image updated: ${therapistId}`, {
                filename: uploadedFile.filename,
                userId: req.user.id
            });
            
            res.json({
                success: true,
                message: 'プロフィール画像が更新されました。',
                file: uploadedFile,
                therapistId: therapistId
            });
        } catch (error) {
            logger.error('Failed to update therapist profile image:', error);
            res.status(500).json({
                error: 'Database Error',
                message: 'データベース更新エラーが発生しました。'
            });
        }
    },
    handleUploadError
);

/**
 * ホテル画像アップロード
 * POST /api/v1/upload/hotel/:hotelId
 */
router.post('/hotel/:hotelId',
    uploadLimiter,
    authenticateToken,
    requireRole(['admin']),
    adminAuditLogger(),
    (req, res, next) => {
        req.params.category = 'hotels';
        next();
    },
    upload.array('hotelImages', 3),
    processImages,
    handleUploadSuccess,
    async (req, res) => {
        const uploadedFiles = req.uploadedFiles;
        const hotelId = req.params.hotelId;
        
        if (!uploadedFiles || uploadedFiles.length === 0) {
            return res.status(400).json({
                error: 'No Files',
                message: 'ホテル画像が選択されていません。'
            });
        }
        
        try {
            // TODO: データベースのhotelsテーブルを更新
            const imageFilenames = uploadedFiles.map(file => file.filename);
            // await db.query('UPDATE hotels SET images = ? WHERE id = ?', [JSON.stringify(imageFilenames), hotelId]);
            
            logger.info(`Hotel images updated: ${hotelId}`, {
                images: imageFilenames,
                count: uploadedFiles.length,
                userId: req.user.id
            });
            
            res.json({
                success: true,
                message: `ホテル画像${uploadedFiles.length}枚が更新されました。`,
                files: uploadedFiles,
                hotelId: hotelId
            });
        } catch (error) {
            logger.error('Failed to update hotel images:', error);
            res.status(500).json({
                error: 'Database Error',
                message: 'データベース更新エラーが発生しました。'
            });
        }
    },
    handleUploadError
);

/**
 * ファイル削除
 * DELETE /api/v1/upload/file/:category/:filename
 */
router.delete('/file/:category/:filename',
    authenticateToken,
    requireRole(['admin']),
    adminAuditLogger(),
    async (req, res) => {
        const { category, filename } = req.params;
        
        try {
            const deleted = await deleteFile(filename, category);
            
            if (deleted) {
                logger.info(`File deleted: ${category}/${filename}`, {
                    userId: req.user.id
                });
                
                res.json({
                    success: true,
                    message: 'ファイルが削除されました。',
                    filename: filename,
                    category: category
                });
            } else {
                res.status(404).json({
                    error: 'File Not Found',
                    message: 'ファイルが見つかりません。'
                });
            }
        } catch (error) {
            logger.error('File deletion failed:', error);
            res.status(500).json({
                error: 'Deletion Failed',
                message: 'ファイル削除に失敗しました。'
            });
        }
    }
);

/**
 * アップロード設定情報取得
 * GET /api/v1/upload/config
 */
router.get('/config',
    authenticateToken,
    (req, res) => {
        res.json({
            categories: Object.keys(UPLOAD_CATEGORIES),
            maxFileSize: process.env.UPLOAD_MAX_SIZE || 10485760,
            allowedTypes: (process.env.UPLOAD_ALLOWED_TYPES || 'image/jpeg,image/png,image/webp').split(','),
            maxFiles: 5,
            optimizationEnabled: true,
            formats: {
                therapists: { width: 400, height: 400, quality: 90 },
                hotels: { width: 800, height: 600, quality: 85 },
                safety: { width: 600, height: 400, quality: 80 },
                articles: { width: 1200, height: 800, quality: 80 },
                manga: { width: 800, height: 600, quality: 85 },
                customers: { width: 200, height: 200, quality: 90 }
            }
        });
    }
);

/**
 * カテゴリ別ファイル一覧取得
 * GET /api/v1/upload/files/:category
 */
router.get('/files/:category',
    authenticateToken,
    requireRole(['admin', 'therapist']),
    async (req, res) => {
        const { category } = req.params;
        const { page = 1, limit = 20 } = req.query;
        
        if (!Object.keys(UPLOAD_CATEGORIES).includes(category)) {
            return res.status(400).json({
                error: 'Invalid Category',
                message: `無効なカテゴリです。対応カテゴリ: ${Object.keys(UPLOAD_CATEGORIES).join(', ')}`
            });
        }
        
        try {
            // TODO: データベースからファイル一覧を取得
            // const files = await getFilesByCategory(category, page, limit);
            
            // 仮のレスポンス
            const files = [];
            
            res.json({
                success: true,
                category: category,
                files: files,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: files.length
                }
            });
        } catch (error) {
            logger.error('Failed to retrieve files:', error);
            res.status(500).json({
                error: 'Database Error',
                message: 'ファイル一覧の取得に失敗しました。'
            });
        }
    }
);

module.exports = router;