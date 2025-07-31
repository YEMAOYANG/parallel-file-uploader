/**
 * 全局响应接口
 * 统一的API响应格式
 */
export interface ResGlobalInterface<T> {
  /** 请求是否成功 */
  isSuccess: boolean
  /** 响应数据 */
  data: T
  /** 错误或提示消息 */
  message?: string
  /** 响应状态码 */
  code?: number
}

/**
 * 文件上传状态枚举
 */
export enum UploadStepEnum {
  /** 上传前准备阶段 */
  beforeUpload = 'beforeUpload',
  /** 正在上传 */
  upload = 'upload',
  /** 上传完成 */
  complete = 'complete',
  /** 上传错误 */
  error = 'error',
  /** 上传暂停 */
  pause = 'pause',
  /** 等待上传 */
  waiting = 'waiting',
}

/**
 * 分片状态枚举
 */
export enum ChunkStatusEnum {
  /** 等待上传 */
  waiting = 'waiting',
  /** 正在上传 */
  uploading = 'uploading',
  /** 上传成功 */
  success = 'success',
  /** 上传错误 */
  error = 'error',
  /** 上传暂停 */
  pause = 'pause',
}

/**
 * 文件分片信息接口
 * 用于断点续传时记录已上传的分片
 */
export interface FilePartInfo {
  /** 分片的ETag标识 */
  etag: string
  /** 分片编号，从1开始 */
  partNumber: number
  /** 分片大小（字节） */
  partSize?: number
  /** 最后修改时间 */
  lastModified?: number
}

/**
 * 分片信息接口
 * 包含分片的所有相关信息
 */
export interface ChunkInfo {
  /** 分片文件对象 */
  file?: File
  /** 在原文件中的起始位置 */
  start: number
  /** 在原文件中的结束位置 */
  end: number
  /** 分片编号，从1开始 */
  partNumber: number
  /** 重试次数 */
  retryCount?: number
  /** 上传耗时（毫秒） */
  uploadTime?: number
  /** 分片大小（字节） */
  partSize?: number | any
  /** 分片状态 */
  status?: ChunkStatusEnum
}

/**
 * 文件信息接口
 * 包含文件的所有相关信息和上传状态
 */
export interface FileInfo {
  /** 文件唯一标识符 */
  fileId: string
  /** 文件名 */
  fileName: string
  /** 文件大小（字节） */
  fileSize: number
  /** 已上传大小（字节） */
  uploadedSize: number
  /** 上传进度百分比 (0-100) */
  progress: number
  /** 文件上传状态 */
  status: UploadStepEnum
  /** 原始文件对象 */
  file: File
  /** 错误消息 */
  errorMessage?: string
  /** 最后更新时间戳 */
  lastUpdated?: number
  /** 文件MIME类型 */
  mimeType?: string
  /** 总分片数量 */
  totalChunks?: number
  /** 上传相关信息 */
  uploadInfo?: {
    /** 已上传的分片列表 */
    parts?: Array<FilePartInfo>
    /** 文件MD5值 */
    md5?: string
    /** 其他扩展字段 */
    [key: string]: any
  }
  /** 自定义上传数据 */
  uploadData?: any
}

/**
 * 并行文件上传器配置选项
 */
export interface ParallelFileUploaderOptions {
  // 全局配置
  /** 最大并发上传文件数，默认3 */
  maxConcurrentFiles?: number
  /** 每个文件最大并发分片数，默认3 */
  maxConcurrentChunks?: number
  /** 分片大小（字节），默认5MB */
  chunkSize?: number
  /** 最大重试次数，默认3 */
  maxRetries?: number
  /** 最大文件大小限制（字节） */
  maxFileSize?: number
  /** 
   * 🔧 允许的文件类型列表，支持MIME类型和扩展名
   * 支持 "*" 通配符表示允许所有文件类型
   * @example ['image/*', '.pdf', 'application/json', '*']
   */
  allowedFileTypes?: string[]
  /** 分片上传URL（已废弃，建议使用sendFilePartToServer） */
  uploadPartUrl?: string
  /** 重试延迟时间（毫秒），默认1000 */
  retryDelay?: number
  /** 是否自动开始上传，默认true */
  autoStart?: boolean

  // 🔧 新增功能配置
  /** 是否启用调试模式，默认false */
  debugMode?: boolean

