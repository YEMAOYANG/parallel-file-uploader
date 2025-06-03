# ParallelFileUploader - 高性能并行文件上传工具

<p align="center">
  <a href="https://www.npmjs.com/package/parallel-file-uploader">
    <img src="https://img.shields.io/npm/v/parallel-file-uploader.svg" alt="npm version">
  </a>
  <a href="https://www.npmjs.com/package/parallel-file-uploader">
    <img src="https://img.shields.io/npm/dm/parallel-file-uploader.svg" alt="npm downloads">
  </a>
  <a href="https://github.com/yemaoyang/parallel-file-uploader/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/yemaoyang/parallel-file-uploader.svg" alt="license">
  </a>
  <a href="https://coveralls.io/github/yemaoyang/parallel-file-uploader">
    <img src="https://coveralls.io/repos/github/yemaoyang/parallel-file-uploader/badge.svg" alt="coverage">
  </a>
</p>

一个功能强大、高性能的JavaScript/TypeScript文件上传工具库，专为现代Web应用设计。通过Web Worker实现真正的多线程处理，支持大文件分片并发上传、断点续传等企业级功能。

## ✨ 核心特性

- 🚀 **高性能并发上传** - 多文件、多分片并发上传，充分利用带宽
- 🧵 **Web Worker多线程** - 后台线程处理，不阻塞UI渲染
- 📦 **智能分片上传** - 自动分片，支持超大文件上传
- 🔄 **断点续传** - 网络中断自动恢复，已上传分片不重传
- 🔁 **失败自动重试** - 智能重试机制，提高上传成功率
- 📊 **实时进度监控** - 精确到字节的进度跟踪
- 🎯 **灵活的API设计** - 支持各种自定义配置和回调
- 🛡️ **文件验证** - 内置文件类型和大小验证
- 💾 **秒传支持** - 服务端支持时可实现文件秒传
- 📝 **TypeScript支持** - 完整的类型定义

### 🆕 新增功能

- 📈 **性能监控** - 实时监控上传速度、内存使用等指标
- 🚦 **速度限制** - 支持动态调整上传速度限制
- 💾 **队列持久化** - 支持将上传队列保存到localStorage
- 🏗️ **模块化架构** - 清晰的模块划分，易于扩展和维护
- 🧪 **单元测试** - 完善的测试覆盖，保证代码质量
- 🎨 **错误分类** - 详细的错误类型分类，便于错误处理

## 📦 安装

```bash
# 使用 npm
npm install parallel-file-uploader

# 使用 yarn
yarn add parallel-file-uploader

# 使用 pnpm
pnpm add parallel-file-uploader
```

## 🚀 快速开始

### 基础用法

```typescript
import { ParallelFileUploader } from 'parallel-file-uploader';

// 创建上传器实例
const uploader = new ParallelFileUploader({
  // 基础配置
  maxConcurrentFiles: 3,      // 同时上传3个文件
  maxConcurrentChunks: 4,     // 每个文件4个分片并发
  chunkSize: 5 * 1024 * 1024, // 5MB分片大小
  
  // 事件监听
  onFileProgress: (fileInfo) => {
    console.log(`${fileInfo.fileName}: ${fileInfo.progress}%`);
  },
  
  onFileSuccess: ({ fileInfo, data }) => {
    console.log(`${fileInfo.fileName} 上传成功`, data);
  },
  
  onFileError: (fileInfo, error) => {
    console.error(`${fileInfo.fileName} 上传失败`, error);
  }
});

// 添加文件并开始上传
const fileInput = document.getElementById('file-input') as HTMLInputElement;
fileInput.addEventListener('change', (e) => {
  const files = (e.target as HTMLInputElement).files;
  if (files) {
    uploader.addFiles(files);
  }
});
```

### 完整配置示例

