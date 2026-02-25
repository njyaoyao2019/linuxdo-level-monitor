/**
 * Linux.do 等级监控 - Chrome 扩展版
 * 支持多主题切换的游戏风格UI + Credit 积分整合
 */

(function() {
    'use strict';

    // ==================== 配置常量 ====================
    const SCRIPT_KEY = 'LINUX_DO_LEVEL_MONITOR_RUNNING';
    const STORAGE_KEY = 'linux_do_user_data';
    const CREDIT_STORAGE_KEY = 'linux_do_credit_data';
    const THEME_KEY = 'linux_do_theme';
    const TAB_KEY = 'linux_do_active_tab';
    const DATA_VERSION = 2;

    // 主题列表
    const THEMES = {
        default: { name: '默认', icon: '🎨' },
        rpg: { name: 'RPG', icon: '⚔️' },
        pixel: { name: '像素', icon: '👾' },
        card: { name: '卡牌', icon: '🃏' },
        cyber: { name: '赛博', icon: '🌆' }
    };

    // 等级要求配置
    const LEVEL_REQUIREMENTS = {
        0: { topics_entered: 5, posts_read_count: 30, time_read: 600 },
        1: { days_visited: 15, likes_given: 1, likes_received: 1, post_count: 3, topics_entered: 20, posts_read_count: 100, time_read: 3600 }
    };

    // ==================== 防重复执行 ====================
    if (window[SCRIPT_KEY]) return;
    window[SCRIPT_KEY] = true;

    // ==================== 工具函数 ====================
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    function log(message) {
        console.log(`[Linux.do等级监控] ${message}`);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    // 存储操作
    const Storage = {
        async get(key, defaultValue = null) {
            try {
                const result = await chrome.storage.local.get(key);
                return result[key] ?? defaultValue;
            } catch (e) {
                log(`存储读取失败: ${e.message}`);
                return defaultValue;
            }
        },
        async set(key, value) {
            try {
                await chrome.storage.local.set({ [key]: value });
            } catch (e) {
                log(`存储写入失败: ${e.message}`);
            }
        }
    };

    // ==================== 主题管理器 ====================
    const ThemeManager = {
        currentTheme: 'default',

        async init() {
            this.currentTheme = await Storage.get(THEME_KEY, 'default');
            this.apply(this.currentTheme);
            this.listenForChanges();
        },

        apply(themeName) {
            document.body.classList.remove(...Object.keys(THEMES).map(t => `ld-theme-${t}`));
            document.body.classList.add(`ld-theme-${themeName}`);
            this.currentTheme = themeName;
            log(`应用主题: ${themeName}`);
        },

        async switch(themeName) {
            if (!THEMES[themeName]) return;
            this.apply(themeName);
            await Storage.set(THEME_KEY, themeName);
        },

        next() {
            const themeNames = Object.keys(THEMES);
            const currentIndex = themeNames.indexOf(this.currentTheme);
            const nextIndex = (currentIndex + 1) % themeNames.length;
            this.switch(themeNames[nextIndex]);
            return themeNames[nextIndex];
        },

        listenForChanges() {
            chrome.storage.onChanged.addListener((changes, namespace) => {
                if (namespace === 'local' && changes[THEME_KEY]) {
                    this.apply(changes[THEME_KEY].newValue);
                }
            });
        }
    };

    // ==================== 用户信息获取 ====================
    function getCurrentUsername() {
        const userMenuButton = document.querySelector('.header-dropdown-toggle.current-user');
        if (userMenuButton) {
            const img = userMenuButton.querySelector('img');
            if (img && img.alt) return img.alt;
            // 备用：从头像 src 中提取用户名，格式 /letter_avatar/{username}/... 或 /user_avatar/.../{username}/...
            if (img && img.src) {
                const letterMatch = img.src.match(/\/letter_avatar\/([^/]+)\//);
                if (letterMatch && letterMatch[1]) return letterMatch[1];
                const userMatch = img.src.match(/\/user_avatar\/[^/]+\/([^/]+)\//);
                if (userMatch && userMatch[1]) return userMatch[1];
            }
        }
        const userAvatar = document.querySelector('.current-user img[title]');
        if (userAvatar && userAvatar.title) return userAvatar.title;
        const currentUserLink = document.querySelector('a.current-user, .header-dropdown-toggle.current-user a');
        if (currentUserLink) {
            const href = currentUserLink.getAttribute('href');
            if (href && href.includes('/u/')) {
                const username = href.split('/u/')[1].split('/')[0];
                if (username && username.length > 0) return username;
            }
        }
        if (window.location.pathname.includes('/u/')) {
            const username = window.location.pathname.split('/u/')[1].split('/')[0];
            if (username && username.length > 0) return username;
        }
        try {
            const discourseData = localStorage.getItem('discourse_current_user');
            if (discourseData) {
                const userData = JSON.parse(discourseData);
                if (userData && userData.username) return userData.username;
            }
        } catch (e) {}
        return null;
    }

    function isLoggedIn() {
        const userMenu = document.querySelector('.header-dropdown-toggle.current-user');
        if (userMenu) return true;
        const loginBtn = document.querySelector('.login-button, .sign-up-button, button.login-button');
        if (loginBtn && loginBtn.offsetParent !== null) return false;
        return true;
    }

    // ==================== 跨域请求辅助函数 ====================
    async function fetchViaBackground(url) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'fetch', url }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (response && response.success) {
                    resolve(response.data);
                } else {
                    reject(new Error(response?.error || '请求失败'));
                }
            });
        });
    }

    // Credit API 请求（通过 background 发起，利用 host_permissions 携带 cookie）
    async function fetchCreditApi(url) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'fetchJson', url }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (response && response.success) {
                    resolve(response.data);
                } else {
                    reject(new Error(response?.error || '请求失败'));
                }
            });
        });
    }

    async function fetchJsonViaBackground(url) {
        return fetchCreditApi(url);
    }

    // ==================== 等级数据获取 ====================
    async function fetchUserData() {
        let username = getCurrentUsername();
        log(`页面获取的用户名: ${username || '未获取到'}`);

        try {
            log('正在请求 connect.linux.do (via background)...');
            const connectHtml = await fetchViaBackground('https://connect.linux.do/');
            log(`connect.linux.do 响应长度: ${connectHtml.length}`);

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = connectHtml;

            let currentLevel = '0';
            let targetLevel = null;
            let hasReachedTarget = false;

            // 主要来源：从 user-menu-info 提取当前等级，格式 "@xxx · 信任级别 X"
            // 这是唯一可靠的当前等级来源（card-title 固定显示 3 级要求，不反映真实等级）
            const menuInfo = tempDiv.querySelector('.user-menu-info');
            if (menuInfo) {
                const menuText = menuInfo.textContent;
                const menuLevelMatch = menuText.match(/信任级别\s*(\d+)/);
                if (menuLevelMatch) {
                    currentLevel = menuLevelMatch[1];
                }
                // 同时从 user-menu-info 提取用户名
                const menuUsernameMatch = menuText.match(/@(\S+)/);
                if (menuUsernameMatch && menuUsernameMatch[1]) {
                    username = menuUsernameMatch[1];
                }
            }

            // 从 h2.card-title 提取页面展示的目标等级，格式 "信任级别 X 的要求"
            const cardTitle = tempDiv.querySelector('h2.card-title');
            if (cardTitle) {
                const titleText = cardTitle.textContent.trim();
                const levelMatch = titleText.match(/信任级别\s*(\d+)/);
                if (levelMatch) targetLevel = parseInt(levelMatch[1]);

                // 通过 badge 判断是否已达到该目标等级
                const badge = tempDiv.querySelector('.card-header .badge');
                if (badge) {
                    hasReachedTarget = badge.classList.contains('badge-success');
                }
            }

            // 从 p.card-subtitle 提取用户名作为备用，格式 "@YY_WD · 过去 100 天内的数据"
            if (!username) {
                const cardSubtitle = tempDiv.querySelector('p.card-subtitle');
                if (cardSubtitle) {
                    const subtitleText = cardSubtitle.textContent.trim();
                    const usernameMatch = subtitleText.match(/@(\S+)/);
                    if (usernameMatch && usernameMatch[1]) {
                        username = usernameMatch[1];
                    }
                }
            }

            log(`当前等级: ${currentLevel}, 目标等级: ${targetLevel}, 是否已达到: ${hasReachedTarget}`);

            // 兼容旧版页面：从 h1 提取
            if (!cardTitle && !menuInfo) {
                const h1 = tempDiv.querySelector('h1');
                if (h1) {
                    const h1Text = h1.textContent.trim();
                    const welcomeMatch = h1Text.match(/你好，\s*([^(\s]*)\s*\(?([^)]*)\)?\s*(\d+)级用户/i);
                    if (welcomeMatch) {
                        const parsedUsername = welcomeMatch[2] || welcomeMatch[1];
                        if (parsedUsername && parsedUsername.length > 0) username = parsedUsername;
                        currentLevel = welcomeMatch[3];
                    } else {
                        const simpleMatch = h1Text.match(/(\d+)级用户/);
                        if (simpleMatch) currentLevel = simpleMatch[1];
                    }
                }
            }

            if (!username) return null;

            const level = parseInt(currentLevel);
            if (level >= 2) {
                return parseHighLevelData(tempDiv, username, currentLevel, targetLevel, hasReachedTarget);
            } else {
                return await fetchLowLevelData(username, level);
            }
        } catch (e) {
            log(`获取数据失败: ${e.message}`);
            return null;
        }
    }

    function parseHighLevelData(tempDiv, username, currentLevel, targetLevel, hasReachedTarget) {
        const level = parseInt(currentLevel);
        // 满级判断：当前等级 >= 3 且目标等级的 badge 显示"已达到"
        const isMaxLevel = level >= 3 && (targetLevel === null || hasReachedTarget);

        // 新版页面：查找 .card 容器（包含 card-title 含"信任级别"的卡片）
        const card = tempDiv.querySelector('.card');

        // 兼容旧版：尝试旧选择器
        const legacyDiv = !card ? Array.from(tempDiv.querySelectorAll('div.bg-white.p-6.rounded-lg.mb-4.shadow'))
            .find(div => div.querySelector('h2')?.textContent.includes('信任级别')) : null;

        const targetDiv = card || legacyDiv;

        if (!targetDiv) {
            if (isMaxLevel) {
                return {
                    username, currentLevel, targetLevel: null, items: [],
                    achievedCount: 0, totalCount: 0, isMaxLevel: true, timestamp: Date.now()
                };
            }
            return null;
        }

        const items = [];

        // 新版页面解析：三种数据布局
        // 1) 环形数据 (tl3-rings) — 活跃程度
        targetDiv.querySelectorAll('.tl3-ring').forEach(ring => {
            const label = ring.querySelector('.tl3-ring-label')?.textContent.trim();
            const current = ring.querySelector('.tl3-ring-current')?.textContent.trim();
            const targetText = ring.querySelector('.tl3-ring-target')?.textContent.trim() || '';
            const required = targetText.replace(/[^\d]/g, '');
            const isMet = ring.querySelector('.tl3-ring-circle')?.classList.contains('met') || false;
            if (label && current) {
                items.push({ label, current, required, isMet });
            }
        });

        // 2) 进度条数据 (tl3-bars) — 互动参与
        targetDiv.querySelectorAll('.tl3-bar-item').forEach(bar => {
            const label = bar.querySelector('.tl3-bar-label')?.textContent.trim();
            const numsEl = bar.querySelector('.tl3-bar-nums');
            const numsText = numsEl?.textContent.trim() || '';
            const isMet = numsEl?.classList.contains('met') || false;
            const parts = numsText.split('/').map(s => s.trim());
            if (label && parts.length === 2) {
                items.push({ label, current: parts[0], required: parts[1], isMet });
            }
        });

        // 3) 配额数据 (tl3-quota) — 合规记录（被举报帖子、举报用户等）
        targetDiv.querySelectorAll('.tl3-quota-card').forEach(card => {
            const label = card.querySelector('.tl3-quota-label')?.textContent.trim();
            const numsText = card.querySelector('.tl3-quota-nums')?.textContent.trim() || '';
            const isMet = card.classList.contains('met');
            const parts = numsText.split('/').map(s => s.trim());
            if (label && parts.length === 2) {
                items.push({ label, current: parts[0], required: `≤${parts[1]}`, isMet });
            }
        });

        // 4) 一票否决数据 (tl3-veto) — 被禁言、被封禁等
        targetDiv.querySelectorAll('.tl3-veto-item').forEach(veto => {
            const label = veto.querySelector('.tl3-veto-label')?.textContent.trim();
            const desc = veto.querySelector('.tl3-veto-desc')?.textContent.trim() || '';
            const value = veto.querySelector('.tl3-veto-value')?.textContent.trim();
            const isMet = veto.classList.contains('met');
            if (label && value !== undefined) {
                items.push({ label: `${label}(${desc})`, current: value, required: '0', isMet });
            }
        });

        // 兼容旧版表格解析
        if (items.length === 0 && legacyDiv) {
            const rows = legacyDiv.querySelectorAll('table tbody tr');
            rows.forEach((row, index) => {
                if (index === 0) return;
                const cells = row.querySelectorAll('td');
                if (cells.length >= 3) {
                    items.push({
                        label: cells[0].textContent.trim(),
                        current: cells[1].textContent.trim(),
                        required: cells[2].textContent.trim(),
                        isMet: cells[1].classList.contains('text-green-500')
                    });
                }
            });
        }

        const achievedCount = items.filter(i => i.isMet).length;
        // targetLevel 优先使用从页面解析的值，否则根据当前等级推算
        const resolvedTargetLevel = targetLevel !== null ? String(targetLevel) : (level < 3 ? String(level + 1) : null);

        return {
            username, currentLevel, targetLevel: resolvedTargetLevel, isMaxLevel, items,
            achievedCount, totalCount: items.length, timestamp: Date.now()
        };
    }

    async function fetchLowLevelData(username, currentLevel) {
        try {
            // 从页面 meta 标签获取 Discourse CSRF Token
            const csrfMeta = document.querySelector('meta[name="csrf-token"]');
            if (!csrfMeta) {
                log('未找到 CSRF Token meta 标签，无法请求 summary.json');
                return null;
            }
            const csrfToken = csrfMeta.getAttribute('content');
            log(`获取到 CSRF Token: ${csrfToken.substring(0, 10)}...`);

            // 使用 CSRF Token + Discourse 必需头直接请求 summary.json（同源，内容脚本可直接 fetch）
            log('正在请求 summary.json (带 CSRF Token)...');
            const response = await fetch(`/u/${username}/summary.json`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'X-CSRF-Token': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                    'Discourse-Present': 'true'
                }
            });

            if (!response.ok) {
                throw new Error(`summary.json HTTP ${response.status}`);
            }

            const data = await response.json();
            const summary = data.user_summary;
            if (!summary) {
                log('summary.json 返回数据中无 user_summary 字段');
                return null;
            }

            log(`summary.json 解析成功: days_visited=${summary.days_visited}, posts_read=${summary.posts_read_count}, topics=${summary.topics_entered}`);

            const requirements = LEVEL_REQUIREMENTS[currentLevel];
            if (!requirements) return null;

            const targetLevel = String(currentLevel + 1);
            const items = [];

            const fieldMap = {
                topics_entered: { label: '浏览的话题', value: summary.topics_entered || 0 },
                posts_read_count: { label: '已读帖子', value: summary.posts_read_count || 0 },
                time_read: { label: '阅读时间(分钟)', value: Math.floor((summary.time_read || 0) / 60), divider: 60 },
                days_visited: { label: '访问天数', value: summary.days_visited || 0 },
                likes_given: { label: '给出的赞', value: summary.likes_given || 0 },
                likes_received: { label: '收到的赞', value: summary.likes_received || 0 },
                post_count: { label: '帖子数量', value: summary.post_count || 0 }
            };

            Object.entries(requirements).forEach(([key, required]) => {
                const field = fieldMap[key];
                if (field) {
                    const displayRequired = field.divider ? Math.floor(required / field.divider) : required;
                    const rawValue = field.divider ? (summary[key] || 0) : field.value;
                    items.push({
                        label: field.label,
                        current: String(field.value),
                        required: String(displayRequired),
                        isMet: rawValue >= required
                    });
                }
            });

            return {
                username, currentLevel: String(currentLevel), targetLevel, items,
                achievedCount: items.filter(i => i.isMet).length,
                totalCount: items.length, timestamp: Date.now()
            };
        } catch (e) {
            log(`fetchLowLevelData 失败: ${e.message}`);
            return null;
        }
    }

    // ==================== Credit 数据获取 ====================
    let creditRequestLock = false;  // 防止重复请求
    let lastCreditRequestTime = 0;  // 上次请求时间
    const CREDIT_REQUEST_INTERVAL = 30000;  // 最小请求间隔 30 秒

    async function fetchCreditData(force = false) {
        // 防止重复请求和速率限制
        const now = Date.now();
        if (creditRequestLock) {
            log('Credit 请求正在进行中，跳过');
            return { error: '请求中...', isLoading: true };
        }
        if (!force && now - lastCreditRequestTime < CREDIT_REQUEST_INTERVAL) {
            const waitTime = Math.ceil((CREDIT_REQUEST_INTERVAL - (now - lastCreditRequestTime)) / 1000);
            log(`Credit API 请求过于频繁，请等待 ${waitTime} 秒`);
            return { error: `请等待 ${waitTime} 秒后重试`, isRateLimit: true };
        }

        creditRequestLock = true;
        lastCreditRequestTime = now;

        try {
            log('正在请求 Credit API...');
            const userInfo = await fetchJsonViaBackground('https://credit.linux.do/api/v1/oauth/user-info');

            if (!userInfo || !userInfo.data) {
                creditRequestLock = false;
                return { error: 'not_logged_in' };
            }

            const userData = userInfo.data;

            // 校验 Credit 返回的用户与当前 linux.do 登录用户是否一致
            const currentUser = getCurrentUsername();
            const creditUser = userData.username;
            if (currentUser && creditUser && currentUser.toLowerCase() !== creditUser.toLowerCase()) {
                creditRequestLock = false;
                log(`Credit 账号不匹配: credit=${creditUser}, linux.do=${currentUser}`);
                return { error: 'account_mismatch', mismatchInfo: { creditUser, currentUser } };
            }

            const data = {
                username: userData.nickname || userData.username || 'User',
                userId: userData.username || '',
                avatarUrl: userData.avatar_url || '',
                credits: userData.available_balance || '0',
                dailyLimit: userData.remain_quota || '0',
                incomeTotal: userData.total_receive || '0',
                expenseTotal: userData.total_payment || '0',
                incomeList: [],
                expenseList: [],
                timestamp: Date.now()
            };

            // 获取每日统计 - 延迟避免连续请求触发 429
            await new Promise(resolve => setTimeout(resolve, 2000));

            try {
                const dailyStats = await fetchJsonViaBackground('https://credit.linux.do/api/v1/dashboard/stats/daily?days=7');
                if (dailyStats && dailyStats.data && Array.isArray(dailyStats.data)) {
                    dailyStats.data.forEach(item => {
                        const date = item.date.substring(5).replace('-', '/');
                        const income = parseFloat(item.income) || 0;
                        const expense = parseFloat(item.expense) || 0;
                        if (income > 0) data.incomeList.push({ date, amount: '+' + income.toFixed(2) });
                        if (expense > 0) data.expenseList.push({ date, amount: '-' + expense.toFixed(2) });
                    });
                    data.incomeList.reverse();
                    data.expenseList.reverse();
                }
            } catch (e) {
                log('获取每日统计失败: ' + e.message);
            }

            creditRequestLock = false;
            return data;
        } catch (e) {
            creditRequestLock = false;
            log(`Credit 数据获取失败: ${e.message}`);
            // 检查是否是 429 错误
            if (e.message.includes('429')) {
                return { error: 'HTTP 429', isRateLimit: true };
            }
            return { error: e.message };
        }
    }

    // ==================== UI 组件 ====================
    function createFloatingUI() {
        document.querySelectorAll('.ld-floating-container').forEach(el => el.remove());

        const container = document.createElement('div');
        container.className = 'ld-floating-container';
        container.innerHTML = `
            <div class="ld-floating-btn" title="点击切换主题">
                <div class="ld-btn-icon">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                    </svg>
                </div>
                <div class="ld-btn-level">L?</div>
                <div class="ld-btn-progress-bar">
                    <div class="ld-btn-progress-fill"></div>
                </div>
                <div class="ld-btn-stats">0/0</div>
                <div class="ld-btn-credit">--</div>
            </div>
            <div class="ld-popup">
                <div class="ld-popup-inner">
                    <div class="ld-tabs">
                        <button class="ld-tab active" data-tab="level">等级</button>
                        <button class="ld-tab" data-tab="credit">积分</button>
                    </div>
                    <div class="ld-tab-content" data-content="level" style="display: flex;">
                        <div class="ld-loading">加载中...</div>
                    </div>
                    <div class="ld-tab-content" data-content="credit" style="display: none;">
                        <div class="ld-loading">加载中...</div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(container);
        return container;
    }

    function updateButtonUI(levelData, creditData) {
        const levelEl = document.querySelector('.ld-btn-level');
        const progressEl = document.querySelector('.ld-btn-progress-fill');
        const statsEl = document.querySelector('.ld-btn-stats');
        const creditEl = document.querySelector('.ld-btn-credit');

        if (levelData) {
            const percent = levelData.isMaxLevel ? 100 : (levelData.totalCount > 0 ? (levelData.achievedCount / levelData.totalCount) * 100 : 0);
            if (levelEl) levelEl.textContent = `L${levelData.currentLevel}`;
            if (progressEl) progressEl.style.width = `${percent}%`;
            if (statsEl) statsEl.textContent = levelData.isMaxLevel ? 'MAX' : `${levelData.achievedCount}/${levelData.totalCount}`;
        }

        if (creditData && !creditData.error) {
            if (creditEl) creditEl.textContent = `${creditData.credits}`;
        } else {
            if (creditEl) creditEl.textContent = '--';
        }
    }

    function updateLevelUI(data) {
        const content = document.querySelector('.ld-tab-content[data-content="level"]');
        if (!content || !data) return;

        if (data.isMaxLevel && data.items.length === 0) {
            content.innerHTML = `
                <div class="ld-popup-header perfect">
                    <div class="ld-user-row">
                        <span class="ld-username">${escapeHtml(data.username)}</span>
                        <span class="ld-level-badge">Lv.${data.currentLevel}</span>
                    </div>
                    <div class="ld-progress-section">
                        <div class="ld-progress-label">
                            <span>🎉 已达到最高等级</span>
                        </div>
                        <div class="ld-progress-bar">
                            <div class="ld-progress-fill perfect" style="width: 100%"></div>
                        </div>
                    </div>
                </div>
                <div class="ld-popup-body">
                    <div style="text-align: center; padding: 40px 20px; color: #9ca3af;">
                        <div style="font-size: 48px; margin-bottom: 16px;">🏆</div>
                        <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">恭喜达到满级！</div>
                        <div style="font-size: 14px;">您已经是 Linux.do 的资深用户</div>
                    </div>
                </div>
                <div class="ld-popup-footer">
                    <span class="ld-update-time">更新于 ${new Date(data.timestamp).toLocaleString()}</span>
                    <button class="ld-refresh-btn" data-type="level">刷新</button>
                </div>
            `;
            bindRefreshButton('level');
            return;
        }

        const isPerfect = data.achievedCount === data.totalCount;
        const percent = data.totalCount > 0 ? Math.round((data.achievedCount / data.totalCount) * 100) : 0;

        let itemsHtml = data.items.map(item => `
            <div class="ld-detail-item ${item.isMet ? 'passed' : 'failed'}">
                <span class="ld-detail-label">${escapeHtml(item.label)}</span>
                <span class="ld-detail-value">
                    <span class="ld-detail-current">${escapeHtml(item.current)}</span>
                    <span class="ld-detail-separator">/</span>
                    <span class="ld-detail-required">${escapeHtml(item.required)}</span>
                </span>
                <span class="ld-detail-status">${item.isMet ? '✓' : '✗'}</span>
            </div>
        `).join('');

        content.innerHTML = `
            <div class="ld-popup-header ${isPerfect ? 'perfect' : ''}">
                <div class="ld-user-row">
                    <span class="ld-username">${escapeHtml(data.username)}</span>
                    <span class="ld-level-badge">${data.targetLevel && !data.isMaxLevel ? `Lv.${data.currentLevel} → ${data.targetLevel}` : `Lv.${data.currentLevel}`}</span>
                </div>
                <div class="ld-progress-section">
                    <div class="ld-progress-label">
                        <span>升级进度</span>
                        <span>${data.achievedCount}/${data.totalCount}</span>
                    </div>
                    <div class="ld-progress-bar">
                        <div class="ld-progress-fill ${isPerfect ? 'perfect' : ''}" style="width: ${percent}%"></div>
                    </div>
                </div>
            </div>
            <div class="ld-popup-body">
                <div class="ld-details-list">${itemsHtml}</div>
            </div>
            <div class="ld-popup-footer">
                <span class="ld-update-time">更新于 ${new Date(data.timestamp).toLocaleString()}</span>
                <button class="ld-refresh-btn" data-type="level">刷新</button>
            </div>
        `;
        bindRefreshButton('level');
    }

    function updateCreditUI(data) {
        const content = document.querySelector('.ld-tab-content[data-content="credit"]');
        if (!content) return;

        if (data.error) {
            const isNotLoggedIn = data.error === 'not_logged_in';
            const isAccountMismatch = data.error === 'account_mismatch';
            const isRateLimit = data.isRateLimit || data.error.includes('429');
            const isLoading = data.isLoading;

            let icon = '⚠️';
            let msg = escapeHtml(data.error);
            let extraHtml = '';

            if (isNotLoggedIn) {
                icon = '🔒';
                msg = '请先登录 Credit';
                extraHtml = '<a href="https://credit.linux.do" target="_blank" class="ld-credit-login-btn">去登录</a>';
            } else if (isAccountMismatch) {
                icon = '🔄';
                msg = 'Credit 账号与当前登录不一致';
                extraHtml = '<div style="font-size: 12px; color: #9ca3af; margin-bottom: 12px;">请前往 Credit 重新登录当前账号</div><a href="https://credit.linux.do" target="_blank" class="ld-credit-login-btn">去 Credit 登录</a>';
            } else if (isRateLimit) {
                icon = '⏳';
                msg = '服务器限流中，请稍后再试';
                extraHtml = '<div style="font-size: 12px; color: #9ca3af; margin-bottom: 12px;">Credit API 服务器正在限流<br>建议等待 5-10 分钟后重试</div>';
            } else if (isLoading) {
                icon = '⏳';
                msg = '正在加载中...';
            }

            content.innerHTML = `
                <div class="ld-credit-error">
                    <div class="ld-credit-error-icon">${icon}</div>
                    <div class="ld-credit-error-msg">${msg}</div>
                    ${extraHtml}
                    <button class="ld-refresh-btn" data-type="credit">重试</button>
                </div>
            `;
            bindRefreshButton('credit');
            return;
        }

        const avatarContent = data.avatarUrl
            ? `<img src="${escapeHtml(data.avatarUrl)}" alt="avatar">`
            : data.username.charAt(0).toUpperCase();

        const incomeListHtml = data.incomeList.length > 0
            ? data.incomeList.map(item => `
                <div class="ld-credit-activity-item">
                    <span class="ld-credit-activity-date">${escapeHtml(item.date)}</span>
                    <span class="ld-credit-activity-amount positive">${escapeHtml(item.amount)}</span>
                </div>`).join('')
            : '<div class="ld-credit-empty">近7天暂无收入</div>';

        const expenseListHtml = data.expenseList.length > 0
            ? data.expenseList.map(item => `
                <div class="ld-credit-activity-item">
                    <span class="ld-credit-activity-date">${escapeHtml(item.date)}</span>
                    <span class="ld-credit-activity-amount negative">${escapeHtml(item.amount)}</span>
                </div>`).join('')
            : '<div class="ld-credit-empty">近7天暂无支出</div>';

        content.innerHTML = `
            <div class="ld-credit-header">
                <div class="ld-credit-user">
                    <div class="ld-credit-avatar">${avatarContent}</div>
                    <div class="ld-credit-user-info">
                        <div class="ld-credit-username">${escapeHtml(data.username)}</div>
                        <div class="ld-credit-subtitle">Linux.do Credit</div>
                    </div>
                </div>
                <a href="https://credit.linux.do/home" target="_blank" class="ld-credit-link">查看详情</a>
            </div>
            <div class="ld-credit-body">
                <div class="ld-credit-main-stat">
                    <span class="ld-credit-main-label">LDC 余额</span>
                    <span class="ld-credit-main-value">${escapeHtml(data.credits)}</span>
                </div>
                <div class="ld-credit-stat-row">
                    <span class="ld-credit-stat-label">今日剩余额度</span>
                    <span class="ld-credit-stat-value">${escapeHtml(data.dailyLimit)}</span>
                </div>
                <div class="ld-credit-section">
                    <div class="ld-credit-section-title">收入统计</div>
                    <div class="ld-credit-stat-row">
                        <span class="ld-credit-stat-label">总收入</span>
                        <span class="ld-credit-stat-value income">+${escapeHtml(data.incomeTotal)} LDC</span>
                    </div>
                    <div class="ld-credit-activity-list">${incomeListHtml}</div>
                </div>
                <div class="ld-credit-section">
                    <div class="ld-credit-section-title">支出统计</div>
                    <div class="ld-credit-stat-row">
                        <span class="ld-credit-stat-label">总支出</span>
                        <span class="ld-credit-stat-value expense">-${escapeHtml(data.expenseTotal)} LDC</span>
                    </div>
                    <div class="ld-credit-activity-list">${expenseListHtml}</div>
                </div>
            </div>
            <div class="ld-popup-footer">
                <span class="ld-update-time">更新于 ${new Date(data.timestamp).toLocaleString()}</span>
                <button class="ld-refresh-btn" data-type="credit">刷新</button>
            </div>
        `;
        bindRefreshButton('credit');
    }

    function bindRefreshButton(type) {
        const btn = document.querySelector(`.ld-refresh-btn[data-type="${type}"]`);
        if (btn) {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                btn.textContent = '加载中...';
                btn.disabled = true;
                if (type === 'level') {
                    await loadLevelData(true);
                } else {
                    await loadCreditData(true);
                }
                btn.textContent = '刷新';
                btn.disabled = false;
            });
        }
    }

    // ==================== 标签切换 ====================
    function initTabs() {
        const tabs = document.querySelectorAll('.ld-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', async (e) => {
                e.stopPropagation();
                const tabName = tab.dataset.tab;

                // 切换激活状态
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // 切换内容显示
                document.querySelectorAll('.ld-tab-content').forEach(content => {
                    content.style.display = content.dataset.content === tabName ? 'flex' : 'none';
                });

                // 保存当前标签
                await Storage.set(TAB_KEY, tabName);

                // 如果是 credit 标签且数据为空，加载数据
                if (tabName === 'credit') {
                    const content = document.querySelector('.ld-tab-content[data-content="credit"]');
                    if (content && content.querySelector('.ld-loading')) {
                        await loadCreditData();
                    }
                }
            });
        });
    }

    // ==================== 主逻辑 ====================
    let cachedLevelData = null;
    let cachedCreditData = null;

    async function loadLevelData(force = false) {
        if (!force && cachedLevelData && cachedLevelData.version === DATA_VERSION && (Date.now() - cachedLevelData.timestamp < 3600000)) {
            updateLevelUI(cachedLevelData);
            updateButtonUI(cachedLevelData, cachedCreditData);
            return;
        }

        try {
            const data = await fetchUserData();
            if (data) {
                data.version = DATA_VERSION;
                cachedLevelData = data;
                await Storage.set(STORAGE_KEY, data);
                updateLevelUI(data);
                updateButtonUI(data, cachedCreditData);
            } else {
                const content = document.querySelector('.ld-tab-content[data-content="level"]');
                if (content) {
                    content.innerHTML = `
                        <div class="ld-credit-error">
                            <div class="ld-credit-error-icon">⚠️</div>
                            <div class="ld-credit-error-msg">数据加载失败</div>
                            <div style="font-size: 12px; color: #9ca3af; margin-bottom: 12px;">请确保已登录 connect.linux.do</div>
                            <button class="ld-refresh-btn" data-type="level">重试</button>
                        </div>
                    `;
                    bindRefreshButton('level');
                }
            }
        } catch (e) {
            log(`loadLevelData 错误: ${e.message}`);
        }
    }

    async function loadCreditData(force = false) {
        // 缓存有效期 30 分钟（改为更长时间避免频繁请求）
        if (!force && cachedCreditData && !cachedCreditData.error && (Date.now() - cachedCreditData.timestamp < 1800000)) {
            updateCreditUI(cachedCreditData);
            updateButtonUI(cachedLevelData, cachedCreditData);
            return;
        }

        try {
            const data = await fetchCreditData(force);
            cachedCreditData = data;
            if (!data.error) {
                await Storage.set(CREDIT_STORAGE_KEY, data);
            }
            updateCreditUI(data);
            updateButtonUI(cachedLevelData, data);
        } catch (e) {
            log(`loadCreditData 错误: ${e.message}`);
            updateCreditUI({ error: e.message });
        }
    }

    async function init() {
        log('初始化开始 v6.2.0');

        if (document.readyState !== 'complete') {
            await new Promise(resolve => window.addEventListener('load', resolve));
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
        log('页面加载完成，开始检测');

        if (!isLoggedIn()) {
            log('用户未登录，不显示浮窗');
            return;
        }

        await ThemeManager.init();
        const container = createFloatingUI();
        log('UI 已创建');

        // 初始化标签切换
        initTabs();

        // 加载缓存数据
        cachedLevelData = await Storage.get(STORAGE_KEY);
        cachedCreditData = await Storage.get(CREDIT_STORAGE_KEY);

        // 检测账号变更：当前页面用户名与缓存用户名不一致时清除缓存
        // 优先用 userId（用户ID）比对，避免昵称与ID不一致导致误判
        const currentUser = getCurrentUsername();
        if (currentUser) {
            const cachedUser = cachedLevelData?.username || cachedCreditData?.userId || cachedCreditData?.username;
            if (cachedUser && cachedUser.toLowerCase() !== currentUser.toLowerCase()) {
                log(`检测到账号变更: ${cachedUser} -> ${currentUser}，清除旧缓存`);
                cachedLevelData = null;
                cachedCreditData = null;
                await Storage.set(STORAGE_KEY, null);
                await Storage.set(CREDIT_STORAGE_KEY, null);
            }
        }

        if (cachedLevelData && cachedLevelData.version === DATA_VERSION) {
            updateLevelUI(cachedLevelData);
            updateButtonUI(cachedLevelData, cachedCreditData);
        }

        // 如果有缓存的 Credit 数据，也显示出来
        if (cachedCreditData && !cachedCreditData.error) {
            updateCreditUI(cachedCreditData);
            updateButtonUI(cachedLevelData, cachedCreditData);
        }

        // 恢复上次选中的标签
        const lastTab = await Storage.get(TAB_KEY, 'level');
        if (lastTab === 'credit') {
            // 切换 UI 到 credit 标签
            const tabs = document.querySelectorAll('.ld-tab');
            tabs.forEach(t => t.classList.remove('active'));
            const creditTab = document.querySelector('.ld-tab[data-tab="credit"]');
            if (creditTab) creditTab.classList.add('active');
            document.querySelectorAll('.ld-tab-content').forEach(content => {
                content.style.display = content.dataset.content === 'credit' ? 'flex' : 'none';
            });
        }

        // 延迟加载最新数据（串行：先等级后积分，避免并发请求）
        setTimeout(async () => {
            await loadLevelData();
            await loadCreditData();
        }, 1000);

        // 绑定事件
        const btn = container.querySelector('.ld-floating-btn');
        const popup = container.querySelector('.ld-popup');

        let hoverTimeout;
        container.addEventListener('mouseenter', () => {
            clearTimeout(hoverTimeout);
            hoverTimeout = setTimeout(() => popup.classList.add('show'), 150);
        });
        container.addEventListener('mouseleave', () => {
            clearTimeout(hoverTimeout);
            hoverTimeout = setTimeout(() => popup.classList.remove('show'), 100);
        });

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const newTheme = ThemeManager.next();
            btn.title = `当前主题: ${THEMES[newTheme].name} (点击切换)`;
        });

        log('初始化完成');
    }

    setTimeout(init, 500);
})();
