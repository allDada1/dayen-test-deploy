import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const templateDir = path.join(root, "docs", "diploma-template-raw", "+Васильева Аэлина сайт", "Готово");
const outputDir = path.join(root, "DayenDiplom", "Готово");
const zipPath = path.join(root, "DayenDiplom.zip");
const stageRoot = path.join(root, "DayenDiplom");
const workRoot = path.join(root, "docs", "diploma-dayen", ".format-repair-work");
const screenshotsDir = path.join(root, "docs", "diploma-dayen", "screenshots");

const exactTemplateDocs = [
  "7 Организация производства .docx",
  "8 Экономическая часть 2023.docx",
  "10 Заключение+.docx",
  "13 Приложение Б вход.docx",
  "14 Приложение В выход.docx",
  "15 Приложение Г схема.docx",
  "16 Приложение Д .docx",
  "17 Приложение Е .docx",
];

const imageReplacements = new Map([
  [
    "13 Приложение Б вход.docx",
    ["D3-product.png", "D2-catalog.png", "D6-admin.png", "D5-notifications.png"],
  ],
  ["14 Приложение В выход.docx", ["D2-catalog.png", "D4-checkout.png", "D6-admin.png"]],
  [
    "7 Организация производства .docx",
    [
      "D1-home.png",
      "D2-catalog.png",
      "D3-product.png",
      "D4-checkout.png",
      "D5-notifications.png",
      "D6-admin.png",
      "D1-home.png",
      "D2-catalog.png",
      "D3-product.png",
      "D4-checkout.png",
      "D5-notifications.png",
      "D6-admin.png",
      "D1-home.png",
      "D2-catalog.png",
      "D3-product.png",
      "D4-checkout.png",
    ],
  ],
]);

const replacements = [
  ["РК ЦАТЭК 1304043 ДП ПЗ", "РК ЦАТЭК 4S06130105 ДП ПЗ"],
  ["BRDWOOD", "Dayen"],
  ["Timber Touch", "Dayen"],
  ["TimberTouch", "Dayen"],
  ["компании «Dayen»", "проекта Dayen"],
  ["компании Dayen", "проекта Dayen"],
  ["для компании «Dayen»", "для проекта Dayen"],
  ["из термодревесины", "из товаров маркетплейса"],
  ["термодревесины", "товаров маркетплейса"],
  ["термодревесина", "товары маркетплейса"],
  ["термодревесину", "товары маркетплейса"],
  ["древесины", "товаров"],
  ["дерева", "товаров"],
  ["изделий", "товаров"],
  ["изделия", "товары"],
  ["изделие", "товар"],
  ["Изделия", "Каталог"],
  ["Изделий", "Товаров"],
  ["продукции", "товаров"],
  ["продукция", "товары"],
  ["онлайн-магазина", "маркетплейса"],
  ["интернет-магазина", "маркетплейса"],
  ["информационного сайта", "web-приложения маркетплейса"],
  ["Информационный сайт", "Web-приложение маркетплейса"],
  ["сайта по продаже", "маркетплейса"],
  ["сайт по продаже", "маркетплейс"],
  ["MongoDB", "PostgreSQL"],
  ["emailjs.send", "API создания заказа"],
  ["emailjs", "backend API"],
  ["Информация об организации", "Информация о магазине"],
  ["Контактные данные компании", "Контактные данные продавца"],
  ["Отчет « Список товаров »", "Каталог товаров Dayen"],
  ["Отчет « Список пользователей »", "Административная панель"],
  ["П одтверждающее письмо на email пользователя", "Оформление заказа и оплата"],
  ["Подтверждающее письмо на email пользователя", "Оформление заказа и оплата"],
  ["Вход на сайт", "Открытие Dayen"],
  ["Вход администратора", "Вход администратора"],
  ["Регистрация пользовател я", "Регистрация пользователя"],
  ["Просмотр каталога товаров", "Просмотр каталога товаров"],
  ["Просмотр списка товаров", "Поиск и фильтрация"],
  ["Добавление в корзину", "Добавление в корзину"],
  ["Добавлени е товара", "Добавление товара"],
  ["Удаление товара", "Управление товаром"],
  ["Оформление заказа", "Оформление заказа"],
  ["Просмотр письма об оф о рмлении", "Получение уведомления"],
  ["В ыход с сайта", "Выход из аккаунта"],
  ["Выход с сайта", "Выход из аккаунта"],
  ["Заполне - ние формы", "Заполнение формы заказа"],
  ["Заполнение формы", "Заполнение формы заказа"],
  ["Заполне - ние полей формы", "Заполнение формы входа"],
  ["Заполнение полей формы", "Заполнение формы входа"],
  ["email на уникал ен?", "Данные корректны?"],
  ["email на уникален?", "Данные корректны?"],
  ["Отправление сообщение о существова - нии пользователя", "Показ сообщения об ошибке"],
  ["Отправление сообщение о существовании пользователя", "Показ сообщения об ошибке"],
  ["Создание токена пользова - теля", "Создание сессии пользователя"],
  ["Создание токена пользователя", "Создание сессии пользователя"],
  ["Создание административных прав пользова - теля", "Проверка роли пользователя"],
  ["Создание административных прав пользователя", "Проверка роли пользователя"],
  ["Сохране - ние токена в локаль - ном хранилище", "Сохранение httpOnly-сессии"],
  ["Сохранение токена в локальном хранилище", "Сохранение httpOnly-сессии"],
  ["Получение и формирова - ние данных для email", "Формирование данных заказа"],
  ["Получение и формирование данных для email", "Формирование данных заказа"],
  ["Отправление сообщения о некорректны х данных", "Показ сообщения об ошибке"],
  ["Отправление сообщения о некорректных данных", "Показ сообщения об ошибке"],
  ["Отправление email через API создания заказа", "Создание заказа через API"],
  ["Отправление email через backend API", "Создание заказа через API"],
  ["Отправление email через emailjs.send", "Создание заказа через API"],
  ["Очистка корзины и полей формы", "Очистка корзины"],
  ["Перена - правление на главную страницу", "Переход к оплате"],
  ["Перенаправление на главную страницу", "Переход к оплате"],
  ["программы для онлайн-магазина", "web-приложения маркетплейса Dayen"],
  ["программу для онлайн-магазина", "web-приложение маркетплейса Dayen"],
  ["программа для онлайн-магазина", "web-приложение маркетплейса Dayen"],
  ["магазина", "маркетплейса"],
  ["магазин", "маркетплейс"],
  ["Схем а работы комплекса", "Схема работы комплекса"],
  ["Схем а", "Схема"],
];

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

