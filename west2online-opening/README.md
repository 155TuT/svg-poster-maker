# 西二在线 2026 纳新开屏

[2026-opening.svg](2026-opening.svg) 是唯一正式编辑稿，画布 **1206 × 2622 px**。沿用当前中轴排布，以今年海报的暖纸色、橙色、炭灰、网点与透明平面统一视觉。

![启动页预览](output/2026-opening-preview.png)

## 当前设计

- 尖括号为两条单色平面路径，取消立体侧面、倒角、渐变高光和投影。
- “纳新啦”为原创圆润笔画，每字独立成组；橙色字面配细炭灰轮廓，三个字的可见中心均为 **x = 603**。轻微倾斜用于形成节奏，细纸色隔离边保持字与背景的辨识度。
- 中文标题使用 `font-cjk`，保留“西二 / 在线”的错位组合；英文为白色填充、4 px 炭灰外描边，WEST-2 在西二下方，ONLINE 在在线上方。中央放置指定 logo，2026 横排在其下方，三个组合均旋转 −3°。
- 薄片改为透明平面叠色，去掉长方体托台和悬浮阴影。底部福uu及标语保留。

## 文件

| 文件 | 用途 |
| --- | --- |
| `2026-opening.svg` | 7 个命名图层、原生路径与 7 个可编辑文字节点 |
| `output/2026-opening.png` | 1206 × 2622 原尺寸成稿 |
| `output/2026-opening-preview.png` | 402 × 874 等比预览 |
| `output/2026-opening-mobile-390x844.png` | 390 × 844 手机视口检查图 |
| `preview.html` | 查看当前成稿及下载入口 |
| `render.cjs` | 按当前 SVG 导出 PNG，不改写主稿 |
| `process/DESIGN.md` | 当前视觉规范 |
| `process/TYPOGRAPHY.md` | 艺术字结构与排版说明 |
| `process/references/` | 原始参考图，原样保留 |

普通导出只生成上述三张当前成品图。旧版本对照、辅助线、结构线稿、长方体检查图和排版过程截图已从导出目录及预览入口移除，不再自动生成。`process/iterations/` 与旧几何记录是保留的历史来源，不参与当前导出；其几何脚本不适用于当前扁平稿。

## 编辑

在 Inkscape、Illustrator 或代码编辑器中编辑 SVG。主体和艺术字为原生矢量；logo 原 SVG 的内容已直接内嵌到 `heading-logo-art`，其中的 PNG 也是 Base64 内嵌。单独移动主稿即可显示 logo，无需读取 `process/references/`。

| 图层 ID | 内容 |
| --- | --- |
| `paper` | 暖纸底色与固定 seed 的细纸纹 |
| `graphic-field` | 网点、细线与小色块 |
| `paper-overlays` | 透明平面叠色 |
| `code-brackets` | 两个平面尖括号 |
| `recruitment-callout` | “纳新啦”手绘艺术字及小笔触 |
| `recruitment-heading` | 工作室中英文名与年份 |
| `footer-identity` | 福uu与标语 |

“纳新啦”的骨架在 `defs` 中的 `glyph-na / glyph-xin / glyph-la`。修改其中的路径即可同步改变各字的字面、细轮廓与纸色隔离边；通过 `callout-na / callout-xin / callout-la` 调整整字位置。它们是可编辑路径，不是可直接输入替换的字体文字。标题及页脚仍保留文字编辑。

标题的 `heading-left / heading-brand / heading-right` 分别控制左侧中英文、中央 logo 与年份、右侧中英文。每组统一 `rotate(-3)`；中英文对齐按旋转前的可见字形边缘计算。英文通过 `stroke-width="8"` 与 `paint-order="stroke fill"` 形成真实向外 4 px 的描边，白色字面覆盖描边向内的一半。

## 导出

在本目录运行：

```powershell
npm.cmd run render
```

首次使用且缺少依赖时运行 `npm.cmd install`。`render` 只导出三张当前 PNG，不生成检查报告或演进截图。

渲染器使用已安装的 Chrome / Edge，也可通过 `OPENING_BROWSER` 指定浏览器。字体直接使用系统安装的字体，遵循 SVG 中的字体栈；缺少某个字体时由浏览器正常回退。

中文标题当前使用 `.font-cjk`。可自由切换为 `.font-title`（站酷酷黑体）、修改字体栈、位置、颜色和效果，导出脚本不限制字体、图层 ID、对齐位置或设计风格。字体改变后可按预览调整间距。“纳新啦”是路径，不受字体切换影响。
