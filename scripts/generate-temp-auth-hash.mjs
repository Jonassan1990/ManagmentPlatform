#!/usr/bin/env node
/**
 * Generate a bcrypt password hash for TEMP_AUTH_PASSWORD_HASH.
 *
 * Usage:
 *   node scripts/generate-temp-auth-hash.mjs
 *     → prompts for password (hidden) on TTY; prints base64:… form (dotenv-safe)
 *   TEMP_AUTH_PASSWORD='...' node scripts/generate-temp-auth-hash.mjs --from-env
 *   node scripts/generate-temp-auth-hash.mjs --raw
 *     → prints raw $2b$… hash (may be corrupted by dotenv `$` expansion — prefer default)
 *
 * Never commit the plaintext password or production hashes into git.
 */
import { createInterface } from "node:readline";
import { stdin as input, stdout as output, stderr } from "node:process";
import { hash } from "bcryptjs";

const COST = 12;

async function readPasswordInteractively() {
  if (!input.isTTY) {
    throw new Error(
      "No TTY. Pass TEMP_AUTH_PASSWORD via env with --from-env, or run in a terminal.",
    );
  }
  return new Promise((resolve, reject) => {
    const rl = createInterface({ input, output: stderr, terminal: true });
    stderr.write("Enter password (input hidden): ");
    const stdin =
      /** @type {NodeJS.ReadStream & { setRawMode?: (v: boolean) => void }} */ (
        input
      );
    if (typeof stdin.setRawMode === "function") {
      stdin.setRawMode(true);
    }
    let pwd = "";
    const onData = (chunk) => {
      const s = chunk.toString("utf8");
      for (const ch of s) {
        if (ch === "\n" || ch === "\r" || ch === "\u0004") {
          cleanup();
          stderr.write("\n");
          resolve(pwd);
          return;
        }
        if (ch === "\u0003") {
          cleanup();
          reject(new Error("Cancelled"));
          return;
        }
        if (ch === "\u007f" || ch === "\b") {
          pwd = pwd.slice(0, -1);
          continue;
        }
        pwd += ch;
      }
    };
    const cleanup = () => {
      input.off("data", onData);
      if (typeof stdin.setRawMode === "function") {
        stdin.setRawMode(false);
      }
      rl.close();
    };
    input.on("data", onData);
  });
}

async function main() {
  const fromEnv = process.argv.includes("--from-env");
  const rawOut = process.argv.includes("--raw");
  let password;
  if (fromEnv) {
    password = process.env.TEMP_AUTH_PASSWORD ?? "";
    if (!password) {
      throw new Error("TEMP_AUTH_PASSWORD env is empty.");
    }
  } else {
    password = await readPasswordInteractively();
  }
  if (password.length < 12) {
    throw new Error("Password should be at least 12 characters.");
  }
  const digest = await hash(password, COST);
  if (rawOut) {
    output.write(`${digest}\n`);
  } else {
    // base64: prefix avoids dotenv / shell `$` expansion corrupting bcrypt hashes.
    output.write(`base64:${Buffer.from(digest, "utf8").toString("base64")}\n`);
  }
}

main().catch((err) => {
  stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
