# WekToDo

WekToDo 是一个简单的桌面待办事项软件，用 Electron 做界面，用 SQLite 存本地数据。  
主要是想做一个轻量、直接、打开就能用的 ToDo 工具，不依赖服务器，数据都保存在本地。

## 功能

目前主要支持：

- 添加待办事项
- 查看待办列表
- 删除待办事项
- 本地 SQLite 数据存储
- 打包成 Windows 安装包使用

这个项目整体比较简单，主要适合用来练习 Electron 桌面应用开发、Node.js 本地文件操作以及 SQLite 数据存储。

## 技术栈

- Electron
- Node.js
- SQLite3
- electron-builder

## 项目结构

```bash
WekToDo
├── main.js          # Electron 主进程入口
├── preload.js       # 预加载脚本，用来连接主进程和页面
├── db.js            # SQLite 数据库相关逻辑
├── package.json     # 项目配置和启动命令
├── icon.ico         # 应用图标
├── renderer/        # 页面相关文件
└── dist/            # 打包输出目录，不上传到 GitHub
````

## 本地运行

先安装依赖：

```bash
pnpm install
```

然后启动项目：

```bash
pnpm start
```

如果你用的是 npm，也可以这样：

```bash
npm install
npm start
```

## 打包安装包

生成 Windows 安装包：

```bash
pnpm run dist
```

或者：

```bash
npm run dist
```

打包完成后，安装包会生成在：

```bash
dist/
```

这个目录里一般会有 `.exe` 安装文件，可以直接拿去安装或者上传到 GitHub Releases。

## 说明

`node_modules` 和 `dist` 目录没有上传到仓库里，这是正常的。
`node_modules` 可以通过安装依赖重新生成，`dist` 是打包后的结果，也可以通过构建命令重新生成。

## 后续计划

后面可能会继续加一些小功能，比如：

* 待办事项完成状态
* 分类管理
* 搜索功能
* 更好看的界面样式
* 数据导入和导出

目前这个版本主要还是一个比较基础的 Electron 本地待办应用。

