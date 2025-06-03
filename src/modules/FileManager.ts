import { v4 as uuid } from 'uuid'
import { FileInfo, UploadStepEnum, ErrorType, UploaderError } from '../type'

/**
 * 文件管理器
 * 负责文件队列管理、文件验证、状态管理等
 */
export class FileManager {
  private fileQueue: FileInfo[] = []
  private activeFiles: Map<string, FileInfo> = new Map()
  private maxFileSize?: number
  private allowedFileTypes?: string[]

  constructor(options: {
    maxFileSize?: number
    allowedFileTypes?: string[]
  } = {}) {
    this.maxFileSize = options.maxFileSize
    this.allowedFileTypes = options.allowedFileTypes
  }

  /**
   * 添加文件到队列
   */
  addFiles(files: File[] | FileList): FileInfo[] {
    const fileArray = Array.from(files)
    const addedFiles: FileInfo[] = []

    for (const file of fileArray) {
      try {
        this.validateFile(file)
        
        const fileId = uuid()
        const fileInfo: FileInfo = {
          fileId,
          fileName: file.name,
          fileSize: file.size,
          uploadedSize: 0,
          progress: 0,
          status: UploadStepEnum.beforeUpload,
          file,
          mimeType: file.type,
          lastUpdated: Date.now(),
        }

        this.fileQueue.push(fileInfo)
        addedFiles.push(fileInfo)
      } catch (error) {
        // 验证失败的文件会抛出错误，由调用方处理
        throw error
      }
    }

    return addedFiles
  }

  /**
   * 验证文件
   */
  private validateFile(file: File): void {
    // 验证文件类型
    if (this.allowedFileTypes && this.allowedFileTypes.length > 0) {
      const fileType = file.type || this.getFileExtension(file.name)
      if (!this.isFileTypeAllowed(fileType)) {
        throw new UploaderError(
          `File type not allowed: ${fileType}`,
          ErrorType.FILE_TYPE_NOT_ALLOWED
        )
      }
    }

    // 验证文件大小
    if (this.maxFileSize && file.size > this.maxFileSize) {
      throw new UploaderError(
        `File size exceeds limit: ${file.size} > ${this.maxFileSize}`,
        ErrorType.FILE_TOO_LARGE
      )
    }
  }

  /**
   * 从队列中获取下一个文件
   */
  getNextFile(): FileInfo | undefined {
    return this.fileQueue.shift()
  }

  /**
   * 添加文件到活动列表
   */
  addToActive(fileInfo: FileInfo): void {
    this.activeFiles.set(fileInfo.fileId, fileInfo)
  }

  /**
   * 从活动列表中移除文件
   */
  removeFromActive(fileId: string): void {
    this.activeFiles.delete(fileId)
  }

  /**
   * 获取活动文件
   */
  getActiveFile(fileId: string): FileInfo | undefined {
    return this.activeFiles.get(fileId)
  }

  /**
   * 获取所有活动文件
   */
  getAllActiveFiles(): FileInfo[] {
    return Array.from(this.activeFiles.values())
  }

  /**
   * 更新文件状态
   */
  updateFileStatus(fileId: string, status: UploadStepEnum): void {
    const fileInfo = this.activeFiles.get(fileId)
    if (fileInfo) {
      fileInfo.status = status
      fileInfo.lastUpdated = Date.now()
    }
  }

  /**
   * 更新文件进度
   */
  updateFileProgress(fileId: string, uploadedSize: number): void {
    const fileInfo = this.activeFiles.get(fileId)
    if (fileInfo) {
      fileInfo.uploadedSize = uploadedSize
      fileInfo.progress = Math.round((uploadedSize / fileInfo.fileSize) * 100)
      fileInfo.lastUpdated = Date.now()
    }
  }

  /**
   * 获取队列长度
   */
  getQueueLength(): number {
    return this.fileQueue.length
  }

  /**
   * 获取活动文件数量
   */
  getActiveCount(): number {
    return this.activeFiles.size
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    this.fileQueue = []
  }

  /**
   * 清空活动文件
   */
  clearActive(): void {
    this.activeFiles.clear()
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    queued: number
    active: number
    completed: number
    failed: number
    paused: number
  } {
    const queued = this.fileQueue.length
    let active = 0
    let completed = 0
    let failed = 0
    let paused = 0

    for (const fileInfo of this.activeFiles.values()) {
      switch (fileInfo.status) {
        case UploadStepEnum.upload:
          active++
          break
        case UploadStepEnum.complete:
          completed++
          break
        case UploadStepEnum.error:
          failed++
          break
        case UploadStepEnum.pause:
          paused++
          break
      }
    }

    return { queued, active, completed, failed, paused }
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.')
    return lastDotIndex !== -1 ? filename.substring(lastDotIndex + 1).toLowerCase() : ''
  }

  /**
   * 检查文件类型是否允许
   */
  private isFileTypeAllowed(fileType: string): boolean {
    if (!this.allowedFileTypes || this.allowedFileTypes.length === 0) {
      return true
    }

    // 处理MIME类型
    if (fileType.includes('/')) {
      return this.allowedFileTypes.some((type) => {
        // 完全匹配 (image/png)
        if (type === fileType) return true
        // 通配符匹配 (image/*)
        if (type.endsWith('/*') && fileType.startsWith(type.split('/*')[0])) return true
        return false
      })
    }

    // 处理扩展名
    return (
      this.allowedFileTypes.includes(`.${fileType}`) || this.allowedFileTypes.includes(fileType)
    )
  }
} 