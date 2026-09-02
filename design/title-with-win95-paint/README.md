# Windows 95 画图界面

这是一个独立的 SVG 小元素项目，根据经典 Windows 95 Paint 界面制作。`win95-paint.svg` 是唯一的可编辑视觉源文件；脚本只向 `output/` 导出 PNG，不重复导出 SVG。

## 文件

- `win95-paint.svg`：完整的可编辑 Win95 Paint 矢量界面。
- `render-win95-paint.mjs`：检查 SVG 结构并导出 2 倍 PNG。
- `output/title-with-win95-paint.png`：`1373 × 924` PNG 成品。

## 界面结构

- 深蓝标题栏与窗口控制按钮。
- File、Edit、View、Image、Options、Help 菜单栏。
- 双列 16 工具箱及工具选项面板，铅笔工具为当前选中状态。
- 空白可编辑画布和双向滚动条。
- 前景色/背景色叠放框与双排立体按钮调色板。

参考图中的水印未写入成品。全部界面元素均为 SVG 矢量节点，不依赖外部图片。

SVG 使用 `936.1363636363636 × 630` 的同宽高比逻辑画布，并声明为 `1373 × 924` 显示尺寸。导出脚本会校验横纵缩放比完全一致，避免工具图标和按钮发生非等比形变。

## 使用

首次使用：

```powershell
npm.cmd --prefix svg-poster-maker\design\title-with-win95-paint install
```

导出并检查：

```powershell
npm.cmd --prefix svg-poster-maker\design\title-with-win95-paint run check
```

`node_modules/` 与 `output/` 由仓库根目录的 `.gitignore` 统一忽略。
