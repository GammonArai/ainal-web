/**
 * ファイルアップロードミドルウェア
 * File upload middleware with security controls
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const { logger } = require('../utils/logger');
const { uploadLimiter } = require('./security');

// アップロード設定
const UPLOAD_DIR = path.join(__dirname, '../uploads');
const MAX_FILE_SIZE = parseInt(process.env.UPLOAD_MAX_SIZE) || 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = (process.env.UPLOAD_ALLOWED_TYPES || 'image/jpeg,image/png,image/webp').split(',');

// ディレクトリ構造
const UPLOAD_CATEGORIES = {
    therapists: 'therapists',
    hotels: 'hotels',
    safety: 'safety',
    articles: 'articles',
    manga: 'manga',
    customers: 'customers',
    temp: 'temp'
};

/**
 * アップロードディレクトリの初期化
 */
async function initializeUploadDirectories() {
    try {
        // メインディレクトリ作成
        await fs.mkdir(UPLOAD_DIR, { recursive: true });
        
        // サブディレクトリ作成
        for (const category of Object.values(UPLOAD_CATEGORIES)) {
            const categoryDir = path.join(UPLOAD_DIR, category);
            await fs.mkdir(categoryDir, { recursive: true });
            logger.info(`Upload directory created: ${categoryDir}`);
        }
        
        logger.info('Upload directories initialized successfully');
    } catch (error) {
        logger.error('Failed to initialize upload directories:', error);
        throw error;
    }
}

/**
 * ファイル名のサニタイズ
 */
function sanitizeFilename(filename) {
    // 危険な文字を除去
    const sanitized = filename
        .replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF.-]/g, '_')
        .replace(/\.+/g, '.')
        .replace(/^\./, '')
        .toLowerCase();
    
    // 最大長制限
    const maxLength = 100;
    if (sanitized.length > maxLength) {
        const ext = path.extname(sanitized);
        const name = path.basename(sanitized, ext);
        return name.substring(0, maxLength - ext.length) + ext;
    }
    
    return sanitized;
}

/**
 * ストレージ設定
 */
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const category = req.params.category || req.body.category || 'temp';
        const uploadPath = path.join(UPLOAD_DIR, UPLOAD_CATEGORIES[category] || 'temp');
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 8);
        const sanitizedName = sanitizeFilename(file.originalname);
        const ext = path.extname(sanitizedName);
        const name = path.basename(sanitizedName, ext);
        
        const filename = `${timestamp}_${randomString}_${name}${ext}`;
        cb(null, filename);
    }
});

/**
 * ファイル検証
 */
function fileFilter(req, file, cb) {
    // MIMEタイプチェック
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
        const error = new Error(`許可されていないファイル形式です。対応形式: ${ALLOWED_TYPES.join(', ')}`);
        error.code = 'INVALID_FILE_TYPE';
        return cb(error, false);
    }
    
    // ファイル名チェック
    if (!file.originalname) {
        const error = new Error('ファイル名が無効です');
        error.code = 'INVALID_FILENAME';
        return cb(error, false);
    }
    
    // 拡張子チェック
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
        const error = new Error(`許可されていない拡張子です。対応拡張子: ${allowedExtensions.join(', ')}`);
        error.code = 'INVALID_EXTENSION';
        return cb(error, false);
    }
    
    cb(null, true);
}

/**
 * Multer設定
 */
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 5, // 最大5ファイル
        fields: 10
    }
});

/**
 * 画像最適化処理
 */
async function optimizeImage(filePath, options = {}) {
    try {
        const {
            width = 800,
            height = 600,
            quality = 85,
            format = 'webp'
        } = options;
        
        const outputPath = filePath.replace(/\.[^/.]+$/, `.optimized.${format}`);
        
        await sharp(filePath)
            .resize(width, height, { 
                fit: 'inside',
                withoutEnlargement: true 
            })
            .webp({ quality })
            .toFile(outputPath);
        
        // 元ファイルを削除
        await fs.unlink(filePath);
        
        logger.info(`Image optimized: ${outputPath}`);
        return outputPath;
        
    } catch (error) {
        logger.error('Image optimization failed:', error);
        throw error;
    }
}

/**
 * 画像処理ミドルウェア
 */
