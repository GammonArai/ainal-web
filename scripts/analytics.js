// Vercel Analytics Integration for Static Sites
// This script should be included in all HTML pages

// Vercel Analytics用のスクリプトタグを追加
(function() {
    // Vercel Analytics
    const analyticsScript = document.createElement('script');
    analyticsScript.defer = true;
    analyticsScript.setAttribute('data-website-id', window.location.hostname);
    analyticsScript.src = 'https://va.vercel-scripts.com/v1/script.debug.js';
    
    // 本番環境では debug を外す
    if (window.location.hostname !== 'localhost') {
        analyticsScript.src = 'https://va.vercel-scripts.com/v1/script.js';
    }
    
    document.head.appendChild(analyticsScript);
})();

// カスタムイベントトラッキング
window.trackEvent = function(eventName, eventData = {}) {
    if (window.va) {
        window.va('event', { name: eventName, ...eventData });
    }
};

// ページビュートラッキング（SPAの場合）
window.trackPageView = function(pageName) {
    if (window.va) {
        window.va('pageview', { page: pageName });
    }
};

// 自動的なクリックトラッキング
document.addEventListener('DOMContentLoaded', function() {
    // 重要なボタンのクリックを追跡
    const trackableElements = [
        { selector: '.btn-member', event: 'member_button_click' },
        { selector: '[href*="member-registration"]', event: 'registration_click' },
        { selector: '[href*="telegram-login"]', event: 'login_click' },
        { selector: '.copy-button', event: 'referral_code_copy' },
        { selector: '.submit-button', event: 'form_submit' }
    ];
    
    trackableElements.forEach(({ selector, event }) => {
        document.querySelectorAll(selector).forEach(element => {
            element.addEventListener('click', () => {
                trackEvent(event, { 
                    page: window.location.pathname,
                    element: element.textContent || element.innerText
                });
            });
        });
    });
    
    // 外部リンククリックの追跡
    document.querySelectorAll('a[href^="http"]:not([href*="' + window.location.hostname + '"])').forEach(link => {
        link.addEventListener('click', () => {
            trackEvent('external_link_click', {
                url: link.href,
                text: link.textContent || link.innerText
            });
        });
    });
});

// エラートラッキング
window.addEventListener('error', function(event) {
    trackEvent('javascript_error', {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno
    });
});

// パフォーマンストラッキング
window.addEventListener('load', function() {
    if (window.performance && window.performance.timing) {
        const timing = window.performance.timing;
        const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
        const domReadyTime = timing.domContentLoadedEventEnd - timing.navigationStart;
        
        trackEvent('performance_metrics', {
            page_load_time: pageLoadTime,
            dom_ready_time: domReadyTime,
            page: window.location.pathname
        });
    }
});