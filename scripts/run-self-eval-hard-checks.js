#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const yaml = require('yaml');

const root = path.resolve(__dirname, '..');
const suitePath = path.join(root, 'eval-src', 'vasmc-self-eval.yaml');
const cliPath = path.join(root, 'packages', 'cli', 'dist', 'index.js');

function readYaml(filePath) {
    return yaml.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeYaml(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, yaml.stringify(value), 'utf8');
}

function relPath(filePath) {
    return path.relative(root, filePath) || '.';
}

function absPath(relativePath) {
    return path.resolve(root, relativePath);
}

function findEntry(report, source) {
    return report.entries?.find(entry => entry.source === source);
}

function readText(relativePath) {
    return fs.readFileSync(absPath(relativePath), 'utf8');
}

function result(ok, message, evidence) {
    return {
        ok,
        message,
        ...(evidence === undefined ? {} : { evidence }),
    };
}

function collectDiagnosticCodes(entry) {
    return [
        ...(entry?.diagnostics || []).map(diagnostic => diagnostic.code),
        ...(entry?.policy?.diagnostics || []).map(diagnostic => diagnostic.code),
        ...(entry?.dependencies || []).flatMap(dependency => (dependency.diagnostics || []).map(diagnostic => diagnostic.code)),
    ];
}

function commandOutput(error) {
    return [
        error?.stdout ? String(error.stdout) : '',
        error?.stderr ? String(error.stderr) : '',
        error?.message ? String(error.message) : '',
    ].join('');
}

function runBuildSource(buildSource, defaultCwd) {
    const cwd = absPath(buildSource.cwd || defaultCwd || '.');
    const args = buildSource.workspace
        ? [cliPath, 'build']
        : [cliPath, 'build', buildSource.source, '-o', buildSource.outDir];
    try {
        const output = execFileSync(process.execPath, args, {
            cwd,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, NO_COLOR: '1' },
        });
        if (output) process.stdout.write(output);
        return { ok: true, ...buildSource, output };
    } catch (error) {
        const stdout = error.stdout ? String(error.stdout) : '';
        const stderr = error.stderr ? String(error.stderr) : '';
        if (stdout) process.stdout.write(stdout);
        if (stderr) process.stderr.write(stderr);
        return {
            ok: false,
            ...buildSource,
            output: commandOutput(error),
        };
    }
}

function normalizeBuildSource(source, defaultOutDir) {
    if (typeof source === 'string') {
        return { source, outDir: defaultOutDir };
    }
    return {
        source: source.source,
        outDir: source.outDir || defaultOutDir,
    };
}

function buildSourcesForCase(testCase) {
    if (testCase.workspaceBuild) {
        return [{
            workspace: true,
            cwd: testCase.cwd || '.',
        }];
    }
    const sources = Array.isArray(testCase.buildSources)
        ? testCase.buildSources.map(source => normalizeBuildSource(source, testCase.outDir))
        : [];
    if (testCase.source && !sources.some(source => source.source === testCase.source)) {
        sources.push({ source: testCase.source, outDir: testCase.outDir });
    }
    return sources;
}

