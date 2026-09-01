# west2-online A4 / A3 组织形象海报

当前 `poster/` 主版本已经由 v4 refined 替换第三版。第三版 SVG、背景图、PNG 与 PDF 均已被覆盖，不再保留额外备份。

本版以经过局部微调的建筑式抽象图作为整页背景：左下深灰块收窄，右侧橙色梁增加向上的纵向延伸，右下细线密度降低。左上与右下信息岛之间加入白色对角渐变遮罩；遮罩位于背景之上、文字之下，渐变端点分别位于两个信息岛角点，透明度为 `30% → 0% → 30%`，整页覆盖以避免矩形接缝。

## 主要文件

- `west2-online-a4.svg`：当前主要编辑稿；保留人工微调后的文案、位置、形变、字体效果和嵌入资源。
- `output/png/west2-online-a4.png`：300 dpi 成品，`2480 × 3508 px`。
- `output/pdf/west2-online-a4.pdf`：A4 单页 PDF。
- `output/png/west2-online-a4-bleed.png`：A4 四边各 3 mm 出血的 300 dpi 印刷 PNG，`2551 × 3579 px`。
- `output/pdf/west2-online-a4-bleed.pdf`：A4 四边各 3 mm 出血的印刷 PDF，含标准 A4 TrimBox 与整页 BleedBox。
- `output/png/west2-online-a3.png`：300 dpi 成品，`3508 × 4961 px`。
- `output/pdf/west2-online-a3.pdf`：A3 单页 PDF。
- `output/png/west2-online-a3-bleed.png`：A3 四边各 3 mm 出血的 300 dpi 印刷 PNG，`3579 × 5031 px`。
- `output/pdf/west2-online-a3-bleed.pdf`：A3 四边各 3 mm 出血的印刷 PDF，含标准 A3 TrimBox 与整页 BleedBox。
- `ai-hero-background.png`：当前微调背景图。
- `qrcode.jpg`：群聊二维码源图；文件扩展名为 JPG，但实际编码为 PNG。
- `qrcode-west2-styled.png`：人工维护的透明底二维码；保持原二维码码点位置，并在原中央图形范围内加入西二徽标。
- `style-embedded-poster.mjs`：以当前嵌入 SVG 为基础，把 `ai-hero-background.png` 与透明二维码原样更新为 Base64，再导出 PNG/PDF；不会改写字体、文案、位置、形变，也不会重绘资源。
- 当前字体分工：中文使用 `Alimama ShuHeiTi` Bold，并以 `Noto Sans CJK SC` 等字体回退；英文使用 `Inter`；数字使用 `IBM Plex Sans`。

## 图层顺序

1. `full-bleed-background`：整页背景图。
2. `information-diagonal-mask`：整页白色对角渐变遮罩。
3. `identity-block`：左上 Logo、工作室名称与说明。
4. `floating-contact-layer`：GitHub、群号和群聊二维码；只保留指定内容本体，不使用卡片、边框、投影或附加文字。
5. `open-source-principles`：右下开放、开源、共享理念。

## 文字强调

- 深橙：西二在线、WEST2-ONLINE、1998 年、开放协作、三项中文理念与编号。
- 深灰：其余主标题、说明和英文理念。
- 悬浮联系文字使用深橙填充，并带 `#424747`、`1px` 深灰描边。
- 右下小字号使用纸色 knockout 轮廓，在细线背景上维持可读性。

## 渲染

首次使用时，在仓库根目录安装 `poster/` 自己的依赖：

```powershell
npm --prefix poster install
```

之后每次修改 `west2-online-a4.svg`，运行：

```powershell
npm --prefix poster run render
```

安装依赖后，也可以直接运行同一个 `.mjs`：

```powershell
node poster\style-embedded-poster.mjs
```

脚本不依赖 Codex 缓存。它只会同步外部背景与二维码，再同时生成 A4 与 A3 的普通版及 3 mm 出血版 PNG/PDF；SVG 内现有字体样式和排版节点会原样保留。所有 PNG 均写入 300 dpi 元数据。出血版只在裁切线外镜像延展边缘背景，不会缩放或移动裁切线内的版式；PDF 同时写入对应 A4/A3 TrimBox 和整页 BleedBox。正式交付印刷时优先使用文件名带 `-bleed` 的 PDF，普通版继续用于屏幕预览或无需裁切的输出。

出血导出不会自动把文件转换为 CMYK：PNG 使用嵌入 sRGB，PDF 保持 RGB 画面。若打印店要求 CMYK，应先取得其设备与纸张对应的 ICC Profile，再单独转换印刷副本，不要覆盖当前 RGB 编辑稿。

四边出血由 `style-embedded-poster.mjs` 顶部的 `bleedMillimeters` 控制，默认值为 `3`；如果打印店明确要求 5 mm，可将它改为 `5` 后重新运行导出。命令结束时会打印输入/输出绝对路径、生成时间、出血像素与 PDF 页面框，以及 SVG/各尺寸 PNG 的 SHA-256；如果哈希或输出时间没有变化，应先核对编辑的是否为 `poster/west2-online-a4.svg`，以及查看的是否为 `poster/output/png/`、`poster/output/pdf/` 中对应尺寸的文件。

二维码改色后可运行 `npm run verify:qr`；它会同时解码 `qrcode-west2-styled.png` 和导出 PNG 中经过斜切的二维码，并确认两者内容一致。

## 悬浮组件角度、形变与位置

三个组件的外层只负责定位：

- GitHub：`transform="translate(12 665)"`
- 群号：`transform="translate(264 900)"`
- 二维码：`transform="translate(560 365)"`

`translate(x y)` 中增大 `x` 会右移，增大 `y` 会下移。三个组件的内层 `contact-plane` 必须保持同一个形变：

```svg
transform="skewY(-20) scale(0.866 1)"
```

- `skewY(-20)` 控制组件上下边沿背景斜梁上升，同时保留左右边缘竖直；负数使右端上抬。需要改斜率时，应同时修改三个 `contact-plane` 的 `-20`，不要分别调整。
- `scale(0.866 1)` 模拟组件绕竖直轴向屏幕内转 `30°` 后的正投影，其中 `0.866 = cos(30°)`。通用写法是 `scale(cos(θ) 1)`：`20° → 0.940`，`30° → 0.866`，`40° → 0.766`。数值越小，横向收窄越明显，平面看起来越向内转。
- 这个组合会把正方形变为上下边倾斜、左右边竖直的平行四边形，接近“门片绕竖直铰链旋转”的视觉模型。若要加入近大远小，则需进一步做四点透视映射。

二维码使用 `preserveAspectRatio="none"`，因此会与文字一起发生横向压缩和纵向错切。此形变符合当前视觉意图，但扫码容错会低于正方形原图；定稿前应使用实际 QQ 客户端测试印刷样张。若扫码不稳定，可为二维码单独减小 `skewY` 幅度并把横向比例调近 `1`。
