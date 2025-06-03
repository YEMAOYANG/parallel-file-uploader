import { FileInfo, ChunkInfo, ParallelFileUploaderOptions, ResGlobalInterface, UploadStepEnum, WorkerMessage, UploaderError, ErrorType, FilePartInfo } from '../type'
import { FileManager } from './FileManager'
import { ChunkManager } from './ChunkManager'
import { WorkerManager } from './WorkerManager'
import { SpeedLimiter } from './SpeedLimiter'
import { PerformanceMonitor } from './PerformanceMonitor'

/**
 * 上传管理器
 * 负责协调文件上传的核心逻辑
 */
export class UploadManager {
  private fileManager: FileManager
  private chunkManager: ChunkManager
  private workerManager: WorkerManager
  private speedLimiter: SpeedLimiter
  private performanceMonitor?: PerformanceMonitor
  
  // 配置
  private maxConcurrentFiles: number
  private maxConcurrentChunks: number
  private maxRetries: number
  private retryDelay: number
  
  // 服务器交互回调
  private sendFileInfoToServer?: (fileInfo: FileInfo) => Promise<ResGlobalInterface<any>>
  private sendFilePartToServer?: (fileInfo: FileInfo, chunkInfo: ChunkInfo) => Promise<ResGlobalInterface<any>>
  private sendFileCompleteToServer?: (fileInfo: FileInfo) => Promise<ResGlobalInterface<any>>
  private getFilePartsFromServer?: (fileInfo: FileInfo) => Promise<ResGlobalInterface<FilePartInfo[]>>
  
  // 事件回调
  private onFileProgress?: (fileInfo: FileInfo) => void
  private onFileSuccess?: (params: { fileInfo: FileInfo; data: any }) => void
  private onFileError?: (fileInfo: FileInfo, error: Error) => void
  private onFileComplete?: (params: { fileInfo: FileInfo; data: any }) => void
  private onAllComplete?: () => void
  
  // 上传控制
  private uploadControllers: Map<string, AbortController> = new Map()
  
  constructor(
    fileManager: FileManager,
    chunkManager: ChunkManager,
    workerManager: WorkerManager,
    speedLimiter: SpeedLimiter,
    performanceMonitor: PerformanceMonitor | undefined,
    options: ParallelFileUploaderOptions
  ) {
    this.fileManager = fileManager
    this.chunkManager = chunkManager
    this.workerManager = workerManager
    this.speedLimiter = speedLimiter
    this.performanceMonitor = performanceMonitor
    
    // 设置配置
    this.maxConcurrentFiles = options.maxConcurrentFiles || 3
    this.maxConcurrentChunks = options.maxConcurrentChunks || 3
    this.maxRetries = options.maxRetries || 3
    this.retryDelay = options.retryDelay || 1000
    
    // 设置回调
    this.sendFileInfoToServer = options.sendFileInfoToServer
    this.sendFilePartToServer = options.sendFilePartToServer
    this.sendFileCompleteToServer = options.sendFileCompleteToServer
    this.getFilePartsFromServer = options.getFilePartsFromServer
    
    this.onFileProgress = options.onFileProgress
    this.onFileSuccess = options.onFileSuccess
    this.onFileError = options.onFileError
    this.onFileComplete = options.onFileComplete
    this.onAllComplete = options.onAllComplete
    
    // 初始化Worker消息处理
    this.workerManager.initialize(this.handleWorkerMessage.bind(this))
  }
  
  /**
   * 开始处理文件队列
   */
  async processQueue(): Promise<void> {
    while (this.fileManager.getActiveFileCount() < this.maxConcurrentFiles) {
      const fileInfo = this.fileManager.getNextFile()
      if (!fileInfo) break
      
      this.fileManager.setFileActive(fileInfo)
      
      try {
        await this.uploadFile(fileInfo)
      } catch (error) {
        this.handleFileError(fileInfo, error instanceof Error ? error : new Error(String(error)))
      }
    }
    
    // 检查是否所有文件都已完成
    if (this.fileManager.getActiveFileCount() === 0 && this.fileManager.getStats().queued === 0) {
      if (this.onAllComplete) {
        this.onAllComplete()
      }
    }
  }
  
  /**
   * 上传单个文件
   */
  private async uploadFile(fileInfo: FileInfo): Promise<void> {
    try {
      // 初始化上传
      await this.initFileUpload(fileInfo)
      
      // 如果文件已标记为完成（如秒传），直接返回
      if (fileInfo.status === UploadStepEnum.complete) {
        return
      }
      
      // 开始上传分片
      this.processChunks(fileInfo.fileId)
    } catch (error) {
      throw error
    }
  }
  
