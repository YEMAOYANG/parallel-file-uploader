import { 
  ChunkInfo,
  FileInfo,
  FilePartInfo,
  ParallelFileUploaderOptions,
  ResGlobalInterface,
  UploadStepEnum,
  WorkerMessage,
  ChunkStatusEnum,
  ErrorType,
  UploaderError,
} from './type'
import SparkMD5 from 'spark-md5'
import {
  FileManager,
  ChunkManager,
  SpeedLimiter,
  PerformanceMonitor,
  QueuePersistence,
  WorkerManager,
  type PerformanceData
} from './modules'

/**
 * 🔧 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 🔧 格式化上传速度
 */
function formatSpeed(bytesPerSecond: number): string {
  return formatFileSize(bytesPerSecond) + '/s'
}

/**
 * 并行文件上传器类
 *
 * 主要特性：
 * - 支持多文件并发上传
 * - 大文件自动分片上传
 * - 使用Web Worker实现多线程处理
 * - 支持断点续传
 * - 自动失败重试
 * - 完整的事件回调系统
 * - 速度限制
 * - 性能监控
 * - 队列持久化
 * - 🔧 增强的错误处理和兼容性
 *
 * @example
 * ```typescript
 * const uploader = new ParallelFileUploader({
 *   maxConcurrentFiles: 3,
 *   chunkSize: 5 * 1024 * 1024, // 5MB
 *   enableSpeedLimit: true,
 *   maxUploadSpeed: 1024 * 1024, // 1MB/s
 *   enablePerformanceMonitor: true,
 *   enableQueuePersistence: true,
 *   allowedFileTypes: ['*'], // 🔧 支持通配符
 *   debugMode: true, // 🔧 启用调试模式
 *   onFileProgress: (fileInfo) => {
 *     console.log(`${fileInfo.fileName}: ${fileInfo.progress}%`)
 *   }
 * })
 *
 * uploader.addFiles(fileList)
 * ```
 */
export class ParallelFileUploader {
  // 模块实例
  private fileManager: FileManager
  private chunkManager: ChunkManager
  private speedLimiter: SpeedLimiter
  private performanceMonitor: PerformanceMonitor
  private queuePersistence: QueuePersistence
  private workerManager: WorkerManager

  // 配置选项
  private maxConcurrentFiles: number
  private maxConcurrentChunks: number
  private maxRetries: number
  private uploadPartUrl = ''
  
  // 🔧 调试模式
  private debugMode: boolean = false

  // 回调函数
  private onFileAdded?: (fileInfo: FileInfo) => void
  private onFileProgress?: (fileInfo: FileInfo) => void
  private onFileSuccess?: (params: { fileInfo: FileInfo; data: any }) => void
  private onFileError?: (fileInfo: FileInfo, error: Error) => void
  private onFileComplete?: (params: { fileInfo: FileInfo; data: any }) => void
  private onAllComplete?: () => void
  private onFileRejected?: (file: File, reason: string) => void
  private onPerformanceUpdate?: (data: PerformanceData) => void

  // 服务器交互
  private sendFileInfoToServer?: (fileInfo: FileInfo) => Promise<ResGlobalInterface<any>>
  private sendFilePartToServer?: (
    fileInfo: FileInfo,
    chunkInfo: ChunkInfo
  ) => Promise<ResGlobalInterface<any>>
  private sendFileCompleteToServer?: (fileInfo: FileInfo) => Promise<ResGlobalInterface<any>>
  private getFilePartsFromServer?: (
    fileInfo: FileInfo
  ) => Promise<ResGlobalInterface<FilePartInfo[]>>
  private sendPauseToServer?: (fileInfo: FileInfo) => Promise<ResGlobalInterface<any>>

  // 性能监控定时器
  private performanceTimer?: NodeJS.Timeout

