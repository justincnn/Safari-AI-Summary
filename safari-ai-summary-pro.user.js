// ==UserScript==
// @name         Safari AI Summary Pro
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Safari 专用 AI 页面总结工具，采用毛玻璃UI，支持暗黑模式，优化运行效率
// @author       Justin Ye
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      api.openai.com
// @connect      *
// ==/UserScript==

(function() {
    'use strict';

    // --- 核心工具函数 ---

    // 封装 GM_xmlhttpRequest 为 Promise，解决跨域问题
    function gmFetch(url, options) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: options.method || 'GET',
                url: url,
                headers: options.headers,
                data: options.body,
                onload: (response) => {
                    if (response.status >= 200 && response.status < 300) {
                        resolve({
                            json: () => Promise.resolve(JSON.parse(response.responseText)),
                            text: () => Promise.resolve(response.responseText),
                            status: response.status
                        });
                    } else {
                        reject(new Error(`HTTP error! status: ${response.status} ${response.statusText || ''}`));
                    }
                },
                onerror: (error) => {
                    console.error('GM_xmlhttpRequest error:', error);
                    reject(new Error('Network error: Failed to fetch'));
                },
                ontimeout: () => {
                    reject(new Error('Request timeout'));
                }
            });
        });
    }

    // 配置管理
    const defaultConfig = {
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        apiKey: '',
        model: 'gpt-3.5-turbo',
        prompt: '请对以下网页内容进行简要总结，突出重点信息。使用Markdown格式，包含标题和列表。',
        theme: 'auto' // auto, light, dark
    };

    const GM = {
        setValue: (key, value) => {
            if (typeof GM_setValue !== 'undefined') GM_setValue(key, value);
            else localStorage.setItem(`safari_pro_${key}`, JSON.stringify(value));
        },
        getValue: (key, defaultValue) => {
            if (typeof GM_getValue !== 'undefined') return GM_getValue(key, defaultValue);
            const value = localStorage.getItem(`safari_pro_${key}`);
            return value ? JSON.parse(value) : defaultValue;
        }
    };

    let config = {
        apiUrl: GM.getValue('apiUrl', defaultConfig.apiUrl),
        apiKey: GM.getValue('apiKey', defaultConfig.apiKey),
        model: GM.getValue('model', defaultConfig.model),
        prompt: GM.getValue('prompt', defaultConfig.prompt),
        theme: GM.getValue('theme', defaultConfig.theme)
    };

    // Lazy Load Marked.js
    let markedLoaded = false;
    const loadMarked = () => {
        if (markedLoaded) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
            script.onload = () => {
                markedLoaded = true;
                marked.setOptions({ breaks: true, gfm: true });
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    // --- UI 构建 (Glassmorphism) ---

    const style = document.createElement('style');
    style.textContent = `
        :root {
            --glass-bg: rgba(255, 255, 255, 0.75);
            --glass-border: rgba(255, 255, 255, 0.5);
            --glass-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
            --text-primary: #333333;
            --text-secondary: #666666;
            --accent-color: #007AFF; /* Safari Blue */
            --accent-hover: #0056b3;
            --input-bg: rgba(255, 255, 255, 0.5);
            --radius-lg: 16px;
            --radius-md: 12px;
            --radius-sm: 8px;
            --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        @media (prefers-color-scheme: dark) {
            :root {
                --glass-bg: rgba(30, 30, 30, 0.75);
                --glass-border: rgba(255, 255, 255, 0.1);
                --glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
                --text-primary: #f5f5f5;
                --text-secondary: #a0a0a0;
                --accent-color: #0A84FF;
                --accent-hover: #409CFF;
                --input-bg: rgba(0, 0, 0, 0.3);
            }
        }

        /* 强制主题覆盖 */
        [data-theme="light"] {
            --glass-bg: rgba(255, 255, 255, 0.75);
            --glass-border: rgba(255, 255, 255, 0.5);
            --text-primary: #333333;
            --text-secondary: #666666;
            --input-bg: rgba(255, 255, 255, 0.5);
        }
        [data-theme="dark"] {
            --glass-bg: rgba(30, 30, 30, 0.75);
            --glass-border: rgba(255, 255, 255, 0.1);
            --text-primary: #f5f5f5;
            --text-secondary: #a0a0a0;
            --input-bg: rgba(0, 0, 0, 0.3);
        }

        .sas-glass {
            background: var(--glass-bg);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid var(--glass-border);
            box-shadow: var(--glass-shadow);
        }

        .sas-container {
            position: fixed;
            z-index: 2147483647;
            font-family: var(--font-family);
            color: var(--text-primary);
            transition: all 0.3s ease;
        }

        /* 悬浮球 */
        .sas-fab {
            right: 24px;
            bottom: 24px;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            user-select: none;
            font-size: 24px;
            transition: transform 0.2s, opacity 0.2s;
        }
        .sas-fab:hover { transform: scale(1.05); }
        .sas-fab:active { transform: scale(0.95); }

        /* 主面板 */
        .sas-panel {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.95);
            width: 90%;
            max-width: 600px;
            max-height: 85vh;
            border-radius: var(--radius-lg);
            display: flex;
            flex-direction: column;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s, transform 0.2s;
        }
        .sas-panel.show {
            opacity: 1;
            pointer-events: auto;
            transform: translate(-50%, -50%) scale(1);
        }

        .sas-header {
            padding: 16px 20px;
            border-bottom: 1px solid var(--glass-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 600;
            font-size: 18px;
        }

        .sas-close-btn {
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            font-size: 20px;
            padding: 4px;
            border-radius: 50%;
            transition: background 0.2s;
        }
        .sas-close-btn:hover { background: rgba(128,128,128,0.1); }

        .sas-content {
            padding: 20px;
            overflow-y: auto;
            flex: 1;
        }

        /* 表单元素 */
        .sas-input-group { margin-bottom: 16px; }
        .sas-label {
            display: block;
            font-size: 13px;
            color: var(--text-secondary);
            margin-bottom: 6px;
            font-weight: 500;
        }
        .sas-input, .sas-textarea, .sas-select {
            width: 100%;
            padding: 10px 12px;
            border-radius: var(--radius-md);
            border: 1px solid var(--glass-border);
            background: var(--input-bg);
            color: var(--text-primary);
            font-family: inherit;
            font-size: 14px;
            box-sizing: border-box;
            transition: border-color 0.2s;
        }
        .sas-input:focus, .sas-textarea:focus, .sas-select:focus {
            outline: none;
            border-color: var(--accent-color);
        }
        .sas-textarea { min-height: 100px; resize: vertical; }

        .sas-btn {
            background: var(--accent-color);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: var(--radius-md);
            font-weight: 500;
            cursor: pointer;
            width: 100%;
            font-size: 15px;
            transition: background 0.2s;
        }
        .sas-btn:hover { background: var(--accent-hover); }
        .sas-btn.secondary {
            background: transparent;
            border: 1px solid var(--glass-border);
            color: var(--text-primary);
        }
        .sas-btn.secondary:hover { background: rgba(128,128,128,0.1); }

        /* Markdown 内容 */
        .sas-markdown { line-height: 1.6; font-size: 15px; }
        .sas-markdown h1, .sas-markdown h2, .sas-markdown h3 { margin-top: 1em; margin-bottom: 0.5em; color: var(--text-primary); }
        .sas-markdown p { margin-bottom: 1em; color: var(--text-primary); }
        .sas-markdown ul, .sas-markdown ol { padding-left: 20px; margin-bottom: 1em; }
        .sas-markdown li { margin-bottom: 0.5em; }
        .sas-markdown code { background: rgba(128,128,128,0.15); padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
        .sas-markdown pre { background: rgba(128,128,128,0.1); padding: 12px; border-radius: var(--radius-sm); overflow-x: auto; }
        .sas-markdown blockquote { border-left: 3px solid var(--accent-color); margin: 0; padding-left: 12px; color: var(--text-secondary); }

        /* 底部操作栏 */
        .sas-actions {
            padding: 16px 20px;
            border-top: 1px solid var(--glass-border);
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }

        /* 动画 */
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .sas-loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 2px solid rgba(128,128,128,0.3);
            border-radius: 50%;
            border-top-color: var(--accent-color);
            animation: spin 1s linear infinite;
            margin-right: 8px;
            vertical-align: middle;
        }
    `;
    document.head.appendChild(style);

    // --- DOM 元素创建 ---

    // 悬浮按钮
    const fab = document.createElement('div');
    fab.className = 'sas-container sas-glass sas-fab';
    fab.innerHTML = '🤖';
    fab.title = 'AI 页面总结 (右键设置)';
    document.body.appendChild(fab);

    // 主面板
    const panel = document.createElement('div');
    panel.className = 'sas-container sas-glass sas-panel';
    document.body.appendChild(panel);

    // --- 逻辑处理 ---

    let isPanelOpen = false;
    let currentView = 'summary'; // 'summary' or 'settings'

    function applyTheme() {
        const theme = config.theme;
        if (theme === 'auto') {
            panel.removeAttribute('data-theme');
        } else {
            panel.setAttribute('data-theme', theme);
        }
    }

    function renderPanel(view) {
        currentView = view;
        applyTheme();
        
        let headerTitle = '';
        let contentHtml = '';
        let actionsHtml = '';

        if (view === 'settings') {
            headerTitle = '设置';
            contentHtml = `
                <div class="sas-input-group">
                    <label class="sas-label">API URL</label>
                    <input type="text" class="sas-input" id="sas-api-url" value="${config.apiUrl}">
                </div>
                <div class="sas-input-group">
                    <label class="sas-label">API Key</label>
                    <input type="password" class="sas-input" id="sas-api-key" value="${config.apiKey}" placeholder="sk-...">
                </div>
                <div class="sas-input-group">
                    <label class="sas-label">模型 (Model)</label>
                    <input type="text" class="sas-input" id="sas-model" value="${config.model}">
                </div>
                <div class="sas-input-group">
                    <label class="sas-label">提示词 (Prompt)</label>
                    <textarea class="sas-textarea" id="sas-prompt">${config.prompt}</textarea>
                </div>
                <div class="sas-input-group">
                    <label class="sas-label">主题</label>
                    <select class="sas-select" id="sas-theme">
                        <option value="auto" ${config.theme === 'auto' ? 'selected' : ''}>跟随系统</option>
                        <option value="light" ${config.theme === 'light' ? 'selected' : ''}>浅色</option>
                        <option value="dark" ${config.theme === 'dark' ? 'selected' : ''}>深色</option>
                    </select>
                </div>
            `;
            actionsHtml = `
                <button class="sas-btn secondary" id="sas-cancel-settings">取消</button>
                <button class="sas-btn" id="sas-save-settings" style="width: auto;">保存配置</button>
            `;
        } else {
            headerTitle = '页面总结';
            contentHtml = `<div id="sas-result-area" class="sas-markdown"><p>点击下方按钮开始生成总结...</p></div>`;
            actionsHtml = `
                <button class="sas-btn secondary" id="sas-open-settings" style="width: auto;">设置</button>
                <button class="sas-btn" id="sas-start-summary" style="width: auto;">开始总结</button>
            `;
        }

        panel.innerHTML = `
            <div class="sas-header">
                <span>${headerTitle}</span>
                <button class="sas-close-btn">×</button>
            </div>
            <div class="sas-content">${contentHtml}</div>
            <div class="sas-actions">${actionsHtml}</div>
        `;

        // 绑定事件
        panel.querySelector('.sas-close-btn').onclick = closePanel;

        if (view === 'settings') {
            document.getElementById('sas-cancel-settings').onclick = () => renderPanel('summary');
            document.getElementById('sas-save-settings').onclick = saveSettings;
        } else {
            document.getElementById('sas-open-settings').onclick = () => renderPanel('settings');
            document.getElementById('sas-start-summary').onclick = startSummary;
        }
    }

    function openPanel(view = 'summary') {
        renderPanel(view);
        panel.classList.add('show');
        isPanelOpen = true;
    }

    function closePanel() {
        panel.classList.remove('show');
        isPanelOpen = false;
    }

    function saveSettings() {
        config.apiUrl = document.getElementById('sas-api-url').value;
        config.apiKey = document.getElementById('sas-api-key').value;
        config.model = document.getElementById('sas-model').value;
        config.prompt = document.getElementById('sas-prompt').value;
        config.theme = document.getElementById('sas-theme').value;

        GM.setValue('apiUrl', config.apiUrl);
        GM.setValue('apiKey', config.apiKey);
        GM.setValue('model', config.model);
        GM.setValue('prompt', config.prompt);
        GM.setValue('theme', config.theme);

        alert('配置已保存');
        renderPanel('summary');
    }

    async function startSummary() {
        if (!config.apiKey) {
            alert('请先配置 API Key');
            renderPanel('settings');
            return;
        }

        const resultArea = document.getElementById('sas-result-area');
        const startBtn = document.getElementById('sas-start-summary');
        
        startBtn.disabled = true;
        startBtn.innerHTML = '<span class="sas-loading"></span>生成中...';
        resultArea.innerHTML = '<p>正在分析页面内容，请稍候...</p>';

        try {
            // 1. 获取页面内容
            const pageContent = document.body.innerText.substring(0, 6000); // 增加字符限制

            // 2. 加载 marked.js
            await loadMarked();

            // 3. 调用 API
            const response = await gmFetch(config.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify({
                    model: config.model,
                    messages: [
                        { role: 'system', content: config.prompt },
                        { role: 'user', content: pageContent }
                    ]
                })
            });

            const data = await response.json();
            if (data.choices && data.choices[0]) {
                const markdown = data.choices[0].message.content;
                resultArea.innerHTML = marked.parse(markdown);
                
                // 添加复制按钮
                const copyBtn = document.createElement('button');
                copyBtn.className = 'sas-btn secondary';
                copyBtn.style.marginTop = '10px';
                copyBtn.textContent = '复制结果';
                copyBtn.onclick = () => {
                    navigator.clipboard.writeText(markdown);
                    copyBtn.textContent = '已复制!';
                    setTimeout(() => copyBtn.textContent = '复制结果', 2000);
                };
                resultArea.appendChild(copyBtn);
            } else {
                throw new Error('API 返回格式异常');
            }

        } catch (error) {
            resultArea.innerHTML = `<p style="color: #ff3b30;">出错啦: ${error.message}</p>`;
            console.error(error);
        } finally {
            startBtn.disabled = false;
            startBtn.innerHTML = '重新总结';
        }
    }

    // --- 拖拽功能 ---
    let isDragging = false;
    let dragStartX, dragStartY;
    let initialRight, initialBottom;

    fab.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // 仅左键
        isDragging = false;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        
        const rect = fab.getBoundingClientRect();
        initialRight = window.innerWidth - rect.right;
        initialBottom = window.innerHeight - rect.bottom;

        const onMouseMove = (e) => {
            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;
            
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) isDragging = true;

            if (isDragging) {
                fab.style.right = `${initialRight - dx}px`;
                fab.style.bottom = `${initialBottom - dy}px`;
            }
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    // --- 事件监听 ---

    fab.addEventListener('click', (e) => {
        if (!isDragging) {
            if (isPanelOpen) closePanel();
            else openPanel('summary');
        }
    });

    fab.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!isDragging) {
            openPanel('settings');
        }
    });

    // 点击外部关闭
    document.addEventListener('click', (e) => {
        if (isPanelOpen && !panel.contains(e.target) && !fab.contains(e.target)) {
            closePanel();
        }
    });

    // --- 菜单命令 ---
    if (typeof GM_registerMenuCommand !== 'undefined') {
        GM_registerMenuCommand("打开设置", () => openPanel('settings'));
        GM_registerMenuCommand("开始总结", () => {
            openPanel('summary');
            startSummary();
        });
    }

})();