```typescript
const uploader = new ParallelFileUploader({
  // 并发控制
  maxConcurrentFiles: 3,
  maxConcurrentChunks: 4,
  
  // 分片配置
  chunkSize: 5 * 1024 * 1024, // 5MB
  
  // 重试配置
  maxRetries: 3,
  retryDelay: 1000, // 1秒后重试
  
  // 文件限制
  maxFileSize: 1024 * 1024 * 1024, // 1GB
  allowedFileTypes: [
    'image/*',
    'video/*',
    'application/pdf',
    '.docx',
    '.xlsx'
  ],
  
  // Worker配置
  useWorker: true, // 启用Web Worker
  
  // 新功能配置
  enablePerformanceMonitor: true,  // 启用性能监控
  enableQueuePersistence: true,    // 启用队列持久化
  enableSpeedLimit: true,          // 启用速度限制
  speedLimit: 1024 * 1024,         // 限制上传速度为1MB/s
  persistenceKey: 'my-app-uploads', // 自定义持久化键名
  
  // 服务器交互
  sendFileInfoToServer: async (fileInfo) => {
    const response = await fetch('/api/upload/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: fileInfo.fileName,
        fileSize: fileInfo.fileSize,
        fileId: fileInfo.fileId
      })
    });
    const data = await response.json();
    return { isSuccess: response.ok, data };
  },
  
  sendFilePartToServer: async (fileInfo, chunkInfo) => {
    const formData = new FormData();
    formData.append('file', chunkInfo.file!);
    formData.append('fileId', fileInfo.fileId);
    formData.append('partNumber', chunkInfo.partNumber.toString());
    
    const response = await fetch('/api/upload/chunk', {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    return { isSuccess: response.ok, data };
  },
  
  sendFileCompleteToServer: async (fileInfo) => {
    const response = await fetch('/api/upload/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId: fileInfo.fileId,
        parts: fileInfo.uploadInfo?.parts
      })
    });
    const data = await response.json();
    return { isSuccess: response.ok, data };
  },
  
  // 事件回调
  onFileAdded: (fileInfo) => {
    console.log('文件已添加:', fileInfo.fileName);
  },
  
  onFileProgress: (fileInfo) => {
    console.log(`进度: ${fileInfo.fileName} - ${fileInfo.progress}%`);
  },
  
  onFileSuccess: ({ fileInfo, data }) => {
    console.log('上传成功:', fileInfo.fileName, data);
  },
  
  onFileError: (fileInfo, error) => {
    console.error('上传失败:', fileInfo.fileName, error);
  },
  
  onAllComplete: () => {
    console.log('所有文件上传完成!');
  },
  
  // 性能监控回调
  onPerformanceUpdate: (metrics) => {
    console.log(`上传速度: ${ParallelFileUploader.formatSpeed(metrics.uploadSpeed)}`);
    console.log(`预计剩余时间: ${ParallelFileUploader.formatTime(metrics.timeRemaining)}`);
  }
});
```

## 📖 API 文档

### 构造函数选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `maxConcurrentFiles` | `number` | `3` | 最大并发上传文件数 |
| `maxConcurrentChunks` | `number` | `3` | 每个文件最大并发分片数 |
| `chunkSize` | `number` | `5242880` | 分片大小(字节)，默认5MB |
| `maxRetries` | `number` | `3` | 分片上传失败最大重试次数 |
| `retryDelay` | `number` | `1000` | 重试延迟时间(毫秒) |
| `useWorker` | `boolean` | `true` | 是否使用Web Worker |
| `maxFileSize` | `number` | - | 最大文件大小限制(字节) |
| `allowedFileTypes` | `string[]` | - | 允许的文件类型 |
| **新增配置** | | | |
| `enablePerformanceMonitor` | `boolean` | `false` | 是否启用性能监控 |
| `enableQueuePersistence` | `boolean` | `false` | 是否启用队列持久化 |
| `enableSpeedLimit` | `boolean` | `false` | 是否启用速度限制 |
| `speedLimit` | `number` | `0` | 速度限制(字节/秒)，0表示不限制 |
| `persistenceKey` | `string` | `'parallel-uploader-queue'` | 持久化存储键名 |

### 方法

#### 基础方法

##### `addFiles(files: File[] | FileList): void`

添加文件到上传队列。

```typescript
// 从input元素添加
uploader.addFiles(inputElement.files);

// 从拖放事件添加
uploader.addFiles(event.dataTransfer.files);
```

##### `pauseFile(fileId: string): void`

暂停指定文件的上传。

##### `resumeFile(fileId: string): void`

