import { v4 as uuid } from 'uuid'
import { FileInfo, UploadStepEnum, ErrorType, UploaderError } from '../type'

/**
 * 文件大小格式化工具
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

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
    // 🔧 处理文件类型配置，自动过滤无效配置
    this.allowedFileTypes = this.processAllowedFileTypes(options.allowedFileTypes)
  }

  /**
   * 🔧 处理和验证允许的文件类型配置
   */
  private processAllowedFileTypes(types?: string[]): string[] | undefined {
    if (!types || types.length === 0) {
      return undefined
    }

    // 处理通配符和无效配置
    const processedTypes = types.filter((type) => {
      // 支持 "*" 通配符，表示允许所有文件类型
      if (type === '*') {
        console.log('📁 检测到通配符 "*"，将允许所有文件类型')
        return false // 返回 undefined 表示不限制
      }
      
      // 过滤空字符串
      if (!type || type.trim() === '') {
        console.warn('⚠️ 检测到空的文件类型配置，已忽略')
        return false
      }
      
      return true
    })

    // 如果包含 "*" 或处理后为空，表示不限制文件类型
    if (types.includes('*') || processedTypes.length === 0) {
      console.log('📁 文件类型验证已禁用，允许所有文件类型')
      return undefined
    }

    console.log('📁 有效的文件类型限制:', processedTypes)
    return processedTypes
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
        // 🔧 增强错误信息，包含文件详情
        if (error instanceof UploaderError) {
          // 添加文件详情到错误信息
          error.message = `文件 "${file.name}" (${formatFileSize(file.size)}) 验证失败: ${error.message}`
        }
        throw error
      }
    }

    return addedFiles
  }

  /**
   * 🔧 增强的文件验证方法
   */
  private validateFile(file: File): void {
    // 🔧 基础文件验证
    if (!file || !file.name) {
      throw new UploaderError(
        '无效的文件对象',
        ErrorType.FILE_TYPE_NOT_ALLOWED
      )
    }

    // 🔧 文件大小为0的检查
    if (file.size === 0) {
      throw new UploaderError(
        '文件大小为0，无法上传空文件',
        ErrorType.FILE_TOO_LARGE
      )
    }

    // 验证文件类型
    if (this.allowedFileTypes && this.allowedFileTypes.length > 0) {
      const fileType = file.type || this.getFileExtension(file.name)
      if (!this.isFileTypeAllowed(fileType, file.name)) {
        const supportedTypes = this.getSupportedTypesDescription()
        throw new UploaderError(
          `不支持的文件类型: ${fileType || '未知类型'}。支持的类型: ${supportedTypes}`,
          ErrorType.FILE_TYPE_NOT_ALLOWED
        )
      }
    }

    // 验证文件大小
    if (this.maxFileSize && file.size > this.maxFileSize) {
      throw new UploaderError(
        `文件大小超出限制: ${formatFileSize(file.size)} > ${formatFileSize(this.maxFileSize)}`,
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
   * 🔧 增强的文件类型检查方法
   */
  private isFileTypeAllowed(fileType: string, fileName: string): boolean {
    if (!this.allowedFileTypes || this.allowedFileTypes.length === 0) {
      return true
    }

    // 获取文件扩展名
    const extension = this.getFileExtension(fileName)

    return this.allowedFileTypes.some((type) => {
      // 🔧 支持 "*" 通配符
      if (type === '*') {
        return true
      }

      // 处理MIME类型
      if (type.includes('/')) {
        // 完全匹配 (image/png)
        if (type === fileType) return true
        // 通配符匹配 (image/*)
        if (type.endsWith('/*') && fileType.startsWith(type.split('/*')[0])) return true
        return false
      }

      // 处理扩展名 - 支持多种格式
      const normalizedType = type.toLowerCase()
      const normalizedExt = extension.toLowerCase()
      
      // 支持 .pdf, pdf, PDF 等格式
      if (normalizedType === `.${normalizedExt}` || 
          normalizedType === normalizedExt ||
          normalizedType === `.${normalizedExt.toLowerCase()}`) {
        return true
      }

      return false
    })
  }

  /**
   * 🔧 获取支持的文件类型描述
   */
  private getSupportedTypesDescription(): string {
    if (!this.allowedFileTypes || this.allowedFileTypes.length === 0) {
      return '所有文件类型'
    }

    if (this.allowedFileTypes.includes('*')) {
      return '所有文件类型'
    }

    // 限制显示的类型数量，避免过长
    if (this.allowedFileTypes.length <= 5) {
      return this.allowedFileTypes.join(', ')
    }

    return `${this.allowedFileTypes.slice(0, 3).join(', ')} 等 ${this.allowedFileTypes.length} 种类型`
  }

  /**
   * 🔧 获取当前配置信息（用于调试）
   */
  getConfiguration(): {
    maxFileSize?: string
    allowedFileTypes?: string[]
    supportedTypesDescription: string
  } {
    return {
      maxFileSize: this.maxFileSize ? formatFileSize(this.maxFileSize) : undefined,
      allowedFileTypes: this.allowedFileTypes,
      supportedTypesDescription: this.getSupportedTypesDescription()
    }
  }
} 