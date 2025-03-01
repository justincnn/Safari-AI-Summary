// ==UserScript==
// @name         Safari AI Summary
// @namespace    http://tampermonkey.net/
// @version      0.1
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
        shortcut: 'Alt+A'
    };

    // 获取配置
    let config = {
        apiUrl: GM_getValue('apiUrl', defaultConfig.apiUrl),
        apiKey: GM_getValue('apiKey', defaultConfig.apiKey),
        prompt: GM_getValue('prompt', defaultConfig.prompt),
        shortcut: GM_getValue('shortcut', defaultConfig.shortcut)
    };

    // 添加marked.js库
    const markedScript = document.createElement('script');
    markedScript.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
    document.head.appendChild(markedScript);

    // 创建样式
    const style = document.createElement('style');
    style.textContent = `
        .ai-buttons-container {
            position: fixed;
            right: 20px;
            bottom: 20px;
            z-index: 2147483647;
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
    document.getElementById('aiSaveConfig').addEventListener('click', () => {
        config.apiUrl = document.getElementById('aiApiUrl').value;
        config.apiKey = document.getElementById('aiApiKey').value;
        config.prompt = document.getElementById('aiPrompt').value;
        config.shortcut = document.getElementById('aiShortcut').value;
        GM_setValue('apiUrl', config.apiUrl);
        GM_setValue('apiKey', config.apiKey);
        GM_setValue('prompt', config.prompt);
        GM_setValue('shortcut', config.shortcut);
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

        const pageContent = document.body.innerText.substring(0, 4000); // 限制内容长度
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
                    model: 'gpt-3.5-turbo',
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
                const summaryContent = marked.parse(rawContent);
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
