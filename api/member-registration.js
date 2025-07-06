/**
 * 会員登録用API（Vercel Serverless Function）
 * /api/member-registration
 */

const crypto = require('crypto');

// 会員番号生成
function generateMemberNumber() {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `AM${year}${month}${random}`;
}

// 紹介コード検証（簡易版）
function validateReferralCode(code) {
    // 8文字の英数字
    const pattern = /^[A-Z0-9]{8}$/;
    return pattern.test(code);
}

export default async function handler(req, res) {
    // CORSヘッダー
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { 
            referralCode, 
            email, 
            password, 
            displayName, 
            phoneNumber 
        } = req.body;
        
        // 入力検証
        if (!referralCode || !email || !password || !displayName || !phoneNumber) {
            return res.status(400).json({ 
                error: 'すべての項目を入力してください' 
            });
        }
        
        // 紹介コード形式チェック
        if (!validateReferralCode(referralCode)) {
            return res.status(400).json({ 
                error: '紹介コードの形式が正しくありません' 
            });
        }
        
        // TODO: 実際のデータベース処理
        // ここでは簡易的なモック処理
        
        // 紹介コードチェック（モック）
        const validCodes = ['WELCOME1', 'VIP12345', 'GOLD2024'];
        if (!validCodes.includes(referralCode)) {
            return res.status(400).json({ 
                error: '無効な紹介コードです' 
            });
        }
        
        // 会員登録処理（モック）
        const memberNumber = generateMemberNumber();
        const token = crypto.randomBytes(32).toString('hex');
        
        // 成功レスポンス
        res.status(200).json({
            success: true,
            message: '会員登録が完了しました',
            data: {
                memberNumber,
                displayName,
                email,
                memberRank: 'regular',
                token, // 実際はJWTトークンを生成
                benefits: [
                    '専用予約システムへのアクセス',
                    '会員限定料金',
                    '優先予約権'
                ]
            }
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            error: 'システムエラーが発生しました' 
        });
    }
}