  /**
   * 创建并行文件上传器实例
   * @param options 配置选项
   */
  constructor(options: ParallelFileUploaderOptions = {}) {
    // 🔧 启用调试模式
    this.debugMode = options.debugMode || false
    
    // 设置基本配置
    this.maxConcurrentFiles = options.maxConcurrentFiles || 3
    this.maxConcurrentChunks = options.maxConcurrentChunks || 3
    this.maxRetries = options.maxRetries || 3

    if (options.uploadPartUrl) {
      this.uploadPartUrl = options.uploadPartUrl
    }

    // 🔧 配置验证和优化建议
    this.validateAndOptimizeConfig(options)

    // 初始化模块
    this.fileManager = new FileManager({
      maxFileSize: options.maxFileSize,
      allowedFileTypes: options.allowedFileTypes,
    })

    this.chunkManager = new ChunkManager(options.chunkSize || 1024 * 1024 * 5)

    this.speedLimiter = new SpeedLimiter(
      options.maxUploadSpeed || 0,
      options.enableSpeedLimit || false
    )

    this.performanceMonitor = new PerformanceMonitor(
      options.enablePerformanceMonitor || false
    )

    this.queuePersistence = new QueuePersistence(
      options.enableQueuePersistence || false,
      options.persistenceKey
    )

    this.workerManager = new WorkerManager()
    this.workerManager.setMessageHandler(this.handleWorkerMessage.bind(this))

    // 设置回调
    this.onFileAdded = options.onFileAdded
    this.onFileProgress = options.onFileProgress
    this.onFileSuccess = options.onFileSuccess
    this.onFileError = options.onFileError
    this.onFileComplete = options.onFileComplete
    this.onAllComplete = options.onAllComplete
    this.onFileRejected = options.onFileRejected
    this.onPerformanceUpdate = options.onPerformanceUpdate

    // 设置服务器交互回调
    this.sendFileInfoToServer = options.sendFileInfoToServer
    this.sendFilePartToServer = options.sendFilePartToServer
    this.sendFileCompleteToServer = options.sendFileCompleteToServer
    this.getFilePartsFromServer = options.getFilePartsFromServer
    this.sendPauseToServer = options.sendPauseToServer

    // 启动性能监控定时器
    if (this.performanceMonitor.isEnabled()) {
      this.startPerformanceMonitoring()
    }

    // 加载持久化队列
    this.loadPersistedQueue()

    // 🔧 输出初始化完成信息
    if (this.debugMode) {
      this.logInitializationInfo()
    }
  }

  /**
   * 添加文件到上传队列
   */
  addFiles(files: File[] | FileList): void {
    console.log(`📂 添加 ${files.length} 个文件到队列`)

    try {
      const addedFiles = this.fileManager.addFiles(files)
      
      // 🔧 输出添加成功的文件信息
      if (this.debugMode && addedFiles.length > 0) {
        console.log('✅ 成功添加文件:', addedFiles.map(f => ({
          name: f.fileName,
          size: formatFileSize(f.fileSize),
          type: f.mimeType || '未知'
        })))
      }
      
      // 触发文件添加回调
      for (const fileInfo of addedFiles) {
        if (this.onFileAdded) {
          this.onFileAdded(fileInfo)
        }
      }

      // 保存队列状态
      this.saveQueueState()

      // 开始处理队列
      this.processFileQueue()
    } catch (error) {
      // 🔧 增强的错误处理
      console.error('❌ 添加文件失败:', error)
      
      if (error instanceof UploaderError && this.onFileRejected) {
        // 尝试从错误信息中提取文件信息
        const errorMessage = error.message || '未知错误'
        
        // 创建一个虚拟文件对象用于回调
        const dummyFile = new File([''], 'unknown')
        
        // 如果可能，尝试从 files 中找到实际的文件
        let rejectedFile = dummyFile
        if (files && files.length > 0) {
          rejectedFile = Array.from(files)[0] // 假设是第一个文件出错
        }
        
        this.onFileRejected(rejectedFile, errorMessage)
      } else {
        // 如果没有 onFileRejected 回调，输出详细错误
        console.error('❌ 文件验证失败，但未配置 onFileRejected 回调。错误详情:', {
          error: error instanceof Error ? error.message : String(error),
          files: Array.from(files).map(f => ({
            name: f.name,
            size: formatFileSize(f.size),
            type: f.type || '未知'
          }))
        })
      }
    }
  }

  /**
   * 处理文件队列
   */
  private async processFileQueue(): Promise<void> {
    while (
      this.fileManager.getActiveCount() < this.maxConcurrentFiles &&
      this.fileManager.getQueueLength() > 0
    ) {
      const fileInfo = this.fileManager.getNextFile()!
      this.fileManager.addToActive(fileInfo)

      try {
        await this.initFileUpload(fileInfo)
        this.uploadFile(fileInfo)
      } catch (error) {
        this.handleFileError(fileInfo, error instanceof Error ? error : new Error(String(error)))
      }
    }
  }

