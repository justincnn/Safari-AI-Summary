// ==UserScript==
// @name         Chrome AI Summary new
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  为Chrome添加AI页面总结功能，支持WebDAV同步
// @author       Justin Ye
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // 默认配置
    // 修改默认配置，将WebDAV相关配置改为OneDrive
    const defaultConfig = {
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        apiKey: '',
        prompt: '请对以下网页内容进行简要总结，突出重点信息。',
        shortcut: 'Alt+A',
        model: 'gpt-3.5-turbo',
        onedriveClientId: '', // OneDrive应用ID
        onedriveAccessToken: '',
        onedriveRefreshToken: '',
        onedriveTokenExpiry: 0
    };
    
    // 获取配置
    let config = {
        apiUrl: GM_getValue('apiUrl', defaultConfig.apiUrl),
        apiKey: GM_getValue('apiKey', defaultConfig.apiKey),
        prompt: GM_getValue('prompt', defaultConfig.prompt),
        shortcut: GM_getValue('shortcut', defaultConfig.shortcut),
        model: GM_getValue('model', defaultConfig.model),
        onedriveClientId: GM_getValue('onedriveClientId', defaultConfig.onedriveClientId),
        onedriveAccessToken: GM_getValue('onedriveAccessToken', defaultConfig.onedriveAccessToken),
        onedriveRefreshToken: GM_getValue('onedriveRefreshToken', defaultConfig.onedriveRefreshToken),
        onedriveTokenExpiry: GM_getValue('onedriveTokenExpiry', defaultConfig.onedriveTokenExpiry)
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
            display: flex;
            flex-direction: column;
            gap: 12px;
            user-select: none;
        }
        .ai-btn {
            position: relative;
            color: #000000;
            background: rgba(255, 255, 255, 0.9);
            border: 1px solid rgba(0, 0, 0, 0.1);
            width: 44px;
            height: 44px;
            border-radius: 12px;
            cursor: pointer;
            z-index: 2147483647;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            transition: all 0.2s ease;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
        }
        .ai-btn:hover {
            transform: translateY(-2px);
            background: rgba(255, 255, 255, 0.95);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .ai-panel {
            position: fixed;
            right: 20px;
            bottom: 80px;
            background: rgba(255, 255, 255, 0.95);
            padding: 24px;
            border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            z-index: 10000;
            display: none;
            width: 320px;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid rgba(0, 0, 0, 0.1);
        }
        .ai-panel.show {
            display: block;
        }
        .ai-panel .input-group {
            margin-bottom: 15px;
        }
        .ai-panel label {
            display: block;
            margin-bottom: 5px;
            color: #333;
            font-weight: bold;
        }
        .ai-panel input,
        .ai-panel textarea {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-size: 14px;
        }
        .ai-panel textarea {
            resize: vertical;
            min-height: 80px;
        }
        .ai-panel button {
            background: #007AFF;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            cursor: pointer;
            margin-top: 10px;
            font-size: 14px;
        }
        .ai-panel button:hover {
            background: #0056b3;
        }
        .ai-panel .tab-nav {
            display: flex;
            margin-bottom: 15px;
            border-bottom: 1px solid #ddd;
        }
        .ai-panel .tab-btn {
            padding: 8px 12px;
            background: none;
            border: none;
            cursor: pointer;
            color: #666;
            margin-right: 5px;
        }
        .ai-panel .tab-btn.active {
            color: #007AFF;
            border-bottom: 2px solid #007AFF;
        }
        .ai-panel .tab-content {
            display: none;
        }
        .ai-panel .tab-content.active {
            display: block;
        }
        .ai-summary-result {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 255, 255, 0.98);
            padding: 24px;
            border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            z-index: 10001;
            max-width: 80%;
            max-height: 80vh;
            overflow-y: auto;
            display: none;
            font-size: 16px;
            line-height: 1.6;
            color: #333;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid rgba(0, 0, 0, 0.1);
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
            border-radius: 8px;
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
    summaryButton.className = 'ai-btn';
    summaryButton.innerHTML = '🤖';
    summaryButton.title = '生成AI总结';
    buttonsContainer.appendChild(summaryButton);

    // 创建设置按钮
    const settingsButton = document.createElement('button');
    settingsButton.className = 'ai-btn';
    settingsButton.innerHTML = '⚙️';
    settingsButton.title = '设置';
    buttonsContainer.appendChild(settingsButton);

    // 创建设置面板
    const settingsPanel = document.createElement('div');
    settingsPanel.className = 'ai-panel';
    settingsPanel.innerHTML = `
        <div class="tab-nav">
            <button class="tab-btn active" data-tab="api">API设置</button>
            <button class="tab-btn" data-tab="shortcut">快捷键</button>
            <button class="tab-btn" data-tab="sync">同步</button>
        </div>
        <div class="tab-content active" data-tab="api">
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
        </div>
        <div class="tab-content" data-tab="shortcut">
            <div class="input-group">
                <label for="aiShortcut">快捷键</label>
                <input type="text" id="aiShortcut" value="${config.shortcut}" readonly placeholder="点击输入快捷键">
                <p style="font-size: 12px; color: #666; margin-top: 5px;">点击输入框并按下快捷键组合</p>
            </div>
        </div>
        <div class="tab-content" data-tab="sync">
            <div class="input-group">
                <label for="onedriveClientId">OneDrive 应用ID</label>
                <input type="text" id="onedriveClientId" value="${config.onedriveClientId}" placeholder="请输入Microsoft应用ID">
                <p style="font-size: 12px; color: #666; margin-top: 5px;">在Microsoft Azure门户注册应用后获取</p>
            </div>
            <div class="auth-status" id="onedriveAuthStatus">
                ${config.onedriveAccessToken ? '<span style="color: green;">已授权</span>' : '<span style="color: red;">未授权</span>'}
            </div>
            <div style="display: flex; gap: 10px; margin-top: 15px;">
                <button id="onedriveAuth" style="flex: 1;">授权OneDrive</button>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 10px;">
                <button id="uploadConfig" style="flex: 1;">上传配置</button>
                <button id="downloadConfig" style="flex: 1;">下载配置</button>
            </div>
        </div>
        <button id="aiSaveSettings" style="width: 100%; margin-top: 20px;">保存设置</button>
    `;
    document.body.appendChild(settingsPanel);

    // 创建结果展示面板
    const resultPanel = document.createElement('div');
    resultPanel.className = 'ai-summary-result';
    document.body.appendChild(resultPanel);

    // 设置面板标签切换
    const tabButtons = settingsPanel.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');

            // 激活按钮
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // 显示对应内容
            const tabContents = settingsPanel.querySelectorAll('.tab-content');
            tabContents.forEach(content => {
                if (content.getAttribute('data-tab') === tabName) {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });
        });
    });

    // 保存设置
    document.getElementById('aiSaveSettings').addEventListener('click', () => {
        config.apiUrl = document.getElementById('aiApiUrl').value;
        config.apiKey = document.getElementById('aiApiKey').value;
        config.prompt = document.getElementById('aiPrompt').value;
        config.shortcut = document.getElementById('aiShortcut').value;
        config.model = document.getElementById('aiModel').value;
        config.onedriveClientId = document.getElementById('onedriveClientId').value;
    
        GM_setValue('apiUrl', config.apiUrl);
        GM_setValue('apiKey', config.apiKey);
        GM_setValue('prompt', config.prompt);
        GM_setValue('shortcut', config.shortcut);
        GM_setValue('model', config.model);
        GM_setValue('onedriveClientId', config.onedriveClientId);
        GM_setValue('onedriveAccessToken', config.onedriveAccessToken);
        GM_setValue('onedriveRefreshToken', config.onedriveRefreshToken);
        GM_setValue('onedriveTokenExpiry', config.onedriveTokenExpiry);
    
        alert('设置已保存');
        settingsPanel.classList.remove('show');
    });

    // 同步功能
    document.getElementById('syncNow').addEventListener('click', async () => {
        if (!config.webdavUrl) {
            alert('请先设置WebDAV URL');
            return;
        }

        try {
            // 准备要同步的配置（不包含密码）
            const syncData = {
                apiUrl: config.apiUrl,
                prompt: config.prompt,
                shortcut: config.shortcut,
                model: config.model,
                lastSync: new Date().toISOString()
            };

            // 上传到WebDAV
            GM_xmlhttpRequest({
                method: 'PUT',
                url: `${config.webdavUrl.replace(/\/$/, '')}/ai-summary-config.json`,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + btoa(`${config.webdavUsername}:${config.webdavPassword}`),
                    'If-Match': '*'
                },
                data: JSON.stringify(syncData),
                onload: function(response) {
                    console.log('WebDAV响应:', response);
                    if (response.status >= 200 && response.status < 300) {
                        alert('同步成功');
                    } else {
                        alert('同步失败: ' + response.statusText);
                    }
                },
                onerror: function(error) {
                    console.error('同步错误:', error);
                    alert('同步出错: ' + (error.statusText || '请检查网络连接和WebDAV配置'));
                }
            });
        } catch (error) {
            console.error('同步异常:', error);
            alert('同步失败: ' + error.message);
        }
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
            generateSummary();
        }
    });

    // 按钮点击事件
    summaryButton.addEventListener('click', generateSummary);
    settingsButton.addEventListener('click', () => {
        settingsPanel.classList.toggle('show');
        syncPanel.classList.remove('show');
    });
    syncButton.addEventListener('click', () => {
        syncPanel.classList.toggle('show');
        settingsPanel.classList.remove('show');
    });

    // 点击其他地方关闭面板
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.ai-btn') &&
            !e.target.closest('.ai-panel') &&
            !e.target.closest('.ai-summary-result')) {
            settingsPanel.classList.remove('show');
            syncPanel.classList.remove('show');
            resultPanel.classList.remove('show');
        }
    });

    // 等待 marked.js 加载完成
    function waitForMarked() {
        return new Promise((resolve) => {
            if (typeof marked !== 'undefined') {
                resolve();
                return;
            }

            const checkMarked = setInterval(() => {
                if (typeof marked !== 'undefined') {
                    clearInterval(checkMarked);
                    resolve();
                }
            }, 100);

            // 10秒后超时
            setTimeout(() => {
                clearInterval(checkMarked);
                console.error('marked.js 加载超时');
                resolve();
            }, 10000);
        });
    }

    // 生成总结函数
    async function generateSummary() {
        if (!config.apiKey) {
            alert('请先配置API Key');
            settingsPanel.classList.add('show');
            return;
        }

        const pageContent = document.body.innerText.substring(0, 4000); // 限制内容长度
        resultPanel.innerHTML = '正在生成总结...';
        resultPanel.classList.add('show');

        try {
            // 确保 marked.js 已加载
            await waitForMarked();

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
                const summaryContent = marked.parse(rawContent);
                resultPanel.innerHTML = `
                    <div class="summary-content">${summaryContent}</div>
                    <div class="ai-summary-actions">
                        <button class="copy-btn">复制内容</button>
                        <button class="close-btn">关闭</button>
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

                // 关闭按钮功能
                resultPanel.querySelector('.close-btn').addEventListener('click', () => {
                    resultPanel.classList.remove('show');
                });
            } else {
                throw new Error('无法获取AI响应');
            }
        } catch (error) {
            resultPanel.innerHTML = `生成总结时出错: ${error.message}`;
        }
    }
})();