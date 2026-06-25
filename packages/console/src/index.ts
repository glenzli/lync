import * as fs from 'fs';
import * as path from 'path';
import { setupCLI } from '../../core/src/cli';
import { verifyCompiledContent, analyzeSemanticDiff } from './verify';
import { consoleT } from './i18n';

function setupConsoleCLI() {
    const program = setupCLI({
        name: 'vasm-console',
        description: 'Human-facing VASMC console with optional LLM-assisted tools.',
        includeAgent: false,
    });

    program
        .command('lint <file>')
        .description('Run optional LLM-powered semantic linting on a compiled markdown file')
        .option('--model <model>', 'Specify the LLM model to use (default: gpt-4o)')
        .option('--continue-on-error', 'Exit with 0 even if the LLM API call fails')
        .action(async (file: string, options?: { model?: string; continueOnError?: boolean }) => {
            const absoluteFile = path.resolve(process.cwd(), file);
            if (!fs.existsSync(absoluteFile)) {
                console.error(`[LINT] ❌ File not found: ${absoluteFile}`);
                process.exit(1);
            }
            const content = fs.readFileSync(absoluteFile, 'utf8');
            console.log(`[LINT] 🔍 Running semantic linting on ${file}...`);
            const verified = await verifyCompiledContent(content, options?.model);
            if (!verified.passed) {
                if (verified.error && options?.continueOnError) {
                    console.log(consoleT('LINT_ERR_CONTINUE'));
                } else {
                    process.exit(1);
                }
            }
        });

    program
        .command('diff <file> [old-file]')
        .description('Run optional LLM-powered semantic diff analysis')
        .option('--model <model>', 'Specify the LLM model to use (default: gpt-4o)')
        .action(async (file: string, oldFile?: string, options?: { model?: string }) => {
            const absoluteFile = path.resolve(process.cwd(), file);
            if (!fs.existsSync(absoluteFile)) {
                console.error(`[DIFF] ❌ File not found: ${absoluteFile}`);
                process.exit(1);
            }
            const newContent = fs.readFileSync(absoluteFile, 'utf8');
            let oldContent = '';
            if (oldFile) {
                const absoluteOld = path.resolve(process.cwd(), oldFile);
                if (!fs.existsSync(absoluteOld)) {
                    console.error(`[DIFF] ❌ Old file not found: ${absoluteOld}`);
                    process.exit(1);
                }
                oldContent = fs.readFileSync(absoluteOld, 'utf8');
            }
            if (oldContent === newContent) {
                console.log(`[DIFF] ✅ Files are identical. No semantic differences.`);
                return;
            }
            await analyzeSemanticDiff(oldContent, newContent, options?.model);
        });

    return program;
}

async function main() {
    const program = setupConsoleCLI();
    await program.parseAsync(process.argv);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