  /**
   * 初始化文件上传
   */
  private async initFileUpload(fileInfo: FileInfo): Promise<void> {
    fileInfo.status = UploadStepEnum.beforeUpload

    // 🔧 输出初始化信息
    if (this.debugMode) {
      console.log(`🔄 初始化文件上传: ${fileInfo.fileName} (${formatFileSize(fileInfo.fileSize)})`)
    }

    // 准备分片队列
    this.chunkManager.prepareChunkQueue(fileInfo)

    if (this.sendFileInfoToServer) {
      const result = await this.sendFileInfoToServer(fileInfo)
      if (!result.isSuccess) {
        throw new UploaderError(
          'Failed to initialize file upload',
          ErrorType.FILE_INITIALIZATION_FAILED,
          fileInfo
        )
      }

      // 检查文件是否已存在（秒传）
      if (result.data && result.data.skipUpload) {
        fileInfo.status = UploadStepEnum.complete

        if (this.onFileSuccess) {
          this.onFileSuccess({ fileInfo, data: result.data })
        }

        if (this.onFileComplete) {
          this.onFileComplete({ fileInfo, data: result.data })
        }

        this.cleanupFile(fileInfo.fileId)
        return
      }

      // 断点续传
      if (this.getFilePartsFromServer) {
        try {
          const partsResult = await this.getFilePartsFromServer(fileInfo)
          if (partsResult.isSuccess && partsResult.data && partsResult.data.length > 0) {
            const hasAllSameEtag =
              new Set(partsResult.data.map((part) => part.etag)).size === 1 &&
              partsResult.data.length > 1

            if (!hasAllSameEtag) {
              this.chunkManager.resumeFromExistingParts(fileInfo, partsResult.data)
            }
          }
        } catch (error) {
          console.warn('⚠️ 获取已有分片失败:', error)
        }
      }
    }

    fileInfo.status = UploadStepEnum.upload
  }

  /**
   * 开始上传文件
   */
  private uploadFile(fileInfo: FileInfo): void {
    if (this.debugMode) {
      console.log(`📤 开始上传文件: ${fileInfo.fileName}`)
    }
    this.processChunkQueue(fileInfo.fileId)
  }

  /**
   * 处理分片队列
   */
  private async processChunkQueue(fileId: string): Promise<void> {
    const fileInfo = this.fileManager.getActiveFile(fileId)
    if (!fileInfo || fileInfo.status !== UploadStepEnum.upload) {
      return
    }

    // 检查是否所有分片都已完成
    if (this.chunkManager.isAllChunksCompleted(fileId)) {
      await this.completeFileUpload(fileInfo)
      return
    }

    // 计算可用的上传槽位
    const pendingCount = this.chunkManager.getPendingChunkCount(fileId)
    const availableSlots = this.maxConcurrentChunks - pendingCount

    if (availableSlots <= 0) {
      return
    }

    // 启动新的分片上传
    for (let i = 0; i < availableSlots && this.chunkManager.getRemainingChunkCount(fileId) > 0; i++) {
      const chunk = this.chunkManager.getNextChunk(fileId)!
      console.log(`Starting upload for chunk #${chunk.partNumber}`)
      
      this.chunkManager.addToPending(fileId, chunk.partNumber)

      // 使用Worker或直接上传
      if (this.workerManager.hasAvailableWorker()) {
        this.uploadChunkWithWorker(fileInfo, chunk)
      } else {
        this.uploadChunkDirect(fileInfo, chunk)
      }
    }
  }

  /**
   * 使用Web Worker上传分片
   */
  private uploadChunkWithWorker(fileInfo: FileInfo, chunkInfo: ChunkInfo): void {
    const { fileId, file } = fileInfo
    const { start, end, partNumber } = chunkInfo

    const worker = this.workerManager.getAvailableWorker()
    if (!worker) {
      this.uploadChunkDirect(fileInfo, chunkInfo)
      return
    }

    this.workerManager.markWorkerBusy(worker)

    // 准备分片数据
    const chunk = file.slice(start, end)
    const chunkFile = new File([chunk], '')

    if (!this.sendFilePartToServer) {
      console.error('No sendFilePartToServer function provided')
      this.handleChunkError(
        fileInfo,
        chunkInfo,
        new UploaderError(
          'No sendFilePartToServer function provided',
          ErrorType.CHUNK_UPLOAD_FAILED,
          fileInfo
        )
      )
      this.workerManager.markWorkerIdle(worker)
      return
    }

    // 将Blob转换为ArrayBuffer后再传输到Worker
    const reader = new FileReader()
    reader.onload = (event) => {
      if (event.target?.result) {
        const arrayBuffer = event.target.result as ArrayBuffer

        this.workerManager.postMessage(
          worker,
          {
            type: 'data',
            fileId,
            chunkInfo: {
              file: chunkFile,
              start: chunkInfo.start,
              end: chunkInfo.end,
              partNumber: chunkInfo.partNumber,
              partSize: chunkInfo.partSize,
            },
          },
          [arrayBuffer]
        )
      } else {
        this.handleChunkError(
          fileInfo, 
          chunkInfo, 
          new UploaderError('Failed to read file chunk', ErrorType.CHUNK_UPLOAD_FAILED, fileInfo)
        )
        this.workerManager.markWorkerIdle(worker)
      }
    }

    reader.onerror = () => {
      this.handleChunkError(
        fileInfo, 
        chunkInfo, 
        new UploaderError('Failed to read file chunk', ErrorType.CHUNK_UPLOAD_FAILED, fileInfo)
      )
      this.workerManager.markWorkerIdle(worker)
    }

    reader.readAsArrayBuffer(chunk)
  }

