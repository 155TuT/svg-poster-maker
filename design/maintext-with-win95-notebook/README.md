# Windows 95 记事本正文窗口

这是一个独立的 SVG 小元素项目，延续同目录 Windows 95 Explorer 与 Paint 元素的结构和视觉语言。`win95-notebook.svg` 是唯一的可编辑视觉源文件；MJS 脚本负责结构校验并向 `output/` 导出 PNG。

## 文件

- `win95-notebook.svg`：完整、可编辑的 Win95 Notepad 矢量窗口。
- `render-win95-notebook.mjs`：检查语义图层、纯矢量结构和等比缩放，并导出 PNG。
- `package-lock.json` 与 `node_modules/`：当前小项目自己的锁文件和依赖，不借用上级目录。
- `output/maintext-with-win95-notebook.png`：`840 × 904` PNG 成品。

## 界面结构

- 深蓝标题栏、记事本图标与三枚窗口控制按钮。
- File、Edit、Search、Help 菜单栏。
- 白色等宽文本编辑区，承载西二在线设计组纳新正文。
- Win95 凹陷边框、点阵滚动轨道及双向滚动条。

全部界面元素均为 SVG 矢量节点，不依赖外部图片。SVG 使用 `420 × 452` 逻辑画布，并以严格 `2×` 等比尺寸导出，避免图标、按钮和滚动条发生非等比形变。渲染脚本会测量实际字形边界，检查正文与编辑区四边均保留 `12–22` 个逻辑单位的紧凑留白。

## 使用

首次使用：

```powershell
npm.cmd --prefix svg-poster-maker\design\maintext-with-win95-notebook install
```

导出并检查：

```powershell
npm.cmd --prefix svg-poster-maker\design\maintext-with-win95-notebook run check
```

`node_modules/` 与 `output/` 由仓库根目录的 `.gitignore` 统一忽略。
