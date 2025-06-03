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
  
  describe('createChunks', () => {
    it('应该正确创建文件分片', () => {
      const fileInfo = createMockFileInfo(chunkSize * 2.5) // 2.5MB文件
      const chunks = chunkManager.createChunks(fileInfo)
      
      expect(chunks).toHaveLength(3)
      expect(fileInfo.totalChunks).toBe(3)
      
      // 检查第一个分片
      expect(chunks[0].partNumber).toBe(1)
      expect(chunks[0].start).toBe(0)
      expect(chunks[0].end).toBe(chunkSize)
      expect(chunks[0].partSize).toBe(chunkSize)
      
      // 检查最后一个分片
      expect(chunks[2].partNumber).toBe(3)
      expect(chunks[2].start).toBe(chunkSize * 2)
      expect(chunks[2].end).toBe(fileInfo.fileSize)
      expect(chunks[2].partSize).toBe(fileInfo.fileSize - chunkSize * 2)
    })
    
    it('应该处理小于分片大小的文件', () => {
      const fileInfo = createMockFileInfo(500 * 1024) // 500KB文件
      const chunks = chunkManager.createChunks(fileInfo)
      
      expect(chunks).toHaveLength(1)
      expect(chunks[0].partSize).toBe(fileInfo.fileSize)
    })
  })
  
  describe('resumeFromExistingParts', () => {
    it('应该正确恢复已上传的分片', () => {
      const fileInfo = createMockFileInfo(chunkSize * 3)
      chunkManager.createChunks(fileInfo)
      
      const existingParts = [
        { partNumber: 1, etag: 'etag1', partSize: chunkSize },
        { partNumber: 3, etag: 'etag3', partSize: chunkSize }
      ]
      
      chunkManager.resumeFromExistingParts(fileInfo, existingParts)
      
      expect(fileInfo.uploadedSize).toBe(chunkSize * 2)
      expect(fileInfo.progress).toBe(67) // 约66.67%
      expect(chunkManager.getUploadedCount(fileInfo.fileId)).toBe(2)
      expect(chunkManager.getQueueLength(fileInfo.fileId)).toBe(1) // 只剩第2个分片
    })
  })
  
  describe('分片状态管理', () => {
    let fileInfo: FileInfo
    
    beforeEach(() => {
      fileInfo = createMockFileInfo(chunkSize * 3)
      chunkManager.createChunks(fileInfo)
    })
    
    it('应该正确标记分片为待处理状态', () => {
      chunkManager.markChunkPending(fileInfo.fileId, 1)
      expect(chunkManager.getPendingCount(fileInfo.fileId)).toBe(1)
    })
    
    it('应该正确标记分片上传成功', () => {
      chunkManager.markChunkPending(fileInfo.fileId, 1)
      chunkManager.markChunkSuccess(fileInfo.fileId, 1)
      
      expect(chunkManager.getPendingCount(fileInfo.fileId)).toBe(0)
      expect(chunkManager.getUploadedCount(fileInfo.fileId)).toBe(1)
      expect(chunkManager.getQueueLength(fileInfo.fileId)).toBe(2)
    })
    
    it('应该正确标记分片上传失败', () => {
      chunkManager.markChunkPending(fileInfo.fileId, 1)
      chunkManager.markChunkError(fileInfo.fileId, 1)
      
      expect(chunkManager.getPendingCount(fileInfo.fileId)).toBe(0)
      
      const chunks = chunkManager.getNextChunks(fileInfo.fileId, 3)
      const errorChunk = chunks.find(c => c.partNumber === 1)
      expect(errorChunk?.status).toBe(ChunkStatusEnum.error)
      expect(errorChunk?.retryCount).toBe(1)
    })
  })
  
  describe('getNextChunks', () => {
    it('应该按顺序返回待上传的分片', () => {
      const fileInfo = createMockFileInfo(chunkSize * 5)
      chunkManager.createChunks(fileInfo)
      
      const chunks = chunkManager.getNextChunks(fileInfo.fileId, 3)
      
      expect(chunks).toHaveLength(3)
      expect(chunks[0].partNumber).toBe(1)
      expect(chunks[1].partNumber).toBe(2)
      expect(chunks[2].partNumber).toBe(3)
    })
    
    it('应该跳过已标记为待处理的分片', () => {
      const fileInfo = createMockFileInfo(chunkSize * 5)
      chunkManager.createChunks(fileInfo)
      
      chunkManager.markChunkPending(fileInfo.fileId, 2)
      chunkManager.markChunkPending(fileInfo.fileId, 3)
      
      const chunks = chunkManager.getNextChunks(fileInfo.fileId, 3)
      
      expect(chunks).toHaveLength(3)
      expect(chunks[0].partNumber).toBe(1)
      expect(chunks[1].partNumber).toBe(4)
      expect(chunks[2].partNumber).toBe(5)
    })
  })
  
  describe('isAllChunksCompleted', () => {
    it('应该正确判断所有分片是否完成', () => {
      const fileInfo = createMockFileInfo(chunkSize * 2)
      chunkManager.createChunks(fileInfo)
      
      expect(chunkManager.isAllChunksCompleted(fileInfo.fileId)).toBe(false)
      
      chunkManager.markChunkPending(fileInfo.fileId, 1)
      chunkManager.markChunkSuccess(fileInfo.fileId, 1)
      
      expect(chunkManager.isAllChunksCompleted(fileInfo.fileId)).toBe(false)
      
      chunkManager.markChunkPending(fileInfo.fileId, 2)
      chunkManager.markChunkSuccess(fileInfo.fileId, 2)
      
      expect(chunkManager.isAllChunksCompleted(fileInfo.fileId)).toBe(true)
    })
  })
}) 