async function processImages(req, res, next) {
    if (!req.files && !req.file) {
        return next();
    }
    
    try {
        const files = req.files || [req.file];
        const processedFiles = [];
        
        for (const file of files) {
            if (file && file.mimetype.startsWith('image/')) {
                const category = req.params.category || req.body.category || 'temp';
                
                // カテゴリ別の最適化設定
                const optimizationSettings = {
                    therapists: { width: 400, height: 400, quality: 90 },
                    hotels: { width: 800, height: 600, quality: 85 },
                    safety: { width: 600, height: 400, quality: 80 },
                    articles: { width: 1200, height: 800, quality: 80 },
                    manga: { width: 800, height: 600, quality: 85 },
                    customers: { width: 200, height: 200, quality: 90 }
                };
                
                const settings = optimizationSettings[category] || { width: 800, height: 600, quality: 85 };
                
                const optimizedPath = await optimizeImage(file.path, settings);
                
                processedFiles.push({
                    ...file,
                    path: optimizedPath,
                    filename: path.basename(optimizedPath),
                    optimized: true
                });
            } else {
                processedFiles.push(file);
            }
        }
        
        if (req.files) {
            req.files = processedFiles;
        } else {
            req.file = processedFiles[0];
        }
        
        next();
    } catch (error) {
        logger.error('Image processing failed:', error);
        next(error);
    }
}

/**
 * アップロード完了後の処理
 */
function handleUploadSuccess(req, res, next) {
    const files = req.files || [req.file];
    const uploadedFiles = [];
    
    files.forEach(file => {
        if (file) {
            const fileInfo = {
                originalName: file.originalname,
                filename: file.filename,
                path: file.path,
                size: file.size,
                mimetype: file.mimetype,
                category: req.params.category || req.body.category || 'temp',
                url: `/uploads/${path.basename(path.dirname(file.path))}/${file.filename}`,
                uploadedAt: new Date().toISOString()
            };
            
            uploadedFiles.push(fileInfo);
            
            logger.info('File uploaded successfully', {
                filename: file.filename,
                size: file.size,
                category: fileInfo.category,
                userId: req.user ? req.user.id : null
            });
        }
    });
    
    req.uploadedFiles = uploadedFiles;
    next();
}

/**
 * エラーハンドリング
 */
function handleUploadError(error, req, res, next) {
    logger.error('Upload error:', error);
    
    if (error instanceof multer.MulterError) {
        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                return res.status(400).json({
                    error: 'File Too Large',
                    message: `ファイルサイズが制限を超えています。最大サイズ: ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB`,
                    maxSize: MAX_FILE_SIZE
                });
            case 'LIMIT_FILE_COUNT':
                return res.status(400).json({
                    error: 'Too Many Files',
                    message: '一度にアップロードできるファイル数を超えています。最大5ファイルまで。',
                    maxFiles: 5
                });
            case 'LIMIT_UNEXPECTED_FILE':
                return res.status(400).json({
                    error: 'Unexpected File',
                    message: '予期しないファイルフィールドです。'
                });
            default:
                return res.status(400).json({
                    error: 'Upload Error',
                    message: 'ファイルアップロードエラーが発生しました。',
                    details: error.message
                });
        }
    }
    
    if (error.code === 'INVALID_FILE_TYPE' || error.code === 'INVALID_EXTENSION') {
        return res.status(400).json({
            error: 'Invalid File',
            message: error.message
        });
    }
    
    res.status(500).json({
        error: 'Server Error',
        message: 'サーバーエラーが発生しました。'
    });
}

/**
 * ファイル削除
 */
async function deleteFile(filename, category = 'temp') {
    try {
        const filePath = path.join(UPLOAD_DIR, UPLOAD_CATEGORIES[category] || 'temp', filename);
        await fs.unlink(filePath);
        logger.info(`File deleted: ${filePath}`);
        return true;
    } catch (error) {
        logger.error('File deletion failed:', error);
        return false;
    }
}

/**
 * 古いファイルのクリーンアップ
 */
async function cleanupOldFiles(olderThanDays = 30) {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
        
        for (const category of Object.values(UPLOAD_CATEGORIES)) {
            const categoryDir = path.join(UPLOAD_DIR, category);
            
            try {
                const files = await fs.readdir(categoryDir);
                
                for (const file of files) {
                    const filePath = path.join(categoryDir, file);
                    const stats = await fs.stat(filePath);
                    
                    if (stats.mtime < cutoffDate) {
                        await fs.unlink(filePath);
                        logger.info(`Old file cleaned up: ${filePath}`);
                    }
                }
            } catch (dirError) {
                logger.warn(`Failed to clean category ${category}:`, dirError);
            }
        }
        
        logger.info('File cleanup completed');
    } catch (error) {
        logger.error('File cleanup failed:', error);
    }
}

module.exports = {
    initializeUploadDirectories,
    upload,
    processImages,
    handleUploadSuccess,
    handleUploadError,
    uploadLimiter,
    deleteFile,
    cleanupOldFiles,
    UPLOAD_CATEGORIES
};