恢复指定文件的上传。

##### `cancelFile(fileId: string): void`

取消指定文件的上传。

##### `pauseAll(): void`

暂停所有文件的上传。

##### `resumeAll(): void`

恢复所有文件的上传。

##### `cancelAll(): void`

取消所有文件的上传。

##### `getStats(): UploadStats`

获取当前上传统计信息。

```typescript
const stats = uploader.getStats();
console.log(`
  队列中: ${stats.queued}
  上传中: ${stats.active}
  已完成: ${stats.completed}
  失败: ${stats.failed}
  暂停: ${stats.paused}
`);
```

#### 新增方法

##### `getPerformanceMetrics(): PerformanceMetrics | null`

获取性能监控指标（需要启用性能监控）。

```typescript
const metrics = uploader.getPerformanceMetrics();
if (metrics) {
  console.log('当前上传速度:', ParallelFileUploader.formatSpeed(metrics.uploadSpeed));
  console.log('平均上传速度:', ParallelFileUploader.formatSpeed(metrics.averageSpeed));
  console.log('峰值速度:', ParallelFileUploader.formatSpeed(metrics.peakSpeed));
  console.log('预计剩余时间:', ParallelFileUploader.formatTime(metrics.timeRemaining));
  console.log('内存使用:', metrics.memoryUsage + 'MB');
}
```

##### `setSpeedLimit(bytesPerSecond: number): void`

动态设置上传速度限制。

```typescript
// 限制为500KB/s
uploader.setSpeedLimit(500 * 1024);

// 取消限制
uploader.setSpeedLimit(0);
```

##### `setSpeedLimitEnabled(enabled: boolean): void`

启用或禁用速度限制。

```typescript
// 禁用速度限制
uploader.setSpeedLimitEnabled(false);

// 重新启用
uploader.setSpeedLimitEnabled(true);
```

##### `destroy(): void`

销毁上传器实例，释放所有资源。

### 静态方法

#### `ParallelFileUploader.calculateFileMD5(file: File, chunkSize?: number, onProgress?: Function): Promise<string>`

计算文件的MD5哈希值。

```typescript
const md5 = await ParallelFileUploader.calculateFileMD5(file, 2097152, (progress) => {
  console.log(`MD5计算进度: ${progress}%`);
});
```

#### `ParallelFileUploader.formatSpeed(bytesPerSecond: number): string`

格式化速度显示。

```typescript
console.log(ParallelFileUploader.formatSpeed(1024)); // "1.0 KB/s"
console.log(ParallelFileUploader.formatSpeed(1048576)); // "1.0 MB/s"
```

#### `ParallelFileUploader.formatTime(seconds: number): string`

格式化时间显示。

```typescript
console.log(ParallelFileUploader.formatTime(65)); // "1分钟5秒"
console.log(ParallelFileUploader.formatTime(3665)); // "1小时1分钟"
```

### 事件回调

| 回调 | 参数 | 说明 |
|------|------|------|
| `onFileAdded` | `(fileInfo: FileInfo)` | 文件添加到队列时触发 |
| `onFileProgress` | `(fileInfo: FileInfo)` | 文件上传进度更新时触发 |
| `onFileSuccess` | `({ fileInfo, data })` | 文件上传成功时触发 |
| `onFileError` | `(fileInfo: FileInfo, error: Error)` | 文件上传失败时触发 |
| `onFileComplete` | `({ fileInfo, data })` | 文件上传完成时触发(无论成功或失败) |
| `onAllComplete` | `()` | 所有文件上传完成时触发 |
| `onFileRejected` | `(file: File, reason: string)` | 文件被拒绝时触发 |
| **新增回调** | | |
| `onPerformanceUpdate` | `(metrics: PerformanceMetrics)` | 性能指标更新时触发 |

### 服务端交互回调

| 回调 | 参数 | 返回值 | 说明 |
|------|------|-------|------|
| `sendFileInfoToServer` | `(fileInfo: FileInfo)` | `Promise<Response>` | 初始化文件上传 |
| `sendFilePartToServer` | `(fileInfo, chunkInfo)` | `Promise<Response>` | 上传文件分片 |
| `sendFileCompleteToServer` | `(fileInfo)` | `Promise<Response>` | 完成文件上传 |
| `getFilePartsFromServer` | `(fileInfo)` | `Promise<Response>` | 获取已上传分片(断点续传) |
| `sendPauseToServer` | `(fileInfo)` | `Promise<Response>` | 通知服务器暂停上传 |

