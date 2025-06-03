import { FileManager } from '../src/modules/FileManager'
import { UploadStepEnum, UploaderError, ErrorType } from '../src/type'

describe('FileManager', () => {
  let fileManager: FileManager
  
  beforeEach(() => {
    fileManager = new FileManager({})
  })
  
  describe('addFiles', () => {
    it('应该成功添加文件到队列', () => {
      const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' })
      const addedFiles = fileManager.addFiles([mockFile])
      
      expect(addedFiles).toHaveLength(1)
      expect(addedFiles[0].fileName).toBe('test.txt')
      expect(addedFiles[0].fileSize).toBe(12) // 'test content' 的长度
      expect(addedFiles[0].status).toBe(UploadStepEnum.beforeUpload)
    })
    
    it('应该拒绝超过大小限制的文件', () => {
      fileManager = new FileManager({
        maxFileSize: 10,
      })
      
      const mockFile = new File(['test content that is too large'], 'large.txt', { type: 'text/plain' })
      
      expect(() => {
        fileManager.addFiles([mockFile])
      }).toThrow(UploaderError)
    })
    
    it('应该拒绝不允许的文件类型', () => {
      fileManager = new FileManager({
        allowedFileTypes: ['image/*', '.pdf'],
      })
      
      const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' })
      
      expect(() => {
        fileManager.addFiles([mockFile])
      }).toThrow(UploaderError)
    })
    
    it('应该接受允许的文件类型', () => {
      fileManager = new FileManager({
        allowedFileTypes: ['image/*', 'application/pdf', 'text/plain']
      })
      
      const mockFile1 = new File(['image'], 'test.jpg', { type: 'image/jpeg' })
      const mockFile2 = new File(['pdf'], 'test.pdf', { type: 'application/pdf' })
      const mockFile3 = new File(['text'], 'test.txt', { type: 'text/plain' })
      
      const addedFiles = fileManager.addFiles([mockFile1, mockFile2, mockFile3])
      
      expect(addedFiles).toHaveLength(3)
    })
  })
  
  describe('getNextFile', () => {
    it('应该按FIFO顺序返回文件', () => {
      const file1 = new File(['1'], '1.txt')
      const file2 = new File(['2'], '2.txt')
      
      fileManager.addFiles([file1, file2])
      
      const next1 = fileManager.getNextFile()
      expect(next1?.fileName).toBe('1.txt')
      
      const next2 = fileManager.getNextFile()
      expect(next2?.fileName).toBe('2.txt')
      
      const next3 = fileManager.getNextFile()
      expect(next3).toBeUndefined()
    })
  })
  
  describe('文件状态管理', () => {
    it('应该正确更新文件状态', () => {
      const mockFile = new File(['test'], 'test.txt')
      const [fileInfo] = fileManager.addFiles([mockFile])
      
      fileManager.addToActive(fileInfo)
      fileManager.updateFileStatus(fileInfo.fileId, UploadStepEnum.upload)
      
      const activeFile = fileManager.getActiveFile(fileInfo.fileId)
      expect(activeFile?.status).toBe(UploadStepEnum.upload)
    })
    
    it('应该正确更新文件进度', () => {
      const mockFile = new File(['test'], 'test.txt')
      const [fileInfo] = fileManager.addFiles([mockFile])
      
      fileManager.addToActive(fileInfo)
      fileManager.updateFileProgress(fileInfo.fileId, 50)
      
      const activeFile = fileManager.getActiveFile(fileInfo.fileId)
      expect(activeFile?.uploadedSize).toBe(50)
      expect(activeFile?.progress).toBe(Math.round((50 / 4) * 100))
    })
  })
  
  describe('getStats', () => {
    it('应该返回正确的统计信息', () => {
      const files = [
        new File(['1'], '1.txt'),
        new File(['2'], '2.txt'),
        new File(['3'], '3.txt')
      ]
      
      const addedFiles = fileManager.addFiles(files)
      
      // 初始状态
      let stats = fileManager.getStats()
      expect(stats.queued).toBe(3)
      expect(stats.active).toBe(0)
      expect(stats.completed).toBe(0)
      
      // 激活一个文件
      const file1 = fileManager.getNextFile()!
      fileManager.addToActive(file1)
      
      stats = fileManager.getStats()
      expect(stats.queued).toBe(2)
      expect(stats.active).toBe(1)
      
      // 完成一个文件
      fileManager.updateFileStatus(file1.fileId, UploadStepEnum.complete)
      
      stats = fileManager.getStats()
      expect(stats.queued).toBe(2)
      expect(stats.active).toBe(1)
      expect(stats.completed).toBe(1)
    })
  })
}) 