import { v4 as uuid } from 'uuid'
import { FileInfo, UploadStepEnum, ParallelFileUploaderOptions, UploaderError, ErrorType } from '../type'

/**
 * 文件管理器
 * 负责文件的添加、验证、状态管理等
 */
export class FileManager {
  /** 等待上传的文件队列 */
  private fileQueue: FileInfo[] = []
  /** 当前正在上传的文件映射表 */
  private activeFiles: Map<string, FileInfo> = new Map()
  /** 已完成的文件映射表 */
  private completedFiles: Map<string, FileInfo> = new Map()
  
  // 配置
  private maxFileSize?: number
  private allowedFileTypes?: string[]
  
  // 回调
  private onFileAdded?: (fileInfo: FileInfo) => void
  private onFileRejected?: (file: File, reason: string) => void
  
  constructor(options: ParallelFileUploaderOptions) {
    this.maxFileSize = options.maxFileSize
    this.allowedFileTypes = options.allowedFileTypes
    this.onFileAdded = options.onFileAdded
    this.onFileRejected = options.onFileRejected
  }
  
  /**
   * 添加文件到队列
   */
  addFiles(files: File[] | FileList): FileInfo[] {
    const fileArray = Array.from(files)
    const addedFiles: FileInfo[] = []
    
    for (const file of fileArray) {
      try {
        // 验证文件
        this.validateFile(file)
        
        // 创建文件信息
        const fileInfo = this.createFileInfo(file)
        this.fileQueue.push(fileInfo)
        addedFiles.push(fileInfo)
        
        // 触发回调
        if (this.onFileAdded) {
          this.onFileAdded(fileInfo)
        }
      } catch (error) {
        if (error instanceof UploaderError && this.onFileRejected) {
          this.onFileRejected(file, error.message)
        }
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
      const fileType = file.type
      const fileExtension = this.getFileExtension(file.name)
      
      if (!this.isFileTypeAllowed(fileType, fileExtension)) {
        throw new UploaderError(
          `File type not allowed: ${fileType || fileExtension}`,
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
   * 创建文件信息对象
   */
  private createFileInfo(file: File): FileInfo {
    return {
      fileId: uuid(),
      fileName: file.name,
      fileSize: file.size,
      uploadedSize: 0,
      progress: 0,
      status: UploadStepEnum.beforeUpload,
      file,
      mimeType: file.type,
      lastUpdated: Date.now()
    }
  }
  
  /**
   * 获取文件扩展名
   */
  private getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.')
    return lastDotIndex >= 0 ? filename.substring(lastDotIndex) : ''
  }
  
  /**
   * 检查文件类型是否允许
   */
  private isFileTypeAllowed(fileType: string, fileExtension: string): boolean {
    if (!this.allowedFileTypes) return true
    
    return this.allowedFileTypes.some(allowedType => {
      if (allowedType.endsWith('/*')) {
        const baseType = allowedType.slice(0, -2)
        return fileType.startsWith(baseType + '/')
      }
      
      if (allowedType.startsWith('.')) {
        return fileExtension === allowedType
      }
      
      return fileType === allowedType
    })
  }
  
  /**
   * 获取下一个待处理的文件
   */
  getNextFile(): FileInfo | null {
    return this.fileQueue.shift() || null
  }
  
  /**
   * 将文件标记为活动状态
   */
  setFileActive(fileInfo: FileInfo): void {
    this.activeFiles.set(fileInfo.fileId, fileInfo)
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
  getActiveFiles(): FileInfo[] {
    return Array.from(this.activeFiles.values())
  }
  
  /**
   * 获取活动文件数量
   */
  getActiveFileCount(): number {
    return this.activeFiles.size
  }
  
  /**
   * 将文件标记为完成
   */
  setFileCompleted(fileInfo: FileInfo): void {
    this.activeFiles.delete(fileInfo.fileId)
    this.completedFiles.set(fileInfo.fileId, fileInfo)
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
  updateFileProgress(fileId: string, uploadedSize: number, progress: number): void {
    const fileInfo = this.activeFiles.get(fileId)
    if (fileInfo) {
      fileInfo.uploadedSize = uploadedSize
      fileInfo.progress = progress
      fileInfo.lastUpdated = Date.now()
    }
  }
  
  /**
   * 获取文件队列统计
   */
  getStats() {
    const stats = {
      queued: this.fileQueue.length,
      active: this.activeFiles.size,
      completed: this.completedFiles.size,
      failed: 0,
      paused: 0
    }
    
    // 统计失败和暂停的文件
    this.activeFiles.forEach(file => {
      if (file.status === UploadStepEnum.error) stats.failed++
      if (file.status === UploadStepEnum.pause) stats.paused++
    })
    
    return stats
  }
  
  /**
   * 清理文件
   */
  cleanupFile(fileId: string): void {
    this.activeFiles.delete(fileId)
  }
  
  /**
   * 清理所有文件
   */
  cleanupAll(): void {
    this.fileQueue = []
    this.activeFiles.clear()
    this.completedFiles.clear()
  }
} 