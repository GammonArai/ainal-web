/**
 * 決済システムテスト
 * Payment system test script
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const PaymentService = require('../services/paymentService');

async function testPaymentSystem() {
    console.log('💳 決済システムテスト開始...\n');

    try {
        const paymentService = new PaymentService();
        let testsPassed = 0;
        let testsTotal = 0;

        // 1. PaymentService初期化テスト
        console.log('1️⃣ PaymentService初期化テスト...');
        testsTotal++;
        if (paymentService && paymentService.payPayConfig) {
            console.log('   ✅ PaymentService 正常に初期化');
            console.log(`   📝 ベースURL: ${paymentService.payPayConfig.baseUrl}`);
            console.log(`   📝 マーチャントID: ${paymentService.payPayConfig.merchantId ? '設定済み' : '未設定'}`);
            testsPassed++;
        } else {
            console.log('   ❌ PaymentService 初期化失敗');
        }

        // 2. 決済ID生成テスト
        console.log('\n2️⃣ 決済ID生成テスト...');
        testsTotal++;
        try {
            const paymentId1 = paymentService.generatePaymentId();
            const paymentId2 = paymentService.generatePaymentId();
            
            if (paymentId1 && paymentId2 && paymentId1 !== paymentId2 && 
                paymentId1.startsWith('PAY') && paymentId2.startsWith('PAY')) {
                console.log('   ✅ 決済ID生成成功');
                console.log(`   📝 サンプルID1: ${paymentId1}`);
                console.log(`   📝 サンプルID2: ${paymentId2}`);
                testsPassed++;
            } else {
                console.log('   ❌ 決済ID生成失敗');
            }
        } catch (error) {
            console.log(`   ❌ 決済ID生成エラー: ${error.message}`);
        }

        // 3. 決済データバリデーションテスト
        console.log('\n3️⃣ 決済データバリデーションテスト...');
        testsTotal++;
        try {
            const validData = {
                id: 1,
                total_price: 8000,
                service_name: 'リラクゼーションマッサージ'
            };
            
            const invalidData = {
                id: 1,
                total_price: 0,
                service_name: ''
            };

            const validResult = paymentService.validatePaymentData(validData, {});
            const invalidResult = paymentService.validatePaymentData(invalidData, {});

            if (validResult.isValid && !invalidResult.isValid) {
                console.log('   ✅ 決済データバリデーション正常');
                console.log(`   📝 有効データ: ${validResult.isValid ? 'OK' : 'NG'}`);
                console.log(`   📝 無効データ: ${invalidResult.isValid ? 'OK' : 'NG'} (${invalidResult.message})`);
                testsPassed++;
            } else {
                console.log('   ❌ 決済データバリデーション失敗');
            }
        } catch (error) {
            console.log(`   ❌ バリデーションテストエラー: ${error.message}`);
        }

        // 4. PayPayステータスマッピングテスト
        console.log('\n4️⃣ PayPayステータスマッピングテスト...');
        testsTotal++;
        try {
            const testCases = [
                { payPayStatus: 'CREATED', expected: 'pending' },
                { payPayStatus: 'COMPLETED', expected: 'completed' },
                { payPayStatus: 'CANCELED', expected: 'cancelled' },
                { payPayStatus: 'FAILED', expected: 'failed' }
            ];

            let allCorrect = true;
            testCases.forEach(testCase => {
                const result = paymentService.mapPayPayStatus(testCase.payPayStatus);
                if (result !== testCase.expected) {
                    allCorrect = false;
                }
                console.log(`   📝 ${testCase.payPayStatus} → ${result} (期待値: ${testCase.expected})`);
            });

            if (allCorrect) {
                console.log('   ✅ PayPayステータスマッピング正常');
                testsPassed++;
            } else {
                console.log('   ❌ PayPayステータスマッピング失敗');
            }
        } catch (error) {
            console.log(`   ❌ ステータスマッピングテストエラー: ${error.message}`);
        }

        // 5. PayPay API署名生成テスト
        console.log('\n5️⃣ PayPay API署名生成テスト...');
        testsTotal++;
        try {
            const method = 'POST';
            const endpoint = '/v2/payments';
            const data = { test: 'data' };
            const timestamp = Date.now();
            const nonce = 'test-nonce';

            const signature1 = paymentService.generateSignature(method, endpoint, data, timestamp, nonce);
            const signature2 = paymentService.generateSignature(method, endpoint, data, timestamp, nonce);

            if (signature1 && signature2 && signature1 === signature2) {
                console.log('   ✅ PayPay API署名生成成功');
                console.log(`   📝 署名サンプル: ${signature1.substring(0, 20)}...`);
                testsPassed++;
            } else {
                console.log('   ❌ PayPay API署名生成失敗');
            }
        } catch (error) {
            console.log(`   ❌ API署名生成エラー: ${error.message}`);
        }

        // 6. 設定値検証テスト
        console.log('\n6️⃣ 設定値検証テスト...');
        testsTotal++;
        try {
            const config = paymentService.payPayConfig;
            const hasRequiredKeys = config.baseUrl && typeof config.timeout === 'number';
            
            if (hasRequiredKeys) {
                console.log('   ✅ 設定値検証成功');
                console.log(`   📝 ベースURL: ${config.baseUrl}`);
                console.log(`   📝 タイムアウト: ${config.timeout}ms`);
                console.log(`   📝 サンドボックス: ${config.baseUrl.includes('sandbox') ? 'YES' : 'NO'}`);
                testsPassed++;
            } else {
                console.log('   ❌ 設定値検証失敗');
            }
        } catch (error) {
            console.log(`   ❌ 設定値検証エラー: ${error.message}`);
        }

        // 7. エラーハンドリングテスト
        console.log('\n7️⃣ エラーハンドリングテスト...');
        testsTotal++;
        try {
            // 無効なデータでのバリデーション
            const invalidBookingData = null;
            const validationResult = paymentService.validatePaymentData(invalidBookingData, {});
            
            if (!validationResult.isValid) {
                console.log('   ✅ エラーハンドリング正常');
                console.log(`   📝 エラーメッセージ: ${validationResult.message}`);
                testsPassed++;
            } else {
                console.log('   ❌ エラーハンドリング失敗');
            }
        } catch (error) {
            console.log(`   ❌ エラーハンドリングテストエラー: ${error.message}`);
        }

        // 8. 決済リクエストデータ構造テスト
        console.log('\n8️⃣ 決済リクエストデータ構造テスト...');
        testsTotal++;
        try {
            const mockBookingData = {
                id: 1,
                total_price: 8000,
                service_name: 'リラクゼーションマッサージ',
                service_id: 1
            };

            const mockPaymentData = {
                userAgent: 'TestAgent/1.0'
            };

            // 実際のAPIコールはしないが、データ構造を検証
            const validationResult = paymentService.validatePaymentData(mockBookingData, mockPaymentData);
            
            if (validationResult.isValid) {
                console.log('   ✅ 決済リクエストデータ構造正常');
                console.log(`   📝 予約ID: ${mockBookingData.id}`);
                console.log(`   📝 金額: ¥${mockBookingData.total_price.toLocaleString()}`);
                console.log(`   📝 サービス: ${mockBookingData.service_name}`);
                testsPassed++;
            } else {
                console.log('   ❌ 決済リクエストデータ構造異常');
            }
        } catch (error) {
            console.log(`   ❌ データ構造テストエラー: ${error.message}`);
        }

        // 結果表示
        console.log('\n📊 テスト結果:');
        console.log(`✅ 成功: ${testsPassed}/${testsTotal}`);
        console.log(`❌ 失敗: ${testsTotal - testsPassed}/${testsTotal}`);
        console.log(`📈 成功率: ${Math.round((testsPassed / testsTotal) * 100)}%\n`);

        if (testsPassed === testsTotal) {
            console.log('🎉 全ての決済システムテストが成功しました!\n');
            console.log('📋 次のステップ:');
            console.log('1. PayPay開発者アカウントでAPIキーを取得');
            console.log('2. .envファイルでPayPay設定を完了');
            console.log('3. payment-integration.htmlで決済フローを確認');
            console.log('4. 実際の決済テストを実行\n');
        } else {
            console.log('⚠️ 一部のテストが失敗しました。コードを確認してください。\n');
        }

        // 実用的な使用例を表示
        console.log('💡 実用的な使用例:');
        console.log('```javascript');
        console.log('const paymentService = new PaymentService();');
        console.log('');
        console.log('// 決済リクエスト作成');
        console.log('const result = await paymentService.createPaymentRequest(bookingData, paymentData);');
        console.log('');
        console.log('// 決済ステータス確認');
        console.log('const status = await paymentService.checkPaymentStatus(paymentId);');
        console.log('');
        console.log('// 決済完了処理');
        console.log('const completion = await paymentService.completePayment(paymentId);');
        console.log('```\n');

        // PayPay設定ガイド
        console.log('⚙️ PayPay設定ガイド:');
        console.log('1. PayPay開発者ページでアプリを作成');
        console.log('2. .envファイルに以下を追加:');
        console.log('   PAYPAY_API_KEY=your_api_key');
        console.log('   PAYPAY_API_SECRET=your_api_secret');
        console.log('   PAYPAY_MERCHANT_ID=your_merchant_id');
        console.log('   PAYPAY_SANDBOX=true');
        console.log('3. 決済フローをテスト\n');

    } catch (error) {
        console.error('❌ テスト実行エラー:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// メイン実行
testPaymentSystem().catch(console.error);