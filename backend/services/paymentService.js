/**
 * 決済サービス
 * Payment service for PayPay integration - Ainaru Massage CMS
 */

const crypto = require('crypto');
const axios = require('axios');
const { query, queryOne, withTransaction } = require('../config/database');
const { logger } = require('../utils/logger');
const { sendAuditLog } = require('../utils/auditLog');

class PaymentService {
    constructor() {
        this.payPayConfig = {
            apiKey: process.env.PAYPAY_API_KEY,
            apiSecret: process.env.PAYPAY_API_SECRET,
            merchantId: process.env.PAYPAY_MERCHANT_ID,
            baseUrl: process.env.PAYPAY_SANDBOX === 'true' 
                ? 'https://stg-api.sandbox.paypay.ne.jp' 
                : 'https://api.paypay.ne.jp',
            timeout: 30000 // 30秒タイムアウト
        };

        // 設定値検証
        this.validateConfig();
    }

    /**
     * 設定値を検証
     */
    validateConfig() {
        const required = ['apiKey', 'apiSecret', 'merchantId'];
        const missing = required.filter(key => !this.payPayConfig[key]);
        
        if (missing.length > 0) {
            logger.warn(`PayPay設定が不完全です: ${missing.join(', ')}`);
        }
    }

    /**
     * 決済リクエストを作成
     * @param {Object} bookingData - 予約データ
     * @param {Object} paymentData - 決済データ
     * @returns {Object} 決済リクエスト結果
     */
    async createPaymentRequest(bookingData, paymentData) {
        try {
            logger.info(`PayPay決済リクエスト作成開始: 予約ID ${bookingData.id}`);

            // 決済データを検証
            const validationResult = this.validatePaymentData(bookingData, paymentData);
            if (!validationResult.isValid) {
                throw new Error(validationResult.message);
            }

            // 一意な決済IDを生成
            const paymentId = this.generatePaymentId();
            
            // PayPay APIリクエストペイロード
            const payload = {
                merchantPaymentId: paymentId,
                amount: {
                    amount: bookingData.total_price,
                    currency: "JPY"
                },
                orderDescription: `愛なるマッサージ - ${bookingData.service_name}`,
                orderItems: [{
                    name: bookingData.service_name,
                    category: "MASSAGE_SERVICE",
                    quantity: 1,
                    productId: bookingData.service_id.toString(),
                    unitPrice: {
                        amount: bookingData.total_price,
                        currency: "JPY"
                    }
                }],
                userAgent: paymentData.userAgent || "AinaruMassage/1.0",
                storeInfo: {
                    name: "愛なるマッサージ",
                    category: "HEALTH_AND_BEAUTY",
                    address: "福岡市中央区天神・博多・中洲エリア"
                }
            };

            // トランザクション内で決済記録を保存し、PayPay APIを呼び出し
            const result = await withTransaction(async (connection) => {
                // 決済記録をDBに保存
                const [paymentResult] = await connection.execute(
                    `INSERT INTO payments 
                     (payment_id, booking_id, amount, currency, status, provider, 
                      provider_payment_id, created_at, updated_at) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                    [
                        paymentId,
                        bookingData.id,
                        bookingData.total_price,
                        'JPY',
                        'pending',
                        'paypay',
                        null
                    ]
                );

                const dbPaymentId = paymentResult.insertId;

                // PayPay API呼び出し
                const payPayResponse = await this.callPayPayAPI('/v2/payments', 'POST', payload);

                if (!payPayResponse.success) {
                    throw new Error(`PayPay API エラー: ${payPayResponse.message}`);
                }

                // PayPay応答でDB記録を更新
                await connection.execute(
                    `UPDATE payments 
                     SET provider_payment_id = ?, provider_response = ?, updated_at = NOW()
                     WHERE id = ?`,
                    [
                        payPayResponse.data.paymentId,
                        JSON.stringify(payPayResponse.data),
                        dbPaymentId
                    ]
                );

                return {
                    paymentId,
                    dbPaymentId,
                    payPayData: payPayResponse.data,
                    qrCodeUrl: payPayResponse.data.data?.url,
                    deepLink: payPayResponse.data.data?.deeplink
                };
            });

            // 予約の決済ステータスを更新
            await query(
                'UPDATE bookings SET payment_status = ? WHERE id = ?',
                ['processing', bookingData.id]
            );

            logger.info(`PayPay決済リクエスト作成完了: ${paymentId}`);

            return {
                success: true,
                paymentId: result.paymentId,
                qrCodeUrl: result.qrCodeUrl,
                deepLink: result.deepLink,
                amount: bookingData.total_price,
                expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15分後
                instructions: {
                    step1: "PayPayアプリを開く",
                    step2: "QRコードをスキャンするか、リンクをタップ",
                    step3: "支払い内容を確認して決済を完了"
                }
            };

        } catch (error) {
            logger.error('PayPay決済リクエスト作成エラー:', error);
            throw error;
        }
    }

    /**
     * 決済ステータスを確認
     * @param {string} paymentId - 決済ID
     * @returns {Object} ステータス確認結果
     */
    async checkPaymentStatus(paymentId) {
        try {
            // DBから決済情報を取得
            const payment = await queryOne(
                `SELECT p.*, b.booking_code, b.total_price 
                 FROM payments p 
                 JOIN bookings b ON p.booking_id = b.id 
                 WHERE p.payment_id = ?`,
                [paymentId]
            );

            if (!payment) {
                throw new Error('決済情報が見つかりません');
            }

            // PayPay APIで最新ステータスを確認
            if (payment.provider_payment_id) {
                const payPayResponse = await this.callPayPayAPI(
                    `/v2/payments/${payment.provider_payment_id}`,
                    'GET'
                );

                if (payPayResponse.success) {
                    const newStatus = this.mapPayPayStatus(payPayResponse.data.status);
                    
                    // ステータスが変更された場合、DBを更新
                    if (newStatus !== payment.status) {
                        await this.updatePaymentStatus(payment.id, newStatus, payPayResponse.data);
                    }

                    return {
                        success: true,
                        paymentId,
                        status: newStatus,
                        amount: payment.amount,
                        bookingCode: payment.booking_code,
                        payPayData: payPayResponse.data
                    };
                }
            }

            // PayPay APIが利用できない場合はDBの情報を返す
            return {
                success: true,
                paymentId,
                status: payment.status,
                amount: payment.amount,
                bookingCode: payment.booking_code
            };

        } catch (error) {
            logger.error('決済ステータス確認エラー:', error);
            throw error;
        }
    }

    /**
     * 決済完了処理
     * @param {string} paymentId - 決済ID
     * @param {Object} webhookData - Webhook データ
     * @returns {Object} 処理結果
     */
    async completePayment(paymentId, webhookData = null) {
        try {
            const payment = await queryOne(
                `SELECT p.*, b.id as booking_id, b.booking_code, b.user_id 
                 FROM payments p 
                 JOIN bookings b ON p.booking_id = b.id 
                 WHERE p.payment_id = ?`,
                [paymentId]
            );

            if (!payment) {
                throw new Error('決済情報が見つかりません');
            }

            if (payment.status === 'completed') {
                return { success: true, message: '既に処理済みです' };
            }

            await withTransaction(async (connection) => {
                // 決済ステータスを完了に更新
                await connection.execute(
                    `UPDATE payments 
                     SET status = 'completed', completed_at = NOW(), 
                         webhook_data = ?, updated_at = NOW()
                     WHERE id = ?`,
                    [webhookData ? JSON.stringify(webhookData) : null, payment.id]
                );

                // 予約ステータスを確認済みに更新
                await connection.execute(
                    'UPDATE bookings SET payment_status = ?, status = ? WHERE id = ?',
                    ['paid', 'confirmed', payment.booking_id]
                );
            });

            // 監査ログ
            if (payment.user_id) {
                await sendAuditLog(
                    payment.user_id, 
                    'payment_completed', 
                    'payments', 
                    payment.id, 
                    null, 
                    { paymentId, amount: payment.amount }
                );
            }

            logger.info(`決済完了処理: ${paymentId}, 予約: ${payment.booking_code}`);

            return {
                success: true,
                message: '決済が完了しました',
                paymentId,
                bookingCode: payment.booking_code,
                amount: payment.amount
            };

        } catch (error) {
            logger.error('決済完了処理エラー:', error);
            throw error;
        }
    }

    /**
     * 決済をキャンセル
     * @param {string} paymentId - 決済ID
     * @param {string} reason - キャンセル理由
     * @returns {Object} キャンセル結果
     */
    async cancelPayment(paymentId, reason = null) {
        try {
            const payment = await queryOne(
                `SELECT p.*, b.booking_code 
                 FROM payments p 
                 JOIN bookings b ON p.booking_id = b.id 
                 WHERE p.payment_id = ?`,
                [paymentId]
            );

            if (!payment) {
                throw new Error('決済情報が見つかりません');
            }

            if (payment.status === 'cancelled') {
                return { success: true, message: '既にキャンセル済みです' };
            }

            // PayPay APIでキャンセル（必要に応じて）
            if (payment.provider_payment_id && payment.status === 'processing') {
                await this.callPayPayAPI(
                    `/v2/payments/${payment.provider_payment_id}/cancel`,
                    'POST',
                    { reason: reason || 'Customer cancelled' }
                );
            }

            // 決済ステータスを更新
            await query(
                `UPDATE payments 
                 SET status = 'cancelled', cancelled_reason = ?, updated_at = NOW()
                 WHERE payment_id = ?`,
                [reason, paymentId]
            );

            logger.info(`決済キャンセル: ${paymentId}, 理由: ${reason}`);

            return {
                success: true,
                message: '決済をキャンセルしました',
                paymentId,
                bookingCode: payment.booking_code
            };

        } catch (error) {
            logger.error('決済キャンセルエラー:', error);
            throw error;
        }
    }

    /**
     * 決済履歴を取得
     * @param {Object} options - 検索オプション
     * @returns {Array} 決済履歴
     */
    async getPaymentHistory(options = {}) {
        try {
            const { userId, bookingId, status, startDate, endDate, limit = 50, offset = 0 } = options;

            let whereClause = 'WHERE 1=1';
            const params = [];

            if (userId) {
                whereClause += ' AND b.user_id = ?';
                params.push(userId);
            }

            if (bookingId) {
                whereClause += ' AND p.booking_id = ?';
                params.push(bookingId);
            }

            if (status) {
                whereClause += ' AND p.status = ?';
                params.push(status);
            }

            if (startDate) {
                whereClause += ' AND p.created_at >= ?';
                params.push(startDate);
            }

            if (endDate) {
                whereClause += ' AND p.created_at <= ?';
                params.push(endDate);
            }

            const payments = await query(
                `SELECT p.*, b.booking_code, b.booking_date, b.start_time,
                        s.name as service_name, u.username
                 FROM payments p
                 JOIN bookings b ON p.booking_id = b.id
                 LEFT JOIN services s ON b.service_id = s.id
                 LEFT JOIN users u ON b.user_id = u.id
                 ${whereClause}
                 ORDER BY p.created_at DESC
                 LIMIT ? OFFSET ?`,
                [...params, limit, offset]
            );

            return payments;

        } catch (error) {
            logger.error('決済履歴取得エラー:', error);
            throw error;
        }
    }

    // ========== プライベートメソッド ==========

    /**
     * PayPay APIを呼び出し
     */
    async callPayPayAPI(endpoint, method, data = null) {
        try {
            const url = `${this.payPayConfig.baseUrl}${endpoint}`;
            const timestamp = Date.now();
            const nonce = crypto.randomBytes(16).toString('hex');

            // 署名を生成
            const signature = this.generateSignature(method, endpoint, data, timestamp, nonce);

            const headers = {
                'Content-Type': 'application/json',
                'X-ASSUME-MERCHANT': this.payPayConfig.merchantId,
                'X-TIMESTAMP': timestamp.toString(),
                'X-NONCE': nonce,
                'Authorization': `hmac OPA-Auth:${this.payPayConfig.apiKey}:${signature}`
            };

            const config = {
                method,
                url,
                headers,
                timeout: this.payPayConfig.timeout
            };

            if (data && (method === 'POST' || method === 'PUT')) {
                config.data = data;
            }

            const response = await axios(config);

            return {
                success: true,
                data: response.data,
                status: response.status
            };

        } catch (error) {
            logger.error('PayPay API呼び出しエラー:', {
                endpoint,
                method,
                error: error.response?.data || error.message
            });

            return {
                success: false,
                message: error.response?.data?.message || error.message,
                status: error.response?.status
            };
        }
    }

    /**
     * PayPay API署名を生成
     */
    generateSignature(method, endpoint, data, timestamp, nonce) {
        const contentToSign = [
            endpoint,
            method,
            data ? JSON.stringify(data) : '',
            timestamp.toString(),
            nonce
        ].join('\n');

        return crypto
            .createHmac('sha256', this.payPayConfig.apiSecret)
            .update(contentToSign, 'utf8')
            .digest('base64');
    }

    /**
     * 決済データを検証
     */
    validatePaymentData(bookingData, paymentData) {
        if (!bookingData?.total_price || bookingData.total_price <= 0) {
            return { isValid: false, message: '決済金額が不正です' };
        }

        if (!bookingData?.service_name) {
            return { isValid: false, message: 'サービス名が不正です' };
        }

        if (bookingData.total_price > 1000000) { // 100万円制限
            return { isValid: false, message: '決済金額が上限を超えています' };
        }

        return { isValid: true };
    }

    /**
     * PayPayステータスをマッピング
     */
    mapPayPayStatus(payPayStatus) {
        const statusMap = {
            'CREATED': 'pending',
            'PROCESSING': 'processing', 
            'COMPLETED': 'completed',
            'CANCELED': 'cancelled',
            'FAILED': 'failed'
        };

        return statusMap[payPayStatus] || 'unknown';
    }

    /**
     * 決済ステータスを更新
     */
    async updatePaymentStatus(paymentId, status, providerData = null) {
        await query(
            `UPDATE payments 
             SET status = ?, provider_response = ?, updated_at = NOW()
             WHERE id = ?`,
            [status, providerData ? JSON.stringify(providerData) : null, paymentId]
        );

        if (status === 'completed') {
            // 予約のステータスも更新
            await query(
                `UPDATE bookings b
                 JOIN payments p ON b.id = p.booking_id
                 SET b.payment_status = 'paid', b.status = 'confirmed'
                 WHERE p.id = ?`,
                [paymentId]
            );
        }
    }

    /**
     * 一意な決済IDを生成
     */
    generatePaymentId() {
        const prefix = 'PAY';
        const timestamp = Date.now().toString();
        const random = crypto.randomBytes(4).toString('hex').toUpperCase();
        return `${prefix}${timestamp}${random}`;
    }
}

module.exports = PaymentService;