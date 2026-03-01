# Lync Future Proposals

This document tracks exploratory ideas and feature proposals for the Lync protocol that are currently deferred due to complexity, model capabilities, or conceptual mismatches, but remain conceptually valuable for future iterations.

## 1. Semantic Tree-Shaking

**Concept:** 
When compiling large nested prompt graphs, the compiler could utilize a localized lightweight LLM call (or embedding search) against the specific User Intent to "shake off" or prune irrelevant markdown sections (rules, examples) that do not apply to the current context, saving massive token space.

**Why Deferred:** 
Requires extremely high intelligence and precision from the LLM. If the tree-shaking LLM is less capable than the target LLM running the final prompt, it might mistakenly strip critical boundary conditions or safety instructions, causing catastrophic failures downstream.

## 2. Template Injection (Variables in Prompts)

**Concept:** 
Allow passing variables into `@import:inline` directives, e.g., `[Skill](lync:skill "@import:inline" '{"lang": "Rust"}')`, which would dynamically replace `{{lang}}` within the target AST.

**Why Deferred:** 
Prompt Engineering inherently relies on semantic natural language. Over-engineering variable injection turns it back into traditional code templating (like Mustache/Jinja). It's often simpler to just append an instruction: "Apply the above skill using Rust." Hardcoded structural variables might unnecessarily restrict the fluid nature of LLMs.

## 3. Dynamic Testing & REPL (lync test)

**Concept:** 
A command like `lync test main.lync.md` that assembles the prompt in memory and drops the user into an interactive CLI chat session (REPL) hooked up to the LLM API, allowing instant Hot-Reload testing of the prompt modifications.

**Why Deferred:** 
The API used locally for testing (e.g., standard OpenAI) might exhibit drastically different behaviors from the actual target model the user intends to deploy the prompt on (e.g., a specific enterprise DeepSeek instance or Ollama). The local testing loop might create a false sense of security (overfitting to the local test model).