  /**
   * 直接在主线程上传分片
   */
  private async uploadChunkDirect(fileInfo: FileInfo, chunkInfo: ChunkInfo): Promise<void> {
    const { partNumber, partSize } = chunkInfo

    try {
      // 速度限制
      if (this.speedLimiter.isEnabled() && partSize) {
        const delay = await this.speedLimiter.requestBytes(partSize)
        if (delay > 0) {
          await this.speedLimiter.wait(delay)
        }
      }

      // 验证分片大小
      if (!partSize || partSize <= 0) {
        throw new UploaderError(
          `Invalid chunk size: ${partSize} bytes, chunk #${partNumber}`,
          ErrorType.CHUNK_UPLOAD_FAILED,
          fileInfo
        )
      }

      if (this.sendFilePartToServer) {
        const result = await this.sendFilePartToServer(fileInfo, chunkInfo)

        if (result.isSuccess) {
          // 记录传输字节数
          this.performanceMonitor.recordBytesTransferred(partSize)

          // 保存etag信息
          if (result.data && result.data.etag) {
            const fileUploadInfo = fileInfo.uploadInfo || {}
            const parts = fileUploadInfo.parts || []

            parts.push({
              etag: result.data.etag,
              partNumber: partNumber,
              partSize: partSize,
            })

            fileUploadInfo.parts = parts
            fileInfo.uploadInfo = fileUploadInfo
          }

          this.handleChunkSuccess(fileInfo, chunkInfo)
        } else {
          throw new UploaderError(
            `Upload chunk #${partNumber} failed: ${result.message || 'Unknown error'}`,
            ErrorType.CHUNK_UPLOAD_FAILED,
            fileInfo
          )
        }
      } else {
        // 模拟上传成功
        setTimeout(() => {
          this.handleChunkSuccess(fileInfo, chunkInfo)
        }, 500)
      }
    } catch (error) {
      this.handleChunkError(
        fileInfo,
        chunkInfo,
        error instanceof UploaderError ? error : new UploaderError(
          String(error),
          ErrorType.CHUNK_UPLOAD_FAILED,
          fileInfo
        )
      )
    }
  }

  /**
   * 处理Worker消息
   */
  private handleWorkerMessage(event: MessageEvent): void {
    const message: WorkerMessage = event.data
    const worker = event.target as Worker

    if (message.type === 'response' && message.fileId && message.chunkInfo) {
      const fileInfo = this.fileManager.getActiveFile(message.fileId)
      if (fileInfo && message.processed) {
        this.sendProcessedChunk(fileInfo, message.chunkInfo)
      }
    } else if (message.type === 'error' && message.fileId && message.chunkInfo) {
      const fileInfo = this.fileManager.getActiveFile(message.fileId)
      if (fileInfo) {
        this.handleChunkError(
          fileInfo,
          message.chunkInfo,
          new UploaderError(
            message.error || 'Unknown error',
            ErrorType.CHUNK_UPLOAD_FAILED,
            fileInfo
          )
        )
      }
    }
  }

