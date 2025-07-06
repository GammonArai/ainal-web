/**
 * スケジューリングサービス
 * Scheduling service for Ainaru Massage CMS
 */

const { query, queryOne, withTransaction } = require('../config/database');
const { logger } = require('../utils/logger');
const { sendAuditLog } = require('../utils/auditLog');

class SchedulingService {
    constructor() {
        this.businessHours = {
            start: '10:00',
            end: '03:00', // 翌日3時まで
            lastBooking: '02:00' // 最終受付は2時
        };
        
        this.timeSlotDuration = 15; // 15分単位でスケジュール管理
        this.bufferTime = 30; // 予約間の最小間隔（分）
    }

    /**
     * 指定日時の空き状況を取得
     * @param {string} date - 日付 (YYYY-MM-DD)
     * @param {number} durationMinutes - 希望時間（分）
     * @param {number} therapistId - セラピストID（オプション）
     * @returns {Array} 利用可能な時間スロット
     */
    async getAvailableTimeSlots(date, durationMinutes, therapistId = null) {
        try {
            logger.info(`空き時間取得: ${date}, 時間: ${durationMinutes}分, セラピスト: ${therapistId || 'any'}`);

            // 基本の時間スロットを生成
            const baseSlots = this.generateBaseTimeSlots(date);

            // 既存予約を取得
            const existingBookings = await this.getExistingBookings(date, therapistId);

            // セラピストのスケジュールを取得
            const therapistSchedules = await this.getTherapistSchedules(date, therapistId);

            // 利用可能な時間をフィルタリング
            const availableSlots = this.filterAvailableSlots(
                baseSlots,
                existingBookings,
                therapistSchedules,
                durationMinutes
            );

            logger.info(`利用可能スロット: ${availableSlots.length}件`);
            return availableSlots;

        } catch (error) {
            logger.error('空き時間取得エラー:', error);
            throw error;
        }
    }

    /**
     * 予約可能性をチェック
     * @param {Object} bookingData - 予約データ
     * @returns {Object} チェック結果
     */
    async checkBookingAvailability(bookingData) {
        try {
            const { date, startTime, endTime, therapistId, serviceId } = bookingData;

            // 基本バリデーション
            const basicCheck = this.validateBookingTime(date, startTime, endTime);
            if (!basicCheck.isValid) {
                return basicCheck;
            }

            // 営業時間チェック
            const businessHoursCheck = this.checkBusinessHours(startTime, endTime);
            if (!businessHoursCheck.isValid) {
                return businessHoursCheck;
            }

            // 重複チェック
            const conflictCheck = await this.checkTimeConflicts(date, startTime, endTime, therapistId);
            if (!conflictCheck.isValid) {
                return conflictCheck;
            }

            // セラピスト可用性チェック
            if (therapistId) {
                const therapistCheck = await this.checkTherapistAvailability(date, startTime, endTime, therapistId);
                if (!therapistCheck.isValid) {
                    return therapistCheck;
                }
            }

            // サービス時間チェック
            if (serviceId) {
                const serviceCheck = await this.validateServiceDuration(serviceId, startTime, endTime);
                if (!serviceCheck.isValid) {
                    return serviceCheck;
                }
            }

            return {
                isValid: true,
                message: '予約可能です',
                suggestedTherapist: therapistId || await this.findBestTherapist(date, startTime, endTime, serviceId)
            };

        } catch (error) {
            logger.error('予約可能性チェックエラー:', error);
            return {
                isValid: false,
                message: 'チェック中にエラーが発生しました',
                error: error.message
            };
        }
    }

