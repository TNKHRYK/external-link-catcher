// Chrome API Mock Setup

// Jest のモック関数を作成するヘルパー
const createMockFn = () => {
  let calls = [];
  let returnValue = Promise.resolve();
  
  const mockFn = (...args) => {
    calls.push(args);
    return returnValue;
  };
  
  mockFn.mockResolvedValue = (value) => {
    returnValue = Promise.resolve(value);
    return mockFn;
  };
  
  mockFn.mockRejectedValue = (error) => {
    returnValue = Promise.reject(error);
    return mockFn;
  };
  
  mockFn.toHaveBeenCalledWith = (...expectedArgs) => {
    return calls.some(callArgs => 
      JSON.stringify(callArgs) === JSON.stringify(expectedArgs)
    );
  };
  
  mockFn.toHaveBeenCalledTimes = (expectedCount) => {
    return calls.length === expectedCount;
  };
  
  mockFn.toHaveBeenCalled = () => calls.length > 0;
  
  mockFn.mockClear = () => {
    calls = [];
    return mockFn;
  };
  
  return mockFn;
};

// Chrome API のモック設定
global.chrome = {
  storage: {
    sync: {
      get: createMockFn(),
      set: createMockFn()
    }
  },
  tabs: {
    create: createMockFn(),
    group: createMockFn(),
    update: createMockFn(),
    onCreated: {
      addListener: createMockFn()
    },
    onUpdated: {
      addListener: createMockFn()
    }
  },
  tabGroups: {
    query: createMockFn(),
    update: createMockFn()
  },
  runtime: {
    onInstalled: {
      addListener: createMockFn()
    }
  }
};

// Jest グローバル設定
global.jest = {
  fn: createMockFn,
  spyOn: (obj, method) => {
    const original = obj[method];
    const spy = createMockFn();
    spy.mockRestore = () => {
      obj[method] = original;
    };
    spy.mockImplementation = (impl) => {
      obj[method] = impl || (() => {});
    };
    obj[method] = spy;
    return spy;
  },
  clearAllMocks: () => {
    // 全てのモックをクリア
    Object.values(chrome.storage.sync).forEach(fn => fn.mockClear && fn.mockClear());
    Object.values(chrome.tabs).forEach(fn => fn.mockClear && fn.mockClear());
    Object.values(chrome.tabGroups).forEach(fn => fn.mockClear && fn.mockClear());
  }
};