# Windows 95 浏览器二维码框

这是一个独立的 SVG 小元素项目。`win95-explorer-qrcode.svg` 是唯一的可编辑视觉源文件；脚本只同步内嵌二维码并向 `output/` 导出 PNG，不重复导出 SVG。

## 文件

- `win95-explorer-qrcode.svg`：Windows 95 风格浏览器窗口可编辑源文件。
- `process-windows-explorer.mjs`：重新读取图标与二维码原图，将 Base64 同步到源 SVG，并导出、验证 PNG。
- `icon/west2-online-avatar.png`：标题栏左侧的 18 × 18 显示图标原图。
- `icon/qq-2006-avatar.png`：地址栏中的 15 × 15 显示图标原图。
- `qrcode/raw-qrcode.jpg`：二维码原始图片，保持不变。
- `qrcode/process-qrcode.mjs`：从原始图片解码并生成透明底黑色方块二维码。
- `qrcode/qrcode-design-black.png`：嵌入窗口的 560 × 560 二维码，四周仅保留 5px 透明静区。
- `output/qrcode-with-win95-explorer.png`：2 倍尺寸 PNG 成品。

## 使用

首次使用时安装当前小项目自己的依赖：

```powershell
npm.cmd --prefix svg-poster-maker\design\qrcode-with-win95-explorer install
```

重新处理二维码并导出窗口 PNG：

```powershell
npm.cmd --prefix svg-poster-maker\design\qrcode-with-win95-explorer run check
```

若二维码已经处理完成，只同步嵌入并导出窗口：

```powershell
npm.cmd --prefix svg-poster-maker\design\qrcode-with-win95-explorer run render
```

## 输出与检查

两张图标在 SVG 前部 `<defs>` 中以带 `data-source` 的 `<image>` 定义，画面中的 `browser-icon` 与 `address-icon` 只通过 `<use>` 引用。每次运行脚本都会重新读取 `icon/` 下的原始 PNG 并刷新 Base64，不会沿用上一次内嵌的数据。

脚本还会验证二维码尺寸、5px 透明静区与纯黑模块，随后生成 `1296 × 1390` PNG，并比较源二维码与窗口成品的扫码内容。窗口不包含导航工具栏和横向滚动条。

`node_modules/` 与 `output/` 由仓库根目录的 `.gitignore` 统一忽略。
