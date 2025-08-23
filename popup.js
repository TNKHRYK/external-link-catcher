// External Link Catcher - Popup Script

import { DEFAULT_GROUP_NAME, DEFAULT_ACTIVATE_WINDOW } from './constants.js';

// DOM要素を取得
document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('settingsForm');
    const groupNameInput = document.getElementById('groupName');
    const activateWindowCheckbox = document.getElementById('activateWindow');
    const currentGroupElement = document.getElementById('currentGroup');
    const statusElement = document.getElementById('status');
    
    // 現在の設定を読み込み
    await loadCurrentSettings();
    
    // フォーム送信時の処理
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveSettings();
    });
    
    // 現在の設定を読み込む関数
    async function loadCurrentSettings() {
        try {
            const result = await chrome.storage.sync.get(['groupName', 'activateWindow']);
            const currentGroupName = result.groupName || DEFAULT_GROUP_NAME;
            const activateWindow = result.activateWindow !== undefined ? result.activateWindow : DEFAULT_ACTIVATE_WINDOW;
            
            groupNameInput.value = currentGroupName;
            activateWindowCheckbox.checked = activateWindow;
            currentGroupElement.textContent = currentGroupName;
        } catch (error) {
            console.error('Error loading settings:', error);
            showStatus('設定の読み込みに失敗しました', false);
        }
    }
    
    // 設定を保存する関数
    async function saveSettings() {
        try {
            const groupName = groupNameInput.value.trim() || DEFAULT_GROUP_NAME;
            const activateWindow = activateWindowCheckbox.checked;
            
            // 設定を保存
            await chrome.storage.sync.set({ 
                groupName: groupName,
                activateWindow: activateWindow
            });
            
            // 現在の設定表示を更新
            currentGroupElement.textContent = groupName;
            
            // 成功メッセージを表示
            showStatus('設定が保存されました', true);
            
            console.log(`Settings saved: groupName = "${groupName}", activateWindow = ${activateWindow}`);
        } catch (error) {
            console.error('Error saving settings:', error);
            showStatus('設定の保存に失敗しました', false);
        }
    }
    
    // ステータスメッセージを表示する関数
    function showStatus(message, isSuccess) {
        statusElement.textContent = message;
        statusElement.className = `status ${isSuccess ? 'success' : 'error'} show`;
        
        // 3秒後にメッセージを非表示にする
        setTimeout(() => {
            statusElement.classList.remove('show');
        }, 3000);
    }
});
