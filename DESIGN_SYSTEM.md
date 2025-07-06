# 愛なるマッサージ 統一デザインシステム

## 概要

このシステムは、愛なるマッサージウェブサイト全体で一貫したデザインとデータ構造を提供するための中央管理システムです。CMS（admin.html）で設定したデザインやコンテンツが自動的に全ページに反映されます。

## 主要コンポーネント

### 1. SITE_CONFIG（統一サイト設定）
- **場所**: `admin.html` 内で定義、`localStorage`に保存
- **目的**: 全ページで使用する統一設定を中央管理
- **含む内容**:
  - ブランド情報（名前、ロゴ、タグライン）
  - ナビゲーション構造
  - デザインシステム（色、フォント、グラデーション）
  - 連絡先情報
  - 会員システム設定
  - 年齢認証設定

### 2. site-config.js（ユーティリティ）
- **目的**: 全ページで統一設定を使用するためのヘルパー関数
- **主要機能**:
  - 統一ヘッダー生成
  - 統一フッター生成
  - CMSデータ取得
  - キャンペーンバナー管理
  - 年齢認証処理

### 3. 統一CSS（modern-styles.css）
- **ベースフレームワーク**: modern-styles.css
- **補完CSS**: premium-styles.css, services-styles.css
- **統一カラーパレット**: CSS変数で定義

## 使用方法

### 新しいページを作成する場合

1. **HTMLヘッダーに追加**:
```html
<script src="site-config.js"></script>
```

2. **統一ヘッダーを使用**:
```html
<div id="unified-header"></div>
<script>
document.addEventListener('DOMContentLoaded', function() {
    const headerContainer = document.getElementById('unified-header');
    if (headerContainer) {
        headerContainer.innerHTML = generateUnifiedHeader('現在のページ.html');
    }
});
</script>
```

3. **統一フッターを使用**:
```html
<div id="unified-footer"></div>
<script>
document.addEventListener('DOMContentLoaded', function() {
    const footerContainer = document.getElementById('unified-footer');
    if (footerContainer) {
        footerContainer.innerHTML = generateUnifiedFooter();
    }
});
</script>
```

### CMSデータを使用する場合

```javascript
// サービスデータを取得
const services = getServicesData();

// ホテルデータを取得
const hotels = getHotelsData();

// 医療機器データを取得
const equipment = getMedicalEquipmentData();

// キャンペーンバナーを表示
loadCampaignBanners();
```

## データフロー

```
Admin.html (CMS) → localStorage → site-config.js → 各ページ
     ↓                              ↓
SITE_CONFIG               統一ヘッダー/フッター
adminData                    CMSコンテンツ
```

## ファイル一覧

### 中央管理ファイル
- `admin.html`: CMS管理画面、SITE_CONFIG定義
- `site-config.js`: 統一設定ユーティリティ
- `modern-styles.css`: メインCSS

### 更新済みページ例
- `index.html`: 統一システム適用済み
- `privacy.html`: 統一ナビゲーション使用

### CSS補完ファイル
- `premium-styles.css`: プレミアム医療デザイン
- `services-styles.css`: 施術ページ専用

## デザイン統一要素

### カラーパレット
- **プライマリ**: #6366f1 (紫)
- **セカンダリ**: #06b6d4 (シアン)  
- **アクセント**: #ec4899 (ピンク)
- **テキスト**: #1a202c (ダーク)

### フォント
- **メイン**: Inter, Noto Sans JP
- **セリフ**: Playfair Display, Noto Serif JP

### レイアウト
- **最大幅**: 1200px
- **余白システム**: CSS変数 (--space-*)
- **角丸**: CSS変数 (--radius-*)

## CMS管理機能

管理画面（admin.html）でCMSデータを変更すると、以下が自動的に全ページに反映されます：

1. **ナビゲーション**: ヘッダーメニュー構造
2. **フッター**: 連絡先、SNS情報
3. **サービス内容**: 施術メニュー、価格
4. **ホテル情報**: 対応可能ホテルリスト
5. **キャンペーン**: ホームページバナー
6. **医療機器**: 安全対策ページ掲載内容

## システムの利点

1. **一貫性**: 全ページで統一されたデザイン
2. **効率性**: CMS変更で全ページ自動更新
3. **保守性**: 中央管理により更新作業が簡単
4. **拡張性**: 新ページ追加が容易
5. **ブランド統一**: 正しいブランド名・情報の自動適用

## 注意事項

- 管理画面にアクセスしていない場合、フォールバックデータが使用されます
- JavaScriptが無効の環境では統一機能が動作しません
- 既存ページは段階的に統一システムに移行する必要があります

## 今後の拡張計画

- 多言語対応システム
- テーマ切り替え機能
- A/Bテスト用設定
- SEO管理システム
- パフォーマンス監視機能