### 类型定义

#### FileInfo

```typescript
interface FileInfo {
  fileId: string;
  fileName: string;
  fileSize: number;
  uploadedSize: number;
  progress: number;
  status: UploadStepEnum;
  file: File;
  errorMessage?: string;
  lastUpdated?: number;
  mimeType?: string;
  totalChunks?: number;
  uploadInfo?: {
    parts?: Array<FilePartInfo>;
    md5?: string;
    [key: string]: any;
  };
  uploadData?: any;
}
```

#### PerformanceMetrics

```typescript
interface PerformanceMetrics {
  uploadSpeed: number;      // 当前上传速度（字节/秒）
  averageSpeed: number;     // 平均上传速度（字节/秒）
  timeRemaining: number;    // 预计剩余时间（秒）
  memoryUsage?: number;     // 内存使用量（MB）
  peakSpeed: number;        // 峰值速度（字节/秒）
  totalBytesUploaded: number; // 总上传字节数
  startTime: number;        // 开始时间
  activeConnections: number; // 活动连接数
}
```

#### ErrorType

```typescript
enum ErrorType {
  NETWORK = 'NETWORK',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  FILE_TYPE_NOT_ALLOWED = 'FILE_TYPE_NOT_ALLOWED',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN',
}
```

## 🎯 高级用法

### 断点续传

```typescript
const uploader = new ParallelFileUploader({
  // 提供获取已上传分片的接口
  getFilePartsFromServer: async (fileInfo) => {
    const response = await fetch(`/api/upload/parts/${fileInfo.fileId}`);
    const data = await response.json();
    return { isSuccess: response.ok, data: data.parts };
  }
});
```

### 秒传实现

```typescript
const uploader = new ParallelFileUploader({
  sendFileInfoToServer: async (fileInfo) => {
    // 计算文件MD5
    const md5 = await ParallelFileUploader.calculateFileMD5(fileInfo.file);
    
    const response = await fetch('/api/upload/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ md5, fileName: fileInfo.fileName })
    });
    
    const data = await response.json();
    
    // 如果文件已存在，设置skipUpload标记
    if (data.exists) {
      data.skipUpload = true;
    }
    
    return { isSuccess: response.ok, data };
  }
});
```

### 性能监控示例

```typescript
const uploader = new ParallelFileUploader({
  enablePerformanceMonitor: true,
  onPerformanceUpdate: (metrics) => {
    // 更新UI显示
    document.getElementById('upload-speed').textContent = 
      ParallelFileUploader.formatSpeed(metrics.uploadSpeed);
    
    document.getElementById('time-remaining').textContent = 
      ParallelFileUploader.formatTime(metrics.timeRemaining);
    
    document.getElementById('progress-bar').style.width = 
      `${(metrics.totalBytesUploaded / totalSize) * 100}%`;
  }
});
```

### 队列持久化

```typescript
const uploader = new ParallelFileUploader({
  enableQueuePersistence: true,
  persistenceKey: 'my-app-uploads'
});

// 页面刷新后，可以从localStorage恢复队列
// 注意：由于File对象无法序列化，需要配合UI让用户重新选择文件
```

### 动态速度控制

```typescript
const uploader = new ParallelFileUploader({
  enableSpeedLimit: true,
  speedLimit: 0 // 初始不限速
});

// 根据网络状况动态调整
function adjustSpeedBasedOnNetwork() {
  const connection = (navigator as any).connection;
  if (connection) {
    switch (connection.effectiveType) {
      case '4g':
        uploader.setSpeedLimit(0); // 不限速
        break;
      case '3g':
        uploader.setSpeedLimit(500 * 1024); // 500KB/s
        break;
      case '2g':
        uploader.setSpeedLimit(100 * 1024); // 100KB/s
        break;
      default:
        uploader.setSpeedLimit(200 * 1024); // 200KB/s
    }
  }
}
```