function runPowerShell(command) {
  execFileSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
    { stdio: "inherit" },
  );
}

function psEscape(value) {
  return value.replaceAll("'", "''");
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

function walk(dir, predicate, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, out);
    else if (!predicate || predicate(full)) out.push(full);
  }
  return out;
}

function replaceXmlText(content) {
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

function normalizeParagraphText(value) {
  return value
    .replace(/\s+/g, " ")
    .replace(/[-‐‑‒–—]/g, "")
    .replace(/\s+([?.:,;])/g, "$1")
    .trim();
}

const paragraphTextReplacements = [
  ["Схем а работы комплекса", "Схема работы комплекса"],
  ["Вход на сайт", "Открытие Dayen"],
  ["Регистрация пользовател я", "Регистрация пользователя"],
  ["Регистрация пользователя", "Регистрация пользователя"],
  ["Просмотр каталога товаров", "Каталог товаров"],
  ["Просмотр списка товаров", "Поиск и фильтрация"],
  ["Добавлени е товара", "Добавление товара"],
  ["Добавление товара", "Добавление товара"],
  ["Удаление товара", "Управление товаром"],
  ["Просмотр письма об оф о рмлении", "Уведомление о заказе"],
  ["Просмотр письма об оформлении", "Уведомление о заказе"],
  ["В ыход с сайта", "Выход из аккаунта"],
  ["Выход с сайта", "Выход из аккаунта"],
  ["Заполне - ние полей формы", "Заполнение формы входа"],
  ["Заполнение полей формы", "Заполнение формы входа"],
  ["email на уникал ен?", "Данные корректны?"],
  ["email на уникален?", "Данные корректны?"],
  ["Отправление сообщение о существова - нии пользователя", "Показ сообщения об ошибке"],
  ["Отправление сообщение о существовании пользователя", "Показ сообщения об ошибке"],
  ["Созданиетокена пользова теля", "Создание сессии пользователя"],
  ["Созданиетокена пользователя", "Создание сессии пользователя"],
  ["Создание токена пользова - теля", "Создание сессии пользователя"],
  ["Создание токена пользователя", "Создание сессии пользователя"],
  ["Создание административных прав пользова - теля", "Проверка роли пользователя"],
  ["Создание административных прав пользователя", "Проверка роли пользователя"],
  ["Сохране - ние токена в локаль - ном хранилище", "Сохранение httpOnly cookie"],
  ["Сохранение токена в локальном хранилище", "Сохранение httpOnly cookie"],
  ["Заполне - ние формы", "Заполнение формы заказа"],
  ["Заполнение формы", "Заполнение формы заказа"],
  ["Получение и формирова - ние данных для email", "Формирование данных заказа"],
  ["Получение и формирование данных для email", "Формирование данных заказа"],
  ["Отправление сообщения о некорректны х данных", "Показ сообщения об ошибке"],
  ["Отправление сообщения о некорректных данных", "Показ сообщения об ошибке"],
  ["Отправление email через API создания заказа", "Создание заказа через API"],
  ["Отправление email через backend API", "Создание заказа через API"],
  ["Отправление email через emailjs.send", "Создание заказа через API"],
  ["Очистка корзины и полей формы", "Очистка корзины"],
  ["Перена - правление на главную страницу", "Переход к оплате"],
  ["Перенаправление на главную страницу", "Переход к оплате"],
];

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

function patchParagraphs(xml, docName) {
  return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraphXml) => {
    const originalText = paragraphText(paragraphXml);
    if (!originalText) return paragraphXml;

    let nextText = originalText;
    const normalizedText = normalizeParagraphText(originalText);
    if (
      docName === "15 Приложение Г схема.docx" &&
      (normalizedText === "Вход" || normalizedText === "Вход на сайт")
    ) {
      nextText = "Открытие Dayen";
    }
    for (const [from, to] of paragraphTextReplacements) {
      if (nextText !== originalText) break;
      if (normalizedText === normalizeParagraphText(from) || normalizedText.includes(normalizeParagraphText(from))) {
        nextText = to;
        break;
      }
    }

    return nextText === originalText ? paragraphXml : setParagraphText(paragraphXml, nextText);
  });
}