function checkHardBoundary(check, entry, buildResult) {
    switch (check.type) {
        case 'build_success': {
            return result(buildResult.ok, '编译应成功', buildResult.lastError);
        }
        case 'build_fails': {
            return result(!buildResult.ok, '编译应失败', buildResult.lastError);
        }
        case 'build_error_contains': {
            return result(
                buildResult.lastError.includes(check.text),
                `编译错误包含预期文本：${check.text}`,
                buildResult.lastError
            );
        }
        case 'output_exists': {
            return result(fs.existsSync(absPath(check.path)), `目标文件存在：${check.path}`);
        }
        case 'output_missing': {
            return result(!fs.existsSync(absPath(check.path)), `目标文件不存在：${check.path}`);
        }
        case 'contains': {
            const content = readText(check.path);
            return result(content.includes(check.text), `目标文件包含预期文本：${check.path}`, check.text);
        }
        case 'no_text': {
            const content = readText(check.path);
            return result(!content.includes(check.text), `目标文件不包含禁止文本：${check.path}`, check.text);
        }
        case 'report_format': {
            return result(entry?.format === check.value, `build report format 为 ${check.value}`, entry?.format);
        }
        case 'report_status': {
            return result(entry?.status === check.value, `build report status 为 ${check.value}`, entry?.status);
        }
        case 'report_action': {
            const actions = (entry?.actions || []).map(action => action.type);
            return result(actions.includes(check.value), `build report action 包含 ${check.value}`, actions);
        }
        case 'translate_target': {
            const targets = (entry?.actions || [])
                .filter(action => action.type === 'translate')
                .flatMap(action => action.targets || []);
            return result(targets.includes(check.value), `translate target 包含 ${check.value}`, targets);
        }
        case 'link_target_exists': {
            const content = readText(check.path);
            const targetPath = path.resolve(path.dirname(absPath(check.path)), check.href);
            return result(
                content.includes(check.href) && fs.existsSync(targetPath),
                `链接目标存在：${check.href}`,
                relPath(targetPath)
            );
        }
        case 'policy_status': {
            return result(entry?.policy?.status === check.value, `policy status 为 ${check.value}`, entry?.policy?.status);
        }
        case 'report_diagnostic': {
            const codes = collectDiagnosticCodes(entry);
            return result(codes.includes(check.value), `report diagnostics 包含 ${check.value}`, codes);
        }
        default:
            return result(false, `未知 hard check 类型：${check.type}`);
    }
}

function cleanCaseOutDir(outputRoot, outDir) {
    const absoluteOutDir = absPath(outDir);
    const relativeToOutputRoot = path.relative(outputRoot, absoluteOutDir);
    const isInsideOutputRoot = relativeToOutputRoot && !relativeToOutputRoot.startsWith('..') && !path.isAbsolute(relativeToOutputRoot);
    if (!isInsideOutputRoot) {
        throw new Error(`Refusing to clean outDir outside self-eval output root: ${outDir}`);
    }
    fs.rmSync(absoluteOutDir, { recursive: true, force: true });
}

function markdownEscape(value) {
    return String(value).replace(/\|/g, '\\|');
}

function displayVerdict(verdict) {
    if (verdict === 'pass') return '通过';
    if (verdict === 'fail') return '失败';
    if (verdict === 'review') return '待审';
    return verdict;
}

function renderMarkdownReport(report) {
    const passCount = report.cases.filter(testCase => testCase.verdict === 'pass').length;
    const failCount = report.cases.length - passCount;
    const lines = [
        `# VASMC 自评估合并报告`,
        ``,
        `生成时间：${report.generatedAt}`,
        `套件：${report.suite}`,
        `报告语言：${report.reportLanguage}`,
        ``,
        `## 摘要`,
        ``,
        `| 阶段 | 通过 | 待审 | 失败 | 状态 |`,
        `| --- | ---: | ---: | ---: | --- |`,
        `| hard checks | ${passCount} | 0 | ${failCount} | ${failCount === 0 ? '通过' : '失败'} |`,
        `| LLM judge | 0 | 0 | 0 | 待执行 |`,
        ``,
        `## 用例`,
        ``,
        `| 用例 | 结论 | Source | Build Report |`,
        `| --- | --- | --- | --- |`,
        ...report.cases.map(testCase => [
            markdownEscape(testCase.id),
            displayVerdict(testCase.verdict),
            `\`${markdownEscape(testCase.source)}\``,
            testCase.buildReport ? `\`${markdownEscape(testCase.buildReport)}\`` : '-',
        ].join(' | ')).map(row => `| ${row} |`),
        ``,
        `## 硬边界检查`,
        ``,
    ];

    for (const testCase of report.cases) {
        lines.push(`### ${testCase.id}`, ``);
        for (const check of testCase.hardChecks) {
            lines.push(`- ${check.ok ? '通过' : '失败'} ${check.type}: ${check.message}`);
        }
        lines.push(``);
    }

    lines.push(
        `## LLM Judge 评审`,
        ``,
        `<!-- judge:start -->`,
        ``,
        `状态：待执行。`,
        ``,
        `继续按 \`eval-src/workflows/vasmc-self-eval.workflow.vasm.md\` 执行 LLM-as-judge 语义评审，并把结果写回本节。默认输出语言为中文。`,
        ``,
        `<!-- judge:end -->`,
        ``
    );

    return `${lines.join('\n')}\n`;
}

