# 西二在线设计组海报

`design.svg` 是海报的编辑源文件。它使用语义化图层、内嵌图片和集中式 CSS，可直接修改文字、坐标、尺寸与样式。

## 工作流

1. 在 `design.svg` 中编辑简体文案与版式。
2. 运行 `process-poster.mjs`。
3. 脚本同步本地图片、处理导出字形，并生成正式 PNG 与 PDF。

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

- PNG：`2480 × 3508 px`，300 dpi。
- PDF：单页 A4，`210 × 297 mm`。

## SVG 结构

`design.svg` 按照网页式结构组织：

- `<defs>`：全局字体、图案、裁切区域和内嵌素材。
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

每个 `<image>` 使用 `data-source` 记录本地路径。脚本读取这些素材并更新对应的 Base64 数据，使 `design.svg` 保持自包含。

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

`design.svg` 保存作者输入的简体正文；PNG 与 PDF 使用内存渲染副本。当前标题在导出时采用 `设 → 設`、`计 → 計`，其余字符保持原文。

Matisse EB 由本机授权字体提供，思源宋体 Heavy 提供缺字回退。自定义字体位置可通过 `MATISSE_FONT_PATH` 指向 `FOT-MatissePro-EB.otf`。

### EVA 标题质感

脚本将 `.font-display` 单独渲染为透明文字层，并采用 eva-title 的核心参数处理：

- 将文字层缩小 `1.4×` 后恢复到输出尺寸，形成轻微的边缘软化。
- 使用亮度加权灰度噪声，振幅为 `18`。
- 使用固定种子 `18`，使每次导出的像素结果一致。
- 将处理后的文字层合成到海报底层，使噪点范围与字体范围一致。

## 版式参数

- SVG 画布：`595 × 842`，A4 纵向比例。
- Apple 图标背景：`x=-127, y=-4, 850 × 850`。
- Lain 图层：`x=98, y=282, 400 × 560`。
- 原图残影透明度：`0.16`。

## 鸣谢

感谢[github@itorr的eva-title](https://github.com/itorr/eva-title)提供的字体实现思路