function ensurePngContentType(workDir) {
  const contentTypesPath = path.join(workDir, "[Content_Types].xml");
  let xml = fs.readFileSync(contentTypesPath, "utf8");
  if (!/Extension="png"/.test(xml)) {
    xml = xml.replace("</Types>", '<Default Extension="png" ContentType="image/png"/></Types>');
    fs.writeFileSync(contentTypesPath, xml, "utf8");
  }
}

function relationshipImageTargets(relsXml) {
  const matches = [...relsXml.matchAll(/<Relationship\b[^>]*Type="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/image"[^>]*>/g)];
  return matches.map((match) => {
    const id = match[0].match(/Id="([^"]+)"/)?.[1] || "";
    const target = match[0].match(/Target="([^"]+)"/)?.[1] || "";
    return { id, target };
  }).filter((item) => item.id && item.target);
}

function replaceDocumentImages(docName, workDir) {
  const replacementFiles = imageReplacements.get(docName);
  if (!replacementFiles?.length) return;

  const relsPath = path.join(workDir, "word", "_rels", "document.xml.rels");
  if (!fs.existsSync(relsPath)) return;

  let relsXml = fs.readFileSync(relsPath, "utf8");
  const targets = relationshipImageTargets(relsXml);
  const mediaDir = path.join(workDir, "word", "media");
  fs.mkdirSync(mediaDir, { recursive: true });
  ensurePngContentType(workDir);

  let replacementIndex = 0;
  for (const targetInfo of targets) {
    const originalMediaPath = path.join(mediaDir, path.basename(targetInfo.target));
    if (docName === "7 Организация производства .docx") {
      const size = fs.existsSync(originalMediaPath) ? fs.statSync(originalMediaPath).size : 0;
      if (size < 50000) continue;
    }

    const screenshot = replacementFiles[replacementIndex % replacementFiles.length];
    const screenshotPath = path.join(screenshotsDir, screenshot);
    if (!fs.existsSync(screenshotPath)) throw new Error(`Screenshot not found: ${screenshotPath}`);

    const nextTarget = `media/dayen-${docName.replace(/[^a-z0-9а-яё]+/gi, "-").toLowerCase()}-${replacementIndex + 1}.png`;
    fs.copyFileSync(screenshotPath, path.join(workDir, "word", nextTarget));

    const targetPattern = new RegExp(`(Id="${targetInfo.id}"[\\s\\S]*?Target=")${escapeRegExp(targetInfo.target)}(")`);
    relsXml = relsXml.replace(targetPattern, `$1${nextTarget}$2`);
    replacementIndex += 1;
  }

  fs.writeFileSync(relsPath, relsXml, "utf8");
}

