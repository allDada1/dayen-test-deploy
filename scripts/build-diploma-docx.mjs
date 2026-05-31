import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const rawTemplateRoot = path.join(root, "docs", "diploma-template-raw");
const contentRoot = path.join(root, "docs", "diploma-dayen", "Готово");
const stageRoot = path.join(root, "DayenDiplom");
const zipPath = path.join(root, "DayenDiplom.zip");
const tempRoot = path.join(root, "docs", "diploma-dayen", ".exact-docx-build");

const bodySourceByOutput = new Map([
  ["Готово/4 Введение+.docx", "4 Введение+.docx"],
  ["Готово/5 Общая часть .docx", "5 Общая часть .docx"],
  ["Готово/6 Специальная часть .docx", "6 Специальная часть .docx"],
  ["Готово/7 Организация производства .docx", "7 Организация производства .docx"],
  ["Готово/8 Экономическая часть 2023.docx", "8 Экономическая часть 2023.docx"],
  ["Готово/9 Охрана труда+.docx", "9 Охрана труда+.docx"],
  ["Готово/10 Заключение+.docx", "10 Заключение+.docx"],
  ["Готово/11 Приложения+.docx", "11 Приложения+.docx"],
  ["Готово/12 Приложение А+листинг.docx", "12 Приложение А+листинг.docx"],
  ["Готово/13 Приложение Б вход.docx", "13 Приложение Б вход.docx"],
  ["Готово/14 Приложение В выход.docx", "14 Приложение В выход.docx"],
  ["Готово/15 Приложение Г схема.docx", "15 Приложение Г схема.docx"],
  ["Готово/16 Приложение Д .docx", "16 Приложение Д .docx"],
  ["Готово/17 Приложение Е .docx", "17 Приложение Е .docx"],
  ["Готово/18 Список литературы+.docx", "18 Список литературы+.docx"],
]);

