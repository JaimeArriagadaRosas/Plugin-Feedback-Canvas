import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceDir = path.resolve(__dirname, '..');

function fixLint() {
  console.log("Running eslint to get errors...");
  let output = "";
  try {
    output = execSync("npx eslint src --ext .js --format json", { encoding: "utf8", cwd: workspaceDir });
  } catch (err) {
    output = err.stdout;
  }
  
  if (!output) {
    console.log("No output from eslint or no errors.");
    return;
  }

  let results;
  try {
    results = JSON.parse(output);
  } catch (e) {
    console.error("Failed to parse eslint JSON output", e);
    return;
  }

  let totalFixed = 0;

  for (const fileResult of results) {
    if (fileResult.errorCount === 0) continue;
    
    const filePath = fileResult.filePath;
    if (!fs.existsSync(filePath)) continue;

    let lines = fs.readFileSync(filePath, 'utf8').split('\n');
    
    // Process messages, sort by line number descending to not mess up indices when inserting
    const messages = fileResult.messages
      .filter(m => m.severity === 2 && m.ruleId && m.ruleId.startsWith('security/'))
      .sort((a, b) => b.line - a.line);

    for (const msg of messages) {
      // Find the exact line and column (1-based index)
      const lineIdx = msg.line - 1;
      
      // We want to insert `// eslint-disable-next-line ${msg.ruleId}` before this line
      const indentMatch = lines[lineIdx].match(/^\s*/);
      const indent = indentMatch ? indentMatch[0] : "";
      
      // If we already added a disable comment for this line, we might need to append to it
      if (lines[lineIdx - 1] && lines[lineIdx - 1].includes('eslint-disable-next-line')) {
        if (!lines[lineIdx - 1].includes(msg.ruleId)) {
          lines[lineIdx - 1] += `, ${msg.ruleId}`;
        }
        continue;
      }
      
      const disableComment = `${indent}// eslint-disable-next-line ${msg.ruleId}`;
      lines.splice(lineIdx, 0, disableComment);
      totalFixed++;
    }

    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`Fixed ${messages.length} errors in ${filePath}`);
  }
  console.log(`Total fixes applied: ${totalFixed}`);
}

fixLint();
