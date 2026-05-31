import crypto from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import dotenv from "dotenv";
import { Pool } from "pg";

const root = process.cwd();
const appUrl = "http://localhost:5173";
const apiUrl = "http://localhost:3000";
const screenshotsDir = path.join(root, "docs", "diploma-dayen", "screenshots");
const appendixDocxPath = path.join(root, "DayenDiplom", "Готово", "16 Приложение Д .docx");
const stageRoot = path.join(root, "DayenDiplom");
const zipPath = path.join(root, "DayenDiplom.zip");
const workRoot = path.join(root, "docs", "diploma-dayen", ".screenshot-docx-work");
const chromeProfileDir = path.join(root, "docs", "diploma-dayen", ".chrome-screenshot-profile");
const chromeDebugPort = 9337;

dotenv.config({ path: path.join(root, "apps", "api", ".env"), quiet: true });

const screenshotPlan = [
  { file: "D1-home.png", path: "/", title: "Главная страница Dayen" },
  { file: "D2-catalog.png", path: "/catalog", title: "Каталог товаров" },
  { file: "D3-product.png", path: "", title: "Карточка товара" },
  { file: "D4-checkout.png", path: "/checkout", title: "Корзина и оформление заказа", needsCart: true },
  { file: "D5-notifications.png", path: "/notifications", title: "Уведомления" },
  { file: "D6-admin.png", path: "/admin", title: "Административная панель" },
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

async function safeRemoveEventually(target) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      safeRemove(target);
      return;
    } catch (error) {
      if (!["EBUSY", "EPERM", "ENOTEMPTY"].includes(error?.code)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }
  console.warn(`Could not remove temporary folder yet: ${path.relative(root, target)}`);
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

async function waitForHttp(url, label) {
  const started = Date.now();
  let lastError = "";
  while (Date.now() - started < 30000) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error?.message || String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  throw new Error(`${label} is not ready: ${lastError}`);
}

function hashPassword(password, saltHex) {
  const salt = Buffer.from(saltHex, "hex");
  return crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
}

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

async function prepareDatabaseSession() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing in apps/api/.env");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const salt = crypto.randomBytes(16).toString("hex");
    const password = `DayenDiplom${new Date().getFullYear()}!`;
    const user = (
      await pool.query(
        `INSERT INTO users
           (name, email, pass_salt, pass_hash, is_owner, is_admin, two_factor_enabled, email_verified, is_seller, seller_access)
         VALUES ($1, $2, $3, $4, true, true, true, true, true, true)
         ON CONFLICT (email) DO UPDATE
           SET name = EXCLUDED.name,
               is_owner = true,
               is_admin = true,
               two_factor_enabled = true,
               email_verified = true,
               is_seller = true,
               seller_access = true
         RETURNING id, name`,
        ["Dayen Demo", "demo@dayen.local", salt, hashPassword(password, salt)],
      )
    ).rows[0];

    await pool.query(
      `UPDATE users
          SET is_admin = true,
              two_factor_enabled = true,
              email_verified = true,
              seller_access = COALESCE(seller_access, false)
        WHERE id = $1`,
      [user.id],
    );

    const notificationCount = Number(
      (
        await pool.query(`SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1`, [user.id])
      ).rows[0]?.count || 0,
    );

    if (notificationCount < 4) {
      const samples = [
        ["Новый оплаченный заказ", "Заказ оплачен. Проверьте продажи и подготовьте товар.", "/orders"],
        ["Ответ поддержки", "Специалист ответил на обращение покупателя.", "/about/support"],
        ["Обновление системы", "Настройки аккаунта успешно обновлены.", "/settings"],
        ["Важное уведомление", "Проверьте новые события аккаунта.", "/notifications"],
      ];
      for (const [title, body, link] of samples) {
        await pool.query(
          `INSERT INTO notifications (user_id, title, body, link, is_read)
           VALUES ($1, $2, $3, $4, false)`,
          [user.id, title, body, link],
        );
      }
    }

    const productRows = (
      await pool.query(
        `SELECT id, title
           FROM products
          WHERE stock > 0
          ORDER BY
            CASE WHEN LOWER(title) LIKE '%spider%' THEN 0 ELSE 1 END,
            CASE WHEN image_url <> '' THEN 0 ELSE 1 END,
            id ASC
          LIMIT 4`,
      )
    ).rows;

    if (!productRows.length) throw new Error("No products found for screenshots");

    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await pool.query(`INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)`, [
      hashSessionToken(token),
      user.id,
      expiresAt,
    ]);

    return {
      token,
      userId: user.id,
      productId: Number(productRows[0].id),
      cartProductIds: productRows.slice(0, 2).map((row) => Number(row.id)),
    };
  } finally {
    await pool.end();
  }
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error("Chrome or Edge executable was not found");
  return found;
}