const paragraphReplacements = [
  [
    "Тема дипломного проекта актуальна, имеет практическ ую направленность, создана для компании «Dayen» по продаже товаров из термодревисины . Сайт с таким функционалом, позволит увеличить продажи компании и сократит затраты на оформление заявки и учета оплат ы за товары .",
    "Тема дипломного проекта актуальна, имеет практическую направленность и посвящена разработке маркетплейса Dayen с каталогом товаров, заказами и административным модулем. Web-приложение с таким функционалом позволяет автоматизировать оформление заказов, работу продавцов, уведомления и учет основных операций.",
  ],
  [
    "Разработка web-приложения маркетплейса Dayen для компании «Dayen » , предложена директором компании .",
    "Разработка web-приложения маркетплейса Dayen с каталогом товаров, корзиной, оплатой, личным кабинетом, панелью продавца и административным модулем, предложена как тема дипломного проекта.",
  ],
  [
    "Разработка web-приложения маркетплейса Dayen для компании «Dayen» , предложена директором компании .",
    "Разработка web-приложения маркетплейса Dayen с каталогом товаров, корзиной, оплатой, личным кабинетом, панелью продавца и административным модулем, предложена как тема дипломного проекта.",
  ],
  [
    "для компании «Dayen » , предложена директором компании .",
    "с каталогом товаров, корзиной, оплатой, личным кабинетом, панелью продавца и административным модулем, предложена как тема дипломного проекта.",
  ],
  [
    "для компании «Dayen» , предложена директором компании .",
    "с каталогом товаров, корзиной, оплатой, личным кабинетом, панелью продавца и административным модулем, предложена как тема дипломного проекта.",
  ],
  [
    "Введение содержит информацию о организациях, оборудование, номенклатуры предприятия.",
    "Введение содержит актуальность разработки маркетплейса Dayen, цель, задачи, объект и предмет исследования.",
  ],
  [
    "Раздел I . Общая часть описывает актуальность проекта и язык и программирования",
    "Раздел I. Общая часть описывает предметную область маркетплейсов, аналоги, интерфейсные технологии, архитектуру web-приложения и выбор базы данных PostgreSQL.",
  ],
  [
    "актуальность проекта и язык и программирования",
    "предметную область маркетплейсов, аналоги, интерфейсные технологии, архитектуру web-приложения и выбор базы данных PostgreSQL",
  ],
  [
    "Раздел II. Специальная часть с одержит:",
    "Раздел II. Специальная часть содержит постановку задачи, описание входных и выходных данных, схему работы комплекса, структуру программных модулей и наборы данных:",
  ],
  [
    "с одержит:",
    "содержит постановку задачи, описание входных и выходных данных, схему работы комплекса, структуру программных модулей и наборы данных:",
  ],
  [
    "Раздел I II . Организация производства содержит:",
    "Раздел III. Организация производства содержит:",
  ],
  ["Раздел I II .", "Раздел III."],
  [
    "Раздел I V . Экономическое обоснование проекта _состоит из:",
    "Раздел IV. Экономическая часть содержит:",
  ],
  ["Раздел I V . Экономическое обоснование проекта _состоит из:", "Раздел IV. Экономическая часть содержит:"],
  [
    "Раздел V . Техника безопасности включает в себя:",
    "Раздел V. Охрана труда включает в себя:",
  ],
  ["Раздел V . Техника безопасности", "Раздел V. Охрана труда"],
  [
    "https://www.w3schools.com/js/; https://www.emailjs.com/docs/examples/reactjs/; https://www.geeksforgeeks.org/how-to-create-a-website-in-react-js/; https://reactrouter.com/en/main; https://react.dev/ ; https://developer.mozilla.org/ru/docs/Learn/JavaScript; https://nodejs.org/en; https://www.postgresql.org/;",
    "React Documentation; TypeScript Documentation; Vite Documentation; Node.js Documentation; Express Documentation; PostgreSQL Documentation; MDN Web Docs; React Router Documentation.",
  ],
  ["https://www.w3schools.com/js/;", "React Documentation;"],
  ["https://www.emailjs.com/docs/examples/reactjs/;", "TypeScript Documentation;"],
  ["https://www.geeksforgeeks.org/how-to-create-a-website-in-react-js/;", "Vite Documentation;"],
  ["https://developer.mozilla.org/ru/docs/Learn/JavaScript;", "MDN Web Docs;"],
  ["https://nodejs.org/en;", "Node.js Documentation;"],
  ["https://www.postgresql.org/;", "PostgreSQL Documentation;"],
  ["Обычный web-приложение-витрина", "Обычный сайт-витрина"],
  ["web-приложение-витрина", "сайт-витрина"],
  ["цифровых товаров", "товаров маркетплейса"],
  ["из цифровых товаров для проекта Dayen", "с каталогом товаров, корзиной, оплатой и административным модулем"],
  ["из товаров маркетплейса для проекта Dayen", "с каталогом товаров, заказами и административным модулем"],
  ["Разработка web-приложения маркетплейса Dayen из цифровых товаров для проекта Dayen", "Разработка web-приложения маркетплейса Dayen с каталогом товаров, корзиной, оплатой и административным модулем"],
  ["Разработка web-приложения маркетплейса Dayen из товаров маркетплейса для проекта Dayen", "Разработка web-приложения маркетплейса Dayen с каталогом товаров, заказами и административным модулем"],
  ["web-приложениеов", "web-приложений"],
  ["web-приложениеа", "web-приложения"],
  ["`стр.`", ""],
  ["`", ""],
];

const paragraphRegexReplacements = [
  [
    /для\s+компании\s+«Dayen\s*»\s*,\s*предложена\s+директором\s+компании\s*\./gu,
    "с каталогом товаров, корзиной, оплатой, личным кабинетом, панелью продавца и административным модулем, предложена как тема дипломного проекта.",
  ],
  [
    /Раздел\s+I\s*\.\s*Общая\s+часть\s+описывает\s+актуальность\s+проекта\s+и\s+язык\s+и\s+программирования/gu,
    "Раздел I. Общая часть описывает предметную область маркетплейсов, аналоги, интерфейсные технологии, архитектуру web-приложения и выбор базы данных PostgreSQL.",
  ],
  [
    /Раздел\s+II\.\s*Специальная\s+часть\s+с\s*одержит:/gu,
    "Раздел II. Специальная часть содержит постановку задачи, описание входных и выходных данных, схему работы комплекса, структуру программных модулей и наборы данных:",
  ],
  [/Раздел\s+I\s*II\s*\./gu, "Раздел III."],
  [
    /Раздел\s+I\s*V\s*\.\s*Экономическое\s+обоснование\s+проекта\s+_?состоит\s+из:/gu,
    "Раздел IV. Экономическая часть содержит:",
  ],
  [/Раздел\s+V\s*\.\s*Техника\s+безопасности/gu, "Раздел V. Охрана труда"],
];

