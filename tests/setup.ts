// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
}

;(globalThis as any).localStorage = localStorageMock

// Mock Worker
class WorkerMock {
  onmessage: any
  onerror: any
  
  constructor(url: string) {
    // Mock implementation
  }
  
  postMessage(message: any) {
    // Mock implementation
  }
  
  terminate() {
    // Mock implementation
  }
}

;(globalThis as any).Worker = WorkerMock

// Mock performance.memory
Object.defineProperty(performance, 'memory', {
  value: {
    usedJSHeapSize: 1024 * 1024 * 10, // 10MB
    totalJSHeapSize: 1024 * 1024 * 50, // 50MB
    jsHeapSizeLimit: 1024 * 1024 * 2048, // 2GB
  },
  writable: true,
}) 