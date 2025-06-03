import { FileInfo, ChunkInfo, UploadStepEnum } from '../type'

/**
 * 持久化的文件信息（不包含File对象）
 */
interface PersistedFileInfo {
  fileId: string
  fileName: string
  fileSize: number
  uploadedSize: number
  progress: number
  status: UploadStepEnum
  mimeType?: string
  lastUpdated?: number
  totalChunks?: number
  uploadInfo?: {
    parts?: Array<{
      etag: string
      partNumber: number
      partSize: number
    }>
    md5?: string
    [key: string]: any
  }
}

/**
 * 队列持久化管理器
 * 将上传队列状态保存到localStorage，支持浏览器刷新后恢复
 */
export class QueuePersistence {
  private enabled: boolean = false
  private storageKey: string = 'parallel-uploader-queue'
  private chunkStorageKey: string = 'parallel-uploader-chunks'

  constructor(enabled: boolean = false, storageKey?: string) {
    this.enabled = enabled
    if (storageKey) {
      this.storageKey = storageKey
      this.chunkStorageKey = `${storageKey}-chunks`
    }
  }

  /**
   * 启用/禁用持久化
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) {
      this.clearAll()
    }
  }

  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * 检查localStorage是否可用
   */
  private isStorageAvailable(): boolean {
    if (!this.enabled) return false
    
    try {
      const testKey = '__storage_test__'
      localStorage.setItem(testKey, 'test')
      localStorage.removeItem(testKey)
      return true
    } catch (e) {
      return false
    }
  }

  /**
   * 保存文件队列状态
   */
  saveQueue(files: FileInfo[]): void {
    if (!this.isStorageAvailable()) return

    try {
      const persistedFiles: PersistedFileInfo[] = files.map(file => ({
        fileId: file.fileId,
        fileName: file.fileName,
        fileSize: file.fileSize,
        uploadedSize: file.uploadedSize,
        progress: file.progress,
        status: file.status,
        mimeType: file.mimeType,
        lastUpdated: file.lastUpdated,
        totalChunks: file.totalChunks,
        uploadInfo: file.uploadInfo
      }))

      localStorage.setItem(this.storageKey, JSON.stringify(persistedFiles))
    } catch (error) {
      console.warn('Failed to save queue to localStorage:', error)
    }
  }

  /**
   * 保存分片状态
   */
  saveChunkStatus(fileId: string, uploadedChunks: Set<number>, pendingChunks: Set<number>): void {
    if (!this.isStorageAvailable()) return

    try {
      const chunkStatus = {
        uploaded: Array.from(uploadedChunks),
        pending: Array.from(pendingChunks),
        timestamp: Date.now()
      }

      const allChunkStatus = this.loadAllChunkStatus()
      allChunkStatus[fileId] = chunkStatus
      
      localStorage.setItem(this.chunkStorageKey, JSON.stringify(allChunkStatus))
    } catch (error) {
      console.warn('Failed to save chunk status to localStorage:', error)
    }
  }

  /**
   * 加载文件队列状态
   */
  loadQueue(): PersistedFileInfo[] {
    if (!this.isStorageAvailable()) return []

    try {
      const stored = localStorage.getItem(this.storageKey)
      if (!stored) return []

      const parsed = JSON.parse(stored)
      if (!Array.isArray(parsed)) return []

      // 过滤掉过期的记录（超过24小时）
      const now = Date.now()
      const maxAge = 24 * 60 * 60 * 1000 // 24小时
      
      return parsed.filter((file: PersistedFileInfo) => {
        if (!file.lastUpdated) return false
        return (now - file.lastUpdated) <= maxAge
      })
    } catch (error) {
      console.warn('Failed to load queue from localStorage:', error)
      return []
    }
  }

  /**
   * 加载分片状态
   */
  loadChunkStatus(fileId: string): {
    uploaded: number[]
    pending: number[]
  } | null {
    if (!this.isStorageAvailable()) return null

    try {
      const allChunkStatus = this.loadAllChunkStatus()
      const chunkStatus = allChunkStatus[fileId]
      
      if (!chunkStatus) return null

      // 检查是否过期（超过24小时）
      const now = Date.now()
      const maxAge = 24 * 60 * 60 * 1000
      if (chunkStatus.timestamp && (now - chunkStatus.timestamp) > maxAge) {
        this.removeChunkStatus(fileId)
        return null
      }

      return {
        uploaded: chunkStatus.uploaded || [],
        pending: chunkStatus.pending || []
      }
    } catch (error) {
      console.warn('Failed to load chunk status from localStorage:', error)
      return null
    }
  }

