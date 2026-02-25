/**
 * Popup 脚本 - 主题选择和设置
 */

const THEME_KEY = 'linux_do_theme';

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    // 动态显示版本号
    const versionEl = document.getElementById('ext-version');
    if (versionEl) {
        versionEl.textContent = 'v' + chrome.runtime.getManifest().version;
    }

    // 获取当前主题
    const result = await chrome.storage.local.get(THEME_KEY);
    const currentTheme = result[THEME_KEY] || 'default';

    // 高亮当前主题按钮
    highlightTheme(currentTheme);

    // 绑定主题按钮点击事件（主题同步通过 chrome.storage.onChanged 实现）
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const theme = btn.dataset.theme;
            await chrome.storage.local.set({ [THEME_KEY]: theme });
            highlightTheme(theme);
        });
    });
});

function highlightTheme(theme) {
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}
