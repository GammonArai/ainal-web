/**
 * 愛なるマッサージ 統一サイト設定システム
 * Site Configuration Utility for Design & Data Consistency
 * 
 * このファイルは全ページで統一されたデザインとデータ構造を提供します
 * All pages should include this file to ensure consistent design and data structure
 */

// 翻訳機能初期化
function initializeI18n() {
    if (typeof I18nManager !== 'undefined') {
        window.i18n = new I18nManager();
    }
}

// サイト設定を取得（admin.htmlから同期）
function getSiteConfig() {
    try {
        const config = localStorage.getItem('siteConfig');
        if (config) {
            return JSON.parse(config);
        }
    } catch (error) {
        console.warn('サイト設定の取得に失敗しました:', error);
    }
    
    // フォールバック設定（管理画面にアクセスしていない場合）
    return {
        brand: {
            name: '愛なるマッサージ',
            logo: '<i class="fas fa-spa"></i> 愛なるマッサージ',
            tagline: '心と体に愛を込めた癒しの出張マッサージ・アカスリ専門店'
        },
        contact: {
            telegram: { botName: '@AnalSenseiBot', url: 'https://t.me/AnalSenseiBot' },
            area: '福岡市中洲・博多・天神エリア',
            payment: { methods: ['現金'] }
        },
        social: {
            twitter: { handle: '@ainaru_massage', url: 'https://x.com/ainaru_massage' }
        },
        navigation: {
            main: [
                { title: 'ホーム', url: 'index.html', icon: 'fas fa-home' },
                { title: '対応可能ホテル', url: 'hotels.html', icon: 'fas fa-building' },
                { title: '施術内容', url: 'services.html', icon: 'fas fa-spa' },
                { title: '施術者紹介', url: 'therapists.html', icon: 'fas fa-user-md' },
                { title: '感染対策', url: 'safety.html', icon: 'fas fa-shield-virus' },
                { title: '施術イメージ', url: 'manga.html', icon: 'fas fa-images' },
                { title: '健康コラム', url: 'column.html', icon: 'fas fa-blog' },
                { title: '求人情報', url: 'recruit.html', icon: 'fas fa-briefcase' }
            ],
            footer: [
                { title: '対応可能ホテル', url: 'hotels.html' },
                { title: '施術イメージ', url: 'manga.html' },
                { title: '健康コラム', url: 'column.html' },
                { title: '求人情報', url: 'recruit.html' },
                { title: 'プライバシーポリシー', url: 'privacy.html' },
                { title: 'ご利用規約', url: 'terms.html' }
            ]
        }
    };
}

// Analytics自動追加
function injectAnalytics() {
    // カスタムAnalyticsスクリプト
    if (!document.querySelector('script[src*="analytics.js"]')) {
        const script = document.createElement('script');
        script.src = '/scripts/analytics.js';
        script.defer = true;
        document.head.appendChild(script);
    }
    
    // Vercel Analytics Scripts
    if (!document.querySelector('script[src*="_vercel/insights"]')) {
        const insightsScript = document.createElement('script');
        insightsScript.defer = true;
        insightsScript.src = '/_vercel/insights/script.js';
        document.head.appendChild(insightsScript);
    }
    
    if (!document.querySelector('script[src*="_vercel/speed-insights"]')) {
        const speedScript = document.createElement('script');
        speedScript.defer = true;
        speedScript.src = '/_vercel/speed-insights/script.js';
        document.head.appendChild(speedScript);
    }
}

// ページ読み込み時にAnalyticsを注入
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectAnalytics);
} else {
    injectAnalytics();
}

// 統一ヘッダーを生成
function generateUnifiedHeader(currentPage = '') {
    const config = getSiteConfig();
    return `
        <header class="header">
            <nav class="navbar">
                <div class="nav-container">
                    <div class="nav-logo">
                        <h1>${config.brand.logo}</h1>
                    </div>
                    <ul class="nav-menu">
                        ${config.navigation.main.map(item => `
                            <li class="nav-item">
                                <a href="${item.url}" class="nav-link ${item.url === currentPage ? 'active' : ''}">
                                    ${item.title}
                                </a>
                            </li>
                        `).join('')}
                    </ul>
                    <div class="nav-auth">
                        <a href="/telegram-login.html" class="btn-member">
                            <i class="fas fa-user-circle"></i>
                            <span>会員ページ</span>
                        </a>
                    </div>
                    <div class="hamburger">
                        <span class="bar"></span>
                        <span class="bar"></span>
                        <span class="bar"></span>
                    </div>
                </div>
            </nav>
        </header>
    `;
}

