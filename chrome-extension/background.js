/**
 * Background Script - 处理跨域请求
 * Service Worker 拥有 host_permissions，可直接携带 cookie 请求目标域
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetch') {
        (async () => {
            try {
                const response = await fetch(request.url, {
                    method: request.method || 'GET',
                    credentials: 'include'
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                sendResponse({ success: true, data: await response.text() });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // JSON API - 直接在 background 中 fetch（利用 host_permissions 携带 cookie）
    if (request.action === 'fetchJson') {
        (async () => {
            try {
                const headers = {
                    'Accept': 'application/json, text/plain, */*'
                };
                // Discourse API 需要 X-Requested-With 头才能返回完整数据
                if (request.url.includes('linux.do')) {
                    headers['X-Requested-With'] = 'XMLHttpRequest';
                    headers['Discourse-Present'] = 'true';
                }
                const response = await fetch(request.url, {
                    method: 'GET',
                    credentials: 'include',
                    headers
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data = await response.json();
                sendResponse({ success: true, data });
            } catch (error) {
                console.error('[Linux.do等级监控] fetchJson 错误:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }
});

console.log('[Linux.do等级监控] Background script 已加载 v6.2.0');