## 🏗️ 项目结构

```
parallel-file-uploader/
├── src/
│   ├── index.ts              # 主入口文件
│   ├── type.ts               # 类型定义
│   ├── worker.ts             # Web Worker文件
│   └── modules/              # 功能模块
│       ├── FileManager.ts    # 文件管理
│       ├── ChunkManager.ts   # 分片管理
│       ├── WorkerManager.ts  # Worker管理
│       ├── UploadManager.ts  # 上传逻辑
│       ├── PerformanceMonitor.ts # 性能监控
│       ├── QueuePersistence.ts   # 队列持久化
│       └── SpeedLimiter.ts   # 速度限制
├── tests/                    # 单元测试
├── examples/                 # 示例代码
│   ├── basic/               # 基础示例
│   └── advanced/            # 高级示例
└── dist/                    # 构建输出
```

## 🧪 测试

```bash
# 运行测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 运行测试并监听文件变化
npm run test:watch
```

## 🏗️ 服务端实现参考

### 初始化上传接口

```javascript
app.post('/api/upload/init', async (req, res) => {
  const { fileName, fileSize, fileId } = req.body;
  
  // 检查文件是否已存在（秒传）
  const existingFile = await checkFileExists(fileName);
  if (existingFile) {
    return res.json({ 
      success: true, 
      data: { 
        skipUpload: true,
        url: existingFile.url 
      }
    });
  }
  
  // 创建上传会话
  const session = await createUploadSession({
    fileId,
    fileName,
    fileSize,
    totalParts: Math.ceil(fileSize / CHUNK_SIZE)
  });
  
  res.json({ success: true, data: session });
});
```

### 分片上传接口

```javascript
app.post('/api/upload/chunk', async (req, res) => {
  const { fileId, partNumber } = req.body;
  const file = req.files.file;
  
  // 保存分片
  const etag = await saveChunk(fileId, partNumber, file.data);
  
  res.json({ 
    success: true, 
    data: { etag, partNumber }
  });
});
```

### 完成上传接口

```javascript
app.post('/api/upload/complete', async (req, res) => {
  const { fileId, parts } = req.body;
  
  // 合并分片
  const fileUrl = await mergeChunks(fileId, parts);
  
  res.json({ 
    success: true, 
    data: { url: fileUrl }
  });
});
```

### 获取已上传分片接口（断点续传）

```javascript
app.get('/api/upload/parts/:fileId', async (req, res) => {
  const { fileId } = req.params;
  
  // 获取已上传的分片信息
  const parts = await getUploadedParts(fileId);
  
  res.json({ 
    success: true, 
    data: { parts }
  });
});
```

## 🤝 贡献指南

欢迎贡献代码！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。

## 📄 许可证

本项目采用 [MIT](LICENSE) 许可证。

## 🙋 常见问题

### Q: 如何处理跨域问题？

A: 确保服务端正确设置了CORS头：

```javascript
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});
```

### Q: Worker文件加载失败怎么办？

A: 工具会自动降级到主线程模式。您也可以手动禁用Worker：

```typescript
const uploader = new ParallelFileUploader({
  useWorker: false
});
```

### Q: 如何优化上传性能？

A:

1. 调整并发数：根据网络和服务器能力调整 `maxConcurrentFiles` 和 `maxConcurrentChunks`
2. 优化分片大小：网络好时增大 `chunkSize`，网络差时减小
3. 使用性能监控：通过 `enablePerformanceMonitor` 监控并调优
4. 启用Worker：确保 `useWorker: true` 以使用多线程

### Q: 队列持久化有什么限制？

A:

1. localStorage 通常有 5-10MB 的大小限制
2. File 对象无法序列化，刷新后需要重新选择文件
3. 建议只用于保存上传进度，配合UI实现完整的断点续传

## 📞 联系方式

- GitHub Issues: [github.com/yemaoyang/parallel-file-uploader/issues](https://github.com/yemaoyang/parallel-file-uploader/issues)
- Email: <346751186@qq.com>

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=yemaoyang/parallel-file-uploader&type=Date)](https://star-history.com/#yemaoyang/parallel-file-uploader&Date)
