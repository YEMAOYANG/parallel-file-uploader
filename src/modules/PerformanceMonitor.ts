import { FileInfo } from '../type'

export interface PerformanceMetrics {
  uploadSpeed: number  // 当前上传速度（字节/秒）
  averageSpeed: number  // 平均上传速度（字节/秒）
  timeRemaining: number  // 预计剩余时间（秒）
  memoryUsage?: number  // 内存使用量（MB）
  peakSpeed: number  // 峰值速度（字节/秒）
  totalBytesUploaded: number  // 总上传字节数
  startTime: number  // 开始时间
  activeConnections: number  // 活动连接数
}

export interface FileMetrics {
  fileId: string
  uploadSpeed: number
  averageSpeed: number
  bytesUploaded: number
  startTime: number
  lastUpdateTime: number
  lastBytesUploaded: number
}

/**
 * 性能监控器
 * 负责监控上传速度、内存使用等性能指标
 */
export class PerformanceMonitor {
  /** 全局性能指标 */
  private metrics: PerformanceMetrics = {
    uploadSpeed: 0,
    averageSpeed: 0,
    timeRemaining: 0,
    peakSpeed: 0,
    totalBytesUploaded: 0,
    startTime: Date.now(),
    activeConnections: 0
  }
  
  /** 每个文件的性能指标 */
  private fileMetrics: Map<string, FileMetrics> = new Map()
  
  /** 速度历史记录（用于计算平均值） */
  private speedHistory: number[] = []
  private maxHistorySize = 10
  
  /** 更新间隔（毫秒） */
  private updateInterval = 1000
  
  /** 定时器 */
  private updateTimer?: number
  
  /** 回调函数 */
  private onMetricsUpdate?: (metrics: PerformanceMetrics) => void
  
  constructor(onMetricsUpdate?: (metrics: PerformanceMetrics) => void) {
    this.onMetricsUpdate = onMetricsUpdate
  }
  
  /**
   * 开始监控
   */
  start(): void {
    if (this.updateTimer) return
    
    this.metrics.startTime = Date.now()
    this.updateTimer = window.setInterval(() => {
      this.updateMetrics()
    }, this.updateInterval)
    
    // 监控内存使用（如果浏览器支持）
    this.monitorMemory()
  }
  
  /**
   * 停止监控
   */
  stop(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer)
      this.updateTimer = undefined
    }
  }
  
  /**
   * 记录文件开始上传
   */
  recordFileStart(fileId: string): void {
    const now = Date.now()
    this.fileMetrics.set(fileId, {
      fileId,
      uploadSpeed: 0,
      averageSpeed: 0,
      bytesUploaded: 0,
      startTime: now,
      lastUpdateTime: now,
      lastBytesUploaded: 0
    })
    
    this.metrics.activeConnections++
  }
  
  /**
   * 记录文件上传进度
   */
  recordFileProgress(fileId: string, bytesUploaded: number): void {
    const fileMetric = this.fileMetrics.get(fileId)
    if (!fileMetric) return
    
    const now = Date.now()
    const timeDiff = (now - fileMetric.lastUpdateTime) / 1000  // 转换为秒
    
    if (timeDiff > 0) {
      const bytesDiff = bytesUploaded - fileMetric.lastBytesUploaded
      const speed = bytesDiff / timeDiff
      
      fileMetric.uploadSpeed = speed
      fileMetric.bytesUploaded = bytesUploaded
      fileMetric.lastUpdateTime = now
      fileMetric.lastBytesUploaded = bytesUploaded
      
      // 计算平均速度
      const totalTime = (now - fileMetric.startTime) / 1000
      if (totalTime > 0) {
        fileMetric.averageSpeed = bytesUploaded / totalTime
      }
    }
    
    // 更新总字节数
    this.updateTotalBytes()
  }
  
  /**
   * 记录文件上传完成
   */
  recordFileComplete(fileId: string): void {
    this.fileMetrics.delete(fileId)
    this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1)
  }
  
  /**
   * 更新总字节数
   */
  private updateTotalBytes(): void {
    let total = 0
    for (const metric of this.fileMetrics.values()) {
      total += metric.bytesUploaded
    }
    this.metrics.totalBytesUploaded = total
  }
  
  /**
   * 更新性能指标
   */
  private updateMetrics(): void {
    // 计算当前总速度
    let currentSpeed = 0
    for (const metric of this.fileMetrics.values()) {
      currentSpeed += metric.uploadSpeed
    }
    
    this.metrics.uploadSpeed = currentSpeed
    
    // 更新速度历史
    this.speedHistory.push(currentSpeed)
    if (this.speedHistory.length > this.maxHistorySize) {
      this.speedHistory.shift()
    }
    
    // 计算平均速度
    if (this.speedHistory.length > 0) {
      const sum = this.speedHistory.reduce((a, b) => a + b, 0)
      this.metrics.averageSpeed = sum / this.speedHistory.length
    }
    
    // 更新峰值速度
    if (currentSpeed > this.metrics.peakSpeed) {
      this.metrics.peakSpeed = currentSpeed
    }
    
    // 计算剩余时间（需要外部提供总大小和已上传大小）
    // 这里只是占位，实际计算需要在上传器中进行
    
    // 触发回调
    if (this.onMetricsUpdate) {
      this.onMetricsUpdate(this.metrics)
    }
  }
  
  /**
   * 监控内存使用
   */
  private monitorMemory(): void {
    if ('memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory
      this.metrics.memoryUsage = memory.usedJSHeapSize / 1024 / 1024  // 转换为MB
    }
  }
  
  /**
   * 计算剩余时间
   */
  calculateTimeRemaining(totalSize: number, uploadedSize: number): number {
    if (this.metrics.averageSpeed <= 0) return Infinity
    
    const remainingBytes = totalSize - uploadedSize
    const timeRemaining = remainingBytes / this.metrics.averageSpeed
    
    this.metrics.timeRemaining = timeRemaining
    return timeRemaining
  }
  
  /**
   * 获取当前性能指标
   */
  getMetrics(): PerformanceMetrics & { getFileMetrics: (fileId: string) => FileMetrics | undefined } {
    return { 
      ...this.metrics,
      getFileMetrics: (fileId: string) => this.fileMetrics.get(fileId)
    }
  }
  
  /**
   * 格式化速度显示
   */
  static formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond < 1024) {
      return `${bytesPerSecond.toFixed(0)} B/s`
    } else if (bytesPerSecond < 1024 * 1024) {
      return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`
    } else {
      return `${(bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`
    }
  }
  
  /**
   * 格式化时间显示
   */
  static formatTime(seconds: number): string {
    if (!isFinite(seconds)) return '未知'
    
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`
    } else if (minutes > 0) {
      return `${minutes}分钟${secs}秒`
    } else {
      return `${secs}秒`
    }
  }
  
  /**
   * 重置监控器
   */
  reset(): void {
    this.metrics = {
      uploadSpeed: 0,
      averageSpeed: 0,
      timeRemaining: 0,
      peakSpeed: 0,
      totalBytesUploaded: 0,
      startTime: Date.now(),
      activeConnections: 0
    }
    
    this.fileMetrics.clear()
    this.speedHistory = []
  }
  
  /**
   * 销毁监控器
   */
  destroy(): void {
    this.stop()
    this.reset()
  }
} 