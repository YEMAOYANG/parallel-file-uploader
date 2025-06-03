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
- 💾 **队列持久化** - 上传队列持久化到localStorage，页面刷新后可恢复
- 📝 **完整TypeScript支持** - 全面的类型定义和智能提示

### 🆕 v2.0 新增功能

- 📈 **性能监控系统** - 实时监控上传速度、内存使用、网络连接等关键指标
- 🚦 **智能速度限制** - 使用令牌桶算法实现精确的速度控制
- 💾 **队列持久化机制** - 支持将上传状态保存到本地存储，支持断点续传
- 🏗️ **模块化架构重构** - 清晰的模块划分，职责分离，易于扩展和维护
- 🧪 **完善的单元测试** - 高覆盖率的测试用例，保证代码质量
- 🎨 **详细错误分类** - 精确的错误类型分类，便于问题诊断和处理
- 🔧 **Worker管理优化** - 智能的Worker池管理，根据硬件自动调整

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
  
  // 新功能配置 - 默认均为false，按需启用
  enablePerformanceMonitor: true,   // 启用性能监控
  enableQueuePersistence: true,     // 启用队列持久化
  enableSpeedLimit: true,           // 启用速度限制
  maxUploadSpeed: 1024 * 1024,      // 限制上传速度为1MB/s
  persistenceKey: 'my-app-uploads', // 自定义持久化键名
  
  // 服务器交互 - 必须实现这些回调
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
  
  // 断点续传支持
  getFilePartsFromServer: async (fileInfo) => {
    const response = await fetch(`/api/upload/parts/${fileInfo.fileId}`);
    const data = await response.json();
    return { isSuccess: response.ok, data: data.parts || [] };
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
  
  // 性能监控回调（需要启用性能监控）
  onPerformanceUpdate: (performanceData) => {
    console.log(`当前速度: ${formatSpeed(performanceData.currentSpeed)}`);
    console.log(`平均速度: ${formatSpeed(performanceData.averageSpeed)}`);
    if (performanceData.estimatedTimeRemaining) {
      console.log(`预计剩余时间: ${formatTime(performanceData.estimatedTimeRemaining)}`);
    }
  }
});

// 工具函数
function formatSpeed(bytesPerSecond: number): string {
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  let size = bytesPerSecond;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours}小时${minutes}分钟${remainingSeconds}秒`;
  } else if (minutes > 0) {
    return `${minutes}分钟${remainingSeconds}秒`;
  } else {
    return `${remainingSeconds}秒`;
  }
}
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
| `maxFileSize` | `number` | - | 最大文件大小限制(字节) |
| `allowedFileTypes` | `string[]` | - | 允许的文件类型 |
| **新增配置** | | | |
| `enablePerformanceMonitor` | `boolean` | `false` | 是否启用性能监控 |
| `enableQueuePersistence` | `boolean` | `false` | 是否启用队列持久化 |
| `enableSpeedLimit` | `boolean` | `false` | 是否启用速度限制 |
| `maxUploadSpeed` | `number` | `0` | 速度限制(字节/秒)，0表示不限制 |
| `persistenceKey` | `string` | `'parallel-uploader-queue'` | 持久化存储键名 |

### 实例方法

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

##### `getPerformanceData(): PerformanceData`

获取性能监控数据（需要启用性能监控）。

```typescript
const data = uploader.getPerformanceData();
console.log('当前上传速度:', data.currentSpeed, 'B/s');
console.log('平均上传速度:', data.averageSpeed, 'B/s');
console.log('峰值速度:', data.peakSpeed, 'B/s');
console.log('已传输字节数:', data.bytesTransferred);
```

##### `setSpeedLimit(bytesPerSecond: number, enabled: boolean = true): void`

动态设置上传速度限制。

```typescript
// 限制为500KB/s
uploader.setSpeedLimit(500 * 1024, true);

// 取消限制
uploader.setSpeedLimit(0, false);
```

##### `setPerformanceMonitoring(enabled: boolean): void`

启用或禁用性能监控。

```typescript
// 启用性能监控
uploader.setPerformanceMonitoring(true);

// 禁用性能监控
uploader.setPerformanceMonitoring(false);
```

##### `setQueuePersistence(enabled: boolean): void`

启用或禁用队列持久化。

```typescript
// 启用队列持久化
uploader.setQueuePersistence(true);

