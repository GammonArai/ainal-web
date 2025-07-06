/**
 * アップロード機能テストスクリプト
 * Test script for upload functionality
 */

const path = require('path');
const fs = require('fs').promises;
const { initializeUploadDirectories, UPLOAD_CATEGORIES } = require('../middleware/upload');

async function testUploadSystem() {
    console.log('🔧 アップロードシステムテスト開始...\n');

    try {
        // 1. ディレクトリ初期化テスト
        console.log('📁 アップロードディレクトリの初期化テスト...');
        await initializeUploadDirectories();
        console.log('✅ ディレクトリ初期化成功\n');

        // 2. ディレクトリ存在確認
        console.log('📂 ディレクトリ存在確認...');
        const uploadDir = path.join(__dirname, '../uploads');
        
        for (const [key, category] of Object.entries(UPLOAD_CATEGORIES)) {
            const categoryDir = path.join(uploadDir, category);
            try {
                await fs.access(categoryDir);
                console.log(`  ✅ ${key}: ${category}`);
            } catch (error) {
                console.log(`  ❌ ${key}: ${category} - ディレクトリが存在しません`);
            }
        }
        console.log('');

        // 3. 権限チェック
        console.log('🔒 ディレクトリ権限チェック...');
        try {
            const testFile = path.join(uploadDir, 'test-write.txt');
            await fs.writeFile(testFile, 'test');
            await fs.unlink(testFile);
            console.log('✅ 書き込み権限OK\n');
        } catch (error) {
            console.log('❌ 書き込み権限エラー:', error.message);
            console.log('');
        }

        // 4. 設定確認
        console.log('⚙️ 設定確認...');
        console.log(`  最大ファイルサイズ: ${process.env.UPLOAD_MAX_SIZE || '10MB'}`);
        console.log(`  許可されるファイル形式: ${process.env.UPLOAD_ALLOWED_TYPES || 'image/jpeg,image/png,image/webp'}`);
        console.log('');

        // 5. モジュール読み込みテスト
        console.log('📦 必要モジュールテスト...');
        try {
            require('multer');
            console.log('  ✅ multer');
        } catch (error) {
            console.log('  ❌ multer - インストールが必要');
        }

        try {
            require('sharp');
            console.log('  ✅ sharp');
        } catch (error) {
            console.log('  ❌ sharp - インストールが必要');
        }

        console.log('\n🎉 アップロードシステムテスト完了！');

    } catch (error) {
        console.error('❌ テストエラー:', error);
        process.exit(1);
    }
}

// 直接実行された場合にテストを実行
if (require.main === module) {
    testUploadSystem();
}

module.exports = { testUploadSystem };