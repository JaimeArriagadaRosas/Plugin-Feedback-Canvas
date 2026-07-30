#!/usr/bin/env node
// Configura la resolución local de "canvas.docker" -> 127.0.0.1:8080
// para que el navegador y el plugin (que usan localhost:8080) coincidan
// con el dominio de desarrollo de Canvas LMS (domain.yml: development=canvas.docker).
//
// Uso (Windows, como administrador):
//   node scripts/setup-hosts.mjs            # añade la entrada si falta
//   node scripts/setup-hosts.mjs --remove   # elimina la entrada

import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { platform } from "node:os";
import logger from '../apps/server/src/utils/logger.js';

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
    logger.error(`No se pudo leer ${HOSTS_PATH}:`, { error: err.message });
    process.exit(1);
  }
}

function writeHosts(content) {
  try {
    writeFileSync(HOSTS_PATH, content, "utf8");
  } catch (err) {
    logger.error(
      `No se pudo escribir ${HOSTS_PATH} (¿ejecutaste como administrador/root?):`, { error: err.message }
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
    logger.info("La entrada canvas.docker no está presente. Nada que hacer.");
    process.exit(0);
  }
  const next = current
    .split(/\r?\n/)
    .filter((line) => line.trim() !== HOST_ENTRY)
    .join("\n");
  writeHosts(next);
  logger.info("Entrada canvas.docker eliminada de hosts.");
  process.exit(0);
}

if (entryExists(current)) {
  logger.info("canvas.docker ya está mapeado a 127.0.0.1 en hosts.");
  process.exit(0);
}

appendFileSync(HOSTS_PATH, `\n${HOST_ENTRY}\n`, "utf8");
logger.info(
  "Añadido: 127.0.0.1 canvas.docker\nAhora Canvas (localhost:8080) responde también en https://canvas.docker"
);
