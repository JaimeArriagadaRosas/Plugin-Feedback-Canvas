const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
            if (filePath.endsWith('.js') || filePath.endsWith('.jsx') || filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
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

let hasError = false;
for (const file of files) {
    try {
        // Run node's internal syntax check or use a tool. We will use esbuild if available, else just simple require (not ideal for jsx).
        // Let's just use esbuild to check syntax since it handles JSX/TS
        execSync(`npx esbuild "${file}" --no-bundle --outfile=NUL`, { stdio: 'pipe' });
    } catch (e) {
        console.error(`Syntax error in ${file}:`);
        console.error(e.stderr ? e.stderr.toString() : e.message);
        hasError = true;
    }
}

if (hasError) {
    process.exit(1);
} else {
    console.log("No syntax errors found.");
}
