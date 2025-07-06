/**
 * Webhook設定用エンドポイント
 * /api/set-telegram-webhook
 */

import { setWebhook } from './telegram-webhook';

export default async function handler(req, res) {
    // 管理者認証（簡易版）
    const adminToken = process.env.ADMIN_TOKEN;
    const authHeader = req.headers.authorization;
    
    if (!adminToken || authHeader !== `Bearer ${adminToken}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        await setWebhook();
        res.status(200).json({ 
            success: true, 
            message: 'Webhook set successfully',
            url: `${process.env.VERCEL_URL}/api/telegram-webhook`
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to set webhook',
            message: error.message 
        });
    }
}