function removeUnreferencedMedia(workDir) {
  const mediaDir = path.join(workDir, "word", "media");
  if (!fs.existsSync(mediaDir)) return;

  const referenced = new Set();
  for (const relsPath of walk(workDir, (file) => file.toLowerCase().endsWith(".rels"))) {
    const relsXml = fs.readFileSync(relsPath, "utf8");
    for (const match of relsXml.matchAll(/Target="([^"]*media\/[^"]+)"/g)) {
      referenced.add(path.basename(match[1]));
    }
  }

  for (const mediaPath of walk(mediaDir)) {
    if (!referenced.has(path.basename(mediaPath))) {
      fs.rmSync(mediaPath, { force: true });
    }
  }
}

function nextRelationshipId(relsXml) {
  const ids = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((match) => Number(match[1]));
  return `rId${Math.max(0, ...ids) + 1}`;
}

function addDocumentImage(workDir, imageName, sourceImageName) {
  const sourceImagePath = path.join(screenshotsDir, sourceImageName);
  if (!fs.existsSync(sourceImagePath)) throw new Error(`Screenshot not found: ${sourceImagePath}`);

  const mediaDir = path.join(workDir, "word", "media");
  fs.mkdirSync(mediaDir, { recursive: true });
  const targetName = `${imageName}.png`;
  fs.copyFileSync(sourceImagePath, path.join(mediaDir, targetName));
  ensurePngContentType(workDir);

  const relsPath = path.join(workDir, "word", "_rels", "document.xml.rels");
  let relsXml = fs.readFileSync(relsPath, "utf8");
  const relationshipId = nextRelationshipId(relsXml);
  relsXml = relsXml.replace(
    "</Relationships>",
    `<Relationship Id="${relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${targetName}"/></Relationships>`,
  );
  fs.writeFileSync(relsPath, relsXml, "utf8");
  return relationshipId;
}

function textParagraph(text, justification = "both") {
  return `<w:p><w:pPr><w:jc w:val="${justification}"/></w:pPr><w:r><w:t>${escapeXmlText(text)}</w:t></w:r></w:p>`;
}