async function waitForJson(url) {
  const started = Date.now();
  let lastError = "";
  while (Date.now() - started < 15000) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error?.message || String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Chrome DevTools is not ready: ${lastError}`);
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.eventWaiters = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message || JSON.stringify(message.error)));
        else resolve(message.result || {});
        return;
      }

      if (message.method && this.eventWaiters.has(message.method)) {
        const waiters = this.eventWaiters.get(message.method);
        this.eventWaiters.delete(message.method);
        for (const resolve of waiters) resolve(message.params || {});
      }
    });

    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(payload);
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 30000);
    });
  }

  waitForEvent(method, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const waiters = this.eventWaiters.get(method) || [];
      waiters.push(resolve);
      this.eventWaiters.set(method, waiters);
      setTimeout(() => {
        const current = this.eventWaiters.get(method) || [];
        const next = current.filter((item) => item !== resolve);
        if (next.length) this.eventWaiters.set(method, next);
        else this.eventWaiters.delete(method);
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
    });
  }

  close() {
    this.ws?.close();
  }
}

async function launchChrome() {
  await safeRemoveEventually(chromeProfileDir);
  await fsp.mkdir(chromeProfileDir, { recursive: true });

  const chrome = findChrome();
  const child = spawnChrome(chrome);
  const list = await waitForJson(`http://127.0.0.1:${chromeDebugPort}/json/list`);
  const page = list.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
  if (!page) throw new Error("Chrome page target was not found");

  const client = new CdpClient(page.webSocketDebuggerUrl);
  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Network.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  return { child, client };
}

function spawnChrome(chrome) {
  const child = spawn(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    `--remote-debugging-port=${chromeDebugPort}`,
    `--user-data-dir=${chromeProfileDir}`,
    "--window-size=1440,900",
    "about:blank",
  ], {
    stdio: "ignore",
    detached: false,
  });

  child.on("error", (error) => {
    throw error;
  });

  return child;
}

async function navigate(client, url) {
  const loaded = client.waitForEvent("Page.loadEventFired", 20000).catch(() => null);
  await client.send("Page.navigate", { url });
  await loaded;
  await new Promise((resolve) => setTimeout(resolve, 1600));
}

async function evalPage(client, expression) {
  return client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
}

async function capturePage(client, planItem) {
  await navigate(client, `${appUrl}${planItem.path}`);
  await evalPage(client, `
    (() => {
      const old = document.querySelector('[data-diploma-screenshot-style]');
      if (old) old.remove();
      const style = document.createElement('style');
      style.dataset.diplomaScreenshotStyle = 'true';
      style.textContent = '.assistantWidget{display:none!important} html{scroll-behavior:auto!important}';
      document.head.appendChild(style);
      window.scrollTo(0, 0);
    })()
  `);
  await new Promise((resolve) => setTimeout(resolve, 800));
  const result = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const outputPath = path.join(screenshotsDir, planItem.file);
  await fsp.writeFile(outputPath, Buffer.from(result.data, "base64"));
  return outputPath;
}

async function captureScreenshots(session) {
  await fsp.mkdir(screenshotsDir, { recursive: true });
  const { child, client } = await launchChrome();

  try {
    await client.send("Network.setCookie", {
      name: "dayen_session",
      value: session.token,
      url: appUrl,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    });

    await navigate(client, appUrl);
    await evalPage(client, `localStorage.setItem('market_cart_v2', '${JSON.stringify(session.cartProductIds)}')`);

    const files = [];
    for (const item of screenshotPlan) {
      const planItem = { ...item };
      if (item.file === "D3-product.png") {
        planItem.path = `/product/${session.productId}`;
      }
      files.push(await capturePage(client, planItem));
    }
    return files;
  } finally {
    client.close();
    child.kill();
    await new Promise((resolve) => {
      child.once("exit", resolve);
      setTimeout(resolve, 2000);
    });
    await safeRemoveEventually(chromeProfileDir);
  }
}

