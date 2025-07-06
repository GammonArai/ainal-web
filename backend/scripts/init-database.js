/**
 * データベース初期化スクリプト
 * Database initialization script for Ainaru Massage CMS
 * 
 * 使用方法:
 * node backend/scripts/init-database.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function initDatabase() {
    let connection;
    
    try {
        // データベースなしで接続
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            multipleStatements: true
        });
        
        console.log('✅ MySQLサーバーに接続しました');
        
        // スキーマファイルを読み込み
        const schemaPath = path.join(__dirname, '../../database/schema.sql');
        const schemaSQL = await fs.readFile(schemaPath, 'utf8');
        
        console.log('📄 スキーマファイルを読み込みました');
        
        // スキーマを実行
        await connection.query(schemaSQL);
        console.log('✅ データベーススキーマを作成しました');
        
        // サンプルデータを挿入するか確認
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const answer = await new Promise(resolve => {
            readline.question('サンプルデータを挿入しますか？ (y/n): ', resolve);
        });
        readline.close();
        
        if (answer.toLowerCase() === 'y') {
            const seedPath = path.join(__dirname, '../../database/seed-data.sql');
            const seedSQL = await fs.readFile(seedPath, 'utf8');
            
            await connection.query(seedSQL);
            console.log('✅ サンプルデータを挿入しました');
        }
        
        console.log('\n🎉 データベースの初期化が完了しました！');
        console.log('\n次のステップ:');
        console.log('1. backend/.env ファイルを作成し、データベース接続情報を設定してください');
        console.log('2. npm run start:backend でバックエンドサーバーを起動してください');
        
    } catch (error) {
        console.error('❌ エラーが発生しました:', error.message);
        
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('\n認証エラー: MySQLのユーザー名またはパスワードが正しくありません');
            console.error('環境変数 DB_USER と DB_PASSWORD を確認してください');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('\n接続エラー: MySQLサーバーが起動していないか、接続情報が正しくありません');
            console.error('MySQLサーバーが起動していることを確認してください');
        }
        
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('\n📊 データベース接続を閉じました');
        }
    }
}

// メイン実行
initDatabase().catch(console.error);