function writeMarkdownReports(suite, report) {
    const reportDir = absPath(suite.reportDir || 'self-eval-reports');
    fs.mkdirSync(reportDir, { recursive: true });
    for (const entry of fs.readdirSync(reportDir)) {
        if (/^self-eval-.*\.md$/.test(entry)) {
            fs.unlinkSync(path.join(reportDir, entry));
        }
    }
    const stamp = report.generatedAt.replace(/[:.]/g, '-');
    const timestampedPath = path.join(reportDir, `self-eval-${stamp}.md`);
    const latestPath = path.join(reportDir, 'latest.md');
    const markdown = renderMarkdownReport(report);
    fs.writeFileSync(timestampedPath, markdown, 'utf8');
    fs.writeFileSync(latestPath, markdown, 'utf8');
    return {
        latest: relPath(latestPath),
        timestamped: relPath(timestampedPath),
        combined: relPath(timestampedPath),
    };
}

function main() {
    if (!fs.existsSync(cliPath)) {
        console.error(`Missing built CLI at ${relPath(cliPath)}. Run npm run build first.`);
        process.exit(1);
    }

    const suite = readYaml(suitePath);
    const outputRoot = absPath(suite.outputRoot || '.vasmc/self-eval');
    const reportsDir = path.join(outputRoot, 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });

    const report = {
        version: 1,
        suite: suite.suite,
        reportLanguage: suite.reportLanguage || 'zh-CN',
        generatedAt: new Date().toISOString(),
        cases: [],
    };

    let failed = false;

    for (const testCase of suite.cases || []) {
        console.log(`[SELF-EVAL] build ${testCase.id}`);
        cleanCaseOutDir(outputRoot, testCase.outDir);
        const buildSources = buildSourcesForCase(testCase);
        const caseCwd = testCase.cwd || '.';
        const buildResult = {
            ok: true,
            lastError: '',
            runs: [],
        };

        for (const buildSource of buildSources) {
            const run = runBuildSource(buildSource, caseCwd);
            buildResult.runs.push(run);
            if (!run.ok) {
                buildResult.ok = false;
                buildResult.lastError = run.output;
                break;
            }
        }

        const buildReportPath = path.resolve(absPath(testCase.cwd || '.'), suite.defaults?.buildReport || '.vasmc/build-report.yaml');
        let buildReport;
        let buildReportSnapshot;
        if (buildResult.ok && fs.existsSync(buildReportPath)) {
            buildReport = readYaml(buildReportPath);
            buildReportSnapshot = path.join(reportsDir, `${testCase.id}.build-report.yaml`);
            writeYaml(buildReportSnapshot, buildReport);
        }

        const entry = buildReport ? findEntry(buildReport, testCase.source) : undefined;
        const checks = (testCase.hardChecks || []).map(check => ({
            type: check.type,
            target: check.path || check.href || check.value || check.text,
            ...checkHardBoundary(check, entry, buildResult),
        }));
        const expectsFailure = Boolean(testCase.expectedFailure);
        const ok = (expectsFailure ? !buildResult.ok : buildResult.ok && !!entry) && checks.every(check => check.ok);
        if (!ok) failed = true;

        report.cases.push({
            id: testCase.id,
            title: testCase.title,
            source: testCase.source,
            buildSources,
            expectedFailure: expectsFailure,
            outDir: testCase.outDir,
            buildReport: buildReportSnapshot ? relPath(buildReportSnapshot) : undefined,
            buildError: buildResult.ok ? undefined : buildResult.lastError,
            hardChecks: checks,
            verdict: ok ? 'pass' : 'fail',
        });
    }

    const reportPath = path.join(outputRoot, 'hard-check-report.yaml');
    const markdownReports = writeMarkdownReports(suite, report);
    report.markdownReports = markdownReports;
    writeYaml(reportPath, report);
    console.log(`[SELF-EVAL] hard check report: ${relPath(reportPath)}`);
    console.log(`[SELF-EVAL] readable report: ${markdownReports.latest}`);

    if (failed) {
        process.exit(1);
    }
}

main();
