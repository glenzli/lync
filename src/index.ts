#!/usr/bin/env node
import { setupCLI } from './cli';

async function main() {
    const program = setupCLI();
    await program.parseAsync(process.argv);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
