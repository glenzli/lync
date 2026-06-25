import { setupCLI } from '../../core/src/cli';

async function main() {
    const program = setupCLI({
        buildMode: 'ai',
        includeAgent: false,
        description: 'AI-facing VASMC CLI: build VASM sources and emit follow-up instructions.',
    });
    await program.parseAsync(process.argv);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