// 統一フッターを生成
function generateUnifiedFooter() {
    const config = getSiteConfig();
    return `
        <footer class="footer">
            <div class="container">
                <div class="footer-content">
                    <div class="footer-section">
                        <h3>${config.brand.name}</h3>
                        <p>${config.brand.tagline}</p>
                        <div style="margin-top: var(--space-4);">
                            <p><i class="fab fa-telegram"></i> <a href="${config.contact.telegram.url}" target="_blank" style="color: rgba(255,255,255,0.9); text-decoration: none;">${config.contact.telegram.botName}</a></p>
                            <p><i class="fas fa-mobile-alt"></i> ${config.contact.payment.methods.join('・')}決済のみ対応</p>
                            <p><i class="fas fa-map-marker-alt"></i> ${config.contact.area}</p>
                        </div>
                        <div style="margin-top: var(--space-6);">
                            <h4 style="margin-bottom: var(--space-3); font-size: 1rem;">フォローする</h4>
                            <a href="${config.social.twitter.url}" target="_blank" style="display: inline-flex; align-items: center; gap: var(--space-2); color: rgba(255,255,255,0.7); text-decoration: none; transition: color 0.3s ease;" onmouseover="this.style.color='#1da1f2'" onmouseout="this.style.color='rgba(255,255,255,0.7)'">
                                <i class="fab fa-x-twitter" style="font-size: 1.2rem;"></i>
                                <span>${config.social.twitter.handle}</span>
                            </a>
                        </div>
                    </div>
                    <div class="footer-section">
                        <h4>サービス</h4>
                        <ul>
                            <li><a href="services.html#atype">アナル開発コース</a></li>
                            <li><a href="services.html#mtype">M性感コース</a></li>
                            <li><a href="services.html#stretch">アナル拡張コース</a></li>
                            <li><a href="safety.html">感染対策</a></li>
                        </ul>
                    </div>
                    <div class="footer-section">
                        <h4>ご案内</h4>
                        <ul>
                            ${config.navigation.footer.map(item => `
                                <li><a href="${item.url}">${item.title}</a></li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
                <div class="footer-bottom">
                    <p>&copy; 2024 ${config.brand.name}. All rights reserved.</p>
                </div>
            </div>
        </footer>
    `;
}

// 管理者データを取得（CMSデータ用）
function getAdminData() {
    try {
        const data = localStorage.getItem('adminData');
        if (data) {
            return JSON.parse(data);
        }
    } catch (error) {
        console.warn('管理者データの取得に失敗しました:', error);
    }
    return null;
}

// サービスデータを取得
function getServicesData() {
    const adminData = getAdminData();
    if (adminData && adminData.services) {
        return adminData.services;
    }
    
    // フォールバックデータ
    return [
        {
            id: 1,
            name: 'マッサージ',
            subtitle: '心身ともにリラックス',
            description: '経験豊富なセラピストによる本格的なマッサージ',
            tags: ['リラックス', '疲労回復', '癒し'],
            status: 'active'
        },
        {
            id: 2,
            name: 'アカスリ',
            subtitle: '美肌効果抜群',
            description: '韓国式本格アカスリで美しい肌へ',
            tags: ['美肌', 'リフレッシュ', '清潔'],
            status: 'active'
        }
    ];
}

// ホテルデータを取得
function getHotelsData() {
    const adminData = getAdminData();
    if (adminData && adminData.hotels) {
        return adminData.hotels;
    }
    
    // フォールバックデータ
    return [
        {
            id: 1,
            name: 'グランドハイアット福岡',
            area: '中洲川端',
            description: '中洲川端駅直結の高級ホテル',
            features: ['高級', '駅直結', 'スパ施設あり'],
            imageUrl: '',
            status: 'active'
        }
    ];
}

// 医療機器データを取得
function getMedicalEquipmentData() {
    const adminData = getAdminData();
    if (adminData && adminData.medicalEquipment) {
        return adminData.medicalEquipment;
    }
    
    // フォールバックデータ
    return [
        {
            id: 1,
            name: 'UV殺菌システム',
            category: '消毒システム',
            description: '医療レベルの紫外線殺菌装置',
            imageUrl: '',
            features: ['99.9%除菌', '医療レベル'],
            specifications: 'UV-C 254nm',
            medicalGrade: true,
            status: 'active'
        }
    ];
}

// キャンペーンバナーを取得
function getCampaignBanners() {
    const adminData = getAdminData();
    if (!adminData || !adminData.promotions) {
        return [];
    }
    
    // アクティブなバナーのみを返す
    return adminData.promotions.filter(p => 
        p.showOnHomeBanner && 
        p.status === 'active' &&
        new Date(p.startDate) <= new Date() &&
        new Date(p.endDate) >= new Date()
    );
}

// バナーを表示
function displayBanners(banners) {
    if (!banners || banners.length === 0) return;
    
    // バナーコンテナが存在するかチェック
    let bannerContainer = document.getElementById('banner-container');
    if (!bannerContainer) {
        // バナーコンテナを作成してbodyの先頭に追加
        bannerContainer = document.createElement('div');
        bannerContainer.id = 'banner-container';
        bannerContainer.style.cssText = `
            position: fixed;
            top: 80px;
            left: 0;
            right: 0;
            z-index: 999;
            background: transparent;
            pointer-events: none;
        `;
        document.body.insertBefore(bannerContainer, document.body.firstChild);
    }
    
    bannerContainer.innerHTML = banners.map((banner, index) => `
        <div class="campaign-banner" style="
            background-color: ${banner.bannerColor || '#ff6b6b'};
            color: white;
            padding: 12px 20px;
            text-align: center;
            font-weight: 600;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            animation: slideDown 0.5s ease-out ${index * 0.2}s both;
            pointer-events: auto;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-bottom: 2px;
        " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
            ${banner.bannerText || banner.title}
            <button onclick="closeBanner(this)" style="
                background: none;
                border: none;
                color: white;
                font-size: 18px;
                float: right;
                cursor: pointer;
                padding: 0;
                margin-left: 20px;
            ">&times;</button>
        </div>
    `).join('');
}

// バナーを閉じる
function closeBanner(button) {
    const banner = button.parentElement;
    banner.style.animation = 'slideUp 0.3s ease-in forwards';
    setTimeout(() => {
        banner.remove();
        // 全てのバナーが削除されたらコンテナも削除
        const container = document.getElementById('banner-container');
        if (container && container.children.length === 0) {
            container.remove();
        }
    }, 300);
}

// キャンペーンバナーをロード
function loadCampaignBanners() {
    const banners = getCampaignBanners();
    if (banners.length > 0) {
        displayBanners(banners);
    }
}

// 年齢認証を確認
function checkAgeVerification() {
    const config = getSiteConfig();
    if (!config.ageVerification || !config.ageVerification.required) {
        return true;
    }
    
    const verified = sessionStorage.getItem('ageVerified');
    const verifiedTime = sessionStorage.getItem('ageVerifiedTime');
    
    if (verified && verifiedTime) {
        const hoursSinceVerification = (Date.now() - parseInt(verifiedTime)) / (1000 * 60 * 60);
        if (hoursSinceVerification < (config.ageVerification.sessionDuration || 24)) {
            return true;
        }
    }
    
    return false;
}

// 年齢認証モーダルを表示
function showAgeVerification() {
    const config = getSiteConfig();
    const modal = document.createElement('div');
    modal.id = 'age-verification-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        backdrop-filter: blur(5px);
    `;
    
    modal.innerHTML = `
        <div style="
            background: white;
            padding: 3rem;
            border-radius: 16px;
            max-width: 500px;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        ">
            <h2 style="color: #1a202c; margin-bottom: 1.5rem;">年齢確認</h2>
            <p style="color: #4a5568; margin-bottom: 2rem; line-height: 1.6;">
                このサイトは${config.ageVerification?.minimumAge || 18}歳以上の方を対象としたサービスです。<br>
                あなたは${config.ageVerification?.minimumAge || 18}歳以上ですか？
            </p>
            <div style="display: flex; gap: 1rem; justify-content: center;">
                <button onclick="confirmAge()" style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                ">はい（${config.ageVerification?.minimumAge || 18}歳以上）</button>
                <button onclick="declineAge()" style="
                    background: #e2e8f0;
                    color: #4a5568;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                ">いいえ</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// 年齢確認
function confirmAge() {
    sessionStorage.setItem('ageVerified', 'true');
    sessionStorage.setItem('ageVerifiedTime', Date.now().toString());
    
    const modal = document.getElementById('age-verification-modal');
    if (modal) {
        modal.remove();
    }
}

// 年齢確認拒否
function declineAge() {
    alert('申し訳ございませんが、18歳未満の方はご利用いただけません。');
    window.location.href = 'https://www.google.com';
}

// ページロード時の初期化
function initializePage() {
    // 翻訳機能初期化
    initializeI18n();
    
    // 年齢認証をチェック
    if (!checkAgeVerification()) {
        showAgeVerification();
        return;
    }
    
    // キャンペーンバナーをロード
    loadCampaignBanners();
    
    // ハンバーガーメニューの初期化
    initializeHamburgerMenu();
}

// ハンバーガーメニューの初期化
function initializeHamburgerMenu() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
        
        // メニューアイテムクリック時にメニューを閉じる
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
    }
}

// CSSアニメーションを追加
function addSiteAnimations() {
    if (document.getElementById('site-animations')) return;
    
    const style = document.createElement('style');
    style.id = 'site-animations';
    style.textContent = `
        @keyframes slideDown {
            from { transform: translateY(-100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes slideUp {
            from { transform: translateY(0); opacity: 1; }
            to { transform: translateY(-100%); opacity: 0; }
        }
        
        .campaign-banner {
            animation: slideDown 0.5s ease-out;
        }
    `;
    document.head.appendChild(style);
}

// DOMロード完了時に初期化
document.addEventListener('DOMContentLoaded', function() {
    addSiteAnimations();
    initializePage();
});

// エクスポート（モジュール環境用）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getSiteConfig,
        generateUnifiedHeader,
        generateUnifiedFooter,
        getAdminData,
        getServicesData,
        getHotelsData,
        getMedicalEquipmentData,
        getCampaignBanners,
        loadCampaignBanners,
        initializePage
    };
}