  /**
   * 加载所有分片状态
   */
  private loadAllChunkStatus(): Record<string, any> {
    try {
      const stored = localStorage.getItem(this.chunkStorageKey)
      if (!stored) return {}
      
      const parsed = JSON.parse(stored)
      return typeof parsed === 'object' && parsed !== null ? parsed : {}
    } catch (error) {
      return {}
    }
  }

  /**
   * 移除指定文件的记录
   */
  removeFile(fileId: string): void {
    if (!this.isStorageAvailable()) return

    try {
      // 移除队列中的文件
      const queue = this.loadQueue()
      const filteredQueue = queue.filter(file => file.fileId !== fileId)
      localStorage.setItem(this.storageKey, JSON.stringify(filteredQueue))

      // 移除分片状态
      this.removeChunkStatus(fileId)
    } catch (error) {
      console.warn('Failed to remove file from localStorage:', error)
    }
  }

  /**
   * 移除分片状态
   */
  private removeChunkStatus(fileId: string): void {
    try {
      const allChunkStatus = this.loadAllChunkStatus()
      delete allChunkStatus[fileId]
      localStorage.setItem(this.chunkStorageKey, JSON.stringify(allChunkStatus))
    } catch (error) {
      console.warn('Failed to remove chunk status from localStorage:', error)
    }
  }

  /**
   * 清除所有持久化数据
   */
  clearAll(): void {
    if (!this.isStorageAvailable()) return

    try {
      localStorage.removeItem(this.storageKey)
      localStorage.removeItem(this.chunkStorageKey)
    } catch (error) {
      console.warn('Failed to clear localStorage:', error)
    }
  }

  /**
   * 清理过期数据
   */
  cleanupExpiredData(): void {
    if (!this.isStorageAvailable()) return

    try {
      // 清理过期的队列数据
      const queue = this.loadQueue() // loadQueue 已经过滤了过期数据
      localStorage.setItem(this.storageKey, JSON.stringify(queue))

      // 清理过期的分片数据
      const allChunkStatus = this.loadAllChunkStatus()
      const now = Date.now()
      const maxAge = 24 * 60 * 60 * 1000

      const cleanedChunkStatus: Record<string, any> = {}
      for (const [fileId, status] of Object.entries(allChunkStatus)) {
        if (status.timestamp && (now - status.timestamp) <= maxAge) {
          cleanedChunkStatus[fileId] = status
        }
      }

      localStorage.setItem(this.chunkStorageKey, JSON.stringify(cleanedChunkStatus))
    } catch (error) {
      console.warn('Failed to cleanup expired data:', error)
    }
  }

  /**
   * 获取存储使用情况
   */
  getStorageInfo(): {
    queueSize: number
    chunkSize: number
    totalSize: number
    estimatedQuota: number
  } {
    if (!this.isStorageAvailable()) {
      return { queueSize: 0, chunkSize: 0, totalSize: 0, estimatedQuota: 0 }
    }

    try {
      const queueData = localStorage.getItem(this.storageKey) || ''
      const chunkData = localStorage.getItem(this.chunkStorageKey) || ''
      
      const queueSize = new Blob([queueData]).size
      const chunkSize = new Blob([chunkData]).size
      
      // 估算localStorage总使用量
      let totalSize = 0
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key) {
          const value = localStorage.getItem(key) || ''
          totalSize += new Blob([key + value]).size
        }
      }

      // 估算localStorage配额（通常为5-10MB）
      const estimatedQuota = 5 * 1024 * 1024 // 5MB

      return {
        queueSize,
        chunkSize,
        totalSize,
        estimatedQuota
      }
    } catch (error) {
      return { queueSize: 0, chunkSize: 0, totalSize: 0, estimatedQuota: 0 }
    }
  }
} 