const replacements = [
  ["РК ЦАТЭК 1304043 ДП ПЗ", "РК ЦАТЭК 4S06130105 ДП ПЗ"],
  [
    "Разработка информационного сайта по продаже изделий из термодревесины для компании «BRDWOOD»",
    "Разработка web-приложения маркетплейса Dayen с каталогом товаров, заказами и административным модулем",
  ],
  [
    "Разработка информационного сайта по продаже изделий из термодревесины для компании «BRDWOOD »",
    "Разработка web-приложения маркетплейса Dayen с каталогом товаров, заказами и административным модулем",
  ],
  [
    "Разработка информационного сайта по продаже изделий из термодревесины",
    "Разработка web-приложения маркетплейса Dayen",
  ],
  [
    "Разработка информационного сайта по продаже изделий ",
    "Разработка web-приложения маркетплейса Dayen ",
  ],
  [
    "из термодревесины для компании «BRDWOOD»",
    "с каталогом товаров, заказами и административным модулем",
  ],
  [
    "из термодревесины для компании «BRDWOOD »",
    "с каталогом товаров, заказами и административным модулем",
  ],
  ["информационного сайта по продаже изделий", "web-приложения маркетплейса Dayen"],
  ["информационный сайт по продаже изделий", "web-приложение маркетплейса Dayen"],
  ["информационного сайта", "web-приложения маркетплейса"],
  ["информационный сайт", "web-приложение маркетплейса"],
  ["информационному сайту", "web-приложению маркетплейса"],
  ["информационным сайтом", "web-приложением маркетплейса"],
  ["сайт по продаже", "маркетплейс"],
  ["сайта по продаже", "маркетплейса"],
  ["магазина термодревесины", "маркетплейса Dayen"],
  ["магазин термодревесины", "маркетплейс Dayen"],
  ["BRDWOOD", "Dayen"],
  ["«Dayen »", "«Dayen»"],
  ["компании «Dayen»", "проекта Dayen"],
  ["компании Dayen", "проекта Dayen"],
  ["термодревесины", "цифровых товаров"],
  ["термодревисины", "товаров маркетплейса"],
  ["термодревесина", "цифровые товары"],
  ["термодревесину", "цифровые товары"],
  ["термодревесиной", "цифровыми товарами"],
  ["изделий", "товаров"],
  ["изделия", "товары"],
  ["изделие", "товар"],
  ["изделием", "товаром"],
  ["продукции", "товаров"],
  ["продукция", "товары"],
  ["продукцию", "товары"],
  ["древесины", "товаров"],
  ["дерева", "товаров"],
  ["дерево", "товары"],
  ["деревянных", "товарных"],
  ["деревянные", "товарные"],
  ["MongoDB", "PostgreSQL"],
  ["mongodb.com", "postgresql.org"],
  ["mongodb", "postgresql"],
  ["HTML, CSS, JavaScript, PHP", "React, TypeScript, Node.js, PostgreSQL"],
  ["PHP", "Node.js"],
  ["MySQL", "PostgreSQL"],
  ["покупателей продукции", "покупателей товаров"],
  ["покупатели продукции", "покупатели товаров"],
  ["`стр.`", ""],
  ["`", ""],
];

