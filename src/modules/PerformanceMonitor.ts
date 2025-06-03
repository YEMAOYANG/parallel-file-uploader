/**
 * 性能监控数据接口
 */
export interface PerformanceData {
  // 速度相关
  currentSpeed: number // 当前上传速度 (bytes/s)
  averageSpeed: number // 平均上传速度 (bytes/s)
  peakSpeed: number // 峰值速度 (bytes/s)
  
  // 内存相关
  memoryUsage?: {
    used: number // 已使用内存 (bytes)
    total: number // 总内存 (bytes)
    percentage: number // 使用百分比
  }
  
  // 网络相关
  activeConnections: number // 活跃连接数
  bytesTransferred: number // 总传输字节数
  
  // 时间相关
  elapsedTime: number // 已用时间 (ms)
  estimatedTimeRemaining?: number // 预估剩余时间 (ms)
  
  // 文件相关
  activeFiles: number // 活跃文件数
  totalFiles: number // 总文件数
  
  timestamp: number // 时间戳
}

/**
 * 性能监控器
 * 监控上传速度、内存使用、连接数等性能指标
 */
export class PerformanceMonitor {
  private enabled: boolean = false
  private startTime: number = 0
  private lastMeasureTime: number = 0
  private lastBytesTransferred: number = 0
  private totalBytesTransferred: number = 0
  private speedHistory: number[] = []
  private peakSpeed: number = 0
  private activeConnections: number = 0
  private activeFiles: number = 0
  private totalFiles: number = 0
  private maxHistorySize: number = 10

  constructor(enabled: boolean = false) {
    this.enabled = enabled
    this.reset()
  }

  /**
   * 启用/禁用性能监控
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (enabled && this.startTime === 0) {
      this.reset()
    }
  }

  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * 重置监控数据
   */
  reset(): void {
    this.startTime = Date.now()
    this.lastMeasureTime = this.startTime
    this.lastBytesTransferred = 0
    this.totalBytesTransferred = 0
    this.speedHistory = []
    this.peakSpeed = 0
    this.activeConnections = 0
    this.activeFiles = 0
    this.totalFiles = 0
  }

  /**
   * 记录字节传输
   */
  recordBytesTransferred(bytes: number): void {
    if (!this.enabled) return
    
    this.totalBytesTransferred += bytes
  }

  /**
   * 设置活跃连接数
   */
  setActiveConnections(count: number): void {
    if (!this.enabled) return
    
    this.activeConnections = count
  }

  /**
   * 设置文件数量
   */
  setFileStats(active: number, total: number): void {
    if (!this.enabled) return
    
    this.activeFiles = active
    this.totalFiles = total
  }

  /**
   * 计算当前速度
   */
  private calculateCurrentSpeed(): number {
    const now = Date.now()
    const timeDiff = now - this.lastMeasureTime
    
    if (timeDiff === 0) return 0
    
    const bytesDiff = this.totalBytesTransferred - this.lastBytesTransferred
    const speed = (bytesDiff / timeDiff) * 1000 // bytes per second
    
    this.lastMeasureTime = now
    this.lastBytesTransferred = this.totalBytesTransferred
    
    return speed
  }

  /**
   * 更新速度历史
   */
  private updateSpeedHistory(speed: number): void {
    this.speedHistory.push(speed)
    
    // 保持历史记录在最大长度内
    if (this.speedHistory.length > this.maxHistorySize) {
      this.speedHistory.shift()
    }
    
    // 更新峰值速度
    if (speed > this.peakSpeed) {
      this.peakSpeed = speed
    }
  }

  /**
   * 计算平均速度
   */
  private calculateAverageSpeed(): number {
    if (this.speedHistory.length === 0) return 0
    
    const sum = this.speedHistory.reduce((acc, speed) => acc + speed, 0)
    return sum / this.speedHistory.length
  }

  /**
   * 获取内存使用情况
   */
  private getMemoryUsage(): PerformanceData['memoryUsage'] | undefined {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in window.performance) {
      const memory = (window.performance as any).memory
      if (memory) {
        return {
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          percentage: Math.round((memory.usedJSHeapSize / memory.totalJSHeapSize) * 100)
        }
      }
    }
    return undefined
  }

  /**
   * 计算预估剩余时间
   */
  private calculateEstimatedTimeRemaining(currentSpeed: number, remainingBytes: number): number | undefined {
    if (currentSpeed <= 0 || remainingBytes <= 0) return undefined
    
    return Math.round(remainingBytes / currentSpeed * 1000) // 转换为毫秒
  }

  /**
   * 获取性能数据
   */
  getPerformanceData(remainingBytes: number = 0): PerformanceData {
    if (!this.enabled) {
      return {
        currentSpeed: 0,
        averageSpeed: 0,
        peakSpeed: 0,
        activeConnections: 0,
        bytesTransferred: 0,
        elapsedTime: 0,
        activeFiles: 0,
        totalFiles: 0,
        timestamp: Date.now()
      }
    }

    const currentSpeed = this.calculateCurrentSpeed()
    this.updateSpeedHistory(currentSpeed)
    
    const now = Date.now()
    const elapsedTime = now - this.startTime
    
    return {
      currentSpeed,
      averageSpeed: this.calculateAverageSpeed(),
      peakSpeed: this.peakSpeed,
      memoryUsage: this.getMemoryUsage(),
      activeConnections: this.activeConnections,
      bytesTransferred: this.totalBytesTransferred,
      elapsedTime,
      estimatedTimeRemaining: this.calculateEstimatedTimeRemaining(currentSpeed, remainingBytes),
      activeFiles: this.activeFiles,
      totalFiles: this.totalFiles,
      timestamp: now
    }
  }

  /**
   * 格式化速度为人类可读格式
   */
  static formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond === 0) return '0 B/s'
    
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
    const base = 1024
    const unitIndex = Math.floor(Math.log(bytesPerSecond) / Math.log(base))
    const size = bytesPerSecond / Math.pow(base, unitIndex)
    
    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  /**
   * 格式化时间为人类可读格式
   */
  static formatTime(milliseconds: number): string {
    if (milliseconds < 1000) return `${Math.round(milliseconds)}ms`
    
    const seconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  /**
   * 格式化内存大小为人类可读格式
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const base = 1024
    const unitIndex = Math.floor(Math.log(bytes) / Math.log(base))
    const size = bytes / Math.pow(base, unitIndex)
    
    return `${size.toFixed(1)} ${units[unitIndex]}`
  }
} 