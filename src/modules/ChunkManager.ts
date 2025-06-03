import { ChunkInfo, FileInfo, ChunkStatusEnum, FilePartInfo } from '../type'

/**
 * 分片管理器
 * 负责文件分片的创建、管理和状态跟踪
 */
export class ChunkManager {
  /** 每个文件的分片队列 */
  private chunkQueue: Map<string, ChunkInfo[]> = new Map()
  /** 已上传成功的分片集合 */
  private uploadedChunks: Map<string, Set<number>> = new Map()
  /** 正在上传中的分片集合 */
  private pendingChunks: Map<string, Set<number>> = new Map()
  
  /** 分片大小（字节） */
  private chunkSize: number
  
  constructor(chunkSize: number) {
    this.chunkSize = chunkSize
  }
  
  /**
   * 创建文件的分片队列
   */
  createChunks(fileInfo: FileInfo): ChunkInfo[] {
    const { fileId, fileSize } = fileInfo
    const totalChunks = Math.ceil(fileSize / this.chunkSize)
    
    const chunks: ChunkInfo[] = []
    
    // 初始化集合
    this.uploadedChunks.set(fileId, new Set())
    this.pendingChunks.set(fileId, new Set())
    
    for (let i = 0; i < totalChunks; i++) {
      const partNumber = i + 1
      const start = i * this.chunkSize
      const end = i === totalChunks - 1 ? fileSize : start + this.chunkSize
      const partSize = end - start
      
      chunks.push({
        partNumber,
        start,
        end,
        partSize,
        status: ChunkStatusEnum.waiting,
        retryCount: 0,
      })
    }
    
    // 按partNumber排序
    chunks.sort((a, b) => a.partNumber - b.partNumber)
    
    // 保存分片队列
    this.chunkQueue.set(fileId, chunks)
    
    // 更新文件信息中的分片总数
    fileInfo.totalChunks = totalChunks
    
    return chunks
  }
  
  /**
   * 恢复已上传的分片（断点续传）
   */
  resumeFromExistingParts(fileInfo: FileInfo, existingParts: FilePartInfo[]): void {
    const { fileId } = fileInfo
    const chunks = this.chunkQueue.get(fileId)
    if (!chunks) return
    
    const uploadedSet = this.uploadedChunks.get(fileId) || new Set()
    let uploadedSize = 0
    
    // 标记已上传的分片
    existingParts.forEach(part => {
      const chunk = chunks.find(c => c.partNumber === part.partNumber)
      if (chunk) {
        chunk.status = ChunkStatusEnum.success
        uploadedSet.add(part.partNumber)
        uploadedSize += part.partSize || 0
      }
    })
    
    // 更新文件信息
    fileInfo.uploadedSize = uploadedSize
    fileInfo.progress = Math.round((uploadedSize / fileInfo.fileSize) * 100)
    
    // 移除已上传的分片
    const remainingChunks = chunks.filter(
      chunk => chunk.status !== ChunkStatusEnum.success
    )
    this.chunkQueue.set(fileId, remainingChunks)
  }
  
  /**
   * 获取下一批待上传的分片
   */
  getNextChunks(fileId: string, count: number): ChunkInfo[] {
    const chunks = this.chunkQueue.get(fileId) || []
    const pendingSet = this.pendingChunks.get(fileId) || new Set()
    
    const nextChunks: ChunkInfo[] = []
    
    for (const chunk of chunks) {
      if (nextChunks.length >= count) break
      if (!pendingSet.has(chunk.partNumber)) {
        nextChunks.push(chunk)
      }
    }
    
    return nextChunks
  }
  
  /**
   * 标记分片开始上传
   */
  markChunkPending(fileId: string, partNumber: number): void {
    const pendingSet = this.pendingChunks.get(fileId) || new Set()
    pendingSet.add(partNumber)
    
    const chunks = this.chunkQueue.get(fileId)
    if (chunks) {
      const chunk = chunks.find(c => c.partNumber === partNumber)
      if (chunk) {
        chunk.status = ChunkStatusEnum.uploading
        chunk.uploadTime = Date.now()
      }
    }
  }
  
  /**
   * 标记分片上传成功
   */
  markChunkSuccess(fileId: string, partNumber: number): void {
    // 从待处理集合中移除
    const pendingSet = this.pendingChunks.get(fileId)
    if (pendingSet) {
      pendingSet.delete(partNumber)
    }
    
    // 添加到已上传集合
    const uploadedSet = this.uploadedChunks.get(fileId) || new Set()
    uploadedSet.add(partNumber)
    
    // 从队列中移除
    const chunks = this.chunkQueue.get(fileId)
    if (chunks) {
      const index = chunks.findIndex(c => c.partNumber === partNumber)
      if (index >= 0) {
        chunks.splice(index, 1)
      }
    }
  }
  
  /**
   * 标记分片上传失败
   */
  markChunkError(fileId: string, partNumber: number): void {
    const pendingSet = this.pendingChunks.get(fileId)
    if (pendingSet) {
      pendingSet.delete(partNumber)
    }
    
    const chunks = this.chunkQueue.get(fileId)
    if (chunks) {
      const chunk = chunks.find(c => c.partNumber === partNumber)
      if (chunk) {
        chunk.status = ChunkStatusEnum.error
        chunk.retryCount = (chunk.retryCount || 0) + 1
      }
    }
  }
  
  /**
   * 获取分片队列长度
   */
  getQueueLength(fileId: string): number {
    const chunks = this.chunkQueue.get(fileId)
    return chunks ? chunks.length : 0
  }
  
  /**
   * 获取待处理分片数量
   */
  getPendingCount(fileId: string): number {
    const pendingSet = this.pendingChunks.get(fileId)
    return pendingSet ? pendingSet.size : 0
  }
  
  /**
   * 获取已上传分片数量
   */
  getUploadedCount(fileId: string): number {
    const uploadedSet = this.uploadedChunks.get(fileId)
    return uploadedSet ? uploadedSet.size : 0
  }
  
  /**
   * 检查是否所有分片都已完成
   */
  isAllChunksCompleted(fileId: string): boolean {
    const queueLength = this.getQueueLength(fileId)
    const pendingCount = this.getPendingCount(fileId)
    return queueLength === 0 && pendingCount === 0
  }
  
  /**
   * 清理文件的分片数据
   */
  cleanupFile(fileId: string): void {
    this.chunkQueue.delete(fileId)
    this.uploadedChunks.delete(fileId)
    this.pendingChunks.delete(fileId)
  }
  
  /**
   * 清理所有分片数据
   */
  cleanupAll(): void {
    this.chunkQueue.clear()
    this.uploadedChunks.clear()
    this.pendingChunks.clear()
  }
} 