function isInsideWorkspace(target) {
  const resolvedRoot = path.resolve(root).toLowerCase();
  const resolvedTarget = path.resolve(target).toLowerCase();
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`);
}

function safeRemove(target) {
  if (!fs.existsSync(target)) return;
  if (!isInsideWorkspace(target)) {
    throw new Error(`Refusing outside workspace: ${target}`);
  }
  fs.rmSync(target, { recursive: true, force: true });
}

function walk(dir, predicate, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, predicate, out);
    } else if (!predicate || predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

function findTemplateRoot() {
  if (!fs.existsSync(rawTemplateRoot)) {
    throw new Error(`Template extract folder not found: ${rawTemplateRoot}`);
  }

  const candidates = walk(rawTemplateRoot, (file) => file.toLowerCase().endsWith(".docx"))
    .map((docx) => {
      const relative = path.relative(rawTemplateRoot, docx).split(path.sep);
      return relative.length > 1 ? path.join(rawTemplateRoot, relative[0]) : rawTemplateRoot;
    });

  const uniqueCandidates = [...new Set(candidates)];
  if (uniqueCandidates.length === 0) {
    throw new Error(`No .docx files found under: ${rawTemplateRoot}`);
  }

  const withReadyFolder = uniqueCandidates.find((candidate) => fs.existsSync(path.join(candidate, "Готово")));
  return withReadyFolder ?? uniqueCandidates[0];
}

function replaceText(content) {
  let next = content;
  for (const [from, to] of replacements) {
    next = next.split(from).join(to);
  }
  return next;
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
  for (const match of paragraphXml.matchAll(/<(?:w|a):t\b[^>]*>([\s\S]*?)<\/(?:w|a):t>/g)) {
    parts.push(decodeXmlText(match[1]));
  }
  return parts.join("");
}

function setParagraphText(paragraphXml, text) {
  let usedFirstTextNode = false;
  return paragraphXml.replace(/(<((?:w|a)):t\b[^>]*>)([\s\S]*?)(<\/\2:t>)/g, (match, open, _prefix, _content, close) => {
    if (usedFirstTextNode) return `${open}${close}`;
    usedFirstTextNode = true;
    return `${open}${escapeXmlText(text)}${close}`;
  });
}

function patchParagraphs(xml) {
  return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraphXml) => {
    const text = paragraphText(paragraphXml);
    if (!text) return paragraphXml;

    let nextText = text;
    for (const [from, to] of paragraphReplacements) {
      nextText = nextText.split(from).join(to);
    }
    for (const [from, to] of paragraphRegexReplacements) {
      nextText = nextText.replace(from, to);
    }
    const compactText = nextText.replace(/\s+/g, " ");
    if (
      compactText.includes("Общая часть") &&
      compactText.includes("язык") &&
      compactText.includes("программирования")
    ) {
      nextText =
        "Раздел I. Общая часть описывает предметную область маркетплейсов, аналоги, интерфейсные технологии, архитектуру web-приложения и выбор базы данных PostgreSQL.";
    }
    if (compactText.includes("Организация производства содержит")) {
      nextText = nextText.replace(
        /^.*?Организация\s+производства\s+содержит:/u,
        "Раздел III. Организация производства содержит:",
      );
    }
    return nextText === text ? paragraphXml : setParagraphText(paragraphXml, nextText);
  });
}

function runPowerShell(command) {
  execFileSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
    { stdio: "inherit" },
  );
}

function extractDocx(docxPath, workDir) {
  safeRemove(workDir);
  fs.mkdirSync(workDir, { recursive: true });
  const archivePath = path.join(workDir, "document.zip");
  fs.copyFileSync(docxPath, archivePath);
  const escapedArchivePath = archivePath.replaceAll("'", "''");
  const escapedWorkDir = workDir.replaceAll("'", "''");
  runPowerShell(`Expand-Archive -LiteralPath '${escapedArchivePath}' -DestinationPath '${escapedWorkDir}' -Force`);
  fs.rmSync(archivePath, { force: true });
}

function packDocx(workDir, docxPath) {
  const tempZip = `${docxPath}.zip`;
  safeRemove(tempZip);
  const escapedWorkDir = workDir.replaceAll("'", "''");
  const escapedTempZip = tempZip.replaceAll("'", "''");
  const escapedDocxPath = docxPath.replaceAll("'", "''");
  runPowerShell(
    `Compress-Archive -Path '${escapedWorkDir}\\*' -DestinationPath '${escapedTempZip}' -Force; ` +
      `Move-Item -LiteralPath '${escapedTempZip}' -Destination '${escapedDocxPath}' -Force`,
  );
}

function copyTemplate(templateRoot) {
  const escapedTemplateRoot = templateRoot.replaceAll("'", "''");
  const escapedStageRoot = stageRoot.replaceAll("'", "''");
  runPowerShell(
    `New-Item -ItemType Directory -Force -Path '${escapedStageRoot}' | Out-Null; ` +
      `Copy-Item -Path '${escapedTemplateRoot}\\*' -Destination '${escapedStageRoot}' -Recurse -Force`,
  );
}

function readBody(xml) {
  const match = xml.match(/<w:body>([\s\S]*?)<\/w:body>/);
  if (!match) throw new Error("word/document.xml does not contain w:body");
  return match[1];
}

function replaceBody(xml, nextBody) {
  return xml.replace(/<w:body>[\s\S]*?<\/w:body>/, `<w:body>${nextBody}</w:body>`);
}

function getSectionProperties(body) {
  const matches = [...body.matchAll(/<w:sectPr[\s\S]*?<\/w:sectPr>/g)];
  return matches.length > 0 ? matches[matches.length - 1][0] : "";
}

function withoutSectionProperties(body) {
  return body.replace(/<w:sectPr[\s\S]*?<\/w:sectPr>/g, "");
}

function transplantBodyFromSource(targetDocumentXml, sourceDocumentXml) {
  const targetBody = readBody(targetDocumentXml);
  const sourceBody = readBody(sourceDocumentXml);
  const targetSectPr = getSectionProperties(targetBody);
  const sourceContent = withoutSectionProperties(sourceBody);
  return replaceBody(targetDocumentXml, `${sourceContent}${targetSectPr}`);
}

function patchDocx(docxPath) {
  const relativeDocx = path.relative(stageRoot, docxPath).replaceAll(path.sep, "/");
  const workDir = path.join(tempRoot, relativeDocx.replace(/[<>:"/\\|?*]/g, "_"));
  extractDocx(docxPath, workDir);

  const documentXmlPath = path.join(workDir, "word", "document.xml");
  const bodySourceName = bodySourceByOutput.get(relativeDocx);
  if (bodySourceName) {
    const sourceDocxPath = path.join(contentRoot, bodySourceName);
    if (!fs.existsSync(sourceDocxPath)) {
      throw new Error(`Content source not found: ${sourceDocxPath}`);
    }
    const sourceWorkDir = path.join(tempRoot, `${relativeDocx.replace(/[<>:"/\\|?*]/g, "_")}.source`);
    extractDocx(sourceDocxPath, sourceWorkDir);
    const targetDocumentXml = fs.readFileSync(documentXmlPath, "utf8");
    const sourceDocumentXml = fs.readFileSync(path.join(sourceWorkDir, "word", "document.xml"), "utf8");
    fs.writeFileSync(documentXmlPath, transplantBodyFromSource(targetDocumentXml, sourceDocumentXml), "utf8");
  }

  const xmlFiles = walk(workDir, (file) => file.toLowerCase().endsWith(".xml"));
  for (const xmlFile of xmlFiles) {
    const before = fs.readFileSync(xmlFile, "utf8");
    const after = xmlFile.endsWith(`${path.sep}document.xml`)
      ? patchParagraphs(replaceText(before))
      : replaceText(before);
    if (after !== before) {
      fs.writeFileSync(xmlFile, after, "utf8");
    }
  }

  packDocx(workDir, docxPath);
}

const templateRoot = findTemplateRoot();

console.log(`Template: ${templateRoot}`);
console.log(`Output: ${zipPath}`);

safeRemove(stageRoot);
safeRemove(tempRoot);
safeRemove(zipPath);

copyTemplate(templateRoot);

for (const extra of [
  path.join(stageRoot, "Готово", "Готово.rar"),
  path.join(stageRoot, "Готово", "+++ Методичка дипломного проекта 24.doc"),
  path.join(stageRoot, "Готово", "П4 Задание для диплома +2024.doc"),
]) {
  safeRemove(extra);
}

const docxFiles = walk(stageRoot, (file) => file.toLowerCase().endsWith(".docx"));
for (const docx of docxFiles) {
  patchDocx(docx);
}

const rootReview = path.join(stageRoot, "Отзыв+.docx");
const readyReview = path.join(stageRoot, "Готово", "Отзыв+.docx");
if (fs.existsSync(rootReview) && fs.existsSync(path.dirname(readyReview))) {
  fs.copyFileSync(rootReview, readyReview);
}

safeRemove(tempRoot);

const escapedStageRoot = stageRoot.replaceAll("'", "''");
const escapedZipPath = zipPath.replaceAll("'", "''");
runPowerShell(`Compress-Archive -LiteralPath '${escapedStageRoot}' -DestinationPath '${escapedZipPath}' -Force`);

console.log(`Done: ${zipPath}`);
