// External Link Catcher - Background Script

// デフォルト設定
const DEFAULT_GROUP_NAME = 'today';

// 設定を取得する関数
async function getGroupName() {
  const result = await chrome.storage.sync.get(['groupName']);
  return result.groupName || DEFAULT_GROUP_NAME;
}

// タブグループを取得または作成する関数
async function getOrCreateTabGroup(groupName) {
  // 既存のタブグループを検索
  const tabGroups = await chrome.tabGroups.query({});
  const existingGroup = tabGroups.find(group => group.title === groupName);
  
  if (existingGroup) {
    return existingGroup.id;
  }
  
  // 新しいタブを作成
  const tab = await chrome.tabs.create({ active: false });
  
  // タブグループを作成
  const groupId = await chrome.tabs.group({ 
    tabIds: [tab.id] 
  });
  
  // グループ名を設定
  await chrome.tabGroups.update(groupId, { 
    title: groupName,
    color: 'blue'
  });
  
  return groupId;
}

// 新しいタブが作成された時の処理
chrome.tabs.onCreated.addListener(async (tab) => {
  // 外部アプリから開かれたタブかどうかを判定
  // openerTabIdがnullの場合、外部から開かれた可能性が高い
  if (tab.openerTabId === undefined && tab.url && tab.url.startsWith('http')) {
    try {
      const groupName = await getGroupName();
      const groupId = await getOrCreateTabGroup(groupName);
      
      // タブをグループに移動
      await chrome.tabs.group({
        tabIds: [tab.id],
        groupId: groupId
      });
      
      // タブをアクティブにする
      await chrome.tabs.update(tab.id, { active: true });
      
      console.log(`Tab moved to group "${groupName}"`);
    } catch (error) {
      console.error('Error moving tab to group:', error);
    }
  }
});

// URL変更時の処理（リダイレクト対応）
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // URLが変更され、外部から開かれたタブの場合
  if (changeInfo.url && 
      tab.openerTabId === undefined && 
      changeInfo.url.startsWith('http') &&
      tab.groupId === -1) { // グループに属していない場合
    
    try {
      const groupName = await getGroupName();
      const groupId = await getOrCreateTabGroup(groupName);
      
      // タブをグループに移動
      await chrome.tabs.group({
        tabIds: [tabId],
        groupId: groupId
      });
      
      console.log(`Updated tab moved to group "${groupName}"`);
    } catch (error) {
      console.error('Error moving updated tab to group:', error);
    }
  }
});

// 拡張機能がインストールされた時の処理
chrome.runtime.onInstalled.addListener(() => {
  console.log('External Link Catcher installed');
});