  /**
   * 初始化文件上传
   */
  private async initFileUpload(fileInfo: FileInfo): Promise<void> {
    fileInfo.status = UploadStepEnum.beforeUpload
    
    // 记录文件开始上传
    if (this.performanceMonitor) {
      this.performanceMonitor.recordFileStart(fileInfo.fileId)
    }
    
    // 创建分片
    this.chunkManager.createChunks(fileInfo)
    
    // 调用服务器初始化接口
    if (this.sendFileInfoToServer) {
      const result = await this.sendFileInfoToServer(fileInfo)
      if (!result.isSuccess) {
        throw new UploaderError('Failed to initialize file upload', ErrorType.SERVER_ERROR, fileInfo)
      }
      
      // 检查是否秒传
      if (result.data && result.data.skipUpload) {
        fileInfo.status = UploadStepEnum.complete
        fileInfo.uploadData = result.data
        
        // 记录性能监控（秒传也算完成）
        if (this.performanceMonitor) {
          this.performanceMonitor.recordFileProgress(fileInfo.fileId, fileInfo.fileSize)
          this.performanceMonitor.recordFileComplete(fileInfo.fileId)
        }
        
        if (this.onFileSuccess) {
          this.onFileSuccess({ fileInfo, data: result.data })
        }
        if (this.onFileComplete) {
          this.onFileComplete({ fileInfo, data: result.data })
        }
        
        this.cleanup(fileInfo.fileId)
        return
      }
      
      // 检查断点续传
      if (this.getFilePartsFromServer) {
        try {
          const partsResult = await this.getFilePartsFromServer(fileInfo)
          if (partsResult.isSuccess && partsResult.data && partsResult.data.length > 0) {
            // 验证分片数据有效性
            const hasInvalidParts = partsResult.data.some(part => !part.partSize || part.partSize === 0)
            if (!hasInvalidParts) {
              this.chunkManager.resumeFromExistingParts(fileInfo, partsResult.data)
              this.updateFileProgress(fileInfo)
            }
          }
        } catch (error) {
          console.warn('Failed to get existing parts:', error)
        }
      }
    }
    
    fileInfo.status = UploadStepEnum.upload
  }
  
  /**
   * 处理文件的分片上传
   */
  private async processChunks(fileId: string): Promise<void> {
    const fileInfo = this.fileManager.getActiveFile(fileId)
    if (!fileInfo || fileInfo.status !== UploadStepEnum.upload) {
      return
    }
    
    // 检查是否所有分片都已完成
    if (this.chunkManager.isAllChunksCompleted(fileId)) {
      await this.completeFileUpload(fileInfo)
      return
    }
    
    // 计算可以开始的新分片数
    const pendingCount = this.chunkManager.getPendingCount(fileId)
    const availableSlots = this.maxConcurrentChunks - pendingCount
    
    if (availableSlots <= 0) return
    
    // 获取下一批分片
    const chunks = this.chunkManager.getNextChunks(fileId, availableSlots)
    
    // 上传分片
    for (const chunk of chunks) {
      this.chunkManager.markChunkPending(fileId, chunk.partNumber)
      this.uploadChunk(fileInfo, chunk)
    }
  }
  
  /**
   * 上传单个分片
   */
  private async uploadChunk(fileInfo: FileInfo, chunkInfo: ChunkInfo): Promise<void> {
    // 准备分片数据
    const blob = fileInfo.file.slice(chunkInfo.start, chunkInfo.end)
    chunkInfo.file = new File([blob], `${fileInfo.fileName}.part${chunkInfo.partNumber}`)
    
    // 检查是否使用Worker
    if (this.workerManager.isEnabled()) {
      const message: WorkerMessage = {
        type: 'upload',
        fileId: fileInfo.fileId,
        chunkInfo,
        chunk: blob
      }
      
      const workerSuccess = this.workerManager.postTask(message)
      if (!workerSuccess) {
        // Worker不可用或繁忙，尝试重试一次
        console.log('Worker busy, retrying...')
        const retrySuccess = this.workerManager.retryInitialize()
        if (retrySuccess && this.workerManager.postTask(message)) {
          return
        }
        
        // Worker彻底失败，直接上传
        console.log('Worker failed, falling back to direct upload')
        await this.uploadChunkDirect(fileInfo, chunkInfo)
      }
    } else {
      // 直接上传
      await this.uploadChunkDirect(fileInfo, chunkInfo)
    }
  }
  
