/**
 * ホテルルート
 * Hotel routes for Ainaru Massage CMS
 */

const express = require('express');
const router = express.Router();

// TODO: ホテル関連のエンドポイントを実装
// - GET / - ホテル一覧取得
// - GET /:id - ホテル詳細取得
// - POST / - ホテル登録（管理者のみ）
// - PUT /:id - ホテル情報更新（管理者のみ）
// - DELETE /:id - ホテル削除（管理者のみ）

router.get('/health', (req, res) => {
    res.json({ status: 'Hotel routes placeholder' });
});

module.exports = router;