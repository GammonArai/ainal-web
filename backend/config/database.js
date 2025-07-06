/**
 * データベース設定
 * Database configuration for Ainaru Massage CMS
 */

const mysql = require('mysql2/promise');

// 環境変数から設定を読み込み
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ainaru_massage_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    timezone: 'Z',
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true
};

// コネクションプールの作成
let pool;

/**
 * データベース接続プールを初期化
 */
async function initializeDatabase() {
    try {
        pool = mysql.createPool(dbConfig);
        
        // 接続テスト
        const connection = await pool.getConnection();
        console.log('✅ データベース接続成功');
        connection.release();
        
        return pool;
    } catch (error) {
        console.error('❌ データベース接続エラー:', error);
        throw error;
    }
}

/**
 * データベース接続プールを取得
 */
function getPool() {
    if (!pool) {
        throw new Error('データベースプールが初期化されていません');
    }
    return pool;
}

/**
 * トランザクション実行ヘルパー
 */
async function withTransaction(callback) {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        const result = await callback(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * クエリ実行ヘルパー
 */
async function query(sql, params = []) {
    try {
        const [results] = await pool.execute(sql, params);
        return results;
    } catch (error) {
        console.error('クエリ実行エラー:', error);
        throw error;
    }
}

/**
 * 単一行取得ヘルパー
 */
async function queryOne(sql, params = []) {
    const results = await query(sql, params);
    return results[0] || null;
}

/**
 * データベース接続を閉じる
 */
async function closeDatabase() {
    if (pool) {
        await pool.end();
        console.log('データベース接続を閉じました');
    }
}

module.exports = {
    initializeDatabase,
    getPool,
    withTransaction,
    query,
    queryOne,
    closeDatabase
};