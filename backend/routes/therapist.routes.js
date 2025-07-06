/**
 * セラピストルート
 * Therapist routes for Ainaru Massage CMS
 */

const express = require('express');
const router = express.Router();

// TODO: セラピスト関連のエンドポイントを実装
// - GET / - セラピスト一覧取得
// - GET /:id - セラピスト詳細取得
// - PUT /:id - セラピストプロフィール更新
// - GET /:id/schedule - スケジュール取得
// - PUT /:id/schedule - スケジュール更新
// - GET /:id/reviews - レビュー一覧取得

router.get('/health', (req, res) => {
    res.json({ status: 'Therapist routes placeholder' });
});

module.exports = router;