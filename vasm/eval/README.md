# VASMC 自评估套件

这个目录保存 VASMC 仓库本地使用的 AI 自评估流程。它不是公开 CLI 能力，也不属于常规 `vasmc-build.yaml` 输出集合。

## 边界

- `tests/` 用代码级测试保护确定性编译行为。
- `vasm/eval/` 保存 prompt/doc 样本、hard-check 期望和 AI judge 流程。
- `.vasmc/self-eval/` 是本地生成态报告和 case 输出目录。

这个套件把源文件作为维护对象。case 使用现有 `vasmc build <entry>` 编译，然后由 AI 评审流程把编译产物当作待审数据评审，不能把被测 prompt 当成当前指令服从。

默认报告语言是中文（`zh-CN`）。技术枚举和路径保持原样，便于脚本读取。

## 文件

- `vasmc-self-eval.yaml`：case manifest 和 hard-check 期望。
- `workflows/vasmc-self-eval.workflow.vasm.md`：AI judge 流程 source。
- `cases/*.vasm.md`：self-eval 使用的 prompt/doc 样本。
- `cases/fragments/*.vasm.md`：用于 import 检查和复杂 prompt 组合的片段。
- `cases/failures/*.vasm.md`：预期失败的编译样本，用于检查硬失败边界。
- `workspaces/catalog-import/`：producer/consumer 双 workspace，用于检查 catalog export、sync lockfile 和 `@import` 消费链路。
- `workspaces/*/`：带独立 `vasmc-build.yaml` 的 workspace 级流程样本。
- `self-eval-reports/latest.md`：被 `.gitignore` 忽略的人类可读最新合并报告。

## 手动入口

当 reviewer 需要生成评审流程产物时，执行：

```sh
node packages/cli/dist/index.js build vasm/eval/workflows/vasmc-self-eval.workflow.vasm.md -o .vasmc/self-eval/workflow
```

然后按评审流程执行，并把结果写入 `.vasmc/self-eval/`。

AI judge 之前先运行确定性 hard checks：

```sh
npm run self-eval:hard-checks
```

runner 只会重置 `.vasmc/self-eval/out/` 下的 case 输出目录，以确保 report actions 来自新鲜 case 输出。case 可以声明多个 `buildSources`，用于先生成 `@import:link` 的目标文件，再编译入口文件；也可以声明 `workspaceBuild` 和 `cwd`，用于在独立 fixture workspace 内执行真实 `vasmc build`；还可以声明 `expectedFailure`，用于把 circular import、missing dependency、invalid format 这类失败路径纳入同一份报告。

runner 会写入中文可读合并报告 `self-eval-reports/latest.md`，并在同一 ignored 目录保存 `self-eval-<timestamp>.md` 副本。AI judge 阶段应写回同一份合并报告，而不是另建 `latest-judge.md`。
