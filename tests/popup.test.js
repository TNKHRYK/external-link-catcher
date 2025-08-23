/**
 * @jest-environment jsdom
 */

import { DEFAULT_GROUP_NAME } from '../constants.js';

// DOM要素のモック
const createMockDOM = () => {
  document.body.innerHTML = `
    <form id="settingsForm">
      <input type="text" id="groupName" placeholder="today" required>
      <button type="submit">設定を保存</button>
    </form>
    <div class="current-group">
      <h3>現在の設定</h3>
      <p id="currentGroup">today</p>
    </div>
    <div id="status" class="status"></div>
  `;
};

beforeEach(() => {
  jest.clearAllMocks();
  createMockDOM();
  
  // Chrome storage のデフォルトモック
  chrome.storage.sync.get.mockResolvedValue({});
  chrome.storage.sync.set.mockResolvedValue();
});

describe('Popup DOM Elements', () => {
  test('should find required DOM elements', () => {
    const form = document.getElementById('settingsForm');
    const groupNameInput = document.getElementById('groupName');
    const currentGroupElement = document.getElementById('currentGroup');
    const statusElement = document.getElementById('status');

    expect(form).toBeTruthy();
    expect(groupNameInput).toBeTruthy();
    expect(currentGroupElement).toBeTruthy();
    expect(statusElement).toBeTruthy();
  });

  test('should have correct initial values', () => {
    const groupNameInput = document.getElementById('groupName');
    const currentGroupElement = document.getElementById('currentGroup');

    expect(groupNameInput.placeholder).toBe('today');
    expect(currentGroupElement.textContent).toBe('today');
  });
});

describe('Settings Loading', () => {
  test('should load current settings from storage', async () => {
    const mockGroupName = 'work-projects';
    chrome.storage.sync.get.mockResolvedValue({ groupName: mockGroupName });

    // 設定読み込み関数の模倣
    const loadCurrentSettings = async () => {
      try {
        const result = await chrome.storage.sync.get(['groupName']);
        const currentGroupName = result.groupName || DEFAULT_GROUP_NAME;
        
        const groupNameInput = document.getElementById('groupName');
        const currentGroupElement = document.getElementById('currentGroup');
        
        groupNameInput.value = currentGroupName;
        currentGroupElement.textContent = currentGroupName;
        
        return { success: true, groupName: currentGroupName };
      } catch (error) {
        console.error('Error loading settings:', error);
        return { success: false, error };
      }
    };

    const result = await loadCurrentSettings();

    expect(result.success).toBe(true);
    expect(result.groupName).toBe(mockGroupName);
    expect(chrome.storage.sync.get).toHaveBeenCalledWith(['groupName']);
    
    const groupNameInput = document.getElementById('groupName');
    const currentGroupElement = document.getElementById('currentGroup');
    
    expect(groupNameInput.value).toBe(mockGroupName);
    expect(currentGroupElement.textContent).toBe(mockGroupName);
  });

  test('should use default value when no stored setting', async () => {
    chrome.storage.sync.get.mockResolvedValue({});

    const loadCurrentSettings = async () => {
      const result = await chrome.storage.sync.get(['groupName']);
      const currentGroupName = result.groupName || DEFAULT_GROUP_NAME;
      
      const groupNameInput = document.getElementById('groupName');
      const currentGroupElement = document.getElementById('currentGroup');
      
      groupNameInput.value = currentGroupName;
      currentGroupElement.textContent = currentGroupName;
      
      return { success: true, groupName: currentGroupName };
    };

    const result = await loadCurrentSettings();

    expect(result.groupName).toBe(DEFAULT_GROUP_NAME);
  });

  test('should handle storage loading errors', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    chrome.storage.sync.get.mockRejectedValue(new Error('Storage error'));

    const loadCurrentSettings = async () => {
      try {
        const result = await chrome.storage.sync.get(['groupName']);
        const currentGroupName = result.groupName || DEFAULT_GROUP_NAME;
        return { success: true, groupName: currentGroupName };
      } catch (error) {
        console.error('Error loading settings:', error);
        return { success: false, error };
      }
    };

    const result = await loadCurrentSettings();

    expect(result.success).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error loading settings:', 
      expect.any(Error)
    );
    
    consoleSpy.mockRestore();
  });
});

