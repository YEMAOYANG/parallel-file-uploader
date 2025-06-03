import { FileInfo, ChunkInfo, UploadStepEnum } from '../type'

export interface PersistentFileInfo {
  fileId: string
  fileName: string
  fileSize: number
  uploadedSize: number
  progress: number
  status: UploadStepEnum
  totalChunks?: number
  uploadedChunks?: number[]
  mimeType?: string
  lastUpdated?: number
}

export interface PersistentQueueData {
  version: string
  timestamp: number
  files: PersistentFileInfo[]
}

/**
 * 队列持久化管理器
 * 负责将上传队列保存到localStorage，支持断点续传
 */
export class QueuePersistence {
  private storageKey: string
  private version = '1.0.0'
  private enabled: boolean
  
  constructor(storageKey: string = 'parallel-uploader-queue', enabled: boolean = true) {
    this.storageKey = storageKey
    this.enabled = enabled
  }
  
  /**
   * 检查是否支持localStorage
   */
  private isStorageAvailable(): boolean {
    if (!this.enabled) return false
    
    try {
      const test = '__storage_test__'
      localStorage.setItem(test, test)
      localStorage.removeItem(test)
      return true
    } catch (e) {
      return false
    }
  }
  
  /**
   * 保存队列到localStorage
   */
  saveQueue(files: FileInfo[], uploadedChunks: Map<string, Set<number>>): boolean {
    if (!this.isStorageAvailable()) return false
    
    try {
      const persistentFiles: PersistentFileInfo[] = files.map(file => {
        const chunks = uploadedChunks.get(file.fileId)
        return {
          fileId: file.fileId,
          fileName: file.fileName,
          fileSize: file.fileSize,
          uploadedSize: file.uploadedSize,
          progress: file.progress,
          status: file.status,
          totalChunks: file.totalChunks,
          uploadedChunks: chunks ? Array.from(chunks) : [],
          mimeType: file.mimeType,
          lastUpdated: file.lastUpdated || Date.now()
        }
      })
      
      const data: PersistentQueueData = {
        version: this.version,
        timestamp: Date.now(),
        files: persistentFiles
      }
      
      localStorage.setItem(this.storageKey, JSON.stringify(data))
      return true
    } catch (error) {
      console.error('Failed to save queue:', error)
      return false
    }
  }
  
  /**
   * 从localStorage加载队列
   */
  loadQueue(): PersistentQueueData | null {
    if (!this.isStorageAvailable()) return null
    
    try {
      const data = localStorage.getItem(this.storageKey)
      if (!data) return null
      
      const queueData = JSON.parse(data) as PersistentQueueData
      
      // 检查版本兼容性
      if (queueData.version !== this.version) {
        console.warn('Queue version mismatch, clearing old data')
        this.clearQueue()
        return null
      }
      
      // 检查数据是否过期（超过7天）
      const maxAge = 7 * 24 * 60 * 60 * 1000  // 7天
      if (Date.now() - queueData.timestamp > maxAge) {
        console.warn('Queue data expired, clearing')
        this.clearQueue()
        return null
      }
      
      return queueData
    } catch (error) {
      console.error('Failed to load queue:', error)
      return null
    }
  }
  
  /**
   * 保存单个文件的状态
   */
  saveFileState(fileInfo: FileInfo, uploadedChunks?: Set<number>): boolean {
    if (!this.isStorageAvailable()) return false
    
    try {
      const key = `${this.storageKey}-file-${fileInfo.fileId}`
      const data = {
        fileInfo: {
          fileId: fileInfo.fileId,
          fileName: fileInfo.fileName,
          fileSize: fileInfo.fileSize,
          uploadedSize: fileInfo.uploadedSize,
          progress: fileInfo.progress,
          status: fileInfo.status,
          totalChunks: fileInfo.totalChunks,
          uploadedChunks: uploadedChunks ? Array.from(uploadedChunks) : [],
          mimeType: fileInfo.mimeType,
          lastUpdated: Date.now()
        },
        version: this.version,
        timestamp: Date.now()
      }
      
      localStorage.setItem(key, JSON.stringify(data))
      return true
    } catch (error) {
      console.error('Failed to save file state:', error)
      return false
    }
  }
  
  /**
   * 加载单个文件的状态
   */
  loadFileState(fileId: string): { fileInfo: PersistentFileInfo; uploadedChunks: number[] } | null {
    if (!this.isStorageAvailable()) return null
    
    try {
      const key = `${this.storageKey}-file-${fileId}`
      const data = localStorage.getItem(key)
      if (!data) return null
      
      const parsed = JSON.parse(data)
      
      // 检查版本和过期时间
      if (parsed.version !== this.version) return null
      
      const maxAge = 7 * 24 * 60 * 60 * 1000  // 7天
      if (Date.now() - parsed.timestamp > maxAge) {
        this.removeFileState(fileId)
        return null
      }
      
      return {
        fileInfo: parsed.fileInfo,
        uploadedChunks: parsed.fileInfo.uploadedChunks || []
      }
    } catch (error) {
      console.error('Failed to load file state:', error)
      return null
    }
  }
  
  /**
   * 删除单个文件的状态
   */
  removeFileState(fileId: string): boolean {
    if (!this.isStorageAvailable()) return false
    
    try {
      const key = `${this.storageKey}-file-${fileId}`
      localStorage.removeItem(key)
      return true
    } catch (error) {
      console.error('Failed to remove file state:', error)
      return false
    }
  }
  
  /**
   * 清空队列
   */
  clearQueue(): boolean {
    if (!this.isStorageAvailable()) return false
    
    try {
      // 清除主队列
      localStorage.removeItem(this.storageKey)
      
      // 清除所有文件状态
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(`${this.storageKey}-file-`)) {
          keysToRemove.push(key)
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key))
      return true
    } catch (error) {
      console.error('Failed to clear queue:', error)
      return false
    }
  }
  
  /**
   * 获取存储使用情况
   */
  getStorageInfo(): { used: number; available: number; percentage: number } | null {
    if (!this.isStorageAvailable()) return null
    
    try {
      // 估算已使用的存储空间
      let used = 0
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(this.storageKey)) {
          const value = localStorage.getItem(key)
          if (value) {
            used += key.length + value.length
          }
        }
      }
      
      // localStorage 通常有 5-10MB 的限制
      const totalSize = 5 * 1024 * 1024  // 假设 5MB
      const percentage = (used / totalSize) * 100
      
      return {
        used,
        available: totalSize - used,
        percentage
      }
    } catch (error) {
      console.error('Failed to get storage info:', error)
      return null
    }
  }
  
  /**
   * 启用/禁用持久化
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }
  
  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    return this.enabled && this.isStorageAvailable()
  }
} 