  /**
   * 直接上传分片（不使用Worker）
   */
  private async uploadChunkDirect(fileInfo: FileInfo, chunkInfo: ChunkInfo): Promise<void> {
    try {
      // 速度限制
      if (this.speedLimiter.isEnabled() && chunkInfo.partSize) {
        const allowedBytes = await this.speedLimiter.requestBytes(chunkInfo.partSize)
        if (allowedBytes === 0) {
          // 被限制，稍后重试
          this.chunkManager.markChunkError(fileInfo.fileId, chunkInfo.partNumber)
          setTimeout(() => this.processChunks(fileInfo.fileId), 1000)
          return
        }
      }
      
      // 发送分片到服务器
      if (this.sendFilePartToServer) {
        const controller = new AbortController()
        this.uploadControllers.set(`${fileInfo.fileId}-${chunkInfo.partNumber}`, controller)
        
        const result = await this.sendFilePartToServer(fileInfo, chunkInfo)
        
        if (result.isSuccess) {
          this.handleChunkSuccess(fileInfo, chunkInfo, result.data)
        } else {
          throw new Error('Chunk upload failed')
        }
      }
    } catch (error) {
      this.handleChunkError(fileInfo, chunkInfo, error instanceof Error ? error : new Error(String(error)))
    } finally {
      this.uploadControllers.delete(`${fileInfo.fileId}-${chunkInfo.partNumber}`)
    }
  }
  
  /**
   * 处理Worker消息
   */
  private handleWorkerMessage(event: MessageEvent): void {
    const message = event.data as WorkerMessage
    
    if (!message.fileId || !message.chunkInfo) return
    
    const fileInfo = this.fileManager.getActiveFile(message.fileId)
    if (!fileInfo) return
    
    if (message.type === 'response' && message.result) {
      if (message.result.isSuccess) {
        this.handleChunkSuccess(fileInfo, message.chunkInfo, message.result.data)
      } else {
        this.handleChunkError(fileInfo, message.chunkInfo, new Error(message.result.message || 'Upload failed'))
      }
    } else if (message.type === 'error') {
      this.handleChunkError(fileInfo, message.chunkInfo, new Error(message.error || 'Unknown error'))
    }
  }
  
  /**
   * 处理分片上传成功
   */
  private handleChunkSuccess(fileInfo: FileInfo, chunkInfo: ChunkInfo, data: any): void {
    // 标记分片成功
    this.chunkManager.markChunkSuccess(fileInfo.fileId, chunkInfo.partNumber)
    
    // 更新上传信息
    if (!fileInfo.uploadInfo) {
      fileInfo.uploadInfo = { parts: [] }
    }
    if (!fileInfo.uploadInfo.parts) {
      fileInfo.uploadInfo.parts = []
    }
    
    fileInfo.uploadInfo.parts.push({
      partNumber: chunkInfo.partNumber,
      etag: data.etag || '',
      partSize: chunkInfo.partSize || 0,
      lastModified: Date.now()
    })
    
    // 更新进度
    fileInfo.uploadedSize += chunkInfo.partSize || 0
    this.updateFileProgress(fileInfo)
    
    // 继续处理下一批分片
    this.processChunks(fileInfo.fileId)
  }
  
  /**
   * 处理分片上传失败
   */
  private handleChunkError(fileInfo: FileInfo, chunkInfo: ChunkInfo, error: Error): void {
    console.error(`Chunk upload failed: ${fileInfo.fileName} part ${chunkInfo.partNumber}`, error)
    
    // 标记分片失败
    this.chunkManager.markChunkError(fileInfo.fileId, chunkInfo.partNumber)
    
    // 检查重试次数
    if (chunkInfo.retryCount && chunkInfo.retryCount < this.maxRetries) {
      // 延迟重试
      setTimeout(() => {
        this.uploadChunk(fileInfo, chunkInfo)
      }, this.retryDelay * chunkInfo.retryCount)
    } else {
      // 超过重试次数，标记文件失败
      this.handleFileError(fileInfo, new UploaderError(
        `Chunk ${chunkInfo.partNumber} failed after ${this.maxRetries} retries`,
        ErrorType.NETWORK,
        fileInfo
      ))
    }
  }
  