describe('Settings Saving', () => {
  test('should save valid group name', async () => {
    const newGroupName = 'development';
    const groupNameInput = document.getElementById('groupName');
    groupNameInput.value = newGroupName;

    const saveSettings = async () => {
      try {
        const groupNameInput = document.getElementById('groupName');
        const groupName = groupNameInput.value.trim() || DEFAULT_GROUP_NAME;
        
        await chrome.storage.sync.set({ groupName: groupName });
        
        const currentGroupElement = document.getElementById('currentGroup');
        currentGroupElement.textContent = groupName;
        
        return { success: true, groupName };
      } catch (error) {
        console.error('Error saving settings:', error);
        return { success: false, error };
      }
    };

    const result = await saveSettings();

    expect(result.success).toBe(true);
    expect(result.groupName).toBe(newGroupName);
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({ 
      groupName: newGroupName 
    });

    const currentGroupElement = document.getElementById('currentGroup');
    expect(currentGroupElement.textContent).toBe(newGroupName);
  });

  test('should use default when input is empty', async () => {
    const groupNameInput = document.getElementById('groupName');
    groupNameInput.value = '   '; // 空白のみ

    const saveSettings = async () => {
      const groupNameInput = document.getElementById('groupName');
      const groupName = groupNameInput.value.trim() || DEFAULT_GROUP_NAME;
      
      await chrome.storage.sync.set({ groupName: groupName });
      return { success: true, groupName };
    };

    const result = await saveSettings();

    expect(result.groupName).toBe(DEFAULT_GROUP_NAME);
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({ 
      groupName: DEFAULT_GROUP_NAME 
    });
  });

  test('should handle storage saving errors', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    chrome.storage.sync.set.mockRejectedValue(new Error('Storage quota exceeded'));

    const saveSettings = async () => {
      try {
        const groupNameInput = document.getElementById('groupName');
        const groupName = groupNameInput.value.trim() || DEFAULT_GROUP_NAME;
        
        await chrome.storage.sync.set({ groupName: groupName });
        return { success: true, groupName };
      } catch (error) {
        console.error('Error saving settings:', error);
        return { success: false, error };
      }
    };

    const result = await saveSettings();

    expect(result.success).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error saving settings:', 
      expect.any(Error)
    );
    
    consoleSpy.mockRestore();
  });
});

describe('Status Message Display', () => {
  test('should show success message correctly', () => {
    const showStatus = (message, isSuccess) => {
      const statusElement = document.getElementById('status');
      statusElement.textContent = message;
      statusElement.className = `status ${isSuccess ? 'success' : 'error'} show`;
    };

    showStatus('設定が保存されました', true);

    const statusElement = document.getElementById('status');
    expect(statusElement.textContent).toBe('設定が保存されました');
    expect(statusElement.classList.contains('success')).toBe(true);
    expect(statusElement.classList.contains('show')).toBe(true);
    expect(statusElement.classList.contains('error')).toBe(false);
  });

  test('should show error message correctly', () => {
    const showStatus = (message, isSuccess) => {
      const statusElement = document.getElementById('status');
      statusElement.textContent = message;
      statusElement.className = `status ${isSuccess ? 'success' : 'error'} show`;
    };

    showStatus('設定の保存に失敗しました', false);

    const statusElement = document.getElementById('status');
    expect(statusElement.textContent).toBe('設定の保存に失敗しました');
    expect(statusElement.classList.contains('error')).toBe(true);
    expect(statusElement.classList.contains('show')).toBe(true);
    expect(statusElement.classList.contains('success')).toBe(false);
  });
});

describe('Form Validation', () => {
  test('should handle form submission', () => {
    const form = document.getElementById('settingsForm');
    const groupNameInput = document.getElementById('groupName');
    
    groupNameInput.value = 'test-group';

    // フォーム送信イベントのシミュレーション
    const mockSubmitHandler = jest.fn((e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      return { groupName: groupNameInput.value };
    });

    form.addEventListener('submit', mockSubmitHandler);

    const submitEvent = new Event('submit', { bubbles: true });
    form.dispatchEvent(submitEvent);

    expect(mockSubmitHandler).toHaveBeenCalled();
  });

  test('should validate required field', () => {
    const groupNameInput = document.getElementById('groupName');
    
    expect(groupNameInput.hasAttribute('required')).toBe(true);
    expect(groupNameInput.getAttribute('type')).toBe('text');
  });
});

describe('Input Sanitization', () => {
  test('should trim whitespace from input', () => {
    const sanitizeInput = (value) => {
      return value.trim() || DEFAULT_GROUP_NAME;
    };

    expect(sanitizeInput('  test  ')).toBe('test');
    expect(sanitizeInput('   ')).toBe(DEFAULT_GROUP_NAME);
    expect(sanitizeInput('')).toBe(DEFAULT_GROUP_NAME);
  });

  test('should handle special characters in group names', () => {
    const groupNameInput = document.getElementById('groupName');
    const testNames = [
      'test-group',
      'group_with_underscores', 
      'group with spaces',
      '日本語グループ'
    ];

    testNames.forEach(name => {
      groupNameInput.value = name;
      expect(groupNameInput.value).toBe(name);
    });
  });
});