// 禁用队列持久化
uploader.setQueuePersistence(false);
```

##### `destroy(): void`

销毁上传器实例，释放所有资源。

### 静态方法

#### `ParallelFileUploader.calculateFileMD5(file: File, chunkSize?: number, onProgress?: Function): Promise<string>`

计算文件的MD5哈希值，支持大文件分片计算，避免内存溢出。

**参数说明：**

| 参数 | 类型 | 默认值 | 必填 | 说明 |
|------|------|--------|------|------|
| `file` | `File` | - | ✓ | 要计算MD5的文件对象 |
| `chunkSize` | `number` | `2097152` (2MB) | ✗ | 分片大小（字节），用于大文件分片计算 |
| `onProgress` | `Function` | - | ✗ | 进度回调函数，参数为进度百分比(0-100) |

**返回值：**

- `Promise<string>` - 返回32位小写的MD5哈希值

**使用场景：**

1. **文件秒传** - 上传前计算MD5，检查服务器是否已存在相同文件
2. **文件完整性校验** - 确保上传过程中文件未损坏
3. **重复文件检测** - 避免上传重复文件
4. **断点续传** - 通过MD5标识唯一文件

**基础用法：**

```typescript
// 简单计算文件MD5
const file = document.getElementById('file-input').files[0];
const md5 = await ParallelFileUploader.calculateFileMD5(file);
console.log('文件MD5:', md5); // 输出: "d41d8cd98f00b204e9800998ecf8427e"
```

**带进度回调的用法：**

```typescript
const file = document.getElementById('file-input').files[0];

const md5 = await ParallelFileUploader.calculateFileMD5(
  file,
  1024 * 1024, // 1MB分片
  (progress) => {
    console.log(`MD5计算进度: ${progress.toFixed(1)}%`);
    // 更新UI进度条
    document.getElementById('md5-progress').style.width = `${progress}%`;
  }
);

console.log('计算完成，MD5值:', md5);
```

**实际应用示例：**

```typescript
// 文件秒传实现
async function checkFileExists(file) {
  // 显示MD5计算进度
  const progressBar = document.getElementById('md5-progress');
  const statusText = document.getElementById('status-text');
  
  statusText.textContent = '正在计算文件指纹...';
  
  try {
    const md5 = await ParallelFileUploader.calculateFileMD5(
      file,
      2 * 1024 * 1024, // 2MB分片
      (progress) => {
        progressBar.style.width = `${progress}%`;
        statusText.textContent = `计算文件指纹: ${progress.toFixed(1)}%`;
      }
    );
    
    // 检查服务器是否已存在相同文件
    const response = await fetch('/api/file/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        md5, 
        fileName: file.name,
        fileSize: file.size 
      })
    });
    
    const result = await response.json();
    
    if (result.exists) {
      statusText.textContent = '文件已存在，秒传成功！';
      return { skipUpload: true, url: result.url };
    } else {
      statusText.textContent = '开始上传文件...';
      return { skipUpload: false, md5 };
    }
    
  } catch (error) {
    console.error('MD5计算失败:', error);
    statusText.textContent = 'MD5计算失败，将直接上传';
    return { skipUpload: false, md5: null };
  }
}

// 在上传器中使用
const uploader = new ParallelFileUploader({
  sendFileInfoToServer: async (fileInfo) => {
    // 先检查文件是否存在
    const checkResult = await checkFileExists(fileInfo.file);
    
    if (checkResult.skipUpload) {
      // 秒传成功
      return { 
        isSuccess: true, 
        data: { 
          skipUpload: true, 
          url: checkResult.url 
        } 
      };
    }
    
    // 正常上传流程，携带MD5
    const response = await fetch('/api/upload/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: fileInfo.fileName,
        fileSize: fileInfo.fileSize,
        fileId: fileInfo.fileId,
        md5: checkResult.md5 // 携带预计算的MD5
      })
    });
    
    const data = await response.json();
    return { isSuccess: response.ok, data };
  }
});
```

**大文件处理示例：**

```typescript
// 处理大文件（如视频文件）
async function calculateLargeFileMD5(file) {
  const fileSize = file.size;
  const fileSizeText = formatFileSize(fileSize);
  
  console.log(`开始计算大文件MD5: ${file.name} (${fileSizeText})`);
  
  const startTime = Date.now();
  
  const md5 = await ParallelFileUploader.calculateFileMD5(
    file,
    5 * 1024 * 1024, // 5MB分片，适合大文件
    (progress) => {
      const elapsed = Date.now() - startTime;
      const estimated = elapsed / (progress / 100);
      const remaining = estimated - elapsed;
      
      console.log(`MD5计算: ${progress.toFixed(1)}% (预计剩余 ${formatTime(remaining)})`);
    }
  );
  
  const totalTime = Date.now() - startTime;
  console.log(`MD5计算完成: ${md5} (耗时 ${formatTime(totalTime)})`);
  
  return md5;
}