  // 新增功能配置 - 默认均不启用
  /** 是否启用速度限制，默认false */
  enableSpeedLimit?: boolean
  /** 最大上传速度（字节/秒），0表示不限制 */
  maxUploadSpeed?: number
  /** 是否启用性能监控，默认false */
  enablePerformanceMonitor?: boolean
  /** 是否启用队列持久化，默认false */
  enableQueuePersistence?: boolean
  /** 持久化存储的键名，默认'parallel-uploader-queue' */
  persistenceKey?: string

  // 回调函数
  /** 文件添加到队列时的回调 */
  onFileAdded?: (fileInfo: FileInfo) => void
  /** 文件上传进度更新时的回调 */
  onFileProgress?: (fileInfo: FileInfo) => void
  /** 文件上传成功时的回调 */
  onFileSuccess?: (params: { fileInfo: FileInfo; data: any }) => void
  /** 文件上传失败时的回调 */
  onFileError?: (fileInfo: FileInfo, error: Error) => void
  /** 文件上传完成时的回调（无论成功失败） */
  onFileComplete?: (params: { fileInfo: FileInfo; data: any }) => void
  /** 所有文件上传完成时的回调 */
  onAllComplete?: () => void
  /** 文件被拒绝时的回调（如文件类型不匹配、大小超限等） */
  onFileRejected?: (file: File, reason: string) => void
  /** 性能监控数据更新时的回调 */
  onPerformanceUpdate?: (data: any) => void

  // 服务器交互回调
  /** 初始化文件上传，向服务器发送文件信息 */
  sendFileInfoToServer?: (fileInfo: FileInfo) => Promise<ResGlobalInterface<any>>
  /** 上传文件分片到服务器 */
  sendFilePartToServer?: (
    fileInfo: FileInfo,
    chunkInfo: ChunkInfo
  ) => Promise<ResGlobalInterface<any>>
  /** 通知服务器文件上传完成，进行文件合并 */
  sendFileCompleteToServer?: (fileInfo: FileInfo) => Promise<ResGlobalInterface<any>>
  /** 从服务器获取已上传的分片信息（用于断点续传） */
  getFilePartsFromServer?: (fileInfo: FileInfo) => Promise<ResGlobalInterface<FilePartInfo[]>>
  /** 通知服务器暂停上传 */
  sendPauseToServer?: (fileInfo: FileInfo) => Promise<ResGlobalInterface<any>>
}

/**
 * Worker消息接口
 * 用于主线程与Worker之间的通信
 */
export interface WorkerMessage {
  /** 消息类型 */
  type: 'data' | 'response' | 'error' | 'ready' | 'abort'
  /** 文件ID */
  fileId?: string
  /** 分片信息 */
  chunkInfo?: ChunkInfo
  /** 分片数据 */
  chunk?: Blob | ArrayBuffer
  /** 上传URL（已废弃） */
  uploadUrl?: string
  /** 处理结果 */
  result?: any
  /** 错误信息 */
  error?: string
  /** 是否已处理标记 */
  processed?: boolean
}

/**
 * 上传器错误类型枚举
 */
export enum ErrorType {
  /** 网络错误 */
  NETWORK = 'NETWORK',
  /** 文件过大错误 */
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  /** 文件类型不允许错误 */
  FILE_TYPE_NOT_ALLOWED = 'FILE_TYPE_NOT_ALLOWED',
  /** 服务器错误 */
  SERVER_ERROR = 'SERVER_ERROR',
  /** 分片上传失败错误 */
  CHUNK_UPLOAD_FAILED = 'CHUNK_UPLOAD_FAILED',
  /** 文件初始化失败错误 */
  FILE_INITIALIZATION_FAILED = 'FILE_INITIALIZATION_FAILED',
  /** 未知错误 */
  UNKNOWN = 'UNKNOWN',
}

/**
 * 自定义错误类
 * 提供详细的错误信息和类型分类
 */
export class UploaderError extends Error {
  /** 错误类型 */
  type: ErrorType
  /** 相关的文件信息 */
  fileInfo?: FileInfo

  /**
   * 构造函数
   * @param message 错误消息
   * @param type 错误类型
   * @param fileInfo 相关的文件信息
   */
  constructor(message: string, type: ErrorType, fileInfo?: FileInfo) {
    super(message)
    this.name = 'UploaderError'
    this.type = type
    this.fileInfo = fileInfo
  }
}
