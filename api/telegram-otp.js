/**
 * Telegram OTP（ワンタイムパスワード）送信API
 * /api/telegram-otp
 */

const { Telegraf } = require('telegraf');

// OTP生成
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// OTPストレージ（実際はRedisやDBを使用）
const otpStorage = new Map();

export default async function handler(req, res) {
    // CORSヘッダー
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    try {
        const { action, telegramUsername, otp } = req.body;
        
        if (action === 'send') {
            // OTP送信処理
            if (!telegramUsername) {
                return res.status(400).json({ 
                    error: 'Telegramユーザー名が必要です' 
                });
            }
            
            // OTP生成
            const newOTP = generateOTP();
            
            // 有効期限5分で保存
            otpStorage.set(telegramUsername, {
                otp: newOTP,
                expires: Date.now() + 5 * 60 * 1000,
                attempts: 0
            });
            
            // Telegram Bot経由で送信（実際の実装）
            if (process.env.TELEGRAM_BOT_TOKEN) {
                try {
                    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
                    
                    // メッセージ送信
                    const message = `
🔐 **ログインパスワード**

あなたのワンタイムパスワード：
\`${newOTP}\`

⏱ 有効期限：5分間
🔒 このパスワードは他人に教えないでください

愛なるマッサージ`;
                    
                    // ユーザー名からチャットIDを取得する処理が必要
                    // ここではモックとして処理
                    console.log(`OTP ${newOTP} would be sent to @${telegramUsername}`);
                    
                } catch (error) {
                    console.error('Telegram送信エラー:', error);
                }
            }
            
            res.status(200).json({ 
                success: true,
                message: 'パスワードをTelegramに送信しました' 
            });
            
        } else if (action === 'verify') {
            // OTP検証処理
            if (!telegramUsername || !otp) {
                return res.status(400).json({ 
                    error: '必要な情報が不足しています' 
                });
            }
            
            const stored = otpStorage.get(telegramUsername);
            
            if (!stored) {
                return res.status(400).json({ 
                    error: 'パスワードが見つかりません' 
                });
            }
            
            // 有効期限チェック
            if (Date.now() > stored.expires) {
                otpStorage.delete(telegramUsername);
                return res.status(400).json({ 
                    error: 'パスワードの有効期限が切れています' 
                });
            }
            
            // 試行回数チェック
            if (stored.attempts >= 3) {
                otpStorage.delete(telegramUsername);
                return res.status(400).json({ 
                    error: '試行回数の上限に達しました' 
                });
            }
            
            // OTP検証
            if (stored.otp !== otp) {
                stored.attempts++;
                return res.status(400).json({ 
                    error: 'パスワードが正しくありません',
                    attemptsLeft: 3 - stored.attempts 
                });
            }
            
            // 成功 - OTPを削除
            otpStorage.delete(telegramUsername);
            
            // JWTトークン生成（実際の実装では必要）
            const token = 'mock-jwt-token-' + Date.now();
            
            res.status(200).json({ 
                success: true,
                message: 'ログインに成功しました',
                token,
                user: {
                    telegramUsername,
                    memberNumber: 'AM2401' + Math.floor(Math.random() * 1000)
                }
            });
            
        } else {
            res.status(400).json({ 
                error: '無効なアクションです' 
            });
        }
        
    } catch (error) {
        console.error('OTP API error:', error);
        res.status(500).json({ 
            error: 'システムエラーが発生しました' 
        });
    }
}

// 定期的にクリーンアップ（実際はcronジョブで実行）
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of otpStorage.entries()) {
        if (now > value.expires) {
            otpStorage.delete(key);
        }
    }
}, 60000); // 1分ごと