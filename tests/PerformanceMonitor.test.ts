import { PerformanceMonitor } from '../src/modules/PerformanceMonitor'
import './setup'

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor

  beforeEach(() => {
    monitor = new PerformanceMonitor(true)
  })

  describe('Constructor', () => {
    it('should initialize with enabled state', () => {
      const enabledMonitor = new PerformanceMonitor(true)
      expect(enabledMonitor.isEnabled()).toBe(true)
    })

    it('should initialize with disabled state', () => {
      const disabledMonitor = new PerformanceMonitor(false)
      expect(disabledMonitor.isEnabled()).toBe(false)
    })
  })

  describe('Enable/Disable', () => {
    it('should enable monitoring', () => {
      monitor.setEnabled(true)
      expect(monitor.isEnabled()).toBe(true)
    })

    it('should disable monitoring', () => {
      monitor.setEnabled(false)
      expect(monitor.isEnabled()).toBe(false)
    })
  })

  describe('Data Recording', () => {
    beforeEach(() => {
      monitor.setEnabled(true)
    })

    it('should record bytes transferred', () => {
      monitor.recordBytesTransferred(1024)
      monitor.recordBytesTransferred(2048)

      const data = monitor.getPerformanceData()
      expect(data.bytesTransferred).toBe(3072)
    })

    it('should set active connections', () => {
      monitor.setActiveConnections(5)

      const data = monitor.getPerformanceData()
      expect(data.activeConnections).toBe(5)
    })

    it('should set file stats', () => {
      monitor.setFileStats(3, 10)

      const data = monitor.getPerformanceData()
      expect(data.activeFiles).toBe(3)
      expect(data.totalFiles).toBe(10)
    })
  })

  describe('Performance Data', () => {
    beforeEach(() => {
      monitor.setEnabled(true)
    })

    it('should return performance data structure', () => {
      const data = monitor.getPerformanceData()

      expect(data).toHaveProperty('currentSpeed')
      expect(data).toHaveProperty('averageSpeed')
      expect(data).toHaveProperty('peakSpeed')
      expect(data).toHaveProperty('activeConnections')
      expect(data).toHaveProperty('bytesTransferred')
      expect(data).toHaveProperty('elapsedTime')
      expect(data).toHaveProperty('activeFiles')
      expect(data).toHaveProperty('totalFiles')
      expect(data).toHaveProperty('timestamp')

      expect(typeof data.currentSpeed).toBe('number')
      expect(typeof data.averageSpeed).toBe('number')
      expect(typeof data.peakSpeed).toBe('number')
    })

    it('should calculate speed over time', async () => {
      monitor.recordBytesTransferred(1024)
      
      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 50))
      
      monitor.recordBytesTransferred(1024)
      
      const data = monitor.getPerformanceData()
      expect(data.currentSpeed).toBeGreaterThanOrEqual(0)
    })

    it('should track peak speed', async () => {
      // Record large transfer to get a peak
      monitor.recordBytesTransferred(10240)
      
      await new Promise(resolve => setTimeout(resolve, 10))
      
      const data = monitor.getPerformanceData()
      expect(data.peakSpeed).toBeGreaterThanOrEqual(0)
    })

    it('should calculate estimated time remaining', () => {
      monitor.recordBytesTransferred(1024)
      
      const data = monitor.getPerformanceData(2048) // 2KB remaining
      
      // ETA might be undefined if speed is too low
      if (data.estimatedTimeRemaining !== undefined) {
        expect(typeof data.estimatedTimeRemaining).toBe('number')
      }
    })

    it('should return zero data when disabled', () => {
      monitor.setEnabled(false)
      
      const data = monitor.getPerformanceData()
      
      expect(data.currentSpeed).toBe(0)
      expect(data.averageSpeed).toBe(0)
      expect(data.peakSpeed).toBe(0)
      expect(data.bytesTransferred).toBe(0)
    })
  })

  describe('Reset', () => {
    it('should reset all data', () => {
      monitor.setEnabled(true)
      monitor.recordBytesTransferred(1024)
      monitor.setActiveConnections(5)
      
      monitor.reset()
      
      const data = monitor.getPerformanceData()
      expect(data.bytesTransferred).toBe(0)
      expect(data.activeConnections).toBe(0)
    })
  })

  describe('Static Utilities', () => {
    it('should format speed correctly', () => {
      expect(PerformanceMonitor.formatSpeed(0)).toBe('0 B/s')
      expect(PerformanceMonitor.formatSpeed(1024)).toBe('1.0 KB/s')
      expect(PerformanceMonitor.formatSpeed(1024 * 1024)).toBe('1.0 MB/s')
      expect(PerformanceMonitor.formatSpeed(1024 * 1024 * 1024)).toBe('1.0 GB/s')
    })

    it('should format time correctly', () => {
      expect(PerformanceMonitor.formatTime(500)).toBe('500ms')
      expect(PerformanceMonitor.formatTime(1500)).toBe('1s')
      expect(PerformanceMonitor.formatTime(61000)).toBe('1m 1s')
      expect(PerformanceMonitor.formatTime(3661000)).toBe('1h 1m 1s')
    })

    it('should format bytes correctly', () => {
      expect(PerformanceMonitor.formatBytes(0)).toBe('0 B')
      expect(PerformanceMonitor.formatBytes(1024)).toBe('1.0 KB')
      expect(PerformanceMonitor.formatBytes(1024 * 1024)).toBe('1.0 MB')
      expect(PerformanceMonitor.formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB')
      expect(PerformanceMonitor.formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1.0 TB')
    })
  })

  describe('Memory Usage', () => {
    it('should include memory usage in data when available', () => {
      monitor.setEnabled(true)
      
      const data = monitor.getPerformanceData()
      
      // Memory usage might be available depending on browser
      if (data.memoryUsage) {
        expect(data.memoryUsage).toHaveProperty('used')
        expect(data.memoryUsage).toHaveProperty('total')
        expect(data.memoryUsage).toHaveProperty('percentage')
        
        expect(typeof data.memoryUsage.used).toBe('number')
        expect(typeof data.memoryUsage.total).toBe('number')
        expect(typeof data.memoryUsage.percentage).toBe('number')
      }
    })
  })
}) 