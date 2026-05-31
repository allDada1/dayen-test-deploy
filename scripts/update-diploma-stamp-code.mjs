import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const diplomaDir = path.join(root, "DayenDiplom");
const zipPath = path.join(root, "DayenDiplom.zip");
const workRoot = path.join(root, "docs", "diploma-dayen", ".stamp-code-work");
const oldCode = "РК ЦАТЭК 1304043 ДП ПЗ";
const newCode = "РК ЦАТЭК 4S06130105 ДП ПЗ";

function isInsideWorkspace(target) {
  const resolvedRoot = path.resolve(root).toLowerCase();
  const resolvedTarget = path.resolve(target).toLowerCase();
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`);
}

function safeRemove(target) {
  if (!fs.existsSync(target)) return;
  if (!isInsideWorkspace(target)) throw new Error(`Refusing outside workspace: ${target}`);
  fs.rmSync(target, { recursive: true, force: true });
}

function psEscape(value) {
  return value.replaceAll("'", "''");
}

function runPowerShell(command) {
  execFileSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
    { stdio: "inherit" },
  );
}

function walk(dir, predicate, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, out);
    else if (!predicate || predicate(full)) out.push(full);
  }
  return out;
}

function escapeXmlText(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function decodeXmlText(value) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function paragraphText(paragraphXml) {
  const parts = [];
  for (const match of paragraphXml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)) {
    parts.push(decodeXmlText(match[1]));
  }
  return parts.join("");
}

function setParagraphText(paragraphXml, text) {
  let usedFirstTextNode = false;
  return paragraphXml.replace(/(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g, (match, open, _content, close) => {
    if (usedFirstTextNode) return `${open}${close}`;
    usedFirstTextNode = true;
    return `${open}${escapeXmlText(text)}${close}`;
  });
}

function replaceStampCode(xml) {
  let next = xml.split(oldCode).join(newCode);
  next = next.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraphXml) => {
    const text = paragraphText(paragraphXml);
    if (!text.includes(oldCode)) return paragraphXml;
    return setParagraphText(paragraphXml, text.split(oldCode).join(newCode));
  });
  return next;
}

function extractDocx(docxPath, workDir) {
  safeRemove(workDir);
  fs.mkdirSync(workDir, { recursive: true });
  const archivePath = path.join(workDir, "document.zip");
  fs.copyFileSync(docxPath, archivePath);
  runPowerShell(
    `Expand-Archive -LiteralPath '${psEscape(archivePath)}' -DestinationPath '${psEscape(workDir)}' -Force`,
  );
  fs.rmSync(archivePath, { force: true });
}

function packDocx(workDir, docxPath) {
  const tempZip = `${docxPath}.zip`;
  safeRemove(tempZip);
  runPowerShell(
    `Compress-Archive -Path '${psEscape(workDir)}\\*' -DestinationPath '${psEscape(tempZip)}' -Force; ` +
      `Move-Item -LiteralPath '${psEscape(tempZip)}' -Destination '${psEscape(docxPath)}' -Force`,
  );
}

function replaceInDocx(docxPath) {
  const workDir = path.join(workRoot, path.relative(diplomaDir, docxPath).replace(/[<>:"/\\|?*]/g, "_"));
  extractDocx(docxPath, workDir);

  let changed = false;
  for (const xmlPath of walk(workDir, (file) => file.toLowerCase().endsWith(".xml"))) {
    const before = fs.readFileSync(xmlPath, "utf8");
    const after = replaceStampCode(before);
    if (after !== before) {
      fs.writeFileSync(xmlPath, after, "utf8");
      changed = true;
    }
  }

  if (changed) packDocx(workDir, docxPath);
  return changed;
}

safeRemove(workRoot);

const docxFiles = walk(diplomaDir, (file) => file.toLowerCase().endsWith(".docx"));
const changedFiles = docxFiles.filter(replaceInDocx);
safeRemove(workRoot);

safeRemove(zipPath);
runPowerShell(`Compress-Archive -Path '${psEscape(diplomaDir)}' -DestinationPath '${psEscape(zipPath)}' -Force`);

console.log(`Updated ${changedFiles.length} DOCX files.`);
for (const file of changedFiles) {
  console.log(`- ${path.relative(root, file)}`);
}
console.log(`Updated: ${path.relative(root, zipPath)}`);
