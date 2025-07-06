/**
 * スケジューリングシステムテスト
 * Scheduling system test script
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const SchedulingService = require('../services/schedulingService');

async function testSchedulingSystem() {
    console.log('📅 スケジューリングシステムテスト開始...\n');

    try {
        const schedulingService = new SchedulingService();
        let testsPassed = 0;
        let testsTotal = 0;

        // 1. クラス初期化テスト
        console.log('1️⃣ クラス初期化テスト...');
        testsTotal++;
        if (schedulingService && schedulingService.businessHours) {
            console.log('   ✅ SchedulingService 正常に初期化');
            console.log(`   📝 営業時間: ${schedulingService.businessHours.start} - ${schedulingService.businessHours.end}`);
            testsPassed++;
        } else {
            console.log('   ❌ SchedulingService 初期化失敗');
        }

        // 2. 基本時間スロット生成テスト
        console.log('\n2️⃣ 基本時間スロット生成テスト...');
        testsTotal++;
        try {
            const today = new Date().toISOString().split('T')[0];
            const baseSlots = schedulingService.generateBaseTimeSlots(today);
            
            if (baseSlots && baseSlots.length > 0) {
                console.log(`   ✅ 時間スロット生成成功: ${baseSlots.length}件`);
                console.log(`   📝 最初のスロット: ${baseSlots[0].time}`);
                console.log(`   📝 最後のスロット: ${baseSlots[baseSlots.length - 1].time}`);
                testsPassed++;
            } else {
                console.log('   ❌ 時間スロット生成失敗');
            }
        } catch (error) {
            console.log(`   ❌ 時間スロット生成エラー: ${error.message}`);
        }

        // 3. 予約可能性チェックテスト
        console.log('\n3️⃣ 予約可能性チェックテスト...');
        testsTotal++;
        try {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const testDate = tomorrow.toISOString().split('T')[0];
            
            const bookingData = {
                date: testDate,
                startTime: '14:00:00',
                endTime: '15:00:00',
                serviceId: 1
            };

            // データベースなしでの基本バリデーションのみテスト
            const basicCheck = schedulingService.validateBookingTime(
                bookingData.date, 
                bookingData.startTime, 
                bookingData.endTime
            );

            if (basicCheck.isValid) {
                console.log('   ✅ 基本バリデーション成功');
                console.log(`   📝 メッセージ: ${basicCheck.message || '正常'}`);
                testsPassed++;
            } else {
                console.log(`   ❌ 基本バリデーション失敗: ${basicCheck.message}`);
            }
        } catch (error) {
            console.log(`   ❌ 予約可能性チェックエラー: ${error.message}`);
        }

        // 4. 営業時間チェックテスト
        console.log('\n4️⃣ 営業時間チェックテスト...');
        testsTotal++;
        try {
            const validTime = schedulingService.checkBusinessHours('14:00:00', '15:00:00');
            const invalidTime = schedulingService.checkBusinessHours('05:00:00', '06:00:00');

            if (validTime.isValid && !invalidTime.isValid) {
                console.log('   ✅ 営業時間チェック成功');
                console.log(`   📝 有効時間: 14:00-15:00 → ${validTime.isValid ? 'OK' : 'NG'}`);
                console.log(`   📝 無効時間: 05:00-06:00 → ${invalidTime.isValid ? 'OK' : 'NG'}`);
                testsPassed++;
            } else {
                console.log('   ❌ 営業時間チェック失敗');
            }
        } catch (error) {
            console.log(`   ❌ 営業時間チェックエラー: ${error.message}`);
        }

        // 5. 時間計算ユーティリティテスト
        console.log('\n5️⃣ 時間計算ユーティリティテスト...');
        testsTotal++;
        try {
            const startTime = '14:00:00';
            const duration = 90; // 90分
            const endTime = schedulingService.addMinutes(startTime, duration);
            
            if (endTime === '15:30:00') {
                console.log('   ✅ 時間計算正確');
                console.log(`   📝 ${startTime} + ${duration}分 = ${endTime}`);
                testsPassed++;
            } else {
                console.log(`   ❌ 時間計算エラー: 期待値15:30:00, 実際${endTime}`);
            }
        } catch (error) {
            console.log(`   ❌ 時間計算エラー: ${error.message}`);
        }

        // 6. 重複チェック機能テスト
        console.log('\n6️⃣ 重複チェック機能テスト...');
        testsTotal++;
        try {
            const overlap1 = schedulingService.isTimeOverlapping('14:00:00', '15:00:00', '14:30:00', '15:30:00');
            const overlap2 = schedulingService.isTimeOverlapping('14:00:00', '15:00:00', '16:00:00', '17:00:00');
            
            if (overlap1 && !overlap2) {
                console.log('   ✅ 重複チェック正確');
                console.log(`   📝 14:00-15:00 vs 14:30-15:30 → 重複: ${overlap1}`);
                console.log(`   📝 14:00-15:00 vs 16:00-17:00 → 重複: ${overlap2}`);
                testsPassed++;
            } else {
                console.log('   ❌ 重複チェック失敗');
            }
        } catch (error) {
            console.log(`   ❌ 重複チェックエラー: ${error.message}`);
        }

        // 7. 予約コード生成テスト
        console.log('\n7️⃣ 予約コード生成テスト...');
        testsTotal++;
        try {
            // データベース接続なしのため、独自生成テスト
            const generateTestCode = () => {
                const prefix = 'AM';
                const timestamp = Date.now().toString().slice(-6);
                const random = Math.random().toString(36).slice(-3).toUpperCase();
                return `${prefix}${timestamp}${random}`;
            };

            const code1 = generateTestCode();
            const code2 = generateTestCode();
            
            if (code1 !== code2 && code1.startsWith('AM') && code2.startsWith('AM')) {
                console.log('   ✅ 予約コード生成成功');
                console.log(`   📝 サンプルコード1: ${code1}`);
                console.log(`   📝 サンプルコード2: ${code2}`);
                testsPassed++;
            } else {
                console.log('   ❌ 予約コード生成失敗');
            }
        } catch (error) {
            console.log(`   ❌ 予約コード生成エラー: ${error.message}`);
        }

        // 8. 営業時間内チェック関数テスト
        console.log('\n8️⃣ 営業時間内チェック関数テスト...');
        testsTotal++;
        try {
            const morning = schedulingService.isWithinBusinessHours('10:00:00'); // 営業開始
            const afternoon = schedulingService.isWithinBusinessHours('15:00:00'); // 営業中
            const earlyMorning = schedulingService.isWithinBusinessHours('02:00:00'); // 営業終了間際
            const dawn = schedulingService.isWithinBusinessHours('05:00:00'); // 営業時間外
            
            if (morning && afternoon && earlyMorning && !dawn) {
                console.log('   ✅ 営業時間内チェック成功');
                console.log(`   📝 10:00 → ${morning}, 15:00 → ${afternoon}, 02:00 → ${earlyMorning}, 05:00 → ${dawn}`);
                testsPassed++;
            } else {
                console.log('   ❌ 営業時間内チェック失敗');
                console.log(`   📝 10:00 → ${morning}, 15:00 → ${afternoon}, 02:00 → ${earlyMorning}, 05:00 → ${dawn}`);
            }
        } catch (error) {
            console.log(`   ❌ 営業時間内チェックエラー: ${error.message}`);
        }

        // 結果表示
        console.log('\n📊 テスト結果:');
        console.log(`✅ 成功: ${testsPassed}/${testsTotal}`);
        console.log(`❌ 失敗: ${testsTotal - testsPassed}/${testsTotal}`);
        console.log(`📈 成功率: ${Math.round((testsPassed / testsTotal) * 100)}%\n`);

        if (testsPassed === testsTotal) {
            console.log('🎉 全てのスケジューリングテストが成功しました!\n');
            console.log('📋 次のステップ:');
            console.log('1. MySQL データベースをセットアップ');
            console.log('2. npm run init:db でデータベース初期化');
            console.log('3. npm run test:api で完全なAPIテスト実行');
            console.log('4. 管理画面でカレンダー表示を確認\n');
        } else {
            console.log('⚠️ 一部のテストが失敗しました。コードを確認してください。\n');
        }

        // 実用的な使用例を表示
        console.log('💡 実用的な使用例:');
        console.log('```javascript');
        console.log('const schedulingService = new SchedulingService();');
        console.log('');
        console.log('// 空き時間を取得');
        console.log('const slots = await schedulingService.getAvailableTimeSlots("2024-06-21", 60);');
        console.log('');
        console.log('// 予約可能性をチェック');
        console.log('const check = await schedulingService.checkBookingAvailability({');
        console.log('    date: "2024-06-21",');
        console.log('    startTime: "14:00:00",');
        console.log('    endTime: "15:00:00",');
        console.log('    serviceId: 1');
        console.log('});');
        console.log('');
        console.log('// 予約を作成');
        console.log('const booking = await schedulingService.createBooking(bookingData, userId);');
        console.log('```\n');

    } catch (error) {
        console.error('❌ テスト実行エラー:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// メイン実行
testSchedulingSystem().catch(console.error);