  /**
   * 更新文件进度
   */
  private updateFileProgress(fileInfo: FileInfo): void {
    const progress = Math.round((fileInfo.uploadedSize / fileInfo.fileSize) * 100)
    this.fileManager.updateFileProgress(fileInfo.fileId, fileInfo.uploadedSize, progress)
    
    // 记录性能监控
    if (this.performanceMonitor) {
      this.performanceMonitor.recordFileProgress(fileInfo.fileId, fileInfo.uploadedSize)
    }
    
    if (this.onFileProgress) {
      this.onFileProgress(fileInfo)
    }
  }
  
  /**
   * 完成文件上传
   */
  private async completeFileUpload(fileInfo: FileInfo): Promise<void> {
    try {
      fileInfo.status = UploadStepEnum.complete
      
      // 调用服务器完成接口
      if (this.sendFileCompleteToServer) {
        const result = await this.sendFileCompleteToServer(fileInfo)
        
        if (!result.isSuccess) {
          throw new Error('Failed to complete file upload')
        }
        
        fileInfo.uploadData = result.data
      }
      
      // 标记文件完成
      this.fileManager.setFileCompleted(fileInfo)
      
      // 记录性能监控
      if (this.performanceMonitor) {
        this.performanceMonitor.recordFileComplete(fileInfo.fileId)
      }
      
      // 触发回调
      if (this.onFileSuccess) {
        this.onFileSuccess({ fileInfo, data: fileInfo.uploadData })
      }
      if (this.onFileComplete) {
        this.onFileComplete({ fileInfo, data: fileInfo.uploadData })
      }
      
      // 清理资源
      this.cleanup(fileInfo.fileId)
      
      // 继续处理队列
      this.processQueue()
    } catch (error) {
      this.handleFileError(fileInfo, error instanceof Error ? error : new Error(String(error)))
    }
  }
  
  /**
   * 处理文件错误
   */
  private handleFileError(fileInfo: FileInfo, error: Error): void {
    fileInfo.status = UploadStepEnum.error
    fileInfo.errorMessage = error.message
    
    if (this.onFileError) {
      this.onFileError(fileInfo, error)
    }
    if (this.onFileComplete) {
      this.onFileComplete({ fileInfo, data: { error: error.message } })
    }
    
    this.cleanup(fileInfo.fileId)
    this.processQueue()
  }
  
  /**
   * 暂停文件上传
   */
  pauseFile(fileId: string): void {
    const fileInfo = this.fileManager.getActiveFile(fileId)
    if (fileInfo && fileInfo.status === UploadStepEnum.upload) {
      this.fileManager.updateFileStatus(fileId, UploadStepEnum.pause)
      
      // 中止正在上传的分片
      this.uploadControllers.forEach((controller, key) => {
        if (key.startsWith(fileId)) {
          controller.abort()
        }
      })
      
      // 中止Worker任务
      this.workerManager.abortFileTasks(fileId)
    }
  }
  
  /**
   * 恢复文件上传
   */
  resumeFile(fileId: string): void {
    const fileInfo = this.fileManager.getActiveFile(fileId)
    if (fileInfo && fileInfo.status === UploadStepEnum.pause) {
      this.fileManager.updateFileStatus(fileId, UploadStepEnum.upload)
      this.processChunks(fileId)
    }
  }
  
  /**
   * 取消文件上传
   */
  cancelFile(fileId: string): void {
    const fileInfo = this.fileManager.getActiveFile(fileId)
    if (fileInfo) {
      // 中止上传
      this.uploadControllers.forEach((controller, key) => {
        if (key.startsWith(fileId)) {
          controller.abort()
        }
      })
      
      // 中止Worker任务
      this.workerManager.abortFileTasks(fileId)
      
      // 记录性能监控
      if (this.performanceMonitor) {
        this.performanceMonitor.recordFileComplete(fileId)
      }
      
      // 清理资源
      this.cleanup(fileId)
      
      // 继续处理队列
      this.processQueue()
    }
  }
  
  /**
   * 清理文件相关资源
   */
  private cleanup(fileId: string): void {
    this.fileManager.cleanupFile(fileId)
    this.chunkManager.cleanupFile(fileId)
    
    // 清理控制器
    const keysToDelete: string[] = []
    this.uploadControllers.forEach((_, key) => {
      if (key.startsWith(fileId)) {
        keysToDelete.push(key)
      }
    })
    keysToDelete.forEach(key => this.uploadControllers.delete(key))
  }
  
  /**
   * 销毁上传管理器
   */
  destroy(): void {
    // 中止所有上传
    this.uploadControllers.forEach(controller => controller.abort())
    this.uploadControllers.clear()
    
    // 清理所有资源
    this.fileManager.cleanupAll()
    this.chunkManager.cleanupAll()
  }
} 