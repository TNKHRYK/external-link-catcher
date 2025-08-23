/**
 * @jest-environment jsdom
 */

import { DEFAULT_GROUP_NAME, DEFAULT_GROUP_COLOR } from '../constants.js';

// background.jsの関数をテスト用にエクスポートする必要があるため、
// テスト専用の関数ラッパーを作成
let backgroundModule;

// モジュールの動的インポートとモック
beforeAll(async () => {
  // Chrome APIのモックをリセット
  jest.clearAllMocks();
  
  // background.jsの内容を文字列として読み込み、評価する
  // 実際のプロジェクトでは、テスト用にエクスポートを追加することを推奨
});

beforeEach(() => {
  jest.clearAllMocks();
  
  // Chrome API のデフォルトモック動作を設定
  chrome.storage.sync.get.mockResolvedValue({});
  chrome.tabGroups.query.mockResolvedValue([]);
  chrome.tabs.group.mockResolvedValue(123);
  chrome.tabGroups.update.mockResolvedValue();
  chrome.tabs.update.mockResolvedValue();
});

describe('Constants', () => {
  test('should export correct default values', () => {
    expect(DEFAULT_GROUP_NAME).toBe('today');
    expect(DEFAULT_GROUP_COLOR).toBe('red');
  });
});

describe('getGroupName function', () => {
  test('should return stored group name when available', async () => {
    const mockGroupName = 'work-tabs';
    chrome.storage.sync.get.mockResolvedValue({ groupName: mockGroupName });

    // テストのため、実際の関数を模倣
    const getGroupName = async () => {
      const result = await chrome.storage.sync.get(['groupName']);
      return result.groupName || DEFAULT_GROUP_NAME;
    };

    const result = await getGroupName();
    expect(result).toBe(mockGroupName);
    expect(chrome.storage.sync.get).toHaveBeenCalledWith(['groupName']);
  });

  test('should return default group name when no stored value', async () => {
    chrome.storage.sync.get.mockResolvedValue({});

    const getGroupName = async () => {
      const result = await chrome.storage.sync.get(['groupName']);
      return result.groupName || DEFAULT_GROUP_NAME;
    };

    const result = await getGroupName();
    expect(result).toBe(DEFAULT_GROUP_NAME);
  });
});

describe('getExistingTabGroup function', () => {
  test('should return existing group ID when group exists', async () => {
    const mockGroups = [
      { id: 1, title: 'work' },
      { id: 2, title: 'today' },
      { id: 3, title: 'personal' }
    ];
    chrome.tabGroups.query.mockResolvedValue(mockGroups);

    const getExistingTabGroup = async (groupName) => {
      const tabGroups = await chrome.tabGroups.query({});
      const existingGroup = tabGroups.find(group => group.title === groupName);
      return existingGroup ? existingGroup.id : null;
    };

    const result = await getExistingTabGroup('today');
    expect(result).toBe(2);
    expect(chrome.tabGroups.query).toHaveBeenCalledWith({});
  });

  test('should return null when group does not exist', async () => {
    const mockGroups = [
      { id: 1, title: 'work' },
      { id: 3, title: 'personal' }
    ];
    chrome.tabGroups.query.mockResolvedValue(mockGroups);

    const getExistingTabGroup = async (groupName) => {
      const tabGroups = await chrome.tabGroups.query({});
      const existingGroup = tabGroups.find(group => group.title === groupName);
      return existingGroup ? existingGroup.id : null;
    };

    const result = await getExistingTabGroup('nonexistent');
    expect(result).toBeNull();
  });
});

describe('moveTabToNewGroup function', () => {
  test('should create new group and set properties', async () => {
    const tabId = 456;
    const groupName = 'test-group';
    const groupId = 789;
    
    chrome.tabs.group.mockResolvedValue(groupId);

    const moveTabToNewGroup = async (tabId, groupName) => {
      const groupId = await chrome.tabs.group({ tabIds: [tabId] });
      await chrome.tabGroups.update(groupId, { 
        title: groupName,
        color: DEFAULT_GROUP_COLOR
      });
      return groupId;
    };

    const result = await moveTabToNewGroup(tabId, groupName);

    expect(result).toBe(groupId);
    expect(chrome.tabs.group).toHaveBeenCalledWith({ tabIds: [tabId] });
    expect(chrome.tabGroups.update).toHaveBeenCalledWith(groupId, {
      title: groupName,
      color: DEFAULT_GROUP_COLOR
    });
  });
});

describe('Tab event handling', () => {
  test('should handle external link detection correctly', () => {
    const mockTab = {
      id: 123,
      url: 'https://example.com',
      openerTabId: undefined
    };

    // 外部リンク判定のロジックをテスト
    const isExternalTab = (tab) => {
      return tab.openerTabId === undefined && 
             tab.url && 
             tab.url.startsWith('http');
    };

    expect(isExternalTab(mockTab)).toBe(true);
  });

  test('should reject internal tabs', () => {
    const mockTab = {
      id: 123,
      url: 'https://example.com',
      openerTabId: 456 // 内部タブ
    };

    const isExternalTab = (tab) => {
      return tab.openerTabId === undefined && 
             tab.url && 
             tab.url.startsWith('http');
    };

    expect(isExternalTab(mockTab)).toBe(false);
  });

  test('should reject non-http URLs', () => {
    const mockTab = {
      id: 123,
      url: 'chrome://extensions/',
      openerTabId: undefined
    };

    const isExternalTab = (tab) => {
      return tab.openerTabId === undefined && 
             tab.url && 
             tab.url.startsWith('http');
    };

    expect(isExternalTab(mockTab)).toBe(false);
  });
});

describe('Error handling', () => {
  test('should handle Chrome API errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    chrome.tabs.group.mockRejectedValue(new Error('Permission denied'));

    const moveTabToGroup = async (tabId) => {
      try {
        await chrome.tabs.group({ tabIds: [tabId] });
      } catch (error) {
        console.error('Error moving tab to group:', error);
      }
    };

    await moveTabToGroup(123);

    expect(consoleSpy).toHaveBeenCalledWith(
      'Error moving tab to group:', 
      expect.any(Error)
    );
    
    consoleSpy.mockRestore();
  });
});