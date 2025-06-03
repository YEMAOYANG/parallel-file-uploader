import { QueuePersistence } from '../src/modules/QueuePersistence'
import { FileInfo, UploadStepEnum } from '../src/type'
import './setup'

describe('QueuePersistence', () => {
  let persistence: QueuePersistence
  let mockFileInfo: FileInfo

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    
    persistence = new QueuePersistence(true, 'test-uploader')
    
    mockFileInfo = {
      fileId: 'test-file-1',
      fileName: 'test.txt',
      fileSize: 1024,
      uploadedSize: 512,
      progress: 50,
      status: UploadStepEnum.upload,
      file: new File(['test'], 'test.txt'),
      mimeType: 'text/plain',
      lastUpdated: Date.now(),
      totalChunks: 2,
    }
  })

  describe('Constructor', () => {
    it('should initialize with enabled state', () => {
      const enabledPersistence = new QueuePersistence(true)
      expect(enabledPersistence.isEnabled()).toBe(true)
    })

    it('should initialize with disabled state', () => {
      const disabledPersistence = new QueuePersistence(false)
      expect(disabledPersistence.isEnabled()).toBe(false)
    })

    it('should use custom storage key', () => {
      const customPersistence = new QueuePersistence(true, 'custom-key')
      expect(customPersistence.isEnabled()).toBe(true)
    })
  })

  describe('Enable/Disable', () => {
    it('should enable persistence', () => {
      persistence.setEnabled(true)
      expect(persistence.isEnabled()).toBe(true)
    })

    it('should disable persistence and clear data', () => {
      persistence.saveQueue([mockFileInfo])
      persistence.setEnabled(false)
      
      expect(persistence.isEnabled()).toBe(false)
      expect(persistence.loadQueue()).toEqual([])
    })
  })

  describe('Queue Operations', () => {
    beforeEach(() => {
      persistence.setEnabled(true)
    })

    it('should save and load queue', () => {
      persistence.saveQueue([mockFileInfo])
      
      const loaded = persistence.loadQueue()
      expect(loaded).toHaveLength(1)
      expect(loaded[0]).toMatchObject({
        fileId: 'test-file-1',
        fileName: 'test.txt',
        fileSize: 1024,
        uploadedSize: 512,
        progress: 50,
        status: UploadStepEnum.upload,
      })
      
      // Should not include File object
      expect(loaded[0]).not.toHaveProperty('file')
    })

    it('should handle empty queue', () => {
      const loaded = persistence.loadQueue()
      expect(loaded).toEqual([])
    })

    it('should save multiple files', () => {
      const secondFile: FileInfo = {
        ...mockFileInfo,
        fileId: 'test-file-2',
        fileName: 'test2.txt',
      }
      
      persistence.saveQueue([mockFileInfo, secondFile])
      
      const loaded = persistence.loadQueue()
      expect(loaded).toHaveLength(2)
    })

    it('should filter expired files', () => {
      const expiredFile: FileInfo = {
        ...mockFileInfo,
        lastUpdated: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
      }
      
      persistence.saveQueue([expiredFile])
      
      const loaded = persistence.loadQueue()
      expect(loaded).toHaveLength(0)
    })

    it('should remove specific file', () => {
      persistence.saveQueue([mockFileInfo])
      
      persistence.removeFile('test-file-1')
      
      const loaded = persistence.loadQueue()
      expect(loaded).toHaveLength(0)
    })
  })

  describe('Chunk Status Operations', () => {
    beforeEach(() => {
      persistence.setEnabled(true)
    })

    it('should save and load chunk status', () => {
      const uploadedChunks = new Set([1, 2, 3])
      const pendingChunks = new Set([4, 5])
      
      persistence.saveChunkStatus('test-file-1', uploadedChunks, pendingChunks)
      
      const loaded = persistence.loadChunkStatus('test-file-1')
      expect(loaded).not.toBeNull()
      expect(loaded!.uploaded).toEqual([1, 2, 3])
      expect(loaded!.pending).toEqual([4, 5])
    })

    it('should return null for non-existent chunk status', () => {
      const loaded = persistence.loadChunkStatus('non-existent')
      expect(loaded).toBeNull()
    })

    it('should filter expired chunk status', () => {
      // Mock timestamp to be old
      const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
      localStorage.setItem('test-uploader-chunks', JSON.stringify({
        'test-file-1': {
          uploaded: [1, 2],
          pending: [3],
          timestamp: oldTimestamp
        }
      }))
      
      const loaded = persistence.loadChunkStatus('test-file-1')
      expect(loaded).toBeNull()
    })
  })

  describe('Storage Management', () => {
    beforeEach(() => {
      persistence.setEnabled(true)
    })

    it('should clear all data', () => {
      persistence.saveQueue([mockFileInfo])
      persistence.saveChunkStatus('test-file-1', new Set([1]), new Set([2]))
      
      persistence.clearAll()
      
      expect(persistence.loadQueue()).toEqual([])
      expect(persistence.loadChunkStatus('test-file-1')).toBeNull()
    })

    it('should cleanup expired data', () => {
      // Add current data
      persistence.saveQueue([mockFileInfo])
      
      // Add expired data directly to localStorage
      const expiredQueue = [{
        ...mockFileInfo,
        fileId: 'expired-file',
        lastUpdated: Date.now() - (25 * 60 * 60 * 1000)
      }]
      
      localStorage.setItem('test-uploader', JSON.stringify([...expiredQueue, mockFileInfo]))
      
      persistence.cleanupExpiredData()
      
      const loaded = persistence.loadQueue()
      expect(loaded).toHaveLength(1)
      expect(loaded[0].fileId).toBe('test-file-1')
    })

    it('should get storage info', () => {
      persistence.saveQueue([mockFileInfo])
      persistence.saveChunkStatus('test-file-1', new Set([1]), new Set([2]))
      
      const info = persistence.getStorageInfo()
      
      expect(info).toHaveProperty('queueSize')
      expect(info).toHaveProperty('chunkSize')
      expect(info).toHaveProperty('totalSize')
      expect(info).toHaveProperty('estimatedQuota')
      
      expect(typeof info.queueSize).toBe('number')
      expect(typeof info.chunkSize).toBe('number')
      expect(info.queueSize).toBeGreaterThan(0)
    })
  })

  describe('Disabled State', () => {
    beforeEach(() => {
      persistence.setEnabled(false)
    })

    it('should not save when disabled', () => {
      persistence.saveQueue([mockFileInfo])
      
      // Should not have saved anything
      expect(localStorage.getItem('test-uploader')).toBeNull()
    })

    it('should return empty array when disabled', () => {
      const loaded = persistence.loadQueue()
      expect(loaded).toEqual([])
    })

    it('should return null chunk status when disabled', () => {
      const loaded = persistence.loadChunkStatus('test-file-1')
      expect(loaded).toBeNull()
    })

    it('should return zero storage info when disabled', () => {
      const info = persistence.getStorageInfo()
      expect(info.queueSize).toBe(0)
      expect(info.chunkSize).toBe(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage to throw error
      const originalSetItem = localStorage.setItem
      localStorage.setItem = jest.fn(() => {
        throw new Error('Storage quota exceeded')
      })
      
      // Should not throw
      expect(() => {
        persistence.saveQueue([mockFileInfo])
      }).not.toThrow()
      
      // Restore original method
      localStorage.setItem = originalSetItem
    })

    it('should handle corrupted data gracefully', () => {
      // Set invalid JSON
      localStorage.setItem('test-uploader', 'invalid json')
      
      // Should return empty array instead of throwing
      expect(persistence.loadQueue()).toEqual([])
    })

    it('should handle non-array queue data', () => {
      // Set non-array data
      localStorage.setItem('test-uploader', JSON.stringify({ not: 'array' }))
      
      expect(persistence.loadQueue()).toEqual([])
    })
  })
}) 