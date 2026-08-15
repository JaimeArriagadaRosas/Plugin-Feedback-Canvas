#!/usr/bin/env node
// Configures local resolution of "canvas.docker" -> 127.0.0.1:8080
// so that the browser and the plugin (which use localhost:8080) match
// with the Canvas LMS development domain (domain.yml: development=canvas.docker).
//
// Usage (Windows, as administrator):
//   npm run setup:hosts            # adds the entry if missing
//   npm run setup:hosts --remove   # removes the entry

import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { platform } from "node:os";
import { boot as logger } from '../orchestration/boot/logger.js';

const HOST_ENTRY = "127.0.0.1\tcanvas.docker";
const HOSTS_PATH =
  platform() === "win32"
    ? "C:\\Windows\\System32\\drivers\\etc\\hosts"
    : "/etc/hosts";

const remove = process.argv.includes("--remove");

function readHosts() {
  try {
    return readFileSync(HOSTS_PATH, "utf8");
  } catch (err) {
    logger.error(`Could not read ${HOSTS_PATH}:`, { error: err.message });
    process.exit(1);
  }
}

function writeHosts(content) {
  try {
    writeFileSync(HOSTS_PATH, content, "utf8");
  } catch (err) {
    logger.error(
      `Could not write ${HOSTS_PATH} (did you run as administrator/root?):`, { error: err.message }
    );
    process.exit(1);
  }
}

function entryExists(content) {
  return content
    .split(/\r?\n/)
    .some((line) => line.trim() === HOST_ENTRY);
}

const current = readHosts();

if (remove) {
  if (!entryExists(current)) {
    logger.info("The entry canvas.docker is not present. Nothing to do.");
    process.exit(0);
  }
  const next = current
    .split(/\r?\n/)
    .filter((line) => line.trim() !== HOST_ENTRY)
    .join("\n");
  writeHosts(next);
  logger.info("Entry canvas.docker removed from hosts.");
  process.exit(0);
}

if (entryExists(current)) {
  logger.info("canvas.docker is already mapped to 127.0.0.1 in hosts.");
  process.exit(0);
}

appendFileSync(HOSTS_PATH, `\n${HOST_ENTRY}\n`, "utf8");
logger.info(
  "Added: 127.0.0.1 canvas.docker\nNow Canvas (localhost:8080) also responds at https://canvas.docker"
);
