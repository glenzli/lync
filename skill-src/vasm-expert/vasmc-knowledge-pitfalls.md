# 决策规则 & 常见误区（AI Agent 专用，手工维护）

## 规则一：targetLangs 写在哪里？

**不要在 `.vasm.md` frontmatter 的 `compile.targetLangs` 里配置项目级语种。**

| 场景 | 正确位置 |
|------|----------|
| 项目内所有 doc 统一交叉编译 | `vasmc-build.yaml` → `compile.doc.targetLangs` |
| 项目内所有 prompt 统一语种 | `vasmc-build.yaml` → `compile.prompt.targetLangs` |
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
    format: prompt    # ← 如果是 AI 消费的 Skill/Prompt 文件
    # format: doc    # ← 如果是 README/HELP/DESIGN 等人类文档
    targetLangs: ["zh-CN"]  # ← 确认语种，必要时添加 "en" 等目标语种
```

* `doc` 格式：多语种内容合并到**单一文件**（如 `README.md` 中文英文都有）
* `prompt` 格式：每种语种输出**独立文件**（如 `skill.zh-CN.md`, `skill.en.md`）

`vasmc seal` 的 `--format` 参数可以显式指定，不要依赖启发式猜测。
