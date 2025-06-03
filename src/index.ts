import { v4 as uuid } from 'uuid'
import SparkMD5 from 'spark-md5'
import {
  ParallelFileUploaderOptions,
  FileInfo,
  UploadStepEnum,
} from './type'

// 导入各个模块
import { FileManager } from './modules/FileManager'
import { ChunkManager } from './modules/ChunkManager'
import { WorkerManager } from './modules/WorkerManager'
import { UploadManager } from './modules/UploadManager'
import { PerformanceMonitor, PerformanceMetrics } from './modules/PerformanceMonitor'
import { QueuePersistence } from './modules/QueuePersistence'
import { SpeedLimiter } from './modules/SpeedLimiter'

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
 * - 性能监控
 * - 队列持久化
 * - 上传速度限制
 *
 * @example
 * ```typescript
 * const uploader = new ParallelFileUploader({
 *   maxConcurrentFiles: 3,
 *   chunkSize: 5 * 1024 * 1024, // 5MB
 *   enablePerformanceMonitor: true,
 *   enableQueuePersistence: true,
 *   enableSpeedLimit: true,
 *   speedLimit: 1024 * 1024, // 1MB/s
 *   onFileProgress: (fileInfo) => {
 *     console.log(`${fileInfo.fileName}: ${fileInfo.progress}%`)
 *   }
 * })
 *
 * uploader.addFiles(fileList)
 * ```
 */
export class ParallelFileUploader {
  // 各个功能模块
  private fileManager: FileManager
  private chunkManager: ChunkManager
  private workerManager: WorkerManager
  private uploadManager: UploadManager
  private performanceMonitor?: PerformanceMonitor
  private queuePersistence?: QueuePersistence
  private speedLimiter: SpeedLimiter
  
  // 配置选项
  private options: ParallelFileUploaderOptions
  
  /**
   * 创建并行文件上传器实例
   * @param options 配置选项
   */
  constructor(options: ParallelFileUploaderOptions = {}) {
    this.options = options
    
    // 初始化各个模块
    this.fileManager = new FileManager(options)
    this.chunkManager = new ChunkManager(options.chunkSize || 1024 * 1024 * 5)
    this.workerManager = new WorkerManager(options.useWorker !== false)
    this.speedLimiter = new SpeedLimiter(
      options.speedLimit || 0,
      options.enableSpeedLimit || false
    )
    
    // 初始化性能监控（如果启用）
    if (options.enablePerformanceMonitor) {
      this.performanceMonitor = new PerformanceMonitor((metrics) => {
        if (options.onPerformanceUpdate) {
          options.onPerformanceUpdate(metrics)
        }
      })
      this.performanceMonitor.start()
    }
    
    // 初始化队列持久化（如果启用）
    if (options.enableQueuePersistence) {
      this.queuePersistence = new QueuePersistence(
        options.persistenceKey || 'parallel-uploader-queue',
        true
      )
      
      // 尝试恢复之前的队列
      this.restoreQueue()
    }
    
    // 初始化上传管理器
    this.uploadManager = new UploadManager(
      this.fileManager,
      this.chunkManager,
      this.workerManager,
      this.speedLimiter,
      this.performanceMonitor,
      options
    )
  }
  
  /**
   * 添加文件到上传队列
   *
   * @param files 要上传的文件列表，可以是File数组或FileList对象
   */
  addFiles(files: File[] | FileList): void {
    // 使用文件管理器添加文件
    const addedFiles = this.fileManager.addFiles(files)
    
    // 记录性能监控
    if (this.performanceMonitor) {
      for (const file of addedFiles) {
        this.performanceMonitor.recordFileStart(file.fileId)
      }
    }
    
    // 保存队列（如果启用持久化）
    if (this.queuePersistence) {
      const allFiles = this.fileManager.getActiveFiles()
      const uploadedChunks = new Map<string, Set<number>>()
      
      // 获取已上传的分片信息
      for (const file of allFiles) {
        const count = this.chunkManager.getUploadedCount(file.fileId)
        if (count > 0) {
          uploadedChunks.set(file.fileId, new Set())
        }
      }
      
      this.queuePersistence.saveQueue(allFiles, uploadedChunks)
    }
    
    // 开始处理队列
    this.uploadManager.processQueue()
  }
  
  /**
   * 暂停指定文件的上传
   *
   * @param fileId 文件ID
   */
  pauseFile(fileId: string): void {
    this.uploadManager.pauseFile(fileId)
    
    // 保存状态（如果启用持久化）
    if (this.queuePersistence) {
      const fileInfo = this.fileManager.getActiveFile(fileId)
      if (fileInfo) {
        const uploadedCount = this.chunkManager.getUploadedCount(fileId)
        const uploadedChunks = new Set<number>()
        for (let i = 1; i <= uploadedCount; i++) {
          uploadedChunks.add(i)
        }
        this.queuePersistence.saveFileState(fileInfo, uploadedChunks)
      }
    }
  }
  
  /**
   * 恢复指定文件的上传
   *
   * @param fileId 文件ID
   */
  resumeFile(fileId: string): void {
    this.uploadManager.resumeFile(fileId)
  }
  
  /**
   * 取消指定文件的上传
   *
   * @param fileId 文件ID
   */
  cancelFile(fileId: string): void {
    this.uploadManager.cancelFile(fileId)
    
    // 删除持久化状态（如果启用）
    if (this.queuePersistence) {
      this.queuePersistence.removeFileState(fileId)
    }
    
    // 记录性能监控
    if (this.performanceMonitor) {
      this.performanceMonitor.recordFileComplete(fileId)
    }
  }
  