  /**
   * 发送Worker处理过的数据
   */
  private async sendProcessedChunk(fileInfo: FileInfo, chunkInfo: ChunkInfo): Promise<void> {
    try {
      if (this.sendFilePartToServer) {
        // 速度限制
        if (this.speedLimiter.isEnabled() && chunkInfo.partSize) {
          const delay = await this.speedLimiter.requestBytes(chunkInfo.partSize)
          if (delay > 0) {
            await this.speedLimiter.wait(delay)
          }
        }

        const result = await this.sendFilePartToServer(fileInfo, chunkInfo)

        if (result.isSuccess) {
          // 记录传输字节数
          if (chunkInfo.partSize) {
            this.performanceMonitor.recordBytesTransferred(chunkInfo.partSize)
          }

          // 保存etag信息
          if (result.data && result.data.etag) {
            const fileUploadInfo = fileInfo.uploadInfo || {}
            const parts = fileUploadInfo.parts || []

            parts.push({
              etag: result.data.etag,
              partNumber: chunkInfo.partNumber,
              partSize: chunkInfo.partSize,
            })

            fileUploadInfo.parts = parts
            fileInfo.uploadInfo = fileUploadInfo
          }

          this.handleChunkSuccess(fileInfo, chunkInfo)
        } else {
          throw new UploaderError(
            `Upload chunk #${chunkInfo.partNumber} failed: ${result.message || 'Unknown error'}`,
            ErrorType.CHUNK_UPLOAD_FAILED,
            fileInfo
          )
        }
      } else {
        throw new UploaderError(
          'No sendFilePartToServer function provided',
          ErrorType.CHUNK_UPLOAD_FAILED,
          fileInfo
        )
      }
    } catch (error) {
      this.handleChunkError(
        fileInfo,
        chunkInfo,
        error instanceof UploaderError ? error : new UploaderError(
          String(error),
          ErrorType.CHUNK_UPLOAD_FAILED,
          fileInfo
        )
      )
    }
  }

  /**
   * 处理分片上传成功
   */
  private handleChunkSuccess(fileInfo: FileInfo, chunkInfo: ChunkInfo): void {
    const { fileId } = fileInfo
    const { partNumber } = chunkInfo

    // 更新分片状态
    this.chunkManager.markChunkCompleted(fileId, partNumber)

    // 更新文件进度
    this.updateFileProgress(fileInfo)

    // 保存状态
    this.saveQueueState()

    // 继续处理队列
    this.processChunkQueue(fileId)
  }

  /**
   * 处理分片上传错误
   */
  private handleChunkError(fileInfo: FileInfo, chunkInfo: ChunkInfo, error: Error): void {
    const { fileId } = fileInfo
    const { partNumber } = chunkInfo

    // 从待处理集合中移除
    this.chunkManager.removeFromPending(fileId, partNumber)

    // 检查是否需要重试
    if ((chunkInfo.retryCount || 0) < this.maxRetries) {
      this.chunkManager.requeueChunk(fileId, chunkInfo)
      this.processChunkQueue(fileId)
    } else {
      // 超过最大重试次数
      this.fileManager.updateFileStatus(fileId, UploadStepEnum.error)
      fileInfo.errorMessage = error.message

      if (this.onFileError) {
        this.onFileError(fileInfo, error)
      }

      this.cleanupFile(fileId)
      this.processFileQueue()
    }
  }

  /**
   * 更新文件上传进度
   */
  private updateFileProgress(fileInfo: FileInfo): void {
    const { fileId } = fileInfo
    const uploadedSize = this.chunkManager.calculateUploadedSize(fileInfo)

    this.fileManager.updateFileProgress(fileId, uploadedSize)

    if (this.onFileProgress) {
      this.onFileProgress(fileInfo)
    }
  }

  /**
   * 完成文件上传
   */
  private async completeFileUpload(fileInfo: FileInfo): Promise<void> {
    const { fileId } = fileInfo
    let result: any = {}

    try {
      fileInfo.status = UploadStepEnum.complete

      if (this.sendFileCompleteToServer) {
        // 确保分片按partNumber排序
        if (fileInfo.uploadInfo && fileInfo.uploadInfo.parts) {
          fileInfo.uploadInfo.parts.sort((a, b) => a.partNumber - b.partNumber)
        }

        result = await this.sendFileCompleteToServer(fileInfo)
        if (!result.isSuccess) {
          throw new UploaderError(
            'Complete file upload failed: ' + (result.message || 'Unknown error'),
            ErrorType.SERVER_ERROR,
            fileInfo
          )
        }
      }

      if (this.onFileSuccess) {
        this.onFileSuccess({ fileInfo, data: result.data })
      }

      if (this.onFileComplete) {
        this.onFileComplete({ fileInfo, data: result.data })
      }

      this.cleanupFile(fileId)
      this.processFileQueue()

      // 检查是否所有文件都已完成
      if (this.fileManager.getActiveCount() === 0 && this.fileManager.getQueueLength() === 0) {
        if (this.onAllComplete) {
          this.onAllComplete()
        }
      }
    } catch (error) {
      this.handleFileError(
        fileInfo, 
        error instanceof UploaderError ? error : new UploaderError(
          String(error),
          ErrorType.SERVER_ERROR,
          fileInfo
        )
      )
    }
  }

