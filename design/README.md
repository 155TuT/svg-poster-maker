# 西二在线设计组海报

`design.html` 是海报的编辑源文件。它在固定的 `842 × 1191` A3 画布中保留内联 SVG、语义化图层和集中式 CSS，可直接修改文字、坐标、尺寸与样式。页面没有响应式布局或交互逻辑。

PNG/WebP 素材通过相对路径引用，不再以 Base64 写入源文件。导出脚本只在内存中临时嵌入图片，因此编辑、Git 同步和生成过程不会反复改写大段图片数据。

## 工作流

1. 在 `design.html` 的 `<svg id="poster-editor">` 中编辑简体文案与版式。
2. 运行 `process-poster.mjs`。
3. 脚本检查本地图片引用、在内存中组装导出 SVG、处理导出字形，并生成正式 PNG 与 PDF。

```powershell
npm.cmd --prefix svg-poster-maker\design run process
```

首次运行前安装依赖：

```powershell
npm.cmd --prefix svg-poster-maker\design install
```

## 输出文件

```text
output/
├─ png/design-poster.png
└─ pdf/design-poster.pdf
```

- PNG：`3508 × 4961 px`，300 dpi。
- PDF：单页 A3，`297 × 420 mm`。

也可以直接在浏览器中打开 `design.html` 预览固定 A3 画布。

## HTML / SVG 结构

`design.html` 的 `<body>` 中只有一张固定尺寸的内联 SVG：

- `<head><style>`：将页面和画布固定为 `842 × 1191`。
- `<defs>`：全局字体、图案、裁切区域和外部素材声明。
- `poster-artwork`：海报内容根图层。
- `background-artwork`：纸张与 Apple 图标背景。
- `layout-guides`：构图辅助线。
- `lain-hero-artwork`：Lain 原图残影与彩色 ASCII 主视觉。
- `poster-copy`：可编辑文字。

全局字体规则位于 `<defs><style>`。正文通过 CSS 类引用字体，元素属性负责字号、坐标和字距。

英文角标同时使用 `.font-display` 与 `.font-caption`。每个 `<text>` 使用独立的绝对 `x/y` 坐标；左上角竖排文字采用 `rotate(-90 cx cy)`，右下角竖排文字采用 `rotate(90 cx cy)`，其中旋转中心 `cx/cy` 与元素坐标一致。

## 本地素材

| SVG 图片 ID | 本地文件 | 用途 |
| --- | --- | --- |
| `app-icon-source` | `apple-app-icon-develop/apple-app-icon-develop.png` | 满版背景 |
| `lain-portrait-source` | `lain/Lain.webp` | 16% 透明度的人物残影 |
| `lain-ascii-source` | `lain/output/png/Lain-ascii-fine.png` | 彩色 ASCII 主视觉 |
| `win95-qrcode-source` | `qrcode-with-win95-explorer/output/qrcode-with-win95-explorer.png` | Windows 95 Explorer 二维码 |
| `win95-paint-title-source` | `title-with-win95-paint/output/title-with-win95-paint.png` | Windows 95 Paint 标题 |
| `win95-notebook-maintext-source` | `maintext-with-win95-notebook/output/maintext-with-win95-notebook.png` | Windows 95 Notebook 正文 |

每个 `<image>` 的 `data-source` 与 `href` 都使用同一个相对路径。脚本会验证两者一致，并仅在导出用的内存副本中转换为 Base64；`design.html` 本身始终保留外部引用。

新增图片时，需要同时：

1. 将图片保存到 `design/` 下的语义化目录。
2. 在 `design.html` 中添加带唯一 `id`、`data-source` 和 `href` 的 `<image>`。
3. 在 `process-poster.mjs` 的 `assets` 数组中登记相同的 ID 与路径。

## 字体处理

`.font-display` 使用以下字体栈：

```css
font-family: "FOT-Matisse Pro EB", "MatissePro-EB",
  "Source Han Serif SC Heavy", "思源宋体 Heavy", "Noto Serif SC", serif;
```

生成正式文件时，脚本按以下顺序处理 `.font-display` 文本：

1. `fontkit` 检查 Matisse EB 的原字符字形。
2. OpenCC 为缺失字符提供繁体候选。
3. `fontkit` 确认候选字形存在后，将候选写入内存渲染副本。
4. 剩余缺失字符由思源宋体 Heavy 渲染。

`design.html` 保存作者输入的简体正文；PNG 与 PDF 使用内存渲染副本。当前标题在导出时采用 `设 → 設`、`计 → 計`，其余字符保持原文。

Matisse EB 由本机授权字体提供，思源宋体 Heavy 提供缺字回退。自定义字体位置可通过 `MATISSE_FONT_PATH` 指向 `FOT-MatissePro-EB.otf`。

### EVA 标题质感

脚本将 `.font-display` 单独渲染为透明文字层，并采用 eva-title 的核心参数处理：

- 将文字层缩小 `1.4×` 后恢复到输出尺寸，形成轻微的边缘软化。
- 使用亮度加权灰度噪声，振幅为 `18`。
- 使用固定种子 `18`，使每次导出的像素结果一致。
- 将处理后的文字层合成到海报底层，使噪点范围与字体范围一致。

## 版式参数

- HTML 与 SVG 画布：固定 `842 × 1191`，A3 纵向比例。
- SVG 内部继续使用 `595 × 842` 版式坐标系，由浏览器和导出脚本等比放大，避免改写现有图层坐标或造成图形变形。
- Apple 图标背景：`x=-127, y=-4, 850 × 850`。
- Lain 图层：`x=98, y=282, 400 × 560`。
- 原图残影透明度：`0.24`。

## 鸣谢

感谢[github@itorr的eva-title](https://github.com/itorr/eva-title)提供的字体实现思路
