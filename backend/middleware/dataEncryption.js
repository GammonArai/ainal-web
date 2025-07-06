/**
 * データ暗号化ミドルウェア
 * Data encryption middleware for sensitive information
 */

const crypto = require('crypto');
const { logger } = require('../utils/logger');

// 暗号化設定
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);
const IV_LENGTH = 16; // For GCM, this is typically 12, but for compatibility using 16

/**
 * データ暗号化
 */
function encryptData(text) {
    try {
        if (!text) return null;
        
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipher(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        // IVと暗号化データを結合
        return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
        logger.error('Encryption failed:', error);
        throw new Error('データの暗号化に失敗しました');
    }
}

/**
 * データ復号化
 */
function decryptData(encryptedText) {
    try {
        if (!encryptedText || typeof encryptedText !== 'string') return null;
        
        const parts = encryptedText.split(':');
        if (parts.length !== 2) {
            throw new Error('Invalid encrypted data format');
        }
        
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedData = parts[1];
        
        const decipher = crypto.createDecipher(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY);
        
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        logger.error('Decryption failed:', error);
        throw new Error('データの復号化に失敗しました');
    }
}

/**
 * 機密データ暗号化ミドルウェア
 */
function encryptSensitiveData(req, res, next) {
    // リクエストボディの機密データを暗号化
    if (req.body) {
        const sensitiveFields = [
            'phone', 'telegramId', 'email', 
            'personalInfo', 'notes', 'address'
        ];
        
        sensitiveFields.forEach(field => {
            if (req.body[field]) {
                req.body[`${field}_encrypted`] = encryptData(req.body[field]);
                delete req.body[field]; // 元のデータを削除
            }
        });
    }
    
    next();
}

/**
 * 機密データ復号化ミドルウェア
 */
function decryptSensitiveData(req, res, next) {
    // レスポンスデータの復号化処理
    const originalSend = res.send;
    
    res.send = function(data) {
        try {
            if (typeof data === 'string') {
                const parsedData = JSON.parse(data);
                const decryptedData = decryptResponseData(parsedData);
                return originalSend.call(this, JSON.stringify(decryptedData));
            }
            return originalSend.call(this, data);
        } catch (error) {
            logger.error('Response decryption failed:', error);
            return originalSend.call(this, data);
        }
    };
    
    next();
}

/**
 * レスポンスデータの復号化
 */
function decryptResponseData(data) {
    if (!data || typeof data !== 'object') return data;
    
    // 配列の場合
    if (Array.isArray(data)) {
        return data.map(item => decryptResponseData(item));
    }
    
    // オブジェクトの場合
    const decryptedData = { ...data };
    
    Object.keys(decryptedData).forEach(key => {
        if (key.endsWith('_encrypted')) {
            const originalKey = key.replace('_encrypted', '');
            try {
                decryptedData[originalKey] = decryptData(decryptedData[key]);
                delete decryptedData[key]; // 暗号化フィールドを削除
            } catch (error) {
                logger.warn(`Failed to decrypt field: ${key}`, error);
                // 復号化に失敗した場合は暗号化フィールドをそのまま残す
            }
        } else if (typeof decryptedData[key] === 'object') {
            decryptedData[key] = decryptResponseData(decryptedData[key]);
        }
    });
    
    return decryptedData;
}

/**
 * ハッシュ化（パスワード等）
 */
function hashData(data, salt = null) {
    try {
        const saltToUse = salt || crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync(data, saltToUse, 10000, 64, 'sha512').toString('hex');
        return `${saltToUse}:${hash}`;
    } catch (error) {
        logger.error('Hashing failed:', error);
        throw new Error('データのハッシュ化に失敗しました');
    }
}

/**
 * ハッシュ検証
 */
function verifyHash(data, hashedData) {
    try {
        const [salt, hash] = hashedData.split(':');
        const computedHash = crypto.pbkdf2Sync(data, salt, 10000, 64, 'sha512').toString('hex');
        return hash === computedHash;
    } catch (error) {
        logger.error('Hash verification failed:', error);
        return false;
    }
}

/**
 * セキュアなランダム文字列生成
 */
function generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * データマスキング（ログ用）
 */
function maskSensitiveData(data) {
    const sensitivePatterns = {
        phone: /(\d{3})\d{4}(\d{4})/,
        email: /(.{2}).*(@.*)/,
        telegramId: /(.{3}).*(.{3})/
    };
    
    if (typeof data !== 'object' || !data) return data;
    
    const maskedData = { ...data };
    
    Object.keys(maskedData).forEach(key => {
        const value = maskedData[key];
        if (typeof value === 'string') {
            if (key.includes('phone') && sensitivePatterns.phone.test(value)) {
                maskedData[key] = value.replace(sensitivePatterns.phone, '$1****$2');
            } else if (key.includes('email') && sensitivePatterns.email.test(value)) {
                maskedData[key] = value.replace(sensitivePatterns.email, '$1***$2');
            } else if (key.includes('telegram') && value.length > 6) {
                maskedData[key] = value.replace(sensitivePatterns.telegramId, '$1***$2');
            }
        }
    });
    
    return maskedData;
}

/**
 * 暗号化キー初期化チェック
 */
function checkEncryptionSetup() {
    if (!process.env.ENCRYPTION_KEY) {
        logger.warn('ENCRYPTION_KEY not set in environment variables. Using temporary key.');
        logger.warn('Please set ENCRYPTION_KEY in production environment for data security.');
        return false;
    }
    
    if (process.env.ENCRYPTION_KEY.length < 32) {
        logger.error('ENCRYPTION_KEY is too short. Must be at least 32 characters.');
        throw new Error('Invalid encryption key length');
    }
    
    return true;
}

module.exports = {
    encryptData,
    decryptData,
    encryptSensitiveData,
    decryptSensitiveData,
    hashData,
    verifyHash,
    generateSecureToken,
    maskSensitiveData,
    checkEncryptionSetup
};