function imageParagraph(relationshipId, docPrId, name) {
  return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="5486400" cy="3086100"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${docPrId}" name="${escapeXmlText(name)}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="${escapeXmlText(name)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="5486400" cy="3086100"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

function tableCell(text, width = 2600) {
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>${escapeXmlText(text)}</w:t></w:r></w:p></w:tc>`;
}

function tableXml(rows) {
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tblBorders></w:tblPr>${rows.map((row) => `<w:tr>${row.map((cell) => tableCell(cell)).join("")}</w:tr>`).join("")}</w:tbl>`;
}

function insertBeforeSectionProperties(documentXml, fragment) {
  const index = documentXml.lastIndexOf("<w:sectPr");
  if (index === -1) return documentXml.replace("</w:body>", `${fragment}</w:body>`);
  return `${documentXml.slice(0, index)}${fragment}${documentXml.slice(index)}`;
}

function patchExistingDoc(docName, patcher) {
  const target = path.join(outputDir, docName);
  if (!fs.existsSync(target)) throw new Error(`Output missing: ${target}`);

  const workDir = path.join(workRoot, docName.replace(/[<>:"/\\|?*]/g, "_"));
  extractDocx(target, workDir);
  patcher(workDir);
  removeUnreferencedMedia(workDir);
  packDocx(workDir, target);
}

function augmentGeneralPart() {
  patchExistingDoc("5 Общая часть .docx", (workDir) => {
    const documentXmlPath = path.join(workDir, "word", "document.xml");
    let xml = fs.readFileSync(documentXmlPath, "utf8");
    if ((xml.match(/<w:drawing\b|<v:shape\b|<v:imagedata\b/g) || []).length >= 2) return;

    const homeImageId = addDocumentImage(workDir, "dayen-general-home", "D1-home.png");
    const productImageId = addDocumentImage(workDir, "dayen-general-product", "D3-product.png");
    const fragment = [
      textParagraph("Внешний вид главной страницы web-приложения Dayen представлен на рисунке 1.1."),
      imageParagraph(homeImageId, 5101, "Dayen home screenshot"),
      textParagraph("Рисунок 1.1 - Главная страница маркетплейса Dayen", "center"),
      textParagraph("Пример страницы товара с описанием, ценой и действиями покупателя представлен на рисунке 1.2."),
      imageParagraph(productImageId, 5102, "Dayen product screenshot"),
      textParagraph("Рисунок 1.2 - Карточка товара в web-приложении Dayen", "center"),
    ].join("");
    xml = insertBeforeSectionProperties(xml, fragment);
    fs.writeFileSync(documentXmlPath, xml, "utf8");
  });
}

function augmentSpecialPart() {
  patchExistingDoc("6 Специальная часть .docx", (workDir) => {
    const documentXmlPath = path.join(workDir, "word", "document.xml");
    let xml = fs.readFileSync(documentXmlPath, "utf8");
    if ((xml.match(/<w:tbl\b/g) || []).length >= 3) return;

    const identifiersTable = tableXml([
      ["Идентификатор", "Смысловое содержание", "Тип"],
      ["user", "Учетная запись пользователя, роль и настройки безопасности", "Таблица PostgreSQL"],
      ["product", "Товар каталога с описанием, ценой, изображением и остатком", "Таблица PostgreSQL"],
      ["order", "Заказ покупателя, статус оплаты и состав заказа", "Таблица PostgreSQL"],
      ["notification", "Уведомление пользователя о заказе, оплате или ответе поддержки", "Таблица PostgreSQL"],
    ]);
    const outputTable = tableXml([
      ["Идентификатор", "Смысловое содержание", "Тип"],
      ["products", "Список товаров каталога для витрины и поиска", "JSON"],
      ["orderDetails", "Детальная информация о заказе пользователя", "JSON"],
      ["paymentStatus", "Результат выполнения оплаты и обновленный статус заказа", "JSON"],
      ["adminAudit", "Запись о важном действии администратора или владельца", "JSON"],
    ]);
    const fragment = [
      textParagraph("Основные идентификаторы базы данных представлены в таблице 2.2."),
      identifiersTable,
      textParagraph("Таблица 2.2 - Описание основных идентификаторов базы данных Dayen", "center"),
      textParagraph("Основные выходные данные приложения представлены в таблице 2.3."),
      outputTable,
      textParagraph("Таблица 2.3 - Описание выходных данных web-приложения Dayen", "center"),
    ].join("");
    xml = insertBeforeSectionProperties(xml, fragment);
    fs.writeFileSync(documentXmlPath, xml, "utf8");
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function repairDoc(docName) {
  const source = path.join(templateDir, docName);
  const target = path.join(outputDir, docName);
  if (!fs.existsSync(source)) throw new Error(`Template missing: ${source}`);
  if (!fs.existsSync(target)) throw new Error(`Output missing: ${target}`);

  fs.copyFileSync(source, target);
  const workDir = path.join(workRoot, docName.replace(/[<>:"/\\|?*]/g, "_"));
  extractDocx(target, workDir);

  for (const xmlPath of walk(workDir, (file) => file.toLowerCase().endsWith(".xml"))) {
    const before = fs.readFileSync(xmlPath, "utf8");
    const after = patchParagraphs(replaceXmlText(before), docName);
    if (after !== before) fs.writeFileSync(xmlPath, after, "utf8");
  }

  replaceDocumentImages(docName, workDir);
  removeUnreferencedMedia(workDir);
  packDocx(workDir, target);
}

safeRemove(workRoot);
for (const docName of exactTemplateDocs) {
  repairDoc(docName);
}
augmentGeneralPart();
augmentSpecialPart();
safeRemove(workRoot);

safeRemove(zipPath);
runPowerShell(`Compress-Archive -Path '${psEscape(stageRoot)}' -DestinationPath '${psEscape(zipPath)}' -Force`);

console.log("Repaired exact template formatting for:");
for (const docName of exactTemplateDocs) {
  console.log(`- ${docName}`);
}
console.log(`Updated: ${path.relative(root, zipPath)}`);
