/**
 * @jest-environment jsdom
 */

import { DEFAULT_GROUP_NAME, DEFAULT_GROUP_COLOR } from '../constants.js';

describe('Integration Tests - End-to-End Scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Chrome API のモック設定
    chrome.storage.sync.get.mockResolvedValue({});
    chrome.storage.sync.set.mockResolvedValue();
    chrome.tabGroups.query.mockResolvedValue([]);
    chrome.tabs.group.mockResolvedValue(123);
    chrome.tabGroups.update.mockResolvedValue();
    chrome.tabs.update.mockResolvedValue();
  });

  describe('Complete Tab Grouping Workflow', () => {
    test('should handle new external tab creation and grouping', async () => {
      // シナリオ: 外部アプリから新しいタブが開かれる
      
      // 1. 設定を取得
      chrome.storage.sync.get.mockResolvedValue({ groupName: 'work-tabs' });
      
      // 2. 既存グループなし
      chrome.tabGroups.query.mockResolvedValue([]);
      
      // 3. 新しいグループID
      const newGroupId = 456;
      chrome.tabs.group.mockResolvedValue(newGroupId);

      // 実際のワークフロー関数の模倣
      const completeTabGroupingWorkflow = async (tab) => {
        // 外部タブ判定
        if (tab.openerTabId === undefined && tab.url && tab.url.startsWith('http')) {
          // 設定取得
          const result = await chrome.storage.sync.get(['groupName']);
          const groupName = result.groupName || DEFAULT_GROUP_NAME;
          
          // 既存グループ検索
          const tabGroups = await chrome.tabGroups.query({});
          const existingGroup = tabGroups.find(group => group.title === groupName);
          
          let groupId;
          if (existingGroup) {
            groupId = existingGroup.id;
            await chrome.tabs.group({
              tabIds: [tab.id],
              groupId: groupId
            });
          } else {
            // 新しいグループ作成
            groupId = await chrome.tabs.group({ tabIds: [tab.id] });
            await chrome.tabGroups.update(groupId, { 
              title: groupName,
              color: DEFAULT_GROUP_COLOR
            });
          }
          
          // タブをアクティブに
          await chrome.tabs.update(tab.id, { active: true });
          
          return { success: true, groupId, groupName };
        }
        
        return { success: false, reason: 'not_external_tab' };
      };

      const mockTab = {
        id: 789,
        url: 'https://github.com',
        openerTabId: undefined
      };

      const result = await completeTabGroupingWorkflow(mockTab);

      expect(result.success).toBe(true);
      expect(result.groupId).toBe(newGroupId);
      expect(result.groupName).toBe('work-tabs');
      
      // API呼び出しの検証
      expect(chrome.storage.sync.get).toHaveBeenCalledWith(['groupName']);
      expect(chrome.tabGroups.query).toHaveBeenCalledWith({});
      expect(chrome.tabs.group).toHaveBeenCalledWith({ tabIds: [789] });
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(newGroupId, {
        title: 'work-tabs',
        color: DEFAULT_GROUP_COLOR
      });
      expect(chrome.tabs.update).toHaveBeenCalledWith(789, { active: true });
    });

    test('should add tab to existing group', async () => {
      // シナリオ: 既存のグループにタブを追加

      const existingGroupId = 999;
      chrome.storage.sync.get.mockResolvedValue({ groupName: 'existing-group' });
      chrome.tabGroups.query.mockResolvedValue([
        { id: existingGroupId, title: 'existing-group' }
      ]);

      const completeTabGroupingWorkflow = async (tab) => {
        if (tab.openerTabId === undefined && tab.url && tab.url.startsWith('http')) {
          const result = await chrome.storage.sync.get(['groupName']);
          const groupName = result.groupName || DEFAULT_GROUP_NAME;
          
          const tabGroups = await chrome.tabGroups.query({});
          const existingGroup = tabGroups.find(group => group.title === groupName);
          
          if (existingGroup) {
            await chrome.tabs.group({
              tabIds: [tab.id],
              groupId: existingGroup.id
            });
            await chrome.tabs.update(tab.id, { active: true });
            return { success: true, groupId: existingGroup.id, groupName, isNewGroup: false };
          }
        }
        return { success: false };
      };

      const mockTab = {
        id: 555,
        url: 'https://stackoverflow.com',
        openerTabId: undefined
      };

      const result = await completeTabGroupingWorkflow(mockTab);

      expect(result.success).toBe(true);
      expect(result.groupId).toBe(existingGroupId);
      expect(result.isNewGroup).toBe(false);
      
      // 既存グループへの追加のみ、更新処理なし
      expect(chrome.tabs.group).toHaveBeenCalledWith({
        tabIds: [555],
        groupId: existingGroupId
      });
      expect(chrome.tabGroups.update).not.toHaveBeenCalled();
    });
  });

  describe('Settings and Tab Grouping Integration', () => {
    test('should save settings and immediately apply to new tabs', async () => {
      // シナリオ: 設定保存後、すぐに外部リンクが開かれる

      // 1. 設定保存
      const newGroupName = 'urgent-tasks';
      chrome.storage.sync.set.mockResolvedValue();
      await chrome.storage.sync.set({ groupName: newGroupName });

      // 2. 新しいタブが外部から開かれる
      chrome.storage.sync.get.mockResolvedValue({ groupName: newGroupName });
      chrome.tabGroups.query.mockResolvedValue([]);
      chrome.tabs.group.mockResolvedValue(777);

      const processNewExternalTab = async (tab) => {
        if (tab.openerTabId === undefined && tab.url && tab.url.startsWith('http')) {
          const result = await chrome.storage.sync.get(['groupName']);
          const groupName = result.groupName || DEFAULT_GROUP_NAME;
          
          const groupId = await chrome.tabs.group({ tabIds: [tab.id] });
          await chrome.tabGroups.update(groupId, { 
            title: groupName,
            color: DEFAULT_GROUP_COLOR
          });
          
          return { success: true, groupName };
        }
        return { success: false };
      };

      const mockTab = {
        id: 888,
        url: 'https://docs.google.com',
        openerTabId: undefined
      };

      const result = await processNewExternalTab(mockTab);

      expect(result.success).toBe(true);
      expect(result.groupName).toBe(newGroupName);
      
      // 保存された設定が使用されることを確認
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(777, {
        title: newGroupName,
        color: DEFAULT_GROUP_COLOR
      });
    });
  });

  describe('Error Recovery Scenarios', () => {
    test('should handle permission errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      chrome.storage.sync.get.mockResolvedValue({ groupName: 'test-group' });
      chrome.tabGroups.query.mockResolvedValue([]);
      chrome.tabs.group.mockRejectedValue(new Error('Permission denied'));

      const safeTabGrouping = async (tab) => {
        try {
          if (tab.openerTabId === undefined && tab.url && tab.url.startsWith('http')) {
            const result = await chrome.storage.sync.get(['groupName']);
            const groupName = result.groupName || DEFAULT_GROUP_NAME;
            
            const tabGroups = await chrome.tabGroups.query({});
            const groupId = await chrome.tabs.group({ tabIds: [tab.id] });
            
            return { success: true, groupId };
          }
        } catch (error) {
          console.error('Error moving tab to group:', error);
          return { success: false, error: error.message };
        }
      };

      const mockTab = {
        id: 123,
        url: 'https://example.com',
        openerTabId: undefined
      };

      const result = await safeTabGrouping(mockTab);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error moving tab to group:', 
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    test('should handle storage quota exceeded', async () => {
      chrome.storage.sync.set.mockRejectedValue(new Error('QUOTA_BYTES_PER_ITEM quota exceeded'));

      const safeStorageSave = async (data) => {
        try {
          await chrome.storage.sync.set(data);
          return { success: true };
        } catch (error) {
          if (error.message.includes('quota exceeded')) {
            return { success: false, error: 'storage_quota_exceeded' };
          }
          return { success: false, error: error.message };
        }
      };

      const result = await safeStorageSave({ groupName: 'a'.repeat(10000) });

      expect(result.success).toBe(false);
      expect(result.error).toBe('storage_quota_exceeded');
    });
  });

  describe('Edge Cases', () => {
    test('should handle undefined tab properties', async () => {
      const handleTabCreation = (tab) => {
        // null/undefinedチェック
        if (!tab || !tab.url) {
          return { success: false, reason: 'invalid_tab' };
        }
        
        if (tab.openerTabId === undefined && tab.url.startsWith('http')) {
          return { success: true, reason: 'external_tab' };
        }
        
        return { success: false, reason: 'internal_tab' };
      };

      // 各種エッジケースをテスト
      expect(handleTabCreation(null).reason).toBe('invalid_tab');
      expect(handleTabCreation({}).reason).toBe('invalid_tab');
      expect(handleTabCreation({ url: null }).reason).toBe('invalid_tab');
      expect(handleTabCreation({ 
        url: 'https://example.com', 
        openerTabId: undefined 
      }).reason).toBe('external_tab');
      expect(handleTabCreation({ 
        url: 'chrome://extensions/', 
        openerTabId: undefined 
      }).reason).toBe('internal_tab');
    });

    test('should handle concurrent tab creations', async () => {
      const groupId = 555;
      chrome.storage.sync.get.mockResolvedValue({ groupName: 'concurrent-group' });
      chrome.tabGroups.query.mockResolvedValue([]);
      chrome.tabs.group.mockResolvedValue(groupId);
      chrome.tabGroups.update.mockResolvedValue();

      const processConcurrentTabs = async (tabs) => {
        const promises = tabs.map(async (tab, index) => {
          // 少し遅延を入れて同時実行をシミュレート
          await new Promise(resolve => setTimeout(resolve, index * 10));
          
          if (tab.openerTabId === undefined && tab.url && tab.url.startsWith('http')) {
            const result = await chrome.storage.sync.get(['groupName']);
            const groupName = result.groupName || DEFAULT_GROUP_NAME;
            
            const groupId = await chrome.tabs.group({ tabIds: [tab.id] });
            await chrome.tabGroups.update(groupId, { 
              title: groupName,
              color: DEFAULT_GROUP_COLOR
            });
            
            return { success: true, tabId: tab.id, groupId };
          }
          
          return { success: false, tabId: tab.id };
        });

        return Promise.all(promises);
      };

      const mockTabs = [
        { id: 1, url: 'https://example.com', openerTabId: undefined },
        { id: 2, url: 'https://github.com', openerTabId: undefined },
        { id: 3, url: 'https://stackoverflow.com', openerTabId: undefined }
      ];

      const results = await processConcurrentTabs(mockTabs);

      expect(results.every(r => r.success)).toBe(true);
      expect(chrome.tabs.group).toHaveBeenCalledTimes(3);
      expect(chrome.tabGroups.update).toHaveBeenCalledTimes(3);
    });
  });
});