// ==UserScript==
// @name         Safari AI Summary
// @namespace    http://tampermonkey.net/
// @version      0.6
// @description  为Safari添加AI页面总结功能
// @author       Justin Ye
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // 默认配置
    const defaultConfig = {
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        apiKey: '',
        prompt: '请对以下网页内容进行简要总结，突出重点信息。',
        shortcut: 'Alt+A',
        model: 'gpt-3.5-turbo'  // 添加默认模型
    };

    // 获取配置
    // 添加 GM 函数兼容层
    const GM = {
        setValue: (key, value) => {
            try {
                if (typeof GM_setValue !== 'undefined') {
                    GM_setValue(key, defaultValue);
                } else {
                    localStorage.setItem(`safari_ai_summary_${key}`, JSON.stringify(value));
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
                const value = localStorage.getItem(`safari_ai_summary_${key}`);
                return value ? JSON.parse(value) : defaultValue;
            } catch (error) {
                console.error('获取配置失败:', error);
                return defaultValue;
            }
        }
    };

    // 修改配置获取方式
    let config = {
        apiUrl: GM.getValue('apiUrl', defaultConfig.apiUrl),
        apiKey: GM.getValue('apiKey', defaultConfig.apiKey),
        prompt: GM.getValue('prompt', defaultConfig.prompt),
        shortcut: GM.getValue('shortcut', defaultConfig.shortcut),
        model: GM.getValue('model', defaultConfig.model)
    };

    // 修改 marked.js 加载方式
    let markedLoaded = false;
    const markedScript = document.createElement('script');
    markedScript.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
    markedScript.onload = () => {
        markedLoaded = true;
        // 配置 marked 选项
        marked.setOptions({
            breaks: true,  // 支持换行
            gfm: true,    // 支持 GitHub 风格 Markdown
            headerIds: false
        });
    };
    document.head.appendChild(markedScript);

    // 创建样式
    const style = document.createElement('style');
    style.textContent = `
        .ai-buttons-container {
            position: fixed;
            right: 20px;
            bottom: 20px;  /* 恢复默认位置为右下角 */
            z-index: 2147483647;
            cursor: ns-resize;
            user-select: none;
            touch-action: pan-y;
        }
        .ai-summary-btn {
            position: relative;
            color: #007AFF;
            background: none;
            border: none;
            width: 40px;
            height: 40px;
            cursor: pointer;
            z-index: 2147483647;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            transition: all 0.3s ease;
            opacity: 0.8;
            padding: 0;
        }
        .ai-summary-btn:hover {
            transform: scale(1.1);
            opacity: 1;
        }
        .ai-config-panel {
            position: fixed;
            right: 20px;
            bottom: 70px;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 10000;
            display: none;
        }
        .ai-config-panel.show {
            display: block;
        }
        .ai-config-panel .input-group {
            margin-bottom: 15px;
        }
        .ai-config-panel label {
            display: block;
            margin-bottom: 5px;
            color: #333;
            font-weight: bold;
        }
        .ai-config-panel input,
        .ai-config-panel textarea {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
        }
        .ai-config-panel textarea {
            resize: vertical;
            min-height: 80px;
        }
        .ai-config-panel button {
            background: #007AFF;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
        }
        .ai-summary-result {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #f5f5eb;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 10001;
            max-width: 80%;
            max-height: 80vh;
            overflow-y: auto;
            display: none;
            font-size: 16px;
            line-height: 1.6;
            color: #333;
        }
        .ai-summary-result h1,
        .ai-summary-result h2,
        .ai-summary-result h3,
        .ai-summary-result h4,
        .ai-summary-result h5,
        .ai-summary-result h6 {
            margin-top: 1em;
            margin-bottom: 0.5em;
            font-weight: bold;
        }
        .ai-summary-result p {
            margin: 0.5em 0;
        }
        .ai-summary-result ul,
        .ai-summary-result ol {
            margin: 0.5em 0;
            padding-left: 2em;
        }
        .ai-summary-result blockquote {
            margin: 0.5em 0;
            padding-left: 1em;
            border-left: 4px solid #ddd;
            color: #666;
        }
        .ai-summary-result code {
            background: #f0f0f0;
            padding: 0.2em 0.4em;
            border-radius: 3px;
            font-family: monospace;
        }
        .ai-summary-result pre {
            background: #f0f0f0;
            padding: 1em;
            border-radius: 5px;
            overflow-x: auto;
        }
        .ai-summary-result.show {
            display: block;
        }
        .ai-summary-actions {
            margin-top: 15px;
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }
        .ai-summary-actions button {
            background: #007AFF;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s ease;
        }
        .ai-summary-actions button:hover {
            background: #0056b3;
        }
    `;
    document.head.appendChild(style);

    // 创建按钮容器
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'ai-buttons-container';
    document.body.appendChild(buttonsContainer);

    // 添加拖拽功能
    // 修改拖拽相关变量和函数
    let isDragging = false;
    let startY = 0;
    let currentBottom = 20;  // 改为从底部计算位置

    function dragStart(e) {
        if (e.target === buttonsContainer || e.target === summaryButton) {
            isDragging = true;
            startY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;
            const rect = buttonsContainer.getBoundingClientRect();
            currentBottom = window.innerHeight - rect.bottom;
        }
    }

    function dragEnd() {
        isDragging = false;
    }

    function drag(e) {
        if (!isDragging) return;

        e.preventDefault();
        const currentY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;
        const deltaY = startY - currentY;  // 反转差值计算

        let newBottom = currentBottom + deltaY;
        const maxBottom = window.innerHeight - buttonsContainer.offsetHeight - 20;

        // 限制拖动范围
        newBottom = Math.max(20, Math.min(newBottom, maxBottom));

        buttonsContainer.style.bottom = `${newBottom}px`;
        buttonsContainer.style.top = 'auto';  // 清除 top 属性
    }

    buttonsContainer.addEventListener("touchstart", dragStart, false);
    buttonsContainer.addEventListener("touchend", dragEnd, false);
    buttonsContainer.addEventListener("touchmove", drag, false);

    buttonsContainer.addEventListener("mousedown", dragStart, false);
    document.addEventListener("mousemove", drag, false);
    document.addEventListener("mouseup", dragEnd, false);

    // 设置初始位置
    // buttonsContainer.style.top = '20px';

    // 创建AI总结按钮
    const summaryButton = document.createElement('button');
    summaryButton.className = 'ai-summary-btn';
    summaryButton.innerHTML = '🤖';
    summaryButton.title = '生成AI总结 (右键点击打开设置)';
    buttonsContainer.appendChild(summaryButton);

    // 创建配置面板
    const configPanel = document.createElement('div');
    configPanel.className = 'ai-config-panel';
    configPanel.innerHTML = `
        <div class="input-group">
            <label for="aiApiUrl">API URL</label>
            <input type="text" id="aiApiUrl" value="${config.apiUrl}">
        </div>
        <div class="input-group">
            <label for="aiApiKey">API Key</label>
            <input type="password" id="aiApiKey" value="${config.apiKey}">
        </div>
        <div class="input-group">
            <label for="aiModel">AI 模型</label>
            <input type="text" id="aiModel" value="${config.model}" placeholder="例如：gpt-3.5-turbo">
        </div>
        <div class="input-group">
            <label for="aiPrompt">自定义提示词</label>
            <textarea id="aiPrompt">${config.prompt}</textarea>
        </div>
        <div class="input-group">
            <label for="aiShortcut">快捷键</label>
            <input type="text" id="aiShortcut" value="${config.shortcut}" readonly placeholder="点击输入快捷键">
        </div>
        <button id="aiSaveConfig">保存配置</button>
    `;
    document.body.appendChild(configPanel);

    // 创建结果展示面板
    const resultPanel = document.createElement('div');
    resultPanel.className = 'ai-summary-result';
    document.body.appendChild(resultPanel);

    // 保存配置
    // 修改保存配置部分
    document.getElementById('aiSaveConfig').addEventListener('click', () => {
        config.apiUrl = document.getElementById('aiApiUrl').value;
        config.apiKey = document.getElementById('aiApiKey').value;
        config.prompt = document.getElementById('aiPrompt').value;
        config.shortcut = document.getElementById('aiShortcut').value;
        config.model = document.getElementById('aiModel').value;
        
        GM.setValue('apiUrl', config.apiUrl);
        GM.setValue('apiKey', config.apiKey);
        GM.setValue('prompt', config.prompt);
        GM.setValue('shortcut', config.shortcut);
        GM.setValue('model', config.model);
        
        configPanel.classList.remove('show');
    });

    // 快捷键输入处理
    const shortcutInput = document.getElementById('aiShortcut');
    shortcutInput.addEventListener('keydown', (e) => {
        e.preventDefault();
        const keys = [];
        if (e.ctrlKey) keys.push('Ctrl');
        if (e.altKey) keys.push('Alt');
        if (e.shiftKey) keys.push('Shift');
        if (e.metaKey) keys.push('Meta');
        if (e.key.toUpperCase() !== 'CONTROL' &&
            e.key.toUpperCase() !== 'ALT' &&
            e.key.toUpperCase() !== 'SHIFT' &&
            e.key.toUpperCase() !== 'META') {
            keys.push(e.key.toUpperCase());
        }
        if (keys.length > 0) {
            shortcutInput.value = keys.join('+');
        }
    });

    // 添加全局快捷键监听
    document.addEventListener('keydown', (e) => {
        const keys = [];
        if (e.ctrlKey) keys.push('Ctrl');
        if (e.altKey) keys.push('Alt');
        if (e.shiftKey) keys.push('Shift');
        if (e.metaKey) keys.push('Meta');
        if (e.key.toUpperCase() !== 'CONTROL' &&
            e.key.toUpperCase() !== 'ALT' &&
            e.key.toUpperCase() !== 'SHIFT' &&
            e.key.toUpperCase() !== 'META') {
            keys.push(e.key.toUpperCase());
        }
        const currentShortcut = keys.join('+');
        if (currentShortcut === config.shortcut) {
            e.preventDefault();
            summaryButton.click();
        }
    });

    // 切换配置面板显示
    summaryButton.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        configPanel.classList.toggle('show');
    });

    // 生成页面总结
    summaryButton.addEventListener('click', async () => {
        if (!config.apiKey) {
            alert('请先配置API Key');
            configPanel.classList.add('show');
            return;
        }

        const pageContent = document.body.innerText.substring(0, 4000);
        resultPanel.innerHTML = '正在生成总结...';
        resultPanel.classList.add('show');

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
                let summaryContent;
                
                // 等待 marked.js 加载完成
                if (!markedLoaded) {
                    await new Promise(resolve => {
                        const checkMarked = setInterval(() => {
                            if (markedLoaded) {
                                clearInterval(checkMarked);
                                resolve();
                            }
                        }, 100);
                    });
                }

                try {
                    // 使用 marked 渲染 Markdown
                    summaryContent = marked.parse(rawContent);
                } catch (error) {
                    console.error('Markdown 渲染失败:', error);
                    // 降级处理：基本文本格式化
                    summaryContent = rawContent
                        .replace(/\n\n/g, '</p><p>')
                        .replace(/\n/g, '<br>')
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>');
                    summaryContent = `<p>${summaryContent}</p>`;
                }

                resultPanel.innerHTML = `
                    <div class="summary-content">${summaryContent}</div>
                    <div class="ai-summary-actions">
                        <button class="copy-btn">复制内容</button>
                    </div>
                `;

                // 复制按钮功能
                resultPanel.querySelector('.copy-btn').addEventListener('click', () => {
                    navigator.clipboard.writeText(rawContent).then(() => {
                        alert('已复制到剪贴板');
                    }).catch(err => {
                        console.error('复制失败:', err);
                        alert('复制失败');
                    });
                });
            } else {
                throw new Error('无法获取AI响应');
            }
        } catch (error) {
            resultPanel.innerHTML = `生成总结时出错: ${error.message}`;
        }
    });

    // 点击其他地方关闭面板
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.ai-summary-btn') &&
            !e.target.closest('.ai-config-panel') &&
            !e.target.closest('.ai-summary-result')) {
            configPanel.classList.remove('show');
            resultPanel.classList.remove('show');
        }
    });
})();
