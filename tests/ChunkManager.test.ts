import { ChunkManager } from '../src/modules/ChunkManager'
import { FileInfo, ChunkStatusEnum, UploadStepEnum } from '../src/type'

describe('ChunkManager', () => {
  let chunkManager: ChunkManager
  const chunkSize = 1024 * 1024 // 1MB
  
  beforeEach(() => {
    chunkManager = new ChunkManager(chunkSize)
  })
  
  const createMockFileInfo = (size: number): FileInfo => ({
    fileId: 'test-file-id',
    fileName: 'test.txt',
    fileSize: size,
    uploadedSize: 0,
    progress: 0,
    status: UploadStepEnum.beforeUpload,
    file: new File([''], 'test.txt')
  })
  
  describe('prepareChunkQueue', () => {
    it('应该正确创建文件分片', () => {
      const fileInfo = createMockFileInfo(chunkSize * 2.5) // 2.5MB文件
      chunkManager.prepareChunkQueue(fileInfo)
      
      expect(fileInfo.totalChunks).toBe(3)
      
      // 检查分片队列
      expect(chunkManager.getRemainingChunkCount(fileInfo.fileId)).toBe(3)
      
      // 获取第一个分片检查
      const firstChunk = chunkManager.getNextChunk(fileInfo.fileId)
      expect(firstChunk?.partNumber).toBe(1)
      expect(firstChunk?.start).toBe(0)
      expect(firstChunk?.end).toBe(chunkSize)
      expect(firstChunk?.partSize).toBe(chunkSize)
    })
    
    it('应该处理小于分片大小的文件', () => {
      const fileInfo = createMockFileInfo(500 * 1024) // 500KB文件
      chunkManager.prepareChunkQueue(fileInfo)
      
      expect(fileInfo.totalChunks).toBe(1)
      expect(chunkManager.getRemainingChunkCount(fileInfo.fileId)).toBe(1)
      
      const chunk = chunkManager.getNextChunk(fileInfo.fileId)
      expect(chunk?.partSize).toBe(fileInfo.fileSize)
    })
  })
  
  describe('resumeFromExistingParts', () => {
    it('应该正确恢复已上传的分片', () => {
      const fileInfo = createMockFileInfo(chunkSize * 3)
      chunkManager.prepareChunkQueue(fileInfo)
      
      const existingParts = [
        { partNumber: 1, etag: 'etag1', partSize: chunkSize },
        { partNumber: 3, etag: 'etag3', partSize: chunkSize }
      ]
      
      chunkManager.resumeFromExistingParts(fileInfo, existingParts)
      
      const uploadedSize = chunkManager.calculateUploadedSize(fileInfo)
      expect(uploadedSize).toBe(chunkSize * 2)
      expect(chunkManager.getRemainingChunkCount(fileInfo.fileId)).toBe(1) // 只剩第2个分片
    })
  })
  
  describe('分片状态管理', () => {
    let fileInfo: FileInfo
    
    beforeEach(() => {
      fileInfo = createMockFileInfo(chunkSize * 3)
      chunkManager.prepareChunkQueue(fileInfo)
    })
    
    it('应该正确标记分片为待处理状态', () => {
      chunkManager.addToPending(fileInfo.fileId, 1)
      expect(chunkManager.getPendingChunkCount(fileInfo.fileId)).toBe(1)
    })
    
    it('应该正确标记分片上传成功', () => {
      chunkManager.addToPending(fileInfo.fileId, 1)
      chunkManager.markChunkCompleted(fileInfo.fileId, 1)
      
      expect(chunkManager.getPendingChunkCount(fileInfo.fileId)).toBe(0)
      const uploadedSize = chunkManager.calculateUploadedSize(fileInfo)
      expect(uploadedSize).toBe(chunkSize)
    })
    
    it('应该正确处理分片重试', () => {
      const chunk = chunkManager.getNextChunk(fileInfo.fileId)!
      chunkManager.addToPending(fileInfo.fileId, chunk.partNumber)
      
      // 标记为失败并重新加入队列
      chunkManager.requeueChunk(fileInfo.fileId, chunk)
      
      expect(chunkManager.getPendingChunkCount(fileInfo.fileId)).toBe(0)
      expect(chunkManager.getRemainingChunkCount(fileInfo.fileId)).toBe(3) // 重新加入队列
      
      const requeuedChunk = chunkManager.getNextChunk(fileInfo.fileId)
      expect(requeuedChunk?.partNumber).toBe(1)
      expect(requeuedChunk?.retryCount).toBe(1)
    })
  })
  
  describe('getNextChunk', () => {
    it('应该按顺序返回待上传的分片', () => {
      const fileInfo = createMockFileInfo(chunkSize * 5)
      chunkManager.prepareChunkQueue(fileInfo)
      
      const chunk1 = chunkManager.getNextChunk(fileInfo.fileId)
      const chunk2 = chunkManager.getNextChunk(fileInfo.fileId)
      const chunk3 = chunkManager.getNextChunk(fileInfo.fileId)
      
      expect(chunk1?.partNumber).toBe(1)
      expect(chunk2?.partNumber).toBe(2)
      expect(chunk3?.partNumber).toBe(3)
    })
    
    it('应该正确处理队列耗尽', () => {
      const fileInfo = createMockFileInfo(chunkSize)
      chunkManager.prepareChunkQueue(fileInfo)
      
      const chunk1 = chunkManager.getNextChunk(fileInfo.fileId)
      expect(chunk1?.partNumber).toBe(1)
      
      const chunk2 = chunkManager.getNextChunk(fileInfo.fileId)
      expect(chunk2).toBeUndefined()
    })
  })
  
  describe('isAllChunksCompleted', () => {
    it('应该正确判断所有分片是否完成', () => {
      const fileInfo = createMockFileInfo(chunkSize * 2)
      chunkManager.prepareChunkQueue(fileInfo)
      
      expect(chunkManager.isAllChunksCompleted(fileInfo.fileId)).toBe(false)
      
      // 上传第一个分片
      const chunk1 = chunkManager.getNextChunk(fileInfo.fileId)!
      chunkManager.addToPending(fileInfo.fileId, chunk1.partNumber)
      chunkManager.markChunkCompleted(fileInfo.fileId, chunk1.partNumber)
      
      expect(chunkManager.isAllChunksCompleted(fileInfo.fileId)).toBe(false)
      
      // 上传第二个分片
      const chunk2 = chunkManager.getNextChunk(fileInfo.fileId)!
      chunkManager.addToPending(fileInfo.fileId, chunk2.partNumber)
      chunkManager.markChunkCompleted(fileInfo.fileId, chunk2.partNumber)
      
      expect(chunkManager.isAllChunksCompleted(fileInfo.fileId)).toBe(true)
    })
  })
  
  describe('cleanup', () => {
    it('应该清理所有分片数据', () => {
      const fileInfo = createMockFileInfo(chunkSize * 2)
      chunkManager.prepareChunkQueue(fileInfo)
      chunkManager.addToPending(fileInfo.fileId, 1)
      chunkManager.markChunkCompleted(fileInfo.fileId, 1)
      
      chunkManager.cleanup(fileInfo.fileId)
      
      expect(chunkManager.getRemainingChunkCount(fileInfo.fileId)).toBe(0)
      expect(chunkManager.getPendingChunkCount(fileInfo.fileId)).toBe(0)
      expect(chunkManager.calculateUploadedSize(fileInfo)).toBe(0)
    })
  })
}) 