  /**
   * 暂停所有文件的上传
   */
  pauseAll(): void {
    const activeFiles = this.fileManager.getActiveFiles()
    for (const file of activeFiles) {
      if (file.status === UploadStepEnum.upload) {
        this.pauseFile(file.fileId)
      }
    }
  }
  
  /**
   * 恢复所有文件的上传
   */
  resumeAll(): void {
    const activeFiles = this.fileManager.getActiveFiles()
    for (const file of activeFiles) {
      if (file.status === UploadStepEnum.pause) {
        this.resumeFile(file.fileId)
      }
    }
  }
  
  /**
   * 取消所有文件的上传
   */
  cancelAll(): void {
    const activeFiles = this.fileManager.getActiveFiles()
    for (const file of activeFiles) {
      this.cancelFile(file.fileId)
    }
    
    // 清空持久化队列（如果启用）
    if (this.queuePersistence) {
      this.queuePersistence.clearQueue()
    }
  }
  
  /**
   * 获取上传统计信息
   *
   * @returns 上传统计信息
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
   * 获取性能指标
   *
   * @returns 性能指标（如果启用了性能监控）
   */
  getPerformanceMetrics(): PerformanceMetrics | null {
    if (this.performanceMonitor) {
      const metrics = this.performanceMonitor.getMetrics()
      
      // 计算总文件大小和已上传大小
      const allFiles = this.fileManager.getActiveFiles()
      const completedFiles = this.fileManager.getStats().completed
      
      let totalSize = 0
      let uploadedSize = 0
      
      for (const file of allFiles) {
        totalSize += file.fileSize
        uploadedSize += file.uploadedSize
      }
      
      // 更新剩余时间
      if (totalSize > uploadedSize) {
        this.performanceMonitor.calculateTimeRemaining(totalSize, uploadedSize)
      }
      
      return this.performanceMonitor.getMetrics()
    }
    return null
  }
  
  /**
   * 设置上传速度限制
   *
   * @param bytesPerSecond 速度限制（字节/秒），0表示不限制
   */
  setSpeedLimit(bytesPerSecond: number): void {
    this.speedLimiter.setSpeedLimit(bytesPerSecond)
  }
  
  /**
   * 启用/禁用速度限制
   *
   * @param enabled 是否启用
   */
  setSpeedLimitEnabled(enabled: boolean): void {
    this.speedLimiter.setEnabled(enabled)
  }
  
  /**
   * 销毁上传器实例，释放所有资源
   */
  destroy(): void {
    // 取消所有上传
    this.cancelAll()
    
    // 销毁各个模块
    this.uploadManager.destroy()
    this.workerManager.destroy()
    
    if (this.performanceMonitor) {
      this.performanceMonitor.destroy()
    }
    
    if (this.speedLimiter) {
      this.speedLimiter.destroy()
    }
  }
  
  /**
   * 从持久化存储恢复队列
   * @private
   */
  private restoreQueue(): void {
    if (!this.queuePersistence) return
    
    const queueData = this.queuePersistence.loadQueue()
    if (!queueData || !queueData.files.length) return
    
    console.log(`恢复 ${queueData.files.length} 个文件的上传队列`)
    
    // 恢复文件信息
    // 注意：由于File对象无法序列化，需要用户重新选择文件
    // 这里只是恢复元数据，实际恢复需要配合UI实现
    for (const fileData of queueData.files) {
      console.log(`待恢复文件: ${fileData.fileName} (${fileData.uploadedSize}/${fileData.fileSize})`)
    }
  }
  
  /**
   * 静态方法：计算文件的MD5值
   *
   * @param file 要计算MD5的文件
   * @param chunkSize 分块大小，默认2MB
   * @param onProgress 进度回调
   * @returns MD5值
   */
  static calculateFileMD5(
    file: File,
    chunkSize = 2097152, // 默认2MB
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const spark = new SparkMD5.ArrayBuffer()
      const fileReader = new FileReader()
      const chunks = Math.ceil(file.size / chunkSize)
      let currentChunk = 0

      fileReader.onload = (e) => {
        spark.append(e.target!.result as ArrayBuffer)
        currentChunk++

        if (onProgress) {
          onProgress(Math.round((currentChunk / chunks) * 100))
        }

        if (currentChunk < chunks) {
          loadNext()
        } else {
          resolve(spark.end())
        }
      }

      fileReader.onerror = (error) => {
        reject(error)
      }

      const loadNext = () => {
        const start = currentChunk * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        fileReader.readAsArrayBuffer(file.slice(start, end))
      }

      loadNext()
    })
  }
  
  /**
   * 格式化速度显示（工具方法）
   */
  static formatSpeed(bytesPerSecond: number): string {
    return PerformanceMonitor.formatSpeed(bytesPerSecond)
  }
  
  /**
   * 格式化时间显示（工具方法）
   */
  static formatTime(seconds: number): string {
    return PerformanceMonitor.formatTime(seconds)
  }
}

// 导出所有相关类型和值
export type {
  ParallelFileUploaderOptions,
  FileInfo,
  ChunkInfo,
  FilePartInfo,
  ResGlobalInterface,
  WorkerMessage,
  ErrorType,
  UploaderError
} from './type'
export {
  UploadStepEnum,
  ChunkStatusEnum
} from './type'
export type { PerformanceMetrics } from './modules/PerformanceMonitor' 