// 工具函数
function formatFileSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`;
  } else if (minutes > 0) {
    return `${minutes}分钟${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
}
```

**注意事项：**

1. **内存占用** - 使用分片计算避免大文件一次性加载到内存
2. **计算时间** - 大文件MD5计算可能耗时较长，建议显示进度
3. **异步处理** - 方法返回Promise，注意正确处理异步调用
4. **错误处理** - 文件读取失败时会抛出异常，建议用try-catch包装
5. **分片大小** - 分片过小会影响计算效率，过大可能占用过多内存，建议1-5MB

**性能建议：**

```typescript
// 根据文件大小动态调整分片大小
function getOptimalChunkSize(fileSize) {
  if (fileSize < 10 * 1024 * 1024) {        // < 10MB
    return 1024 * 1024;                      // 1MB分片
  } else if (fileSize < 100 * 1024 * 1024) { // < 100MB
    return 2 * 1024 * 1024;                  // 2MB分片
  } else if (fileSize < 1024 * 1024 * 1024) { // < 1GB
    return 5 * 1024 * 1024;                  // 5MB分片
  } else {                                   // >= 1GB
    return 10 * 1024 * 1024;                 // 10MB分片
  }
}

// 使用动态分片大小
const optimalChunkSize = getOptimalChunkSize(file.size);
const md5 = await ParallelFileUploader.calculateFileMD5(file, optimalChunkSize);
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
| `onPerformanceUpdate` | `(data: PerformanceData)` | 性能指标更新时触发 |

### 服务端交互回调

| 回调 | 参数 | 返回值 | 说明 |
|------|------|-------|------|
| `sendFileInfoToServer` | `(fileInfo: FileInfo)` | `Promise<ResGlobalInterface<any>>` | 初始化文件上传 |
| `sendFilePartToServer` | `(fileInfo, chunkInfo)` | `Promise<ResGlobalInterface<any>>` | 上传文件分片 |
| `sendFileCompleteToServer` | `(fileInfo)` | `Promise<ResGlobalInterface<any>>` | 完成文件上传 |
| `getFilePartsFromServer` | `(fileInfo)` | `Promise<ResGlobalInterface<FilePartInfo[]>>` | 获取已上传分片(断点续传) |
| `sendPauseToServer` | `(fileInfo)` | `Promise<ResGlobalInterface<any>>` | 通知服务器暂停上传 |

### 类型定义

#### FileInfo

```typescript
interface FileInfo {
  fileId: string;           // 文件唯一标识符
  fileName: string;         // 文件名
  fileSize: number;         // 文件大小（字节）
  uploadedSize: number;     // 已上传大小（字节）
  progress: number;         // 上传进度百分比 (0-100)
  status: UploadStepEnum;   // 文件上传状态
  file: File;               // 原始文件对象
  errorMessage?: string;    // 错误消息
  lastUpdated?: number;     // 最后更新时间戳
  mimeType?: string;        // 文件MIME类型
  totalChunks?: number;     // 总分片数量
  uploadInfo?: {
    parts?: Array<FilePartInfo>;  // 已上传的分片列表
    md5?: string;                 // 文件MD5值
    [key: string]: any;           // 其他扩展字段
  };
  uploadData?: any;         // 自定义上传数据
}
```

#### PerformanceData

