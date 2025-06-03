export interface ResGlobalInterface<T> {
  isSuccess: boolean
  data: T
  message?: string
  code?: number
}

export enum UploadStepEnum {
  beforeUpload = 'beforeUpload',
  upload = 'upload',
  complete = 'complete',
  error = 'error',
  pause = 'pause',
  waiting = 'waiting',
}

export enum ChunkStatusEnum {
  waiting = 'waiting',
  uploading = 'uploading',
  success = 'success',
  error = 'error',
  pause = 'pause',
}

export interface FilePartInfo {
  etag: string
  partNumber: number
  partSize: number
  lastModified?: number
}

export interface ChunkInfo {
  file?: File
  start: number
  end: number
  partNumber: number
  retryCount?: number
  uploadTime?: number
  partSize?: number | any
  status?: ChunkStatusEnum
}

export interface FileInfo {
  fileId: string
  fileName: string
  fileSize: number
  uploadedSize: number
  progress: number
  status: UploadStepEnum
  file: File
  errorMessage?: string
  lastUpdated?: number
  mimeType?: string
  totalChunks?: number
  uploadInfo?: {
    parts?: Array<FilePartInfo>
    md5?: string
    [key: string]: any
  }
  uploadData?: any
}

export interface ParallelFileUploaderOptions {
  // 全局配置
  maxConcurrentFiles?: number
  maxConcurrentChunks?: number
  chunkSize?: number
  maxRetries?: number
  useWorker?: boolean
  maxFileSize?: number
  allowedFileTypes?: string[]
  uploadPartUrl?: string
  retryDelay?: number
  autoStart?: boolean

  // 新增配置项
  enablePerformanceMonitor?: boolean  // 是否启用性能监控
  enableQueuePersistence?: boolean    // 是否启用队列持久化
  enableSpeedLimit?: boolean          // 是否启用速度限制
  speedLimit?: number                 // 速度限制（字节/秒）
  persistenceKey?: string             // 持久化存储键名

  // 回调函数
  onFileAdded?: (fileInfo: FileInfo) => void
  onFileProgress?: (fileInfo: FileInfo) => void
  onFileSuccess?: (params: { fileInfo: FileInfo; data: any }) => void
  onFileError?: (fileInfo: FileInfo, error: Error) => void
  onFileComplete?: (params: { fileInfo: FileInfo; data: any }) => void
  onAllComplete?: () => void
  onFileRejected?: (file: File, reason: string) => void
  
  // 新增回调
  onPerformanceUpdate?: (metrics: any) => void  // 性能指标更新回调

  // 服务器交互回调
  sendFileInfoToServer?: (fileInfo: FileInfo) => Promise<ResGlobalInterface<any>>
  sendFilePartToServer?: (
    fileInfo: FileInfo,
    chunkInfo: ChunkInfo
  ) => Promise<ResGlobalInterface<any>>
  sendFileCompleteToServer?: (fileInfo: FileInfo) => Promise<ResGlobalInterface<any>>
  getFilePartsFromServer?: (fileInfo: FileInfo) => Promise<ResGlobalInterface<FilePartInfo[]>>
  sendPauseToServer?: (fileInfo: FileInfo) => Promise<ResGlobalInterface<any>>
}

export interface WorkerMessage {
  type: 'upload' | 'process' | 'response' | 'error' | 'ready' | 'abort'
  fileId?: string
  chunkInfo?: ChunkInfo
  chunk?: Blob | ArrayBuffer
  uploadUrl?: string
  result?: any
  error?: string
  processed?: boolean
}

/**
 * 上传器错误类型
 */
export enum ErrorType {
  NETWORK = 'NETWORK',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  FILE_TYPE_NOT_ALLOWED = 'FILE_TYPE_NOT_ALLOWED',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN',
}

/**
 * 自定义错误类
 */
export class UploaderError extends Error {
  type: ErrorType
  fileInfo?: FileInfo

  constructor(message: string, type: ErrorType, fileInfo?: FileInfo) {
    super(message)
    this.name = 'UploaderError'
    this.type = type
    this.fileInfo = fileInfo
  }
}