    /**
     * 予約を作成
     * @param {Object} bookingData - 予約データ
     * @param {number} userId - ユーザーID
     * @returns {Object} 作成された予約
     */
    async createBooking(bookingData, userId = null) {
        try {
            // 予約可能性をチェック
            const availabilityCheck = await this.checkBookingAvailability(bookingData);
            if (!availabilityCheck.isValid) {
                throw new Error(availabilityCheck.message);
            }

            // トランザクション内で予約作成
            const booking = await withTransaction(async (connection) => {
                // 予約コード生成
                const bookingCode = await this.generateUniqueBookingCode(connection);

                // 予約作成
                const [result] = await connection.execute(
                    `INSERT INTO bookings 
                     (booking_code, user_id, therapist_id, service_id, hotel_id, 
                      booking_date, start_time, end_time, total_price, status, payment_status,
                      telegram_chat_id, notes) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?, ?)`,
                    [
                        bookingCode,
                        userId,
                        bookingData.therapistId || availabilityCheck.suggestedTherapist,
                        bookingData.serviceId,
                        bookingData.hotelId,
                        bookingData.date,
                        bookingData.startTime,
                        bookingData.endTime,
                        bookingData.totalPrice,
                        bookingData.telegramChatId || null,
                        bookingData.notes || null
                    ]
                );

                const bookingId = result.insertId;

                // 作成された予約を取得
                const [createdBooking] = await connection.execute(
                    `SELECT b.*, s.name as service_name, s.duration_minutes,
                            t.display_name as therapist_name, h.name as hotel_name
                     FROM bookings b
                     LEFT JOIN services s ON b.service_id = s.id
                     LEFT JOIN therapists t ON b.therapist_id = t.id
                     LEFT JOIN hotels h ON b.hotel_id = h.id
                     WHERE b.id = ?`,
                    [bookingId]
                );

                return createdBooking[0];
            });

            // 監査ログ
            if (userId) {
                await sendAuditLog(userId, 'booking_created', 'bookings', booking.id, null, bookingData);
            }

            logger.info(`予約作成完了: ${booking.booking_code}`);
            return booking;

        } catch (error) {
            logger.error('予約作成エラー:', error);
            throw error;
        }
    }

    /**
     * 予約をキャンセル
     * @param {number} bookingId - 予約ID
     * @param {number} userId - ユーザーID
     * @param {string} reason - キャンセル理由
     * @returns {Object} キャンセル結果
     */
    async cancelBooking(bookingId, userId, reason = null) {
        try {
            const booking = await queryOne(
                'SELECT * FROM bookings WHERE id = ? AND status != "cancelled"',
                [bookingId]
            );

            if (!booking) {
                throw new Error('予約が見つからないか、既にキャンセル済みです');
            }

            // キャンセル期限チェック（24時間前まで）
            const bookingDateTime = new Date(`${booking.booking_date} ${booking.start_time}`);
            const now = new Date();
            const hoursUntilBooking = (bookingDateTime - now) / (1000 * 60 * 60);

            if (hoursUntilBooking < 24 && booking.status === 'confirmed') {
                throw new Error('予約の24時間前を過ぎているためキャンセルできません');
            }

            // キャンセル処理
            await query(
                `UPDATE bookings 
                 SET status = 'cancelled', cancelled_reason = ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [reason, bookingId]
            );

            // 監査ログ
            await sendAuditLog(userId, 'booking_cancelled', 'bookings', bookingId, booking, { reason });

            logger.info(`予約キャンセル: ${booking.booking_code}`);
            
            return {
                success: true,
                message: '予約をキャンセルしました',
                bookingCode: booking.booking_code
            };

        } catch (error) {
            logger.error('予約キャンセルエラー:', error);
            throw error;
        }
    }

    /**
     * セラピストのスケジュールを更新
     * @param {number} therapistId - セラピストID
     * @param {Object} schedule - スケジュールデータ
     * @returns {Object} 更新結果
     */
    async updateTherapistSchedule(therapistId, schedule) {
        try {
            await query(
                'UPDATE therapists SET schedule = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [JSON.stringify(schedule), therapistId]
            );

            logger.info(`セラピストスケジュール更新: ${therapistId}`);
            
            return {
                success: true,
                message: 'スケジュールを更新しました'
            };

        } catch (error) {
            logger.error('スケジュール更新エラー:', error);
            throw error;
        }
    }

    /**
     * 月間予約カレンダーを取得
     * @param {number} year - 年
     * @param {number} month - 月
     * @param {number} therapistId - セラピストID（オプション）
     * @returns {Object} カレンダーデータ
     */
    async getMonthlyCalendar(year, month, therapistId = null) {
        try {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);
            
            let whereClause = 'WHERE booking_date >= ? AND booking_date <= ? AND status != "cancelled"';
            const params = [
                startDate.toISOString().split('T')[0],
                endDate.toISOString().split('T')[0]
            ];

            if (therapistId) {
                whereClause += ' AND therapist_id = ?';
                params.push(therapistId);
            }

            const bookings = await query(
                `SELECT b.*, s.name as service_name, t.display_name as therapist_name, h.name as hotel_name
                 FROM bookings b
                 LEFT JOIN services s ON b.service_id = s.id
                 LEFT JOIN therapists t ON b.therapist_id = t.id
                 LEFT JOIN hotels h ON b.hotel_id = h.id
                 ${whereClause}
                 ORDER BY booking_date, start_time`,
                params
            );

            // 日付ごとにグループ化
            const calendar = {};
            bookings.forEach(booking => {
                const date = booking.booking_date;
                if (!calendar[date]) {
                    calendar[date] = [];
                }
                calendar[date].push({
                    ...booking,
                    startTime: booking.start_time,
                    endTime: booking.end_time
                });
            });

            return {
                year,
                month,
                calendar,
                totalBookings: bookings.length
            };

        } catch (error) {
            logger.error('月間カレンダー取得エラー:', error);
            throw error;
        }
    }

    // ========== プライベートメソッド ==========

    /**
     * 基本時間スロットを生成
     */
    generateBaseTimeSlots(date) {
        const slots = [];
        const startHour = 10; // 10:00
        const endHour = 26; // 翌日2:00まで（26:00）

        for (let hour = startHour; hour < endHour; hour++) {
            for (let minute = 0; minute < 60; minute += this.timeSlotDuration) {
                const actualHour = hour >= 24 ? hour - 24 : hour;
                const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
                
                slots.push({
                    time: timeString,
                    displayTime: `${actualHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
                    timestamp: new Date(`${date} ${timeString}`)
                });
            }
        }