function imageParagraphXml({ relationshipId, docPrId, fileName, title, widthEmu, heightEmu, addPageBreak }) {
  const pageBreak = addPageBreak ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' : "";
  return `
<w:p>
  <w:pPr>
    <w:jc w:val="center"/>
    <w:spacing w:before="120" w:after="180"/>
  </w:pPr>
  <w:r>
    <w:drawing>
      <wp:inline distT="0" distB="0" distL="0" distR="0">
        <wp:extent cx="${widthEmu}" cy="${heightEmu}"/>
        <wp:effectExtent l="0" t="0" r="0" b="0"/>
        <wp:docPr id="${docPrId}" name="${escapeXml(title)}"/>
        <wp:cNvGraphicFramePr>
          <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
        </wp:cNvGraphicFramePr>
        <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:nvPicPr>
                <pic:cNvPr id="${docPrId}" name="${escapeXml(fileName)}"/>
                <pic:cNvPicPr/>
              </pic:nvPicPr>
              <pic:blipFill>
                <a:blip r:embed="${relationshipId}"/>
                <a:stretch><a:fillRect/></a:stretch>
              </pic:blipFill>
              <pic:spPr>
                <a:xfrm>
                  <a:off x="0" y="0"/>
                  <a:ext cx="${widthEmu}" cy="${heightEmu}"/>
                </a:xfrm>
                <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
              </pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing>
  </w:r>
</w:p>${pageBreak}`.replace(/\n\s*/g, "");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function decodeXmlText(value) {
  return String(value)
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function paragraphText(paragraphXml) {
  return decodeXmlText(paragraphXml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function nextRelationshipId(relsXml) {
  const ids = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((match) => Number(match[1]));
  return Math.max(0, ...ids) + 1;
}

function nextDocPrId(documentXml) {
  const ids = [...documentXml.matchAll(/<wp:docPr[^>]*\sid="(\d+)"/g)].map((match) => Number(match[1]));
  return Math.max(0, ...ids) + 1;
}

function insertScreenshotsIntoDocx(files) {
  if (!fs.existsSync(appendixDocxPath)) throw new Error(`Appendix DOCX not found: ${appendixDocxPath}`);

  safeRemove(workRoot);
  fs.mkdirSync(workRoot, { recursive: true });

  const archivePath = path.join(workRoot, "document.zip");
  fs.copyFileSync(appendixDocxPath, archivePath);
  runPowerShell(
    `Expand-Archive -LiteralPath '${psEscape(archivePath)}' -DestinationPath '${psEscape(workRoot)}' -Force`,
  );
  fs.rmSync(archivePath, { force: true });

  const mediaDir = path.join(workRoot, "word", "media");
  fs.mkdirSync(mediaDir, { recursive: true });

  const documentXmlPath = path.join(workRoot, "word", "document.xml");
  const relsPath = path.join(workRoot, "word", "_rels", "document.xml.rels");
  const contentTypesPath = path.join(workRoot, "[Content_Types].xml");

  let documentXml = fs.readFileSync(documentXmlPath, "utf8");
  let relsXml = fs.readFileSync(relsPath, "utf8");
  let contentTypesXml = fs.readFileSync(contentTypesPath, "utf8");

  if (!/Extension="png"/.test(contentTypesXml)) {
    contentTypesXml = contentTypesXml.replace(
      "</Types>",
      '<Default Extension="png" ContentType="image/png"/></Types>',
    );
  }

  let relationshipNumber = nextRelationshipId(relsXml);
  let docPrId = nextDocPrId(documentXml);
  const imageData = files.map((filePath, index) => {
    const fileName = `dayen-d${index + 1}.png`;
    fs.copyFileSync(filePath, path.join(mediaDir, fileName));
    const relationshipId = `rId${relationshipNumber++}`;
    relsXml = relsXml.replace(
      "</Relationships>",
      `<Relationship Id="${relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${fileName}"/></Relationships>`,
    );
    return {
      relationshipId,
      docPrId: docPrId++,
      fileName,
      title: screenshotPlan[index].title,
    };
  });

  const widthEmu = 5_211_000;
  const heightEmu = 3_257_000;
  let imageIndex = 0;
  documentXml = documentXml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraphXml) => {
    if (!paragraphText(paragraphXml).includes("Место для скриншота")) return paragraphXml;
    const current = imageData[imageIndex];
    if (!current) return paragraphXml;
    const xml = imageParagraphXml({
      ...current,
      widthEmu,
      heightEmu,
      addPageBreak: imageIndex < imageData.length - 1,
    });
    imageIndex += 1;
    return xml;
  });

  if (imageIndex !== files.length) {
    throw new Error(`Expected ${files.length} screenshot placeholders, replaced ${imageIndex}`);
  }

  fs.writeFileSync(documentXmlPath, documentXml, "utf8");
  fs.writeFileSync(relsPath, relsXml, "utf8");
  fs.writeFileSync(contentTypesPath, contentTypesXml, "utf8");

  const tempZip = `${appendixDocxPath}.zip`;
  safeRemove(tempZip);
  runPowerShell(
    `Compress-Archive -Path '${psEscape(workRoot)}\\*' -DestinationPath '${psEscape(tempZip)}' -Force; ` +
      `Move-Item -LiteralPath '${psEscape(tempZip)}' -Destination '${psEscape(appendixDocxPath)}' -Force`,
  );

  safeRemove(workRoot);
}

function rebuildDiplomaZip() {
  safeRemove(zipPath);
  runPowerShell(
    `Compress-Archive -Path '${psEscape(stageRoot)}' -DestinationPath '${psEscape(zipPath)}' -Force`,
  );
}

await waitForHttp(`${apiUrl}/api/products`, "API");
await waitForHttp(appUrl, "Web");

const session = await prepareDatabaseSession();
const screenshotFiles = await captureScreenshots(session);
insertScreenshotsIntoDocx(screenshotFiles);
rebuildDiplomaZip();

console.log("Screenshots inserted:");
for (const file of screenshotFiles) {
  console.log(`- ${path.relative(root, file)}`);
}
console.log(`Updated: ${path.relative(root, appendixDocxPath)}`);
console.log(`Updated: ${path.relative(root, zipPath)}`);
