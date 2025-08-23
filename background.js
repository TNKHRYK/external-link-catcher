// External Link Catcher - Background Script

import { DEFAULT_GROUP_NAME, DEFAULT_GROUP_COLOR } from './constants.js';

// 設定を取得する関数
async function getGroupName() {
  const result = await chrome.storage.sync.get(['groupName']);
  return result.groupName || DEFAULT_GROUP_NAME;
}

// タブグループを取得する関数
async function getExistingTabGroup(groupName) {
  // 既存のタブグループを検索
  const tabGroups = await chrome.tabGroups.query({});
  const existingGroup = tabGroups.find(group => group.title === groupName);
  
  if (existingGroup) {
    return existingGroup.id;
  }
  
  return null;
}

// タブを新しいグループに移動する関数
async function moveTabToNewGroup(tabId, groupName) {
  // タブをグループ化してグループを作成
  const groupId = await chrome.tabs.group({ tabIds: [tabId] });
  
  // グループ名と色を設定
  await chrome.tabGroups.update(groupId, { 
    title: groupName,
    color: DEFAULT_GROUP_COLOR
  });
  
  return groupId;
}

// タブをグループに移動する共通処理
async function moveTabToGroup(tabId, shouldActivate = false) {
  try {
    const groupName = await getGroupName();
    let groupId = await getExistingTabGroup(groupName);
    
    if (groupId) {
      // 既存のグループに移動
      await chrome.tabs.group({
        tabIds: [tabId],
        groupId: groupId
      });
    } else {
      // 新しいグループを作成して移動
      groupId = await moveTabToNewGroup(tabId, groupName);
    }
    
    // 必要に応じてタブをアクティブにする
    if (shouldActivate) {
      await chrome.tabs.update(tabId, { active: true });
    }
    
    console.log(`Tab moved to group "${groupName}"`);
  } catch (error) {
    console.error('Error moving tab to group:', error);
  }
}

// 新しいタブが作成された時の処理
chrome.tabs.onCreated.addListener(async (tab) => {
  // 外部アプリから開かれたタブかどうかを判定
  // openerTabIdがnullの場合、外部から開かれた可能性が高い
  if (tab.openerTabId === undefined && tab.url && tab.url.startsWith('http')) {
    await moveTabToGroup(tab.id, true);
  }
});

// URL変更時の処理（リダイレクト対応）
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // URLが変更され、外部から開かれたタブの場合
  if (changeInfo.url && 
      tab.openerTabId === undefined && 
      changeInfo.url.startsWith('http') &&
      tab.groupId === -1) { // グループに属していない場合
    
    await moveTabToGroup(tabId, false);
  }
});

// 拡張機能がインストールされた時の処理
chrome.runtime.onInstalled.addListener(() => {
  console.log('External Link Catcher installed');
});
