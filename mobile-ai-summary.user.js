// ==UserScript==
// @name         Mobile AI Summary (MD3)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  为移动端设计的AI页面总结工具，采用Material Design 3风格
// @author       Justin Ye
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // MD3 风格定义
    const md3Colors = {
        primary: '#006492',
        onPrimary: '#ffffff',
        primaryContainer: '#cae6ff',
        onPrimaryContainer: '#001e30',
        surface: '#f8f9ff',
        onSurface: '#191c20',
        surfaceContainer: '#f0f4f8', // 稍微深一点的背景
        outline: '#72777f',
        shadow: 'rgba(0, 0, 0, 0.2)'
    };

    // 新的提示词
    const newPrompt = `你是一个专业的中文内容总结器。你的任务是分析提供的网页内容，**识别内容类型（例如：新闻报道、研究报告、普通文章、市场分析等）**，并在此基础上创建一个清晰、简洁、结构良好的中文总结。**总结必须严格依据原文内容，不得进行任何推测、假设或添加原文中未包含的信息。**

请严格遵守以下指南：

1.  **内容类型识别与结构确定:**
    *   首先识别原文的内容类型。
    *   根据内容类型，确定最合适的分段和总结重点。总结的结构应该逻辑清晰，反映原文的核心信息。
    *   你可以使用 **\`##\`** 作为主要分段的标题，例如：对于新闻可以使用“事件概述”、“关键进展”等，对于报告可以使用“主要发现”、“数据支持”等。不必拘泥于原文的固定分段，但要确保覆盖核心要点。

2.  **输出格式:**
    *   使用 **\`##\`** 表示主要段落标题。
    *   使用 **\`•\`** 表示段落内的关键点和细节。
    *   使用 **粗体** 突出重要术语、概念或关键信息。
    *   使用 **\`>\`** 表示引人注目的原文引述（如果适用）。

3.  **内容要求:**
    *   总结必须**严格忠于原文**，不允许加入任何个人观点、推测或假设。
    *   **识别并保留原文中的重要数据、数字、统计信息或关键事实。**
    *   根据识别的内容类型，调整总结的侧重点，但**所有信息必须来源于原文**。

4.  **写作风格:**
    *   语言清晰简洁。
    *   专业且客观的语调。
    *   逻辑流畅。
    *   易于理解。
    *   聚焦于原文的核心信息和重要细节。

5.  **重要规则:**
    *   **DO NOT show your reasoning process.** (不要显示你的思考过程或内部步骤。)`;

    // 默认配置
    const defaultConfig = {
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        apiKey: '',
        prompt: newPrompt,
        model: 'gpt-3.5-turbo'
    };

    // GM 函数兼容层
    const GM = {
        setValue: (key, value) => {
            try {
                if (typeof GM_setValue !== 'undefined') {
                    GM_setValue(key, value);
                } else {
                    localStorage.setItem(`mobile_ai_summary_${key}`, JSON.stringify(value));
                }
            } catch (error) {
                console.error('保存配置失败:', error);
            }
        },
        getValue: (key, defaultValue) => {
            try {
                if (typeof GM_getValue !== 'undefined') {
                    return GM_getValue(key, defaultValue);
                }
                const value = localStorage.getItem(`mobile_ai_summary_${key}`);
                return value ? JSON.parse(value) : defaultValue;
            } catch (error) {
                console.error('获取配置失败:', error);
                return defaultValue;
            }
        }
    };

    // 获取配置
    let config = {
        apiUrl: GM.getValue('apiUrl', defaultConfig.apiUrl),
        apiKey: GM.getValue('apiKey', defaultConfig.apiKey),
        prompt: GM.getValue('prompt', defaultConfig.prompt),
        model: GM.getValue('model', defaultConfig.model)
    };

    // 加载 marked.js
    let markedLoaded = false;
    const markedScript = document.createElement('script');
    markedScript.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
    markedScript.onload = () => {
        markedLoaded = true;
        marked.setOptions({
            breaks: true,
            gfm: true
        });
    };
    document.head.appendChild(markedScript);

    // 创建样式
    const style = document.createElement('style');
    style.textContent = `
        /* Material Design 3 风格样式 */
        :root {
            --md-sys-color-primary: ${md3Colors.primary};
            --md-sys-color-on-primary: ${md3Colors.onPrimary};
            --md-sys-color-primary-container: ${md3Colors.primaryContainer};
            --md-sys-color-on-primary-container: ${md3Colors.onPrimaryContainer};
            --md-sys-color-surface: ${md3Colors.surface};
            --md-sys-color-on-surface: ${md3Colors.onSurface};
            --md-sys-color-surface-container: ${md3Colors.surfaceContainer};
            --md-sys-color-outline: ${md3Colors.outline};
            --md-sys-shadow: ${md3Colors.shadow};
        }

        .mas-fab-container {
            position: fixed;
            right: 16px;
            bottom: 100px; /* 避开底部导航栏 */
            z-index: 999999;
            display: flex;
            flex-direction: column;
            gap: 16px;
            pointer-events: none; /* 允许点击穿透 */
        }

        .mas-fab {
            width: 56px;
            height: 56px;
            border-radius: 16px; /* MD3 Large FAB shape */
            background-color: var(--md-sys-color-primary-container);
            color: var(--md-sys-color-on-primary-container);
            border: none;
            box-shadow: 0 4px 8px 3px var(--md-sys-shadow);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            cursor: pointer;
            pointer-events: auto;
            transition: transform 0.2s, box-shadow 0.2s;
            -webkit-tap-highlight-color: transparent;
        }

        .mas-fab:active {
            transform: scale(0.95);
            box-shadow: 0 2px 4px 2px var(--md-sys-shadow);
        }

        .mas-fab svg {
            width: 24px;
            height: 24px;
            fill: currentColor;
        }

        /* Bottom Sheet 样式 */
        .mas-bottom-sheet {
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: var(--md-sys-color-surface);
            border-top-left-radius: 28px;
            border-top-right-radius: 28px;
            box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
            z-index: 1000000;
            transform: translateY(100%);
            transition: transform 0.3s cubic-bezier(0.2, 0.0, 0, 1.0);
            max-height: 85vh;
            display: flex;
            flex-direction: column;
            color: var(--md-sys-color-on-surface);
            font-family: system-ui, -apple-system, sans-serif;
        }

        .mas-bottom-sheet.show {
            transform: translateY(0);
        }

        .mas-drag-handle {
            width: 32px;
            height: 4px;
            background-color: var(--md-sys-color-outline);
            opacity: 0.4;
            border-radius: 2px;
            margin: 22px auto 0;
            flex-shrink: 0;
        }

        .mas-sheet-content {
            padding: 24px;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
        }

        .mas-sheet-header {
            font-size: 22px;
            font-weight: 400;
            margin-bottom: 24px;
            color: var(--md-sys-color-on-surface);
        }

        /* 表单样式 */
        .mas-input-group {
            margin-bottom: 20px;
        }

        .mas-label {
            display: block;
            font-size: 12px;
            color: var(--md-sys-color-on-surface);
            margin-bottom: 8px;
            font-weight: 500;
        }

        .mas-input, .mas-textarea {
            width: 100%;
            padding: 12px 16px;
            border: 1px solid var(--md-sys-color-outline);
            border-radius: 4px;
            background: transparent;
            font-size: 16px;
            color: var(--md-sys-color-on-surface);
            box-sizing: border-box;
            transition: border-color 0.2s;
        }

        .mas-input:focus, .mas-textarea:focus {
            outline: none;
            border-color: var(--md-sys-color-primary);
            border-width: 2px;
            padding: 11px 15px; /* 补偿边框宽度 */
        }

        .mas-textarea {
            min-height: 100px;
            resize: vertical;
            font-family: inherit;
        }

        /* 按钮样式 */
        .mas-btn {
            background-color: var(--md-sys-color-primary);
            color: var(--md-sys-color-on-primary);
            border: none;
            border-radius: 20px;
            padding: 10px 24px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            width: 100%;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background-color 0.2s;
        }

        .mas-btn:active {
            opacity: 0.9;
        }

        .mas-btn-text {
            background: transparent;
            color: var(--md-sys-color-primary);
            margin-top: 8px;
        }

        /* 结果内容样式 */
        .mas-result-content {
            font-size: 16px;
            line-height: 1.6;
        }
        
        .mas-result-content h1, .mas-result-content h2, .mas-result-content h3 {
            margin-top: 1em;
            margin-bottom: 0.5em;
            color: var(--md-sys-color-on-surface);
        }

        .mas-result-content p {
            margin-bottom: 1em;
        }

        .mas-result-content ul {
            padding-left: 20px;
            margin-bottom: 1em;
        }

        .mas-result-content li {
            margin-bottom: 0.5em;
        }

        .mas-result-content strong {
            font-weight: 700;
        }

        .mas-result-content blockquote {
            border-left: 4px solid var(--md-sys-color-primary-container);
            margin: 1em 0;
            padding-left: 16px;
            color: #555;
        }

        /* 遮罩层 */
        .mas-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.32);
            z-index: 999999;
            display: none;
            opacity: 0;
            transition: opacity 0.3s;
        }

        .mas-overlay.show {
            display: block;
            opacity: 1;
        }

        .mas-actions {
            display: flex;
            gap: 12px;
            margin-top: 24px;
        }
    `;
    document.head.appendChild(style);

    // 创建 UI 元素
    const fabContainer = document.createElement('div');
    fabContainer.className = 'mas-fab-container';
    
    // 总结按钮 FAB
    const summaryFab = document.createElement('button');
    summaryFab.className = 'mas-fab';
    summaryFab.innerHTML = `
        <svg viewBox="0 0 24 24">
            <path d="M14,17H7V15H14M17,13H7V11H17M17,9H7V7H17M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3Z" />
        </svg>
    `;
    
    // 设置按钮 FAB (小一点)
    const settingsFab = document.createElement('button');
    settingsFab.className = 'mas-fab';
    settingsFab.style.width = '40px';
    settingsFab.style.height = '40px';
    settingsFab.style.borderRadius = '12px';
    settingsFab.style.alignSelf = 'flex-end';
    settingsFab.innerHTML = `
        <svg viewBox="0 0 24 24">
            <path d="M19.14,12.94C19.14,12.78 19.14,12.61 19.14,12.45C19.14,12.29 19.14,12.12 19.14,11.96L21.41,10.19C21.61,10.03 21.67,9.75 21.54,9.53L19.38,5.79C19.25,5.57 18.97,5.48 18.74,5.57L16.07,6.65C15.5,6.23 14.9,5.87 14.25,5.6L13.84,2.76C13.8,2.5 13.59,2.31 13.33,2.31H9.03C8.77,2.31 8.56,2.5 8.53,2.76L8.11,5.6C7.46,5.87 6.86,6.23 6.29,6.65L3.62,5.57C3.39,5.48 3.11,5.57 2.98,5.79L0.82,9.53C0.69,9.75 0.75,10.03 0.95,10.19L3.22,11.96C3.22,12.12 3.22,12.29 3.22,12.45C3.22,12.61 3.22,12.78 3.22,12.94L0.95,14.71C0.75,14.87 0.69,15.15 0.82,15.37L2.98,19.11C3.11,19.33 3.39,19.42 3.62,19.33L6.29,18.25C6.86,18.67 7.46,19.03 8.11,19.3L8.53,22.14C8.56,22.4 8.77,22.59 9.03,22.59H13.33C13.59,22.59 13.8,22.4 13.84,22.14L14.25,19.3C14.9,19.03 15.5,18.67 16.07,18.25L18.74,19.33C18.97,19.42 19.25,19.33 19.38,19.11L21.54,15.37C21.67,15.15 21.61,14.87 21.41,14.71L19.14,12.94M11.18,15.06C9.5,15.06 8.14,13.7 8.14,12.03C8.14,10.36 9.5,9 11.18,9C12.86,9 14.22,10.36 14.22,12.03C14.22,13.7 12.86,15.06 11.18,15.06Z" />
        </svg>
    `;

    fabContainer.appendChild(settingsFab);
    fabContainer.appendChild(summaryFab);
    document.body.appendChild(fabContainer);

    // 遮罩层
    const overlay = document.createElement('div');
    overlay.className = 'mas-overlay';
    document.body.appendChild(overlay);

    // 设置面板 Bottom Sheet
    const settingsSheet = document.createElement('div');
    settingsSheet.className = 'mas-bottom-sheet';
    settingsSheet.innerHTML = `
        <div class="mas-drag-handle"></div>
        <div class="mas-sheet-content">
            <div class="mas-sheet-header">设置</div>
            <div class="mas-input-group">
                <label class="mas-label">API URL</label>
                <input type="text" class="mas-input" id="masApiUrl" value="${config.apiUrl}">
            </div>
            <div class="mas-input-group">
                <label class="mas-label">API Key</label>
                <input type="password" class="mas-input" id="masApiKey" value="${config.apiKey}">
            </div>
            <div class="mas-input-group">
                <label class="mas-label">模型</label>
                <input type="text" class="mas-input" id="masModel" value="${config.model}">
            </div>
            <div class="mas-input-group">
                <label class="mas-label">提示词</label>
                <textarea class="mas-textarea" id="masPrompt">${config.prompt}</textarea>
            </div>
            <button class="mas-btn" id="masSaveConfig">保存</button>
        </div>
    `;
    document.body.appendChild(settingsSheet);

    // 结果面板 Bottom Sheet
    const resultSheet = document.createElement('div');
    resultSheet.className = 'mas-bottom-sheet';
    resultSheet.innerHTML = `
        <div class="mas-drag-handle"></div>
        <div class="mas-sheet-content">
            <div class="mas-sheet-header">AI 总结</div>
            <div id="masResultContent" class="mas-result-content"></div>
            <div class="mas-actions">
                <button class="mas-btn" id="masCopyBtn">复制</button>
                <button class="mas-btn mas-btn-text" id="masCloseResultBtn">关闭</button>
            </div>
        </div>
    `;
    document.body.appendChild(resultSheet);

    // 交互逻辑
    function showOverlay() {
        overlay.classList.add('show');
        document.body.style.overflow = 'hidden'; // 防止背景滚动
    }

    function hideOverlay() {
        overlay.classList.remove('show');
        document.body.style.overflow = '';
    }

    function closeAllSheets() {
        settingsSheet.classList.remove('show');
        resultSheet.classList.remove('show');
        hideOverlay();
    }

    // 点击遮罩关闭
    overlay.addEventListener('click', closeAllSheets);

    // 设置按钮点击
    settingsFab.addEventListener('click', () => {
        settingsSheet.classList.add('show');
        showOverlay();
    });

    // 保存配置
    document.getElementById('masSaveConfig').addEventListener('click', () => {
        config.apiUrl = document.getElementById('masApiUrl').value;
        config.apiKey = document.getElementById('masApiKey').value;
        config.prompt = document.getElementById('masPrompt').value;
        config.model = document.getElementById('masModel').value;

        GM.setValue('apiUrl', config.apiUrl);
        GM.setValue('apiKey', config.apiKey);
        GM.setValue('prompt', config.prompt);
        GM.setValue('model', config.model);

        closeAllSheets();
        // 可以添加一个简单的 Toast 提示
        alert('配置已保存');
    });

    // 总结按钮点击
    summaryFab.addEventListener('click', async () => {
        if (!config.apiKey) {
            alert('请先配置 API Key');
            settingsSheet.classList.add('show');
            showOverlay();
            return;
        }

        const resultContent = document.getElementById('masResultContent');
        resultContent.innerHTML = '<p>正在分析页面内容...</p>';
        resultSheet.classList.add('show');
        showOverlay();

        const pageContent = document.body.innerText.substring(0, 5000); // 增加一点长度限制

        try {
            const response = await fetch(config.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify({
                    model: config.model,
                    messages: [
                        {
                            role: 'system',
                            content: config.prompt
                        },
                        {
                            role: 'user',
                            content: pageContent
                        }
                    ]
                })
            });

            const data = await response.json();
            if (data.choices && data.choices[0]) {
                const rawContent = data.choices[0].message.content;
                
                // 等待 marked 加载
                if (!markedLoaded) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                try {
                    resultContent.innerHTML = marked.parse(rawContent);
                } catch (e) {
                    resultContent.innerText = rawContent;
                }

                // 绑定复制按钮
                const copyBtn = document.getElementById('masCopyBtn');
                copyBtn.onclick = () => {
                    navigator.clipboard.writeText(rawContent).then(() => {
                        copyBtn.innerText = '已复制';
                        setTimeout(() => copyBtn.innerText = '复制', 2000);
                    });
                };
            } else {
                throw new Error('API 返回数据异常');
            }
        } catch (error) {
            resultContent.innerHTML = `<p style="color: red;">出错啦: ${error.message}</p>`;
        }
    });

    // 关闭结果面板
    document.getElementById('masCloseResultBtn').addEventListener('click', closeAllSheets);

    // 简单的拖拽支持 (FAB)
    let isDragging = false;
    let startY = 0;
    let startBottom = 100;

    fabContainer.addEventListener('touchstart', (e) => {
        if (e.target.closest('.mas-fab')) {
            isDragging = true;
            startY = e.touches[0].clientY;
            const style = window.getComputedStyle(fabContainer);
            startBottom = parseInt(style.bottom);
        }
    });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        e.preventDefault(); // 防止滚动
        const deltaY = startY - e.touches[0].clientY;
        let newBottom = startBottom + deltaY;
        newBottom = Math.max(20, Math.min(newBottom, window.innerHeight - 100));
        fabContainer.style.bottom = `${newBottom}px`;
    }, { passive: false });

    document.addEventListener('touchend', () => {
        isDragging = false;
    });

})();