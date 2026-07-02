# 决策规则 & 常见误区（AI 编辑器专用，手工维护）

## 规则一：targetLangs 写在哪里？

**不要在 `.vasm.md` frontmatter 的 `compile.targetLangs` 里配置项目级语种。**

| 场景 | 正确位置 |
|------|----------|
| 项目内所有 informational 统一交叉编译 | `vasmc-build.yaml` → `compile.informational.targetLangs` |
| 项目内所有 executable 统一语种 | `vasmc-build.yaml` → `compile.executable.targetLangs` |
| 对外发布的独立模块（自带语种声明） | 文件 frontmatter `compile.targetLangs` |

优先级（高到低）：`文件 frontmatter` > `vasmc-build.yaml 按格式配置` > `CLI --target-langs` > `文件内 lang 块自动提取`

**工程项目默认用 `vasmc-build.yaml`，frontmatter 留给分发模块。**

***

## 规则二：输出路径公式（routing vs output.dir + baseDir）

最终输出路径 = `output.dir` + (文件路径 relative to `baseDir`)，**routing 是在此基础上的拦截覆盖**。

```
# 设定：
output.dir: ./dist
baseDir: ./src

# 文件：src/agents/foo.vasm.md
# 默认路径：./dist/agents/foo.md

# 如果有 routing:
# - match: "src/agents/*.vasm.md"
#   dest: "./skills/"
# 最终路径：./skills/foo.md  ← routing 覆盖了默认的 ./dist/agents/
```

⚠️ 直接写 routing 而不设 `output.dir`/`baseDir` 时，默认 output 是 `./dist`，baseDir 是项目根目录。

***

## 规则三：vasmc seal 之后必须检查 compile.format

`vasmc seal` 会根据文件名启发式推断格式，但你**必须**在生成的 frontmatter 里确认：

```yaml
vasm:
  compile:
    format: executable      # ← 如果是 AI 消费的 Skill/Prompt 文件
    # format: informational # ← 如果是 README/HELP/DESIGN 等信息文档
    # format: integrative   # ← 如果是组合多个 VASM 模块的 source-only 整合指导
    targetLangs: ["zh-CN"]  # ← 确认语种，必要时添加 "en" 等目标语种
```

* `informational` 格式：多语种内容合并到**单一文件**（如 `README.md` 中文英文都有）；如果旧输出已有目标语种段，AI build 会保留它们并生成 `refresh_translation` action
* `executable` 格式：每种语种输出**独立文件**（如 `skill.zh-CN.md`, `skill.en.md`）
* `integrative` 格式：**不生成输出文件**，AI 直接读取 source，把它当组合指导

`vasmc seal` 的 `--format` 参数可以显式指定，不要依赖启发式猜测。

***

## 规则四：integrative 指导用 appliesTo 建关系

如果你创建的是组合指导文件，不要把它通过 `@import:inline` 放进目标 executable。正确方式是在 guide 的 Frontmatter 中声明：

```yaml
vasm:
  compile:
    format: integrative
  integration:
    appliesTo:
      - vasm:target-skill
      - skill-src/target/**/*.vasm.md
```

`appliesTo` 命中后，`vasmc build` 会在目标 executable 的 report actions 中生成 `integration_guidance`，提醒 AI 在整合前读取 guide。

***

## 规则五：`@import:link` 目标要进入同一次构建

`@import:link` 只保留链接边界，不会内联内容。编译器会把本地 `.vasm.md` 链接重写为生成 `.md` 路径，但**链接目标也必须被构建**，否则生成的链接可能指向不存在的文件。

| 场景 | 正确做法 |
|------|----------|
| workspace 内多个 source 互相 link | 在 `vasmc-build.yaml.includes` 中包含 link target source |
| 单入口 build 需要可点击 link | 先单独 build link target，或改用 workspace build |
| 只是想把内容拼进最终 prompt | 使用 `@import:inline` 而不是 `@import:link` |

发现坏链接时，不要手改生成 `.md`；应调整 source import、workspace includes、output/baseDir 或 routing 后重新 `vasmc build`。
