// External Link Catcher - Background Script

import { DEFAULT_GROUP_NAME, DEFAULT_GROUP_COLOR, DEFAULT_ACTIVATE_WINDOW } from './constants.js';

// タブソース検出用マップ
const openedByTab = new Map(); // key: targetTabId, val: sourceTabId
const openerMap = new Map();  // key: tabId, val: openerTabId
const navMeta = new Map();    // key: tabId, val: { initiator, hasReferrer }

// 設定を取得する関数
async function getGroupName() {
  const result = await chrome.storage.sync.get(['groupName']);
  return result.groupName || DEFAULT_GROUP_NAME;
}

// ウィンドウアクティブ設定を取得する関数
async function shouldActivateWindow() {
  const result = await chrome.storage.sync.get(['activateWindow']);
  return result.activateWindow !== undefined ? result.activateWindow : DEFAULT_ACTIVATE_WINDOW;
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
    
    // 設定に応じてウィンドウをアクティブにする
    const activateWindow = await shouldActivateWindow();
    if (activateWindow) {
      const tab = await chrome.tabs.get(tabId);
      if (tab.windowId) {
        // タブが属するウィンドウをアクティブにする
        await chrome.windows.update(tab.windowId, { focused: true });
      }
    }
    
    // 必要に応じてタブをアクティブにする
    if (shouldActivate) {
      await chrome.tabs.update(tabId, { active: true });
    }
    
    const windowStatus = activateWindow ? " and window activated" : "";
    console.log(`Tab moved to group "${groupName}"${windowStatus}`);
  } catch (error) {
    console.error('Error moving tab to group:', error);
  }
}

// 新しいタブが作成された時の処理
chrome.tabs.onCreated.addListener(async (tab) => {
  // タブのopenerTabId処理はopenerMap内で行うため、ここでは必要に応じて他の処理を行う
  
  // 外部アプリから開かれたタブかどうかを判定（改良版）
  if (tab.url && tab.url.startsWith('http')) {
    const isExternal = await isLikelyFromExternalApp(tab.id);
    if (isExternal) {
      console.log(`Tab ${tab.id} detected as external app source - grouping`);
      await moveTabToGroup(tab.id, true);
    } else {
      console.log(`Tab ${tab.id} detected as internal browser source - ignoring`);
    }
  }
});

// URL変更時の処理（リダイレクト対応）
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // URLが変更され、外部から開かれたタブの場合
  if (changeInfo.url && 
      changeInfo.url.startsWith('http') &&
      tab.groupId === -1) { // グループに属していない場合
    
    // 判定ロジックを改良版に変更
    const isExternal = await isLikelyFromExternalApp(tabId);
    if (isExternal) {
      console.log(`URL updated tab ${tabId} detected as external app source - grouping`);
      await moveTabToGroup(tabId, false);
    }
  }
});

// 直近に「既存タブから開かれた」ことを記録
chrome.webNavigation.onCreatedNavigationTarget.addListener(d => {
  // ページが新規タブ/ウィンドウを開いた
  openedByTab.set(d.tabId, d.sourceTabId);
  // 数十秒で掃除
  setTimeout(() => openedByTab.delete(d.tabId), 30000);
});

// 補助: onCreated の openerTabId も見る
chrome.tabs.onCreated.addListener(tab => {
  if (typeof tab.openerTabId === "number") {
    openerMap.set(tab.id, tab.openerTabId);
    setTimeout(() => openerMap.delete(tab.id), 30000);
  }
});

// メインフレームの最初のリクエストで initiator / Referer を取得
chrome.webRequest.onBeforeSendHeaders.addListener(
  details => {
    if (details.type !== "main_frame") return;
    const info = { initiator: details.initiator || "", hasReferrer: false };
    const headers = details.requestHeaders || [];
    info.hasReferrer = headers.some(h => h.name.toLowerCase() === "referer" && h.value);
    navMeta.set(details.tabId, info);
    // 少し後で掃除
    setTimeout(() => navMeta.delete(details.tabId), 60000);
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders", "extraHeaders"] // Referer を見るために必要
);

// タブが外部アプリから開かれたかどうかを判定する関数
async function isLikelyFromExternalApp(tabId) {
  // 1. 既存タブが新規タブを開いた？
  const sourceFromCreated = openedByTab.get(tabId) ?? openerMap.get(tabId);
  if (typeof sourceFromCreated === "number") {
    console.log(`[TabSource] ${tabId} - IN_CHROME_FROM_TAB - sourceTabId: ${sourceFromCreated}`);
    return false; // Chrome内から開いた
  }

  // 2. initiator / Referer あり？
  const net = navMeta.get(tabId);
  if (net?.initiator || net?.hasReferrer) {
    console.log(`[TabSource] ${tabId} - IN_CHROME_FROM_PAGE - initiator: ${net?.initiator}, hasReferrer: ${net?.hasReferrer}`);
    return false; // Chrome内の別ページから
  }

  // onCommitted イベントの情報があればより精度の高い判定が可能
  // ここでは基本情報から「Chrome内から開かれていない」と判定
  return true; // 外部アプリの可能性が高い
}

// 拡張機能がインストールされた時の処理
chrome.runtime.onInstalled.addListener(() => {
  console.log('External Link Catcher installed');
});

// onCommitted イベントの追加（オプション）
chrome.webNavigation.onCommitted.addListener(d => {
  if (d.frameId !== 0) return; // メインフレームのみ
  const tabId = d.tabId;
  
  // Chrome UI（アドレスバー/ブクマ等）?
  if (["typed","auto_bookmark","keyword","keyword_generated","reload","start_page","generated"].includes(d.transitionType)) {
    console.log(`[TabSource] ${tabId} - IN_CHROME_UI - transitionType: ${d.transitionType}, qualifiers: ${d.transitionQualifiers}`);
    return;
  }
  
  // 外部アプリの可能性が高い？
  console.log(`[TabSource] ${tabId} - LIKELY_EXTERNAL_APP - transitionType: ${d.transitionType}, qualifiers: ${d.transitionQualifiers}`);
});