  /**
   * 🔧 增强的错误处理方法
   */
  private handleFileError(fileInfo: FileInfo, error: Error): void {
    const { fileId } = fileInfo

    this.fileManager.updateFileStatus(fileId, UploadStepEnum.error)
    fileInfo.errorMessage = error.message

    // 🔧 输出详细的错误信息
    console.error(`❌ 文件上传失败: ${fileInfo.fileName}`, {
      fileId,
      fileName: fileInfo.fileName,
      fileSize: formatFileSize(fileInfo.fileSize),
      error: error.message,
      progress: fileInfo.progress
    })

    if (this.onFileError) {
      this.onFileError(fileInfo, error)
    }

    this.cleanupFile(fileId)
    this.processFileQueue()
  }

  /**
   * 清理文件资源
   */
  private cleanupFile(fileId: string): void {
    this.fileManager.removeFromActive(fileId)
    this.chunkManager.cleanup(fileId)
    this.queuePersistence.removeFile(fileId)
  }

  /**
   * 保存队列状态
   */
  private saveQueueState(): void {
    if (this.queuePersistence.isEnabled()) {
      const allFiles = [
        ...Array.from({ length: this.fileManager.getQueueLength() }),
        ...this.fileManager.getAllActiveFiles()
      ]
      this.queuePersistence.saveQueue(this.fileManager.getAllActiveFiles())
    }
  }

  /**
   * 加载持久化队列
   */
  private loadPersistedQueue(): void {
    if (this.queuePersistence.isEnabled()) {
      const persistedFiles = this.queuePersistence.loadQueue()
      console.log(`Loaded ${persistedFiles.length} persisted files`)
      // 这里可以实现队列恢复逻辑
    }
  }

  /**
   * 启动性能监控
   */
  private startPerformanceMonitoring(): void {
    if (this.performanceTimer) {
      clearInterval(this.performanceTimer)
    }

    this.performanceTimer = setInterval(() => {
      if (this.performanceMonitor.isEnabled()) {
        // 计算剩余字节数
        const activeFiles = this.fileManager.getAllActiveFiles()
        let remainingBytes = 0
        for (const file of activeFiles) {
          remainingBytes += file.fileSize - file.uploadedSize
        }

        // 更新性能监控数据
        this.performanceMonitor.setActiveConnections(this.workerManager.getStats().busy)
        this.performanceMonitor.setFileStats(
          this.fileManager.getActiveCount(),
          this.fileManager.getActiveCount() + this.fileManager.getQueueLength()
        )

        const performanceData = this.performanceMonitor.getPerformanceData(remainingBytes)
        
        if (this.onPerformanceUpdate) {
          this.onPerformanceUpdate(performanceData)
        }
      }
    }, 1000) // 每秒更新一次
  }

  // 公共API方法保持不变...

  /**
   * 暂停指定文件的上传
   */
  pauseFile(fileId: string): void {
    const fileInfo = this.fileManager.getActiveFile(fileId)
    if (fileInfo && fileInfo.status === UploadStepEnum.upload) {
      this.fileManager.updateFileStatus(fileId, UploadStepEnum.pause)

      if (this.sendPauseToServer) {
        this.sendPauseToServer(fileInfo).catch(console.error)
      }
    }
  }

  /**
   * 暂停所有文件的上传
   */
  pauseAll(): void {
    for (const fileInfo of this.fileManager.getAllActiveFiles()) {
      if (fileInfo.status === UploadStepEnum.upload) {
        this.pauseFile(fileInfo.fileId)
      }
    }
  }

  /**
   * 恢复指定文件的上传
   */
  resumeFile(fileId: string): void {
    const fileInfo = this.fileManager.getActiveFile(fileId)
    if (fileInfo && fileInfo.status === UploadStepEnum.pause) {
      this.fileManager.updateFileStatus(fileId, UploadStepEnum.upload)
      this.processChunkQueue(fileId)
    }
  }

