import { ChunkInfo, FileInfo, FilePartInfo, ChunkStatusEnum } from '../type'

/**
 * 分片管理器
 * 负责分片队列管理、断点续传、分片状态管理等
 */
export class ChunkManager {
  private chunkQueue: Map<string, ChunkInfo[]> = new Map()
  private uploadedChunks: Map<string, Set<number>> = new Map()
  private pendingChunks: Map<string, Set<number>> = new Map()
  private chunkSize: number

  constructor(chunkSize: number = 1024 * 1024 * 5) {
    this.chunkSize = chunkSize
  }

  /**
   * 准备分片队列
   */
  prepareChunkQueue(fileInfo: FileInfo): void {
    const { fileId, fileSize } = fileInfo
    const totalChunks = Math.ceil(fileSize / this.chunkSize)
    const chunks: ChunkInfo[] = []

    // 创建已上传分片集合
    this.uploadedChunks.set(fileId, new Set())
    this.pendingChunks.set(fileId, new Set())

    for (let i = 0; i < totalChunks; i++) {
      const partNumber = i + 1
      const start = i * this.chunkSize
      const end = i === totalChunks - 1 ? fileSize : start + this.chunkSize
      const currentChunkSize = end - start

      chunks.push({
        partNumber,
        start,
        end,
        partSize: currentChunkSize,
        status: ChunkStatusEnum.waiting,
        retryCount: 0,
      })
    }

    // 确保分片按partNumber排序
    chunks.sort((a, b) => a.partNumber - b.partNumber)
    this.chunkQueue.set(fileId, chunks)

    // 更新文件信息中的分片总数
    fileInfo.totalChunks = totalChunks
  }

  /**
   * 获取下一个待上传的分片
   */
  getNextChunk(fileId: string): ChunkInfo | undefined {
    const chunks = this.chunkQueue.get(fileId) || []
    return chunks.shift()
  }

  /**
   * 获取待上传分片数量
   */
  getRemainingChunkCount(fileId: string): number {
    const chunks = this.chunkQueue.get(fileId) || []
    return chunks.length
  }

  /**
   * 获取待处理分片数量
   */
  getPendingChunkCount(fileId: string): number {
    const pendingChunks = this.pendingChunks.get(fileId) || new Set()
    return pendingChunks.size
  }

  /**
   * 添加分片到待处理集合
   */
  addToPending(fileId: string, partNumber: number): void {
    const pendingChunks = this.pendingChunks.get(fileId) || new Set()
    pendingChunks.add(partNumber)
    this.pendingChunks.set(fileId, pendingChunks)
  }

  /**
   * 从待处理集合移除分片
   */
  removeFromPending(fileId: string, partNumber: number): void {
    const pendingChunks = this.pendingChunks.get(fileId)
    if (pendingChunks) {
      pendingChunks.delete(partNumber)
    }
  }

  /**
   * 标记分片为已完成
   */
  markChunkCompleted(fileId: string, partNumber: number): void {
    const uploadedChunks = this.uploadedChunks.get(fileId) || new Set()
    uploadedChunks.add(partNumber)
    this.uploadedChunks.set(fileId, uploadedChunks)
    
    this.removeFromPending(fileId, partNumber)
  }

  /**
   * 重新加入分片到队列（用于重试）
   */
  requeueChunk(fileId: string, chunkInfo: ChunkInfo): void {
    const chunks = this.chunkQueue.get(fileId) || []
    chunkInfo.retryCount = (chunkInfo.retryCount || 0) + 1
    chunks.unshift(chunkInfo)
    this.chunkQueue.set(fileId, chunks)
    
    this.removeFromPending(fileId, chunkInfo.partNumber)
  }

  /**
   * 计算已上传大小
   */
  calculateUploadedSize(fileInfo: FileInfo): number {
    const { fileId, fileSize } = fileInfo
    const uploadedChunks = this.uploadedChunks.get(fileId)
    
    if (!uploadedChunks) return 0

    let uploadedSize = 0
    for (const partNumber of uploadedChunks) {
      // 计算分片大小
      const start = (partNumber - 1) * this.chunkSize
      const end = Math.min(start + this.chunkSize, fileSize)
      uploadedSize += end - start
    }

    return uploadedSize
  }

  /**
   * 从已上传的分片恢复上传
   */
  resumeFromExistingParts(fileInfo: FileInfo, existingParts: FilePartInfo[]): void {
    const { fileId } = fileInfo
    const uploadedChunks = this.uploadedChunks.get(fileId)

    // 验证分片数据的有效性
    const hasInvalidPartSize = existingParts.some((part) => !part.partSize || part.partSize === 0)
    const hasAllSameEtag =
      new Set(existingParts.map((part) => part.etag)).size === 1 && existingParts.length > 1

    // 如果存在无效的分片数据，则不恢复
    if (hasInvalidPartSize || hasAllSameEtag) {
      console.warn('检测到无效分片数据，将重新上传所有分片', {
        hasInvalidPartSize,
        hasAllSameEtag,
        parts: existingParts,
      })
      return
    }

    if (uploadedChunks) {
      // 标记已上传的分片
      for (const part of existingParts) {
        uploadedChunks.add(part.partNumber)

        // 从队列中移除已上传的分片
        const chunks = this.chunkQueue.get(fileId) || []
        const index = chunks.findIndex((c) => c.partNumber === part.partNumber)
        if (index !== -1) {
          chunks.splice(index, 1)
        }
      }
    }
  }

  /**
   * 检查是否所有分片都已完成
   */
  isAllChunksCompleted(fileId: string): boolean {
    const chunks = this.chunkQueue.get(fileId) || []
    const pendingChunks = this.pendingChunks.get(fileId) || new Set()
    
    return chunks.length === 0 && pendingChunks.size === 0
  }

  /**
   * 清理文件相关的分片数据
   */
  cleanup(fileId: string): void {
    this.chunkQueue.delete(fileId)
    this.uploadedChunks.delete(fileId)
    this.pendingChunks.delete(fileId)
  }

  /**
   * 获取分片统计信息
   */
  getChunkStats(fileId: string): {
    total: number
    completed: number
    pending: number
    remaining: number
  } {
    const chunks = this.chunkQueue.get(fileId) || []
    const uploadedChunks = this.uploadedChunks.get(fileId) || new Set()
    const pendingChunks = this.pendingChunks.get(fileId) || new Set()
    
    // 总分片数需要从文件信息中获取，这里只能估算
    const total = chunks.length + uploadedChunks.size + pendingChunks.size
    
    return {
      total,
      completed: uploadedChunks.size,
      pending: pendingChunks.size,
      remaining: chunks.length,
    }
  }
} 