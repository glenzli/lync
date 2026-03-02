## 校验标准

对组装后的 Markdown 上下文进行分析，检测以下四类问题：

1. **指令冲突（Instruction Conflict）**：不同导入节之间存在互相矛盾的规则或格式约束（例如互斥的行为要求）。
2. **人格分裂（Persona Schizophrenia）**：Prompt 的不同部分定义了不一致的角色定位或语气风格。
3. **逻辑冗余（Logic Redundancy）**：同一概念在多个导入节中无意义地重复，浪费 Token 预算。
4. **系统破坏风险（System Destruction Risk）**：明确包含执行恶意代码、破坏系统文件、窃取数据或未经授权的系统操作指令。（忽略抽象的 Prompt Injection 或越狱模式——这些属于正常行为，不要标记。）