  /**
   * 恢复所有暂停的文件上传
   */
  resumeAll(): void {
    for (const fileInfo of this.fileManager.getAllActiveFiles()) {
      if (fileInfo.status === UploadStepEnum.pause) {
        this.resumeFile(fileInfo.fileId)
      }
    }
  }

  /**
   * 取消指定文件的上传
   */
  cancelFile(fileId: string): void {
    const fileInfo = this.fileManager.getActiveFile(fileId)
    if (fileInfo) {
      this.cleanupFile(fileId)
      this.processFileQueue()
    }
  }

  /**
   * 取消所有文件的上传
   */
  cancelAll(): void {
    const activeFileIds = this.fileManager.getAllActiveFiles().map(f => f.fileId)
    this.fileManager.clearQueue()

    for (const fileId of activeFileIds) {
      this.cancelFile(fileId)
    }
  }

  /**
   * 获取上传状态统计
   */
  getStats(): {
    queued: number
    active: number
    completed: number
    failed: number
    paused: number
  } {
    return this.fileManager.getStats()
  }

  /**
   * 获取性能数据
   */
  getPerformanceData(): PerformanceData {
    const activeFiles = this.fileManager.getAllActiveFiles()
    let remainingBytes = 0
    for (const file of activeFiles) {
      remainingBytes += file.fileSize - file.uploadedSize
    }

    return this.performanceMonitor.getPerformanceData(remainingBytes)
  }

  /**
   * 设置速度限制
   */
  setSpeedLimit(bytesPerSecond: number, enabled: boolean = true): void {
    this.speedLimiter.setMaxBytesPerSecond(bytesPerSecond)
    this.speedLimiter.setEnabled(enabled)
  }

  /**
   * 启用/禁用性能监控
   */
  setPerformanceMonitoring(enabled: boolean): void {
    this.performanceMonitor.setEnabled(enabled)
    if (enabled) {
      this.startPerformanceMonitoring()
    } else if (this.performanceTimer) {
      clearInterval(this.performanceTimer)
      this.performanceTimer = undefined
    }
  }

  /**
   * 启用/禁用队列持久化
   */
  setQueuePersistence(enabled: boolean): void {
    this.queuePersistence.setEnabled(enabled)
  }

  /**
   * 销毁上传器实例
   */
  destroy(): void {
    this.cancelAll()
    this.workerManager.destroy()
    
    if (this.performanceTimer) {
      clearInterval(this.performanceTimer)
    }
  }

