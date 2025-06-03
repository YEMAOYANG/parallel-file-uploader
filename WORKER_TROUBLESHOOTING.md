# Worker问题排查指南

## 🔧 问题描述

当将并行文件上传器的代码拷贝到其他项目使用时，可能遇到Worker加载失败的问题：

```
Worker error: Event {isTrusted: true, type: 'error', ...}
```

## 🎯 解决方案

### 自动修复 (v1.0.0+)

**新版本已自动解决该问题！** WorkerManager现在具备以下特性：

1. **多路径尝试**: 自动尝试多个Worker文件路径
2. **Inline Worker回退**: 当外部文件加载失败时，自动使用内联Worker
3. **错误恢复**: Worker失败时自动降级到直接上传
4. **重试机制**: 提供Worker重初始化功能

### 技术原理

```typescript
// 新的Worker创建逻辑
const workerPaths = [
  './worker.js',      // 相对于当前页面
  '/worker.js',       // 网站根目录
  './lib/worker.js',  // lib目录
  './dist/worker.js', // dist目录
  'worker.js'         // 同级目录
]

// 如果所有路径都失败，使用inline Worker
if (!worker) {
  const blob = new Blob([this.workerCode], { type: 'application/javascript' })
  const workerUrl = URL.createObjectURL(blob)
  worker = new Worker(workerUrl)
}
```

## 📋 验证步骤

### 1. 快速测试

```javascript
// 在浏览器控制台中测试
console.log('Worker支持:', typeof Worker !== 'undefined')
console.log('CPU核心数:', navigator.hardwareConcurrency)
```

### 2. 使用测试页面

打开 `examples/worker-test.html` 进行全面测试：

- 测试Worker初始化
- 测试文件分片处理
- 查看详细日志输出

### 3. 检查网络控制台

如果仍有问题，检查浏览器开发者工具：

- **Console**: 查看错误日志
- **Network**: 检查Worker文件加载情况
- **Sources**: 确认Worker代码是否正确加载

## 🔄 降级策略

即使Worker完全失败，上传器也能正常工作：

```javascript
// 自动降级流程
1. 尝试使用Worker并行处理
2. Worker失败 → 重试初始化
3. 重试失败 → 使用直接上传
4. 功能完全可用，只是性能略降
```

## 📱 浏览器兼容性

| 浏览器 | 版本要求 | Worker支持 |
|--------|----------|------------|
| Chrome | 60+ | ✅ 完全支持 |
| Firefox | 55+ | ✅ 完全支持 |
| Safari | 12+ | ✅ 完全支持 |
| Edge | 79+ | ✅ 完全支持 |
| IE | - | ❌ 不支持 |

## 🚀 最佳实践

### 1. 项目集成

```javascript
import { ParallelFileUploader } from 'parallel-file-uploader'

const uploader = new ParallelFileUploader({
  // Worker会自动处理，无需额外配置
  useWorker: true, // 默认值
  
  // 其他配置...
  maxConcurrent: 3,
  chunkSize: 1024 * 1024,
})
```

### 2. 错误监听

```javascript
uploader.on('workerError', (error) => {
  console.log('Worker遇到问题，已自动降级:', error)
})

uploader.on('error', (error) => {
  console.log('上传错误:', error)
})
```

### 3. 性能监控

```javascript
// 检查Worker状态
const metrics = uploader.getPerformanceMetrics()
console.log('Worker池大小:', metrics.workerPoolSize)
console.log('活跃Worker数:', metrics.activeWorkers)
```

## 🛠 手动处理 (如果需要)

### 禁用Worker

```javascript
const uploader = new ParallelFileUploader({
  useWorker: false // 完全禁用Worker
})
```

### 自定义Worker路径

如果您的项目有特殊的Worker文件位置，可以通过以下方式处理：

```javascript
// 方法1: 确保Worker文件在正确位置
// 将 lib/worker.js 复制到项目的 public/ 目录

// 方法2: 使用自定义实现
const uploader = new ParallelFileUploader({
  useWorker: false,
  // 使用其他并行处理方案
})
```

## 📞 技术支持

如果仍遇到问题：

1. **检查版本**: 确保使用最新版本 (v1.0.0+)
2. **查看日志**: 浏览器控制台中的详细错误信息
3. **测试环境**: 在不同浏览器中测试
4. **报告问题**: 在GitHub Issues中提供详细信息

---

**总结**: 新版本的WorkerManager已经自动解决了绝大多数Worker相关问题，您只需要正常使用即可，系统会自动处理所有的回退和错误恢复逻辑。
