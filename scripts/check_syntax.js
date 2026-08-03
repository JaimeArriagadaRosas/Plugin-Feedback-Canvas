import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findFiles(dir, files = []) {
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
                findFiles(filePath, files);
            }
        } else {
            if (filePath.endsWith('.js') || filePath.endsWith('.jsx') || filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.mjs') || filePath.endsWith('.cjs')) {
                files.push(filePath);
            }
        }
    }
    return files;
}

const files = [];
findFiles(path.join(__dirname, 'apps'), files);
findFiles(path.join(__dirname, 'packages'), files);

console.log(`Checking ${files.length} files...`);

async function check() {
    let hasError = false;
    for (const file of files) {
        try {
            await esbuild.build({
                entryPoints: [file],
                bundle: false,
                write: false,
                logLevel: 'silent'
            });
        } catch (e) {
            console.error(`\nSyntax error in ${file}:`);
            for (const error of e.errors) {
                console.error(`- ${error.text} at line ${error.location?.line}, col ${error.location?.column}`);
                if (error.location?.lineText) {
                    console.error(`  > ${error.location.lineText}`);
                }
            }
            hasError = true;
        }
    }
    
    if (hasError) {
        console.log('\nSyntax check failed.');
        process.exit(1);
    } else {
        console.log('No syntax errors found.');
    }
}

check();
