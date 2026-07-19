import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import https from 'node:https';
import { execSync } from 'node:child_process';
import { PLUGIN_DIR, isIgnored, collectFiles, readFileSafe, hostsResolves, readEnvObj, SCAN_ROOTS } from './fileSystem.mjs';
import { C, state, log, step, ok, warn, fail, info } from './logger.mjs';

export const LOCAL_HTTP_RE = /\bhttp:\/\/(localhost|127\.0\.0\.1|canvas\.(local|docker))(:\d+)?/g;
export const IMS_VOCAB = /purl\.imsglobal\.org|imsglobal\.org\/spec|imsglobal\.org\/vocab/i;
const HTTP_URL_RE = /\bhttp:\/\/[^\s"'`>\]]+/g;

export function scanHttpReferences(files) {
  const hits = [];
  for (const file of files) {
    if (isIgnored(file)) continue;
    const content = readFileSafe(file);
    if (!content) continue;
    let m;
    HTTP_URL_RE.lastIndex = 0;
    const lines = content.split('\n');
    while ((m = HTTP_URL_RE.exec(content)) !== null) {
      const url = m[0];
      if (IMS_VOCAB.test(url)) continue;
      const lineIdx = content.substring(0, m.index).split('\n').length;
      hits.push({ file, line: lineIdx, url });
    }
  }
  return hits;
}

${v2}
${v3}
${v4}
${v5}
${v6}
${v7}
${v8}
${v9}