        return slots;
    }

    /**
     * 既存予約を取得
     */
    async getExistingBookings(date, therapistId = null) {
        let whereClause = 'WHERE booking_date = ? AND status IN ("pending", "confirmed")';
        const params = [date];

        if (therapistId) {
            whereClause += ' AND therapist_id = ?';
            params.push(therapistId);
        }

        return await query(
            `SELECT * FROM bookings ${whereClause}`,
            params
        );
    }

    /**
     * セラピストスケジュールを取得
     */
    async getTherapistSchedules(date, therapistId = null) {
        const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        
        let whereClause = 'WHERE is_available = TRUE';
        const params = [];

        if (therapistId) {
            whereClause += ' AND id = ?';
            params.push(therapistId);
        }

        const therapists = await query(
            `SELECT id, display_name, schedule FROM therapists ${whereClause}`,
            params
        );

        return therapists.map(therapist => {
            const schedule = therapist.schedule ? JSON.parse(therapist.schedule) : {};
            return {
                ...therapist,
                isWorkingDay: schedule[dayOfWeek] ? true : false,
                workingHours: schedule[dayOfWeek] || null
            };
        });
    }

    /**
     * 利用可能時間をフィルタリング
     */
    filterAvailableSlots(baseSlots, existingBookings, therapistSchedules, durationMinutes) {
        return baseSlots.filter(slot => {
            // 基本的な営業時間チェック
            if (!this.isWithinBusinessHours(slot.time)) {
                return false;
            }

            // 予約終了時間を計算
            const endTime = this.addMinutes(slot.time, durationMinutes);
            
            // 既存予約との重複チェック
            const hasConflict = existingBookings.some(booking => {
                return this.isTimeOverlapping(
                    slot.time, endTime,
                    booking.start_time, booking.end_time
                );
            });

            if (hasConflict) {
                return false;
            }

            // セラピストの勤務時間チェック
            const availableTherapists = therapistSchedules.filter(therapist => {
                if (!therapist.isWorkingDay) return false;
                
                const workingHours = therapist.workingHours;
                if (!workingHours) return false;

                return this.isWithinWorkingHours(slot.time, endTime, workingHours);
            });

            return availableTherapists.length > 0;
        });
    }

    /**
     * 営業時間内かチェック
     */
    isWithinBusinessHours(time) {
        const hour = parseInt(time.split(':')[0]);
        return hour >= 10 || hour <= 2; // 10:00-02:00
    }

    /**
     * 時間の重複をチェック
     */
    isTimeOverlapping(start1, end1, start2, end2) {
        return start1 < end2 && end1 > start2;
    }

    /**
     * 時間に分を追加
     */
    addMinutes(timeString, minutes) {
        const [hours, mins] = timeString.split(':').map(Number);
        const totalMinutes = hours * 60 + mins + minutes;
        const newHours = Math.floor(totalMinutes / 60) % 24;
        const newMins = totalMinutes % 60;
        return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}:00`;
    }

    /**
     * セラピストの勤務時間内かチェック
     */
    isWithinWorkingHours(startTime, endTime, workingHours) {
        // 簡略化: workingHours は "10:00-19:00" 形式と仮定
        const [workStart, workEnd] = workingHours.split('-');
        return startTime >= workStart && endTime <= workEnd;
    }

    /**
     * 基本バリデーション
     */
    validateBookingTime(date, startTime, endTime) {
        const bookingDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (bookingDate < today) {
            return { isValid: false, message: '過去の日付は予約できません' };
        }

        if (startTime >= endTime) {
            return { isValid: false, message: '開始時間が終了時間より後になっています' };
        }

        return { isValid: true };
    }

    /**
     * 営業時間チェック
     */
    checkBusinessHours(startTime, endTime) {
        if (!this.isWithinBusinessHours(startTime) || !this.isWithinBusinessHours(endTime)) {
            return { 
                isValid: false, 
                message: `営業時間外です（営業時間: ${this.businessHours.start}-${this.businessHours.end}）` 
            };
        }
        return { isValid: true };
    }

    /**
     * 時間重複チェック
     */
    async checkTimeConflicts(date, startTime, endTime, therapistId) {
        const conflicts = await query(
            `SELECT * FROM bookings 
             WHERE booking_date = ? AND therapist_id = ? AND status IN ('pending', 'confirmed')
             AND ((start_time < ? AND end_time > ?) OR (start_time < ? AND end_time > ?))`,
            [date, therapistId, endTime, startTime, startTime, endTime]
        );

        if (conflicts.length > 0) {
            return { isValid: false, message: 'この時間は既に予約が入っています' };
        }

        return { isValid: true };
    }

    /**
     * セラピスト可用性チェック
     */
    async checkTherapistAvailability(date, startTime, endTime, therapistId) {
        const therapist = await queryOne(
            'SELECT * FROM therapists WHERE id = ? AND is_available = TRUE',
            [therapistId]
        );

        if (!therapist) {
            return { isValid: false, message: '指定されたセラピストは利用できません' };
        }

        // スケジュールチェックは簡略化
        return { isValid: true };
    }

    /**
     * サービス時間バリデーション
     */
    async validateServiceDuration(serviceId, startTime, endTime) {
        const service = await queryOne(
            'SELECT duration_minutes FROM services WHERE id = ?',
            [serviceId]
        );

        if (!service) {
            return { isValid: false, message: 'サービスが見つかりません' };
        }

        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);
        const actualDuration = (endHour * 60 + endMin) - (startHour * 60 + startMin);

        if (actualDuration !== service.duration_minutes) {
            return { 
                isValid: false, 
                message: `サービス時間が一致しません（必要時間: ${service.duration_minutes}分）` 
            };
        }

        return { isValid: true };
    }

    /**
     * 最適なセラピストを検索
     */
    async findBestTherapist(date, startTime, endTime, serviceId) {
        // 簡略化実装
        const therapists = await query(
            'SELECT id FROM therapists WHERE is_available = TRUE ORDER BY rating DESC LIMIT 1'
        );

        return therapists.length > 0 ? therapists[0].id : null;
    }

    /**
     * ユニークな予約コードを生成
     */
    async generateUniqueBookingCode(connection) {
        let bookingCode;
        let attempts = 0;
        
        do {
            const prefix = 'AM';
            const timestamp = Date.now().toString().slice(-6);
            const random = Math.random().toString(36).slice(-3).toUpperCase();
            bookingCode = `${prefix}${timestamp}${random}`;
            
            const [existing] = await connection.execute(
                'SELECT id FROM bookings WHERE booking_code = ?',
                [bookingCode]
            );
            
            if (existing.length === 0) break;
            attempts++;
        } while (attempts < 10);

        if (attempts >= 10) {
            throw new Error('予約コードの生成に失敗しました');
        }

        return bookingCode;
    }
}

module.exports = SchedulingService;