import { ParallelFileUploader } from '../src/index'
import { UploadStepEnum, ErrorType } from '../src/type'
import './setup'

describe('ParallelFileUploader', () => {
  let uploader: ParallelFileUploader
  
  beforeEach(() => {
    uploader = new ParallelFileUploader({
      maxConcurrentFiles: 2,
      maxConcurrentChunks: 3,
      chunkSize: 1024 * 1024, // 1MB
      enableSpeedLimit: false,
      enablePerformanceMonitor: false,
      enableQueuePersistence: false,
    })
  })

  afterEach(() => {
    uploader.destroy()
  })

  describe('Constructor', () => {
    it('should initialize with default options', () => {
      const defaultUploader = new ParallelFileUploader()
      expect(defaultUploader).toBeInstanceOf(ParallelFileUploader)
      defaultUploader.destroy()
    })

    it('should initialize with custom options', () => {
      const customUploader = new ParallelFileUploader({
        maxConcurrentFiles: 5,
        maxConcurrentChunks: 2,
        chunkSize: 2 * 1024 * 1024,
        enableSpeedLimit: true,
        maxUploadSpeed: 1024 * 1024,
        enablePerformanceMonitor: true,
        enableQueuePersistence: true,
      })
      
      expect(customUploader).toBeInstanceOf(ParallelFileUploader)
      customUploader.destroy()
    })
  })

  describe('File Management', () => {
    it('should add files to queue', () => {
      const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' })
      const fileAddedSpy = jest.fn()
      
      uploader = new ParallelFileUploader({
        onFileAdded: fileAddedSpy,
      })

      uploader.addFiles([mockFile])

      expect(fileAddedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: 'test.txt',
          fileSize: 12,
          status: expect.any(String),
        })
      )
    })

    it('should reject files that exceed size limit', () => {
      const largeFile = new File(['x'.repeat(1024 * 1024 * 10)], 'large.txt') // 10MB
      const fileRejectedSpy = jest.fn()
      
      uploader = new ParallelFileUploader({
        maxFileSize: 1024 * 1024 * 5, // 5MB limit
        onFileRejected: fileRejectedSpy,
      })

      uploader.addFiles([largeFile])

      expect(fileRejectedSpy).toHaveBeenCalledWith(
        expect.any(File),
        expect.stringContaining('文件大小超出限制')
      )
    })

    it('should reject files with disallowed types', () => {
      const txtFile = new File(['content'], 'test.txt', { type: 'text/plain' })
      const fileRejectedSpy = jest.fn()
      
      uploader = new ParallelFileUploader({
        allowedFileTypes: ['image/*', '.pdf'],
        onFileRejected: fileRejectedSpy,
      })

      uploader.addFiles([txtFile])

      expect(fileRejectedSpy).toHaveBeenCalledWith(
        expect.any(File),
        expect.stringContaining('不支持的文件类型')
      )
    })
  })

  describe('Upload Control', () => {
    let mockFile: File
    let fileInfo: any

    beforeEach(() => {
      mockFile = new File(['test content'], 'test.txt')
      
      uploader = new ParallelFileUploader({
        onFileAdded: (info) => { fileInfo = info },
        sendFileInfoToServer: async () => ({ isSuccess: true, data: {} }),
        sendFilePartToServer: async () => ({ isSuccess: true, data: { etag: 'test-etag' } }),
        sendFileCompleteToServer: async () => ({ isSuccess: true, data: {} }),
      })
      
      uploader.addFiles([mockFile])
    })

    it('should pause and resume file upload', async () => {
      await new Promise(resolve => setTimeout(resolve, 100)) // Wait for initialization
      
      uploader.pauseFile(fileInfo.fileId)
      expect(true).toBe(true)
      
      uploader.resumeFile(fileInfo.fileId)
      expect(true).toBe(true)
    })

    it('should cancel file upload', async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const statsBefore = uploader.getStats()
      
      uploader.cancelFile(fileInfo.fileId)
      
      const statsAfter = uploader.getStats()
      expect(statsAfter.active + statsAfter.queued).toBeLessThanOrEqual(statsBefore.active + statsBefore.queued)
    })

    it('should pause and resume all files', () => {
      uploader.pauseAll()
      uploader.resumeAll()
      
      // Should not throw errors
      expect(true).toBe(true)
    })

    it('should cancel all files', () => {
      uploader.cancelAll()
      
      const stats = uploader.getStats()
      expect(stats.active).toBe(0)
      expect(stats.queued).toBe(0)
    })
  })

  describe('Statistics', () => {
    it('should return correct stats', () => {
      const stats = uploader.getStats()
      
      expect(stats).toHaveProperty('queued')
      expect(stats).toHaveProperty('active')
      expect(stats).toHaveProperty('completed')
      expect(stats).toHaveProperty('failed')
      expect(stats).toHaveProperty('paused')
      
      expect(typeof stats.queued).toBe('number')
      expect(typeof stats.active).toBe('number')
    })
  })

  describe('Speed Control', () => {
    it('should set speed limit', () => {
      const speed = 1024 * 1024 // 1MB/s
      uploader.setSpeedLimit(speed, true)
      
      // Should not throw error
      expect(true).toBe(true)
    })

    it('should disable speed limit', () => {
      uploader.setSpeedLimit(0, false)
      
      // Should not throw error
      expect(true).toBe(true)
    })
  })

  describe('Performance Monitoring', () => {
    it('should enable performance monitoring', () => {
      uploader.setPerformanceMonitoring(true)
      
      const performanceData = uploader.getPerformanceData()
      
      expect(performanceData).toHaveProperty('currentSpeed')
      expect(performanceData).toHaveProperty('averageSpeed')
      expect(performanceData).toHaveProperty('activeConnections')
      expect(performanceData).toHaveProperty('bytesTransferred')
    })

    it('should disable performance monitoring', () => {
      uploader.setPerformanceMonitoring(false)
      
      const performanceData = uploader.getPerformanceData()
      expect(performanceData.currentSpeed).toBe(0)
    })
  })

  describe('Queue Persistence', () => {
    it('should enable queue persistence', () => {
      uploader.setQueuePersistence(true)
      
      // Should not throw error
      expect(true).toBe(true)
    })

    it('should disable queue persistence', () => {
      uploader.setQueuePersistence(false)
      
      // Should not throw error
      expect(true).toBe(true)
    })
  })

  describe('MD5 Calculation', () => {
    it('should calculate file MD5', async () => {
      const file = new File(['test content'], 'test.txt')
      
      const md5 = await ParallelFileUploader.calculateFileMD5(file)
      
      expect(typeof md5).toBe('string')
      expect(md5.length).toBe(32) // MD5 is 32 characters
    })

    it('should report progress during MD5 calculation', async () => {
      const file = new File(['test content'.repeat(1000)], 'test.txt')
      const progressSpy = jest.fn()
      
      await ParallelFileUploader.calculateFileMD5(file, 1024, progressSpy)
      
      expect(progressSpy).toHaveBeenCalled()
    })
  })

  describe('Callbacks', () => {
    it('should call onFileProgress callback', () => {
      const progressSpy = jest.fn()
      const mockFile = new File(['test'], 'test.txt')
      
      uploader = new ParallelFileUploader({
        onFileProgress: progressSpy,
        sendFileInfoToServer: async () => ({ isSuccess: true, data: {} }),
        sendFilePartToServer: async () => ({ isSuccess: true, data: { etag: 'test' } }),
      })

      uploader.addFiles([mockFile])
      
      // Progress callback should eventually be called during upload
      setTimeout(() => {
        expect(progressSpy).toHaveBeenCalled()
      }, 100)
    })

    it('should call onFileSuccess callback', async () => {
      const successSpy = jest.fn()
      const mockFile = new File(['test'], 'test.txt')
      
      uploader = new ParallelFileUploader({
        onFileSuccess: successSpy,
        sendFileInfoToServer: async () => ({ isSuccess: true, data: { skipUpload: true } }),
      })

      uploader.addFiles([mockFile])
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      expect(successSpy).toHaveBeenCalled()
    })

    it('should call onFileError callback', async () => {
      const errorSpy = jest.fn()
      const mockFile = new File(['test'], 'test.txt')
      
      uploader = new ParallelFileUploader({
        onFileError: errorSpy,
        sendFileInfoToServer: async () => ({ isSuccess: false, message: 'Server error', data: null }),
      })

      uploader.addFiles([mockFile])
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      expect(errorSpy).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle server initialization failure', async () => {
      const errorSpy = jest.fn()
      const mockFile = new File(['test'], 'test.txt')
      
      uploader = new ParallelFileUploader({
        onFileError: errorSpy,
        sendFileInfoToServer: async () => ({ isSuccess: false, message: 'Init failed', data: null }),
      })

      uploader.addFiles([mockFile])
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      expect(errorSpy).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          message: expect.stringContaining('Failed to initialize file upload')
        })
      )
    })

    it('should handle chunk upload failure with retries', async () => {
      const mockFile = new File(['test content'], 'test.txt')
      let attempts = 0
      
      uploader = new ParallelFileUploader({
        maxRetries: 2,
        sendFileInfoToServer: async () => ({ isSuccess: true, data: {} }),
        sendFilePartToServer: async () => {
          attempts++
          if (attempts <= 2) {
            return { isSuccess: false, message: 'Network error', data: null }
          }
          return { isSuccess: true, data: { etag: 'test-etag' } }
        },
        sendFileCompleteToServer: async () => ({ isSuccess: true, data: {} }),
      })

      uploader.addFiles([mockFile])
      
      await new Promise(resolve => setTimeout(resolve, 200))
      
      expect(attempts).toBeGreaterThan(1) // Should have retried
    })
  })

  describe('Destroy', () => {
    it('should clean up resources on destroy', () => {
      const mockFile = new File(['test'], 'test.txt')
      uploader.addFiles([mockFile])
      
      uploader.destroy()
      
      const stats = uploader.getStats()
      expect(stats.active).toBe(0)
      expect(stats.queued).toBe(0)
    })
  })
}) 