  /**
   * 计算文件MD5值（静态方法）
   */
  static calculateFileMD5(
    file: File,
    chunkSize = 2097152,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const blobSlice = File.prototype.slice
        const chunks = Math.ceil(file.size / chunkSize)
        let currentChunk = 0
        const spark = new SparkMD5.ArrayBuffer()
        const fileReader = new FileReader()

        const loadNext = () => {
          const start = currentChunk * chunkSize
          const end = start + chunkSize >= file.size ? file.size : start + chunkSize
          fileReader.readAsArrayBuffer(blobSlice.call(file, start, end))
        }

        fileReader.onload = (e) => {
          if (e.target && e.target.result) {
            spark.append(e.target.result as ArrayBuffer)
            currentChunk++

            if (onProgress) {
              const progress = Math.round((currentChunk / chunks) * 100)
              onProgress(progress)
            }

            if (currentChunk < chunks) {
              loadNext()
            } else {
              const md5 = spark.end()
              resolve(md5)
            }
          }
        }

        fileReader.onerror = () => {
          reject(new Error('文件读取失败'))
        }

        loadNext()
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 获取性能指标（兼容性方法）
   * @deprecated 使用 getPerformanceData() 代替
   */
  getPerformanceMetrics(): {
    workerPoolSize: number
    activeConnections: number
    averageSpeed: number
    currentSpeed: number
    memoryUsage?: any
  } {
    const performanceData = this.getPerformanceData()
    const workerStats = this.workerManager.getStats()
    
    return {
      workerPoolSize: workerStats.total,
      activeConnections: performanceData.activeConnections,
      averageSpeed: performanceData.averageSpeed,
      currentSpeed: performanceData.currentSpeed,
      memoryUsage: performanceData.memoryUsage
    }
  }

  /**
   * 获取队列统计（兼容性方法）
   * @deprecated 使用 getStats() 代替
   */
  getQueueStats(): {
    total: number
    active: number
    queued: number
    completed: number
    failed: number
  } {
    const stats = this.getStats()
    return {
      total: stats.active + stats.queued + stats.completed + stats.failed,
      active: stats.active,
      queued: stats.queued,
      completed: stats.completed,
      failed: stats.failed
    }
  }

  /**
   * 🔧 配置验证和优化建议
   */
  private validateAndOptimizeConfig(options: ParallelFileUploaderOptions): void {
    const warnings: string[] = []
    const suggestions: string[] = []

    // 检查分片大小
    const chunkSize = options.chunkSize || 1024 * 1024 * 5
    if (chunkSize < 1024 * 1024) {
      warnings.push(`分片大小过小 (${formatFileSize(chunkSize)})，可能影响上传性能`)
      suggestions.push('建议使用 1MB 以上的分片大小')
    } else if (chunkSize > 1024 * 1024 * 50) {
      warnings.push(`分片大小过大 (${formatFileSize(chunkSize)})，可能导致内存占用过高`)
      suggestions.push('建议使用 50MB 以下的分片大小')
    }

    // 检查并发数
    if (options.maxConcurrentFiles && options.maxConcurrentFiles > 10) {
      warnings.push(`并发文件数过多 (${options.maxConcurrentFiles})，可能影响浏览器性能`)
      suggestions.push('建议将并发文件数控制在 10 以内')
    }

    if (options.maxConcurrentChunks && options.maxConcurrentChunks > 10) {
      warnings.push(`并发分片数过多 (${options.maxConcurrentChunks})，可能导致网络拥塞`)
      suggestions.push('建议将并发分片数控制在 10 以内')
    }

    // 检查文件类型配置
    if (options.allowedFileTypes) {
      const hasWildcard = options.allowedFileTypes.includes('*')
      const hasEmptyStrings = options.allowedFileTypes.some(type => !type || type.trim() === '')
      
      if (hasEmptyStrings) {
        warnings.push('文件类型配置中包含空字符串，已自动过滤')
      }

      if (hasWildcard && this.debugMode) {
        console.log('📁 检测到通配符 "*"，文件类型验证已禁用')
      }
    }

    // 输出警告和建议
    if (warnings.length > 0 && this.debugMode) {
      console.warn('⚠️ 配置警告:', warnings)
    }
    if (suggestions.length > 0 && this.debugMode) {
      console.info('💡 优化建议:', suggestions)
    }
  }

  /**
   * 🔧 输出初始化信息
   */
  private logInitializationInfo(): void {
    const config = this.fileManager.getConfiguration()
    console.log('🚀 ParallelFileUploader 初始化完成', {
      version: '2.0.1',
      config: {
        maxConcurrentFiles: this.maxConcurrentFiles,
        maxConcurrentChunks: this.maxConcurrentChunks,
        chunkSize: formatFileSize(this.chunkManager.getChunkSize()),
        maxFileSize: config.maxFileSize || '无限制',
        allowedFileTypes: config.supportedTypesDescription,
        features: {
          speedLimit: this.speedLimiter.isEnabled(),
          performanceMonitor: this.performanceMonitor.isEnabled(),
          queuePersistence: this.queuePersistence.isEnabled(),
          workerSupport: this.workerManager.isSupported()
        }
      }
    })
  }

  /**
   * 🔧 获取详细的配置信息
   */
  getConfiguration(): {
    fileManager: any
    chunkManager: { chunkSize: string }
    features: {
      speedLimit: boolean
      performanceMonitor: boolean
      queuePersistence: boolean
      workerSupport: boolean
    }
    limits: {
      maxConcurrentFiles: number
      maxConcurrentChunks: number
      maxRetries: number
    }
  } {
    return {
      fileManager: this.fileManager.getConfiguration(),
      chunkManager: {
        chunkSize: formatFileSize(this.chunkManager.getChunkSize())
      },
      features: {
        speedLimit: this.speedLimiter.isEnabled(),
        performanceMonitor: this.performanceMonitor.isEnabled(),
        queuePersistence: this.queuePersistence.isEnabled(),
        workerSupport: this.workerManager.isSupported()
      },
      limits: {
        maxConcurrentFiles: this.maxConcurrentFiles,
        maxConcurrentChunks: this.maxConcurrentChunks,
        maxRetries: this.maxRetries
      }
    }
  }

  /**
   * 🔧 启用/禁用调试模式
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled
    if (enabled) {
      console.log('🔍 调试模式已启用')
      console.log('📊 当前配置:', this.getConfiguration())
    }
  }
}

// 导出格式化工具函数
export { formatFileSize, formatSpeed }
