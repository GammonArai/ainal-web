# 🗑️ 削除対象ファイル一覧

## X運用に不要なファイル・ディレクトリ

### バックエンド関連（完全削除）
```
backend/                     # 全削除
├── config/
├── middleware/
├── routes/
├── services/
├── scripts/
├── logs/
└── uploads/

database/                    # 全削除
├── schema.sql
└── seed-data.sql
```

### 複雑な管理画面（削除）
```
admin.html                   # 532KB - 削除
admin-*.html                 # 全ての管理画面削除
├── admin-analytics.html
├── admin-backup.html
├── admin-calendar.html
├── admin-customers.html
├── admin-login.html
├── admin-payments.html
├── admin-reviews.html
├── admin-services.html
└── admin-upload.html
```

### 不要な機能ページ
```
login.html                   # 会員ログイン不要
payment-integration.html     # PayPay不要
therapist-register.html      # セラピスト登録不要
recruit.html                 # 採用ページ不要
write-review.html           # レビュー投稿不要
```

### 複雑なJavaScript
```
pwa-init.js                 # PWA不要
sw.js                       # Service Worker不要
performance-optimizer.js    # 不要
language-selector.js        # 多言語不要
```

### 設定ファイル
```
package.json                # Node.js不要
package-lock.json
package-static.json
vercel.json                 # Vercel不要
netlify.toml               # Netlify不要
railway.json               # Railway不要
```

### ドキュメント類
```
SETUP.md                   # 複雑なセットアップ不要
DEPLOYMENT_CHECKLIST.md
FREE_VPS_OPTIONS.md
ORACLE_DEPLOY.md
STATIC_DEPLOY.md
```

## 保持するファイル（必要最小限）

### 基本ページ（簡素化版）
```
index.html                 # ランディングページ（簡素版）
services.html             # サービス紹介（簡素版）
safety.html               # 感染対策
privacy.html              # プライバシーポリシー
terms.html                # 利用規約
```

### スタイル
```
modern-styles.css         # 基本スタイルのみ
```

### 画像
```
images/                   # 必要な画像のみ
├── analsensei.png        # ロゴ
├── aroma-massage.jpg     # サービス画像
├── korean-scrub.jpg
├── sleep-massage.jpg
├── sports-massage.jpg
├── desk-work-relief.jpg
└── icon-*.png           # ファビコン
```

### モバイル運用テンプレート
```
mobile-templates/         # 新規作成
├── schedule-template.md
├── dm-templates.md
└── operation-manual.md
```

## 削除後の構成（超軽量版）
```
/
├── index.html            # 簡素なランディング
├── services.html         # サービス紹介
├── safety.html           # 感染対策
├── privacy.html          # 必須ページ
├── terms.html            # 必須ページ
├── modern-styles.css     # 基本スタイル
├── images/              # 必要画像のみ
├── mobile-templates/    # X運用テンプレート
└── README.md            # 更新版
```

**削除後のサイズ予想: 約200KB以下**