```typescript
interface PerformanceData {
  currentSpeed: number;          // 当前上传速度（字节/秒）
  averageSpeed: number;          // 平均上传速度（字节/秒）
  peakSpeed: number;             // 峰值速度（字节/秒）
  activeConnections: number;     // 活动连接数
  bytesTransferred: number;      // 总传输字节数
  elapsedTime: number;           // 已耗时（毫秒）
  activeFiles: number;           // 活动文件数
  totalFiles: number;            // 总文件数
  timestamp: number;             // 时间戳
  estimatedTimeRemaining?: number; // 预计剩余时间（毫秒）
  memoryUsage?: {
    used: number;                // 已使用内存（字节）
    total: number;               // 总内存（字节）
    percentage: number;          // 使用百分比
  };
}
```

#### ErrorType

```typescript
enum ErrorType {
  NETWORK = 'NETWORK',                           // 网络错误
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',            // 文件过大
  FILE_TYPE_NOT_ALLOWED = 'FILE_TYPE_NOT_ALLOWED', // 文件类型不允许
  SERVER_ERROR = 'SERVER_ERROR',                 // 服务器错误
  CHUNK_UPLOAD_FAILED = 'CHUNK_UPLOAD_FAILED',   // 分片上传失败
  FILE_INITIALIZATION_FAILED = 'FILE_INITIALIZATION_FAILED', // 文件初始化失败
  UNKNOWN = 'UNKNOWN',                          // 未知错误
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
      formatSpeed(metrics.currentSpeed);
    
    if (metrics.estimatedTimeRemaining) {
      document.getElementById('time-remaining').textContent = 
        formatTime(metrics.estimatedTimeRemaining);
    }
    
    const progress = metrics.bytesTransferred / totalBytes * 100;
    document.getElementById('progress-bar').style.width = `${progress}%`;
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
  maxUploadSpeed: 0 // 初始不限速
});

// 根据网络状况动态调整
function adjustSpeedBasedOnNetwork() {
  const connection = (navigator as any).connection;
  if (connection) {
    switch (connection.effectiveType) {
      case '4g':
        uploader.setSpeedLimit(0, false); // 不限速
        break;
      case '3g':
        uploader.setSpeedLimit(500 * 1024, true); // 500KB/s
        break;
      case '2g':
        uploader.setSpeedLimit(100 * 1024, true); // 100KB/s
        break;
      default:
        uploader.setSpeedLimit(200 * 1024, true); // 200KB/s
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
│       ├── index.ts          # 模块导出文件
│       ├── FileManager.ts    # 文件管理
│       ├── ChunkManager.ts   # 分片管理
│       ├── WorkerManager.ts  # Worker管理
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
      isSuccess: true, 
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
  
  res.json({ isSuccess: true, data: session });
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
    isSuccess: true, 
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
    isSuccess: true, 
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
    isSuccess: true, 
    data: parts
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

A: 工具会自动降级到主线程模式。在测试环境中，Worker会自动跳过初始化。

### Q: 如何优化上传性能？

A:

1. 调整并发数：根据网络和服务器能力调整 `maxConcurrentFiles` 和 `maxConcurrentChunks`
2. 优化分片大小：网络好时增大 `chunkSize`，网络差时减小
3. 使用性能监控：通过 `enablePerformanceMonitor` 监控并调优
4. 启用Worker：确保Worker正常工作以使用多线程

### Q: 队列持久化有什么限制？

A:

1. localStorage 通常有 5-10MB 的大小限制
2. File 对象无法序列化，刷新后需要重新选择文件
3. 建议只用于保存上传进度，配合UI实现完整的断点续传

### Q: 新功能默认是否开启？

A: 所有新功能（性能监控、队列持久化、速度限制）默认都是关闭的，需要手动启用：

```typescript
const uploader = new ParallelFileUploader({
  enablePerformanceMonitor: true,  // 手动启用性能监控
  enableQueuePersistence: true,    // 手动启用队列持久化
  enableSpeedLimit: true,          // 手动启用速度限制
});
```

## 📞 联系方式

- GitHub Issues: [github.com/yemaoyang/parallel-file-uploader/issues](https://github.com/yemaoyang/parallel-file-uploader/issues)
- Email: <346751186@qq.com>

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=yemaoyang/parallel-file-uploader&type=Date)](https://star-history.com/#yemaoyang/parallel-file-uploader&Date)
