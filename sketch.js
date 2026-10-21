// ===== 多模式學習遊戲：選單 + 連連看 + 拼拼圖 + 多媒體測驗 =====
// 整份程式只用一張畫布。用變數 mode 記住現在在哪個畫面：
//   "menu"（選單）、"match"（連連看）、"puzzle"（拼拼圖）、"quiz"（多媒體測驗）
// 每個模式都是 MODES 裡的一組函式：
//   enter()  進入模式時執行（重設狀態）
//   resize() 視窗大小改變時重新排版
//   draw(t)  每一幀畫畫面，t 是秒數
//   down() / move() / up()  按下、移動、放開（滑鼠與觸控都會進來）

// ==================================================================
// 共用：模式表與切換
// ==================================================================
const FONT = '"Noto Sans TC", "Microsoft JhengHei", "PingFang TC", sans-serif';

const MODES = {
  menu:   { enter: menuEnter, resize: menuLayout, draw: menuDraw, down: menuDown, move: noop, up: menuUp },
  match:  { enter: matchNewGame, resize: matchLayout, draw: matchDraw, down: matchDown, move: matchMove, up: matchUp },
  puzzle: { enter: puzzleEnter, resize: puzzleLayout, draw: puzzleDraw, down: puzzleDown, move: puzzleMove, up: puzzleUp },
  quiz:   { enter: qzEnter, leave: qzLeave, resize: qzLayout, draw: qzDraw, down: qzDown, move: noop, up: qzUp, key: qzKey },
};

let mode = "menu";
let cursorType = "default";
let backBtn = { x: 10, y: 10, w: 84, h: 34, label: "← 選單" };
let imgs = {};      // gif 圖片

function noop() {}

function goMode(name) {
  // 離開目前的模式時，讓它先收拾（例如停掉聲音、移除影片）
  if (MODES[mode] && MODES[mode].leave) MODES[mode].leave();
  mode = name;
  MODES[mode].enter();
  layoutAll();
}

function layoutAll() {
  const small = width < 700;
  backBtn = { x: 10, y: 10, w: small ? 68 : 84, h: small ? 30 : 34, label: "← 選單" };
  MODES[mode].resize();
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont(FONT);
  textAlign(CENTER, CENTER);
  for (const tp of TOPICS) {
    for (const it of tp.items) {
      if (it.gif) imgs[it.name] = loadImage(it.gif);
    }
  }
  puzzleLoadImages();
  goMode("menu");
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  layoutAll();
}

// 每一幀重畫
function draw() {
  background(244, 246, 250);
  textAlign(CENTER, CENTER);
  textStyle(NORMAL);
  cursorType = "default";

  MODES[mode].draw(millis() / 1000);

  if (mode !== "menu") drawBackButton();
  cursor(cursorType);
}

function drawBackButton() {
  const b = backBtn;
  const over = inRect(mouseX, mouseY, b.x, b.y, b.w, b.h);
  if (over) cursorType = "pointer";
  noStroke();
  fill(over ? color(210, 218, 232) : color(225, 230, 240));
  rect(b.x, b.y, b.w, b.h, b.h / 2);
  fill(60, 70, 90);
  textAlign(CENTER, CENTER);
  textSize(b.h * 0.42);
  text(b.label, b.x + b.w / 2, b.y + b.h / 2);
}

// 滑鼠與觸控都會進到這三個事件，再交給目前的模式
function mousePressed() {
  if (!inCanvas()) return;
  if (mode !== "menu" && inRect(mouseX, mouseY, backBtn.x, backBtn.y, backBtn.w, backBtn.h)) {
    goMode("menu");
    return false;
  }
  MODES[mode].down();
  return false;
}
function mouseDragged() { MODES[mode].move(); return false; }
function mouseReleased() { MODES[mode].up(); }

// 鍵盤：交給目前的模式處理（模式有寫 key() 才會用到）
function keyPressed() {
  const m = MODES[mode];
  if (m.key && m.key()) return false;
}

// ---------- 共用工具 ----------
function inRect(px, py, x, y, w, h) {
  return px >= x && px <= x + w && py >= y && py <= y + h;
}

function inCanvas() {
  return mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height;
}

function drawButton(b, c) {
  const over = inRect(mouseX, mouseY, b.x, b.y, b.w, b.h);
  if (over) cursorType = "pointer";
  const dy = over ? -1 : 0;
  noStroke();
  fill(red(c), green(c), blue(c), over ? 255 : 225);
  rect(b.x, b.y + dy, b.w, b.h, b.h / 2);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(b.h * 0.38);
  textStyle(BOLD);
  text(b.label, b.x + b.w / 2, b.y + b.h / 2 + dy);
  textStyle(NORMAL);
}

// ==================================================================
// 模式 0：選單
// ==================================================================
const MENU = [
  { key: "match",  title: "動態連連看", desc: "把名稱拖到對應的動畫上", color: [46, 125, 230], icon: iconMatch },
  { key: "puzzle", title: "拼拼圖遊戲", desc: "把碎片拼回完整圖片",     color: [240, 140, 40], icon: iconPuzzle },
  { key: "quiz",   title: "多媒體測驗", desc: "看圖、聽聲音答選擇題",   color: [40, 170, 120], icon: iconQuiz },
];

let menuCards = [];     // 每張卡片的位置：{ x, y, w, h }
let menuStack = false;  // 窄螢幕時改成直向排列
let menuHeadH = 130;
let menuHover = [0, 0, 0];
let menuPress = -1;

function menuEnter() {
  menuPress = -1;
  menuHover = [0, 0, 0];
}

function menuLayout() {
  const n = MENU.length;
  menuStack = width < 700;
  menuHeadH = width < 500 ? 100 : 130;
  menuCards = [];

  if (menuStack) {
    const gap = 12;
    const w = min(width - 32, 440);
    const h = constrain((height - menuHeadH - 20 - (n - 1) * gap) / n, 80, 150);
    const x = (width - w) / 2;
    for (let i = 0; i < n; i++) {
      menuCards.push({ x, y: menuHeadH + i * (h + gap), w, h });
    }
  } else {
    const gap = 24;
    const w = min((width - 40 - (n - 1) * gap) / n, 300);
    const availH = height - menuHeadH - 20;
    const h = max(140, min(availH, w * 1.15));
    const x0 = (width - (n * w + (n - 1) * gap)) / 2;
    const y = menuHeadH + max(0, (availH - h) / 2);
    for (let i = 0; i < n; i++) {
      menuCards.push({ x: x0 + i * (w + gap), y, w, h });
    }
  }
}

function menuDraw() {
  noStroke();
  fill(40, 50, 70);
  textSize(width < 500 ? 24 : 34);
  textStyle(BOLD);
  text("選擇遊戲模式", width / 2, menuHeadH * 0.4);
  textStyle(NORMAL);
  textSize(width < 500 ? 13 : 16);
  fill(110, 120, 140);
  text("點一下卡片就開始", width / 2, menuHeadH * 0.72);

  for (let i = 0; i < MENU.length; i++) drawMenuCard(i);
}

function drawMenuCard(i) {
  const c = menuCards[i];
  const m = MENU[i];
  if (!c) return;
  const over = inRect(mouseX, mouseY, c.x, c.y, c.w, c.h);
  if (over) cursorType = "pointer";
  menuHover[i] = lerp(menuHover[i], over ? 1 : 0, 0.2);
  const y = c.y - menuHover[i] * 6;
  const [r, g, b] = m.color;

  // 卡片本體
  noStroke();
  fill(0, 0, 0, 18 + menuHover[i] * 14);
  rect(c.x + 3, y + 6, c.w, c.h, 18);
  fill(255);
  rect(c.x, y, c.w, c.h, 18);
  fill(r, g, b);
  rect(c.x, y + c.h - 6, c.w, 6, 0, 0, 18, 18);

  if (menuStack) {
    // 直向排列：圖示在左，文字在右
    const d = c.h * 0.62;
    const icx = c.x + c.h * 0.52;
    const icy = y + (c.h - 6) / 2;
    fill(r, g, b);
    circle(icx, icy, d);
    m.icon(icx, icy, d * 0.62);

    textAlign(LEFT, CENTER);
    fill(40, 50, 70);
    textStyle(BOLD);
    textSize(constrain(c.h * 0.2, 18, 26));
    text(m.title, c.x + c.h + 6, y + c.h * 0.36);
    textStyle(NORMAL);
    fill(110, 120, 140);
    textSize(constrain(c.h * 0.13, 12, 15));
    text(m.desc, c.x + c.h + 6, y + c.h * 0.64);
    textAlign(CENTER, CENTER);
  } else {
    // 橫向排列：圖示在上，文字在下
    const d = min(c.w * 0.42, c.h * 0.42);
    const icx = c.x + c.w / 2;
    const icy = y + c.h * 0.34;
    fill(r, g, b);
    circle(icx, icy, d);
    m.icon(icx, icy, d * 0.62);

    fill(40, 50, 70);
    textStyle(BOLD);
    textSize(constrain(c.w * 0.09, 16, 26));
    text(m.title, c.x + c.w / 2, y + c.h * 0.68);
    textStyle(NORMAL);
    fill(110, 120, 140);
    textSize(constrain(c.w * 0.052, 11, 15));
    text(m.desc, c.x + c.w / 2, y + c.h * 0.83);
  }
}

function menuCardAt(px, py) {
  for (let i = 0; i < menuCards.length; i++) {
    const c = menuCards[i];
    if (inRect(px, py, c.x, c.y, c.w, c.h)) return i;
  }
  return -1;
}

function menuDown() {
  menuPress = menuCardAt(mouseX, mouseY);
}

function menuUp() {
  const i = menuCardAt(mouseX, mouseY);
  const press = menuPress;
  menuPress = -1;
  if (press >= 0 && i === press) goMode(MENU[i].key);
}

// 選單圖示：以 (cx, cy) 為中心，大小約 s
function iconMatch(cx, cy, s) {
  noStroke();
  fill(255);
  const w = s * 0.38, h = s * 0.28, rr = s * 0.06;
  rect(cx - s * 0.6, cy - s * 0.42, w, h, rr);
  rect(cx - s * 0.6, cy + s * 0.14, w, h, rr);
  rect(cx + s * 0.22, cy - s * 0.42, w, h, rr);
  rect(cx + s * 0.22, cy + s * 0.14, w, h, rr);
  stroke(255);
  strokeWeight(max(2, s * 0.05));
  strokeCap(ROUND);
  line(cx - s * 0.2, cy - s * 0.28, cx + s * 0.2, cy + s * 0.28);
  line(cx - s * 0.2, cy + s * 0.28, cx + s * 0.2, cy - s * 0.28);
}

function iconPuzzle(cx, cy, s) {
  noStroke();
  fill(255);
  const q = s * 0.4, g = s * 0.04, rr = s * 0.06;
  const wob = sin(millis() / 350) * s * 0.05;
  rect(cx - q - g, cy - q - g, q, q, rr);
  rect(cx + g, cy - q - g, q, q, rr);
  rect(cx - q - g, cy + g, q, q, rr);
  fill(255, 255, 255, 215);
  rect(cx + g + wob, cy + g + wob, q, q, rr);
  fill(255);
  circle(cx, cy - q / 2 - g, s * 0.14);
  circle(cx - q / 2 - g, cy, s * 0.14);
}

function iconQuiz(cx, cy, s) {
  noStroke();
  fill(255);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(s * 1.1);
  text("?", cx, cy - s * 0.04);
  textStyle(NORMAL);
}

// ==================================================================
// 尚未完成的模式（拼拼圖、多媒體測驗）的暫時畫面
// 之後把 MODES.puzzle / MODES.quiz 換成你自己的 enter、resize、draw、down、move、up 即可
// ==================================================================
function placeholderMode(title, hint) {
  return {
    enter: noop,
    resize: noop,
    down: noop,
    move: noop,
    up: noop,
    draw() {
      noStroke();
      fill(40, 50, 70);
      textSize(width < 500 ? 20 : 26);
      textStyle(BOLD);
      text(title, width / 2, 28);
      textStyle(NORMAL);

      fill(110, 120, 140);
      textSize(width < 500 ? 14 : 18);
      text(hint, width / 2, height / 2 - 18);
      fill(160, 170, 190);
      textSize(width < 500 ? 12 : 14);
      text("這個模式還沒做，按左上角回選單", width / 2, height / 2 + 14);
    },
  };
}

// ==================================================================
// 模式 2：拼拼圖遊戲（建築）
// ==================================================================

// ① 題目與圖片放在最上面
// 圖片：把你的建築照片放進專案的 images 資料夾，再照格式加在這裡。
// 有放照片就只用照片（每次隨機挑一張，不會連續重複）；
// 沒放或找不到檔案，就改用程式畫的 3 張建築圖。
const PUZZLE_IMAGES = [
  // { title: "巴黎艾菲爾鐵塔", src: "images/eiffel.jpg" },
  // { title: "羅馬競技場",     src: "images/colosseum.jpg" },
];

// 題目：每塊拼圖一題（共 9 題，每次遊戲隨機分配到不同拼圖）
// q 是題目，opts 是選項，ans 是正確答案在 opts 裡的位置（從 0 開始）
const PUZZLE_QS = [
  { q: "艾菲爾鐵塔位於哪一個國家？", opts: ["法國", "義大利", "英國"], ans: 0 },
  { q: "羅馬競技場位於哪一個城市？", opts: ["雅典", "羅馬", "巴黎"], ans: 1 },
  { q: "台北 101 位於台北市的哪一區？", opts: ["信義區", "中山區", "大安區"], ans: 0 },
  { q: "泰姬瑪哈陵位於哪一個國家？", opts: ["伊朗", "土耳其", "印度"], ans: 2 },
  { q: "雪梨歌劇院位於哪一個國家？", opts: ["澳洲", "美國", "加拿大"], ans: 0 },
  { q: "帕德嫩神殿位於哪一個城市？", opts: ["伊斯坦堡", "雅典", "開羅"], ans: 1 },
  { q: "哥德式教堂常見的結構特色是什麼？", opts: ["圓形穹頂與厚牆", "尖拱與飛扶壁", "平屋頂與方柱"], ans: 1 },
  { q: "萬里長城最主要的用途是什麼？", opts: ["防禦外敵", "灌溉農田", "祭祀祖先"], ans: 0 },
  { q: "故宮（紫禁城）位於哪一個城市？", opts: ["上海", "西安", "北京"], ans: 2 },
];

const PZ_BUILTIN = [
  { title: "城市天際線", draw: sceneSkyline },
  { title: "希臘神殿", draw: sceneTemple },
  { title: "日式寶塔", draw: scenePagoda },
];

const PZ_PITCH = 1.4;   // 拼圖托盤裡每塊的間距（單位：拼圖邊長）

// 用變數記住狀態
// 每塊拼圖有三種狀態：locked（鎖住）→ open（可拖曳）→ placed（拼好）
let pzPieces = [];
let pzEdgesH = [];      // 橫向邊的方向值：1 凸、-1 凹、0 平邊
let pzEdgesV = [];      // 直向邊的方向值
let pzG = null;         // 這局用的方形圖片
let pzTitle = "", pzLastTitle = "";

let pzS = 100;          // 一塊拼圖的邊長
let pzBX = 0, pzBY = 0; // 拼圖板左上角
let pzTX = 0, pzTY = 0, pzTW = 0; // 托盤左上角與邊長
let pzHeadH = 80;

let pzDrag = -1, pzPress = -1, pzMoved = false;
let pzOffX = 0, pzOffY = 0, pzPX = 0, pzPY = 0;

let pzAsk = -1;         // 正在回答哪一塊（-1 表示沒有）
let pzPhase = 0;        // 0 選答案，1 看結果
let pzChoice = -1;
let pzOpts = [];

let pzFinished = false, pzFinishAt = 0;
let pzBtnReset = { x: 0, y: 0, w: 0, h: 0, label: "重新開始" };
let pzBtnAgain = { x: 0, y: 0, w: 0, h: 0, label: "再玩一次" };

function puzzleLoadImages() {
  for (const it of PUZZLE_IMAGES) {
    if (!it.src) continue;
    loadImage(
      it.src,
      (im) => { it.img = im; },
      () => console.warn("找不到圖片：" + it.src)
    );
  }
}

function puzzleEnter() {
  // 選圖：優先用你放的照片，不連續選到同一張
  const loaded = PUZZLE_IMAGES.filter((x) => x.img);
  const pool = loaded.length > 0 ? loaded : PZ_BUILTIN;
  let choices = pool.filter((x) => x.title !== pzLastTitle);
  if (choices.length === 0) choices = pool;
  const pick = random(choices);
  pzLastTitle = pick.title;
  pzTitle = pick.title;

  if (pzG) pzG.remove();
  pzG = createGraphics(600, 600);
  pzG.pixelDensity(1);
  if (pick.img) {
    const im = pick.img;
    const side = min(im.width, im.height);
    pzG.image(im, 0, 0, 600, 600, (im.width - side) / 2, (im.height - side) / 2, side, side);
  } else {
    pick.draw(pzG);
  }

  // ① 凸起與凹槽：相鄰兩塊共用同一條邊，一塊凸、另一塊就凹
  pzEdgesH = [];
  for (let r = 0; r <= 3; r++) {
    const row = [];
    for (let c = 0; c < 3; c++) row.push(r === 0 || r === 3 ? 0 : random() < 0.5 ? 1 : -1);
    pzEdgesH.push(row);
  }
  pzEdgesV = [];
  for (let r = 0; r < 3; r++) {
    const row = [];
    for (let c = 0; c <= 3; c++) row.push(c === 0 || c === 3 ? 0 : random() < 0.5 ? 1 : -1);
    pzEdgesV.push(row);
  }

  // 題目與托盤位置都隨機分配
  const qOrder = shuffle(PUZZLE_QS.map((_, i) => i));
  const slotOrder = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  pzPieces = [];
  for (let i = 0; i < 9; i++) {
    pzPieces.push({
      row: floor(i / 3),
      col: i % 3,
      q: PUZZLE_QS[qOrder[i % qOrder.length]],
      slot: slotOrder[i],
      state: "locked",
      result: null,      // true 答對、false 答錯、null 還沒答
      x: 0, y: 0, gx: 0, gy: 0,
      path: null,
    });
  }

  pzDrag = -1;
  pzPress = -1;
  pzMoved = false;
  pzAsk = -1;
  pzPhase = 0;
  pzChoice = -1;
  pzFinished = false;
  puzzleLayout();
  for (const p of pzPieces) {
    p.x = p.gx;
    p.y = p.gy;
  }
}

function puzzleLayout() {
  const m = 12, g = 18;
  pzHeadH = width < 500 ? 62 : 80;

  // 橫排（拼圖板在左、托盤在右）與直排（板在上、托盤在下），選能放得比較大的
  const sL = min((width - 2 * m - g) / (3 + 3 * PZ_PITCH), (height - pzHeadH - m) / (3 * PZ_PITCH));
  const sP = min((width - 2 * m) / (3 * PZ_PITCH), (height - pzHeadH - m - g) / (3 + 3 * PZ_PITCH));
  const land = sL >= sP;
  pzS = max(30, land ? sL : sP);
  const s = pzS;
  pzTW = 3 * PZ_PITCH * s;

  if (land) {
    const total = 3 * s + g + pzTW;
    pzBX = (width - total) / 2;
    pzTY = pzHeadH + max(0, (height - pzHeadH - m - pzTW) / 2);
    pzBY = pzTY + (pzTW - 3 * s) / 2;
    pzTX = pzBX + 3 * s + g;
  } else {
    pzBX = (width - 3 * s) / 2;
    pzBY = pzHeadH;
    pzTX = (width - pzTW) / 2;
    pzTY = pzBY + 3 * s + g;
  }

  const small = width < 700;
  const bw = small ? 84 : 100;
  const bh = small ? 30 : 34;
  pzBtnReset = { x: width - 10 - bw, y: 10, w: bw, h: bh, label: "重新開始" };
  pzBtnAgain = { x: pzTX + pzTW / 2 - 60, y: pzTY + pzTW - 12 - 40, w: 120, h: 40, label: "再玩一次" };

  for (const p of pzPieces) {
    p.path = pzMakePath(p.row, p.col, s);
    const t = p.state === "placed" ? pzTarget(p) : pzHome(p);
    p.gx = t.x;
    p.gy = t.y;
    p.x = p.gx;
    p.y = p.gy;
  }
}

function pzTarget(p) {
  return { x: pzBX + p.col * pzS, y: pzBY + p.row * pzS };
}

function pzHome(p) {
  const r = floor(p.slot / 3);
  const c = p.slot % 3;
  const pad = ((PZ_PITCH - 1) * pzS) / 2;
  return { x: pzTX + c * PZ_PITCH * pzS + pad, y: pzTY + r * PZ_PITCH * pzS + pad };
}

// 拼圖的形狀：四條邊依序接起來，凸起用兩段貝茲曲線 bezierCurveTo() 畫
function pzMakePath(r, c, s) {
  const path = new Path2D();
  const top = -pzEdgesH[r][c];
  const right = pzEdgesV[r][c + 1];
  const bottom = pzEdgesH[r + 1][c];
  const left = -pzEdgesV[r][c];
  path.moveTo(0, 0);
  pzEdge(path, 0, 0, s, 0, 0, -1, top);
  pzEdge(path, s, 0, s, s, 1, 0, right);
  pzEdge(path, s, s, 0, s, 0, 1, bottom);
  pzEdge(path, 0, s, 0, 0, -1, 0, left);
  path.closePath();
  return path;
}

// 從 (x0,y0) 畫到 (x1,y1)；(nx,ny) 是向外的方向；d：1 往外凸、-1 往內凹、0 平邊
function pzEdge(path, x0, y0, x1, y1, nx, ny, d) {
  if (d === 0) {
    path.lineTo(x1, y1);
    return;
  }
  const L = dist(x0, y0, x1, y1);
  const ux = (x1 - x0) / L;
  const uy = (y1 - y0) / L;
  // a：沿著邊的位置（0 到 1），b：凸出去的高度
  const P = (a, b) => [x0 + ux * a * L + nx * d * b * L, y0 + uy * a * L + ny * d * b * L];
  let q = P(0.38, 0);
  path.lineTo(q[0], q[1]);
  let c1 = P(0.26, 0.08);
  let c2 = P(0.3, 0.27);
  let e = P(0.5, 0.25);
  path.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], e[0], e[1]);
  c1 = P(0.7, 0.27);
  c2 = P(0.74, 0.08);
  e = P(0.62, 0);
  path.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], e[0], e[1]);
  path.lineTo(x1, y1);
}

// ② 判斷一：點到哪一塊，用拼圖的真實形狀判斷
function pzHit(p, mx, my) {
  const ctx = drawingContext;
  const d = pixelDensity();
  ctx.save();
  ctx.setTransform(d, 0, 0, d, p.x * d, p.y * d);
  const inside = ctx.isPointInPath(p.path, mx * d, my * d);
  ctx.restore();
  return inside;
}

function pzPieceAt(mx, my) {
  for (let i = pzPieces.length - 1; i >= 0; i--) {
    const p = pzPieces[i];
    if (p.state === "placed") continue;
    if (pzHit(p, mx, my)) return i;
  }
  return -1;
}

function pzScore() {
  return pzPieces.filter((p) => p.result === true).length;
}

function puzzleDraw() {
  const s = pzS;
  const ctx = drawingContext;

  // 每塊慢慢滑向它的目標位置（拖曳中的除外）
  pzPieces.forEach((p, i) => {
    if (i === pzDrag && pzMoved) return;
    p.x += (p.gx - p.x) * 0.3;
    p.y += (p.gy - p.y) * 0.3;
    if (abs(p.gx - p.x) < 0.3 && abs(p.gy - p.y) < 0.3) {
      p.x = p.gx;
      p.y = p.gy;
    }
  });

  // 標題與進度
  const unlocked = pzPieces.filter((p) => p.state !== "locked").length;
  const placedN = pzPieces.filter((p) => p.state === "placed").length;
  noStroke();
  fill(40, 50, 70);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(width < 500 ? 20 : 26);
  text("建築拼圖挑戰", width / 2, pzHeadH * 0.34);
  textStyle(NORMAL);
  textSize(width < 500 ? 12 : 14);
  fill(110, 120, 140);
  let sub;
  if (pzFinished) sub = "完成！圖片：" + pzTitle;
  else if (unlocked === 0) sub = "點一塊拼圖答題解鎖，再拖到拼圖板";
  else sub = "已解鎖 " + unlocked + " / 9　已拼好 " + placedN + " / 9　答對 " + pzScore();
  text(sub, width / 2, pzHeadH * 0.68);

  // 拼圖板：白底、淡淡的底圖、還沒拼好的格子輪廓
  noStroke();
  fill(255);
  rect(pzBX - 6, pzBY - 6, 3 * s + 12, 3 * s + 12, 10);
  if (!pzFinished) {
    push();
    tint(255, 60);
    image(pzG, pzBX, pzBY, 3 * s, 3 * s);
    pop();
  }
  for (const p of pzPieces) {
    if (p.state === "placed") continue;
    const t = pzTarget(p);
    push();
    translate(t.x, t.y);
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(110,120,140,0.45)";
    ctx.stroke(p.path);
    ctx.restore();
    pop();
  }

  // 拼好的拼圖
  pzPieces.forEach((p) => {
    if (p.state === "placed") pzDrawPiece(p, false);
  });

  // 全部拼好：完整圖畫淡入
  if (pzFinished) {
    const a = constrain((millis() - pzFinishAt) / 700, 0, 1);
    push();
    tint(255, a * 255);
    image(pzG, pzBX, pzBY, 3 * s, 3 * s);
    pop();
  }

  // 托盤或成績
  if (pzFinished) {
    pzDrawResult();
  } else {
    noStroke();
    fill(225, 230, 240);
    rect(pzTX, pzTY, pzTW, pzTW, 14);
    pzPieces.forEach((p, i) => {
      if (p.state !== "placed" && !(i === pzDrag && pzMoved)) pzDrawPiece(p, false);
    });
    if (pzDrag >= 0 && pzMoved) pzDrawPiece(pzPieces[pzDrag], true);
  }

  drawButton(pzBtnReset, color(120, 130, 150));

  if (pzAsk < 0) {
    if (pzDrag >= 0 && pzMoved) cursorType = "grabbing";
    else if (!pzFinished && pzPieceAt(mouseX, mouseY) >= 0) cursorType = "pointer";
  }

  if (pzAsk >= 0) pzDrawModal();
}

function pzDrawPiece(p, lifted) {
  const s = pzS;
  const ctx = drawingContext;
  push();
  translate(p.x, p.y);
  ctx.save();
  if (lifted) {
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
  }
  if (p.state === "locked") {
    ctx.fillStyle = "#9aa8c2";
    ctx.fill(p.path);
    ctx.shadowColor = "transparent";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.stroke(p.path);
    ctx.restore();
    noStroke();
    fill(255);
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    textSize(s * 0.42);
    text("?", s / 2, s / 2 + 2);
    textStyle(NORMAL);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.fill(p.path);
    ctx.shadowColor = "transparent";
    ctx.save();
    ctx.clip(p.path);
    image(pzG, -p.col * s, -p.row * s, 3 * s, 3 * s);
    ctx.restore();
    ctx.lineWidth = p.state === "placed" ? 1 : 2;
    ctx.strokeStyle = p.state === "placed" ? "rgba(255,255,255,0.45)" : "rgba(40,50,70,0.5)";
    ctx.stroke(p.path);
    ctx.restore();
  }
  pop();
}

function pzDrawResult() {
  const w = pzTW;
  const x = pzTX;
  const y = pzTY;
  noStroke();
  fill(225, 230, 240);
  rect(x, y, w, w, 14);

  textAlign(CENTER, CENTER);
  fill(40, 50, 70);
  textStyle(BOLD);
  textSize(constrain(w * 0.07, 16, 24));
  text("成績九宮格", x + w / 2, y + w * 0.07);

  const gap = 6;
  const gridTop = y + w * 0.13;
  const budget = w - w * 0.13 - 34 - 52 - 12;
  const cs = max(20, min(w * 0.2, (budget - 2 * gap) / 3));
  const gridW = 3 * cs + 2 * gap;
  const gx = x + (w - gridW) / 2;
  for (const p of pzPieces) {
    const cx = gx + p.col * (cs + gap);
    const cy = gridTop + p.row * (cs + gap);
    noStroke();
    fill(p.result === true ? color(40, 170, 90) : p.result === false ? color(230, 80, 70) : color(160, 170, 190));
    rect(cx, cy, cs, cs, 10);
    fill(255);
    textSize(cs * 0.5);
    text(p.result === true ? "✓" : p.result === false ? "✗" : "-", cx + cs / 2, cy + cs / 2 + 1);
  }

  const k = pzScore();
  fill(k === 9 ? color(30, 150, 80) : color(40, 50, 70));
  textSize(constrain(w * 0.06, 16, 22));
  text(k === 9 ? "全對！答對 9 / 9 🎉" : "答對 " + k + " / 9", x + w / 2, gridTop + gridW + 22);
  textStyle(NORMAL);

  drawButton(pzBtnAgain, color(46, 125, 230));
}

// ---------- 題目視窗 ----------
function pzOpenAsk(i) {
  pzAsk = i;
  pzPhase = 0;
  pzChoice = -1;
  const q = pzPieces[i].q;
  pzOpts = shuffle(q.opts.map((txt, k) => ({ text: txt, correct: k === q.ans })));
}

// 中文沒有空格，所以自己一個字一個字量寬度來換行
function pzWrap(str, maxW) {
  const lines = [];
  let cur = "";
  for (const ch of str) {
    if (cur !== "" && textWidth(cur + ch) > maxW) {
      lines.push(cur);
      cur = ch;
    } else {
      cur += ch;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function pzModal() {
  const small = width < 500;
  const w = min(width - 24, 520);
  const pad = small ? 14 : 20;
  const qSize = small ? 16 : 19;
  const oSize = small ? 15 : 17;
  const qlh = qSize * 1.45;
  const olh = oSize * 1.4;
  const p = pzPieces[pzAsk];

  textStyle(NORMAL);
  textSize(qSize);
  const qLines = pzWrap(p.q.q, w - 2 * pad);
  textSize(oSize);
  const optLines = pzOpts.map((o) => pzWrap(o.text, w - 2 * pad - 28));
  const optH = optLines.map((l) => max(44, l.length * olh + 16));

  let fbLines = [];
  if (pzPhase === 1) {
    const chosen = pzOpts[pzChoice];
    const right = pzOpts.find((o) => o.correct);
    const msg = chosen.correct
      ? "答對了！拼圖解鎖囉"
      : "答錯了，正確答案是「" + right.text + "」。這題不計分，拼圖一樣解鎖。";
    fbLines = pzWrap(msg, w - 2 * pad);
  }

  const titleH = 24;
  let h = pad + titleH + qLines.length * qlh + 12;
  for (const oh of optH) h += oh + 8;
  if (pzPhase === 1) h += fbLines.length * olh + 10 + 44;
  h += pad;

  const x = (width - w) / 2;
  const y = max(8, (height - h) / 2);
  let cy = y + pad + titleH + qLines.length * qlh + 12;
  const opts = optH.map((oh) => {
    const r = { x: x + pad, y: cy, w: w - 2 * pad, h: oh };
    cy += oh + 8;
    return r;
  });
  const fbY = cy + 2;
  const btn =
    pzPhase === 1
      ? { x: x + pad, y: fbY + fbLines.length * olh + 10, w: w - 2 * pad, h: 44, label: "解鎖拼圖" }
      : null;
  return { x, y, w, h, pad, qSize, oSize, qlh, olh, qLines, optLines, opts, fbLines, fbY, btn };
}

function pzDrawModal() {
  const M = pzModal();
  const p = pzPieces[pzAsk];
  noStroke();
  fill(20, 28, 45, 150);
  rect(0, 0, width, height);
  fill(255);
  rect(M.x, M.y, M.w, M.h, 16);

  textAlign(LEFT, TOP);
  fill(110, 120, 140);
  textSize(13);
  text("第 " + (p.row * 3 + p.col + 1) + " 塊拼圖：選一個答案", M.x + M.pad, M.y + M.pad);

  fill(40, 50, 70);
  textStyle(BOLD);
  textSize(M.qSize);
  const qTop = M.y + M.pad + 24;
  M.qLines.forEach((ln, i) => text(ln, M.x + M.pad, qTop + i * M.qlh));
  textStyle(NORMAL);

  textSize(M.oSize);
  M.opts.forEach((r, k) => {
    const o = pzOpts[k];
    const over = pzPhase === 0 && inRect(mouseX, mouseY, r.x, r.y, r.w, r.h);
    if (over) cursorType = "pointer";
    let bg = over ? color(230, 240, 255) : color(244, 246, 250);
    let bd = color(200, 210, 230);
    if (pzPhase === 1) {
      if (o.correct) {
        bg = color(215, 245, 225);
        bd = color(40, 170, 90);
      } else if (k === pzChoice) {
        bg = color(252, 222, 218);
        bd = color(230, 80, 70);
      }
    }
    fill(bg);
    stroke(bd);
    strokeWeight(2);
    rect(r.x, r.y, r.w, r.h, 10);
    noStroke();
    fill(40, 50, 70);
    const lines = M.optLines[k];
    const top = r.y + (r.h - lines.length * M.olh) / 2;
    lines.forEach((ln, i) => text(ln, r.x + 14, top + i * M.olh));
  });

  if (pzPhase === 1) {
    fill(pzOpts[pzChoice].correct ? color(30, 150, 80) : color(210, 80, 60));
    textSize(M.oSize);
    M.fbLines.forEach((ln, i) => text(ln, M.x + M.pad, M.fbY + i * M.olh));
    drawButton(M.btn, color(46, 125, 230));
  }
  textAlign(CENTER, CENTER);
  textStyle(NORMAL);
}

function pzModalDown() {
  const M = pzModal();
  if (pzPhase === 0) {
    for (let k = 0; k < M.opts.length; k++) {
      const r = M.opts[k];
      if (inRect(mouseX, mouseY, r.x, r.y, r.w, r.h)) {
        pzChoice = k;
        pzPieces[pzAsk].result = pzOpts[k].correct;
        pzPhase = 1;
        return;
      }
    }
    // 點視窗外面：先不答題，關掉視窗
    if (!inRect(mouseX, mouseY, M.x, M.y, M.w, M.h)) pzAsk = -1;
  } else if (inRect(mouseX, mouseY, M.btn.x, M.btn.y, M.btn.w, M.btn.h)) {
    pzPieces[pzAsk].state = "open";
    pzAsk = -1;
  }
}

// ---------- 按下、移動、放開 ----------
function puzzleDown() {
  if (pzAsk >= 0) {
    pzModalDown();
    return;
  }
  if (inRect(mouseX, mouseY, pzBtnReset.x, pzBtnReset.y, pzBtnReset.w, pzBtnReset.h)) {
    puzzleEnter();
    return;
  }
  if (pzFinished) {
    if (inRect(mouseX, mouseY, pzBtnAgain.x, pzBtnAgain.y, pzBtnAgain.w, pzBtnAgain.h)) puzzleEnter();
    return;
  }
  const i = pzPieceAt(mouseX, mouseY);
  pzPress = i;
  pzMoved = false;
  pzPX = mouseX;
  pzPY = mouseY;
  if (i >= 0 && pzPieces[i].state === "open") {
    pzDrag = i;
    pzOffX = mouseX - pzPieces[i].x;
    pzOffY = mouseY - pzPieces[i].y;
  }
}

function puzzleMove() {
  if (pzAsk >= 0 || pzDrag < 0) return;
  if (!pzMoved && dist(mouseX, mouseY, pzPX, pzPY) > 6) pzMoved = true;
  if (pzMoved) {
    pzPieces[pzDrag].x = mouseX - pzOffX;
    pzPieces[pzDrag].y = mouseY - pzOffY;
  }
}

function puzzleUp() {
  if (pzAsk >= 0) return;
  if (pzPress >= 0) {
    const p = pzPieces[pzPress];
    if (pzDrag >= 0 && pzMoved) {
      // ② 判斷二：離正確位置夠近就吸附
      const t = pzTarget(p);
      if (dist(p.x, p.y, t.x, t.y) < pzS * 0.35) {
        p.state = "placed";
        p.gx = t.x;
        p.gy = t.y;
        // ② 判斷三：每一塊都放好就完成
        if (pzPieces.every((z) => z.state === "placed")) {
          pzFinished = true;
          pzFinishAt = millis();
        }
      }
      // 沒吸附就滑回托盤（p.gx、p.gy 還是原本托盤的位置）
    } else if (p.state === "locked" && dist(mouseX, mouseY, pzPX, pzPY) <= 8) {
      pzOpenAsk(pzPress);
    }
  }
  pzDrag = -1;
  pzPress = -1;
  pzMoved = false;
}

// ---------- 內建的 3 張建築圖（600 x 600） ----------
function sceneSkyline(g) {
  g.noStroke();
  for (let y = 0; y < 600; y += 2) {
    const k = y / 600;
    g.fill(lerp(70, 255, k), lerp(70, 170, k), lerp(150, 120, k));
    g.rect(0, y, 600, 2);
  }
  g.fill(255, 225, 160, 235);
  g.circle(150, 390, 130);

  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  g.fill(105, 90, 150);
  for (let x = -20; x < 600; x += 62) {
    const h = 150 + rnd() * 170;
    g.rect(x, 600 - h, 56, h);
  }
  let x = 0;
  while (x < 600) {
    const w = 44 + rnd() * 34;
    const h = 190 + rnd() * 190;
    if (x + w > 330 && x < 470) {
      x += w;
      continue;
    }
    g.fill(34, 36, 72);
    g.rect(x, 600 - h, w, h);
    g.fill(255, 214, 110);
    for (let wy = 600 - h + 14; wy < 590; wy += 20) {
      for (let wx = x + 8; wx < x + w - 10; wx += 14) {
        if (rnd() < 0.55) g.rect(wx, wy, 6, 9);
      }
    }
    x += w + 4;
  }
  // 中間的高塔：一節一節往上疊
  for (let i = 0; i < 8; i++) {
    const y = 600 - i * 44;
    g.fill(58, 96, 128);
    g.quad(370, y, 430, y, 438, y - 40, 362, y - 40);
    g.fill(150, 200, 230);
    g.rect(374, y - 26, 52, 6);
  }
  g.fill(58, 96, 128);
  g.triangle(380, 248, 420, 248, 400, 190);
  g.rect(397, 140, 6, 60);
}

function sceneTemple(g) {
  g.noStroke();
  for (let y = 0; y < 600; y += 2) {
    const k = y / 600;
    g.fill(lerp(150, 255, k), lerp(200, 240, k), lerp(240, 210, k));
    g.rect(0, y, 600, 2);
  }
  g.fill(255, 232, 150);
  g.circle(520, 70, 70);
  g.fill(255, 255, 255, 220);
  g.ellipse(120, 90, 130, 36);
  g.ellipse(160, 80, 90, 34);
  g.ellipse(430, 150, 110, 30);

  g.fill(120, 170, 110);
  g.rect(0, 540, 600, 60);
  g.fill(235, 225, 205);
  g.rect(30, 522, 540, 18);
  g.rect(50, 506, 500, 16);
  g.rect(70, 490, 460, 16);

  for (let i = 0; i < 6; i++) {
    const cx = 120 + i * 72;
    g.fill(245, 240, 228);
    g.rect(cx - 17, 250, 34, 240);
    g.rect(cx - 24, 240, 48, 14);
    g.rect(cx - 22, 482, 44, 8);
    g.stroke(214, 204, 184);
    g.strokeWeight(2);
    for (let f = -9; f <= 9; f += 9) g.line(cx + f, 256, cx + f, 482);
    g.noStroke();
  }
  g.fill(236, 228, 210);
  g.rect(90, 205, 420, 36);
  g.fill(244, 238, 224);
  g.triangle(80, 205, 520, 205, 300, 100);
  g.fill(222, 212, 190);
  g.triangle(130, 196, 470, 196, 300, 116);
  g.fill(200, 150, 90);
  g.circle(300, 168, 28);
}

function scenePagoda(g) {
  g.noStroke();
  for (let y = 0; y < 600; y += 2) {
    const k = y / 600;
    g.fill(lerp(30, 240, k), lerp(40, 150, k), lerp(90, 130, k));
    g.rect(0, y, 600, 2);
  }
  g.fill(250, 245, 220);
  g.circle(470, 120, 80);
  g.fill(70, 60, 110);
  g.triangle(-60, 560, 140, 330, 340, 560);
  g.fill(55, 48, 95);
  g.triangle(240, 560, 470, 300, 700, 560);
  g.fill(38, 46, 58);
  g.rect(0, 540, 600, 60);

  for (let i = 0; i < 5; i++) {
    const yb = 530 - i * 88;
    const w = 300 - i * 46;
    g.fill(150, 60, 50);
    g.rect(300 - w * 0.3, yb - 52, w * 0.6, 52);
    g.fill(250, 210, 120);
    g.rect(300 - 9, yb - 40, 18, 28);
    g.fill(52, 44, 58);
    g.quad(300 - w / 2, yb - 52, 300 + w / 2, yb - 52, 300 + w / 2 - 30, yb - 84, 300 - w / 2 + 30, yb - 84);
    g.rect(300 - w / 2 - 8, yb - 56, w + 16, 6);
  }
  g.fill(52, 44, 58);
  g.rect(297, 20, 6, 70);
  g.fill(120, 100, 90);
  g.rect(230, 530, 140, 10);
  g.rect(215, 540, 170, 10);
}

// ==================================================================
// 模式 3：多媒體測驗
// ==================================================================

// ① 用 type 決定題型（換題目只改這個陣列）
//   anim  看內建動畫：anim = sunny / cloudy / rainy / snowy / thunder / windy
//   sound 聽內建合成聲音：sound = rain / wind / thunder / birds
//   image 看自己的圖片或 GIF：src
//   audio 聽自己的音檔：src
//   video 看自己的影片：src
// answer 必須和 options 裡的某一項完全相同；explain 是答完後顯示的一句解說
const QUESTIONS = [
  { type: "anim", anim: "snowy", q: "動畫裡是什麼天氣？",
    options: ["下雪", "下雨", "晴天", "多雲"], answer: "下雪",
    explain: "白色的雪花慢慢飄下來，這是下雪。" },
  { type: "sound", sound: "rain", q: "這是什麼天氣的聲音？",
    options: ["下雨", "打雷", "有風", "下雪"], answer: "下雨",
    explain: "沙沙的連續聲，加上滴答的水滴聲，是下雨。" },
  { type: "anim", anim: "sunny", q: "動畫裡是什麼天氣？",
    options: ["晴天", "多雲", "打雷", "下雪"], answer: "晴天",
    explain: "天空沒有雲，太陽發出光芒，是晴天。" },
  { type: "sound", sound: "thunder", q: "這是什麼天氣的聲音？",
    options: ["打雷", "下雨", "有風", "鳥叫"], answer: "打雷",
    explain: "低沉、先大聲再慢慢變小的轟隆聲，是雷聲。" },
  { type: "anim", anim: "windy", q: "動畫裡的線條和樹葉不停飄動，是什麼天氣？",
    options: ["有風", "打雷", "下雪", "晴天"], answer: "有風",
    explain: "被吹動的線條和樹葉，表示正在颳風。" },
  { type: "sound", sound: "birds", q: "清脆的鳥叫聲，比較常出現在什麼時候？",
    options: ["天氣晴朗的早晨", "雷雨交加的夜晚", "下大雪的時候", "颱風來的時候"],
    answer: "天氣晴朗的早晨",
    explain: "天氣穩定、環境安靜時，鳥比較常出來鳴叫。" },
  { type: "anim", anim: "thunder", q: "畫面中出現閃電，這是什麼天氣？",
    options: ["打雷", "下雪", "多雲", "晴天"], answer: "打雷",
    explain: "烏雲裡出現閃電，就是打雷的天氣。" },
  { type: "sound", sound: "wind", q: "這是什麼天氣的聲音？",
    options: ["有風", "下雨", "打雷", "鳥叫"], answer: "有風",
    explain: "呼～呼～忽大忽小的聲音，是風聲。" },
  { type: "anim", anim: "rainy", q: "烏雲下面落下來的是什麼？",
    options: ["雨滴", "雪花", "冰雹", "樹葉"], answer: "雨滴",
    explain: "藍色的細長線條是一滴一滴的雨。" },
  { type: "anim", anim: "cloudy", q: "雲慢慢飄過去，天空被很多雲遮住，是什麼天氣？",
    options: ["多雲", "晴天", "下雪", "打雷"], answer: "多雲",
    explain: "雲很多、看不到太陽，就是多雲。" },

  // 你自己的素材範例：檔案放進專案資料夾，把前面的 // 拿掉，路徑改成你的檔名
  // { type: "image", src: "images/taipei101.jpg", q: "這是哪一棟建築？",
  //   options: ["台北 101", "艾菲爾鐵塔", "雪梨歌劇院"], answer: "台北 101", explain: "……" },
  // { type: "audio", src: "sounds/rain.mp3", q: "這是什麼聲音？", options: ["…", "…"], answer: "…", explain: "……" },
  // { type: "video", src: "videos/clip.mp4", q: "影片裡發生什麼事？", options: ["…", "…"], answer: "…", explain: "……" },
];

// 交通安全題組：共 9 題，每題一個動畫（anim 對應下面 QZ_ANIMS 的名稱）
const TRAFFIC_QUESTIONS = [
  { type: "anim", anim: "ped_red", q: "行人號誌是紅燈，應該怎麼做？",
    options: ["在路邊停下來等待", "趕快跑過去", "慢慢走過去", "看沒有車就走"], answer: "在路邊停下來等待",
    explain: "紅燈代表禁止通行，要站在安全的地方等到綠燈再走。" },
  { type: "anim", anim: "ped_blink", q: "行人號誌的綠燈開始閃爍，表示什麼？",
    options: ["時間快結束，不要開始過馬路", "可以加快速度開始過馬路", "綠燈壞掉了", "車子都停下來了"], answer: "時間快結束，不要開始過馬路",
    explain: "閃爍表示通行時間快用完，還沒出發的人要在路邊等下一次綠燈。" },
  { type: "anim", anim: "zebra", q: "過馬路時，應該走哪裡最安全？",
    options: ["斑馬線", "車子與車子中間的縫隙", "護欄的缺口", "哪裡都可以"], answer: "斑馬線",
    explain: "斑馬線是專門給行人通行的地方，駕駛看到行人會減速停讓。" },
  { type: "anim", anim: "look", q: "過馬路之前，要先做什麼？",
    options: ["停、看、聽，確認沒有來車", "馬上衝過去", "低頭看手機", "閉上眼睛跑"], answer: "停、看、聽，確認沒有來車",
    explain: "先停下來，左右看、仔細聽，確定沒有車靠近才可以走。" },
  { type: "anim", anim: "helmet", q: "騎腳踏車或機車時，戴什麼最能保護頭部？",
    options: ["安全帽", "太陽眼鏡", "圍巾", "耳機"], answer: "安全帽",
    explain: "安全帽可以保護頭部，跌倒或碰撞時能減輕受傷的程度。" },
  { type: "anim", anim: "seatbelt", q: "坐在汽車裡，要怎麼做才安全？",
    options: ["繫好安全帶", "把頭伸出窗外", "站在座位上", "解開安全帶睡覺"], answer: "繫好安全帶",
    explain: "緊急煞車或碰撞時，安全帶會把人固定在座位上，前座後座都要繫。" },
  { type: "anim", anim: "night", q: "晚上走在路上，穿什麼比較容易被駕駛看到？",
    options: ["亮色或有反光條的衣服", "全黑的衣服", "深藍色的衣服", "深灰色的衣服"], answer: "亮色或有反光條的衣服",
    explain: "車燈照到反光條會發亮，駕駛可以更早看到你。" },
  { type: "anim", anim: "phone", q: "走在路上，為什麼不能邊走邊滑手機？",
    options: ["會看不到來車，很危險", "手機會比較快沒電", "手機螢幕會刮傷", "走路會變慢"], answer: "會看不到來車，很危險",
    explain: "低頭看手機會分心，沒注意到車子或障礙物，很容易發生意外。" },
  { type: "anim", anim: "ball", q: "球滾到馬路上，應該怎麼做？",
    options: ["先停下來，請大人幫忙", "馬上衝出去撿", "叫朋友幫你去撿", "在馬路上繼續玩"], answer: "先停下來，請大人幫忙",
    explain: "追球時很容易沒注意到來車，不要自己衝進馬路，先停下來求助。" },
];

const QZ_ANIMS = {
  sunny: drawSunny,
  cloudy: drawCloudy,
  rainy: drawRainy,
  snowy: drawSnowy,
  thunder: drawThunder,
  windy: drawWindy,
  fog: drawFoggy,
  ped_red: drawPedRed,
  ped_blink: drawPedBlink,
  zebra: drawZebra,
  look: drawLookBoth,
  helmet: drawHelmet,
  seatbelt: drawSeatbelt,
  night: drawNightWalk,
  phone: drawPhoneWalk,
  ball: drawBallRoad,
};

// 題組：首頁可以切換。previewKeys 是首頁預覽輪播的動畫
const QZ_TOPICS = [
  { name: "天氣", title: "天氣多媒體測驗", sub: "看動畫、聽聲音", questions: QUESTIONS,
    previewKeys: ["sunny", "cloudy", "rainy", "snowy", "thunder", "windy", "fog"] },
  { name: "交通安全", title: "交通安全測驗", sub: "看動畫，學交通安全", questions: TRAFFIC_QUESTIONS,
    previewKeys: ["ped_red", "zebra", "look", "helmet", "seatbelt", "night", "phone", "ball"] },
];

let qzTopic = 0;      // 目前選的題組
let qzTabs = [];      // 首頁的題組切換按鈕

function qzQs() { return QZ_TOPICS[qzTopic].questions; }
function qzAllQs() { return QZ_TOPICS.flatMap((tp) => tp.questions); }

// ② 一個變數管理三個畫面：start → quiz → result
let qzScreen = "start";

let qzList = [];      // 這局的題目：{ q: 原題目, opts: 洗過牌的選項 }
let qzIdx = 0;        // 第幾題
let qzPicked = -1;    // 選了第幾個選項（-1 表示還沒答）
let qzResults = [];   // 每題對或錯
let qzScoreN = 0;
let qzResultAt = 0;
let qzL = {};         // 版面
let qzPress = "";     // 按下去的目標，放開時目標相同才算點擊

let qzSynth = null;   // 正在播放的合成聲音
let qzFFT = null;     // p5.FFT 頻譜分析

function qzHasSound() {
  return typeof p5 !== "undefined" && typeof p5.Noise === "function";
}

function qzUnlockAudio() {
  if (typeof userStartAudio === "function") userStartAudio();
}

function qzEnter() {
  qzScreen = "start";
  qzList = [];
  qzIdx = 0;
  qzPicked = -1;
  qzResults = [];
  qzScoreN = 0;
  qzPress = "";
  // 載入自己的素材（只載入一次）
  for (const q of qzAllQs()) {
    if (!q.src) continue;
    if (q.type === "image" && !q.img && !q.imgTried) {
      q.imgTried = true;
      loadImage(q.src, (im) => { q.img = im; }, () => { q.err = true; });
    }
    if (q.type === "audio" && !q.snd && !q.sndTried && typeof loadSound === "function") {
      q.sndTried = true;
      loadSound(q.src, (sf) => { q.snd = sf; }, () => { q.err = true; });
    }
    if (q.type === "video" && !q.vid) {
      q.vid = createVideo([q.src]);
      q.vid.hide();
      q.vid.elt.onerror = () => { q.err = true; };
    }
  }
  qzLayout();
}

function qzLeave() {
  qzStopSound();
  for (const q of qzAllQs()) {
    if (q.vid) {
      q.vid.remove();
      q.vid = null;
    }
  }
}

function qzStart() {
  qzUnlockAudio();
  qzList = shuffle(qzQs()).map((q) => ({ q, opts: shuffle(q.options) }));
  qzIdx = 0;
  qzPicked = -1;
  qzResults = [];
  qzScoreN = 0;
  qzScreen = "quiz";
  qzLayout();
  qzPlayMedia();
}

function qzAnswer(k) {
  if (qzPicked >= 0) return;
  const item = qzList[qzIdx];
  qzPicked = k;
  const ok = item.opts[k] === item.q.answer;
  qzResults[qzIdx] = ok;
  if (ok) qzScoreN++;
}

function qzNext() {
  if (qzPicked < 0) return;
  qzStopSound();
  if (qzIdx + 1 >= qzList.length) {
    qzScreen = "result";
    qzResultAt = millis();
  } else {
    qzIdx++;
    qzPicked = -1;
    qzLayout();
    qzPlayMedia();
    return;
  }
  qzLayout();
}

// 聲音題與影片題：進到題目時自動播放一次，點畫面可再播
function qzPlayMedia() {
  qzStopSound();
  const q = qzList[qzIdx].q;
  try {
    if (q.type === "sound") qzPlaySynth(q.sound);
    else if (q.type === "audio" && q.snd) {
      q.snd.stop();
      q.snd.play();
    } else if (q.type === "video" && q.vid) {
      q.vid.time(0);
      q.vid.play();
    }
  } catch (e) {
    console.warn(e);
  }
}

// ---------- ③ 聲音是即時合成的 ----------
function qzStopSound() {
  if (qzSynth) {
    const s = qzSynth;
    qzSynth = null;
    for (const nd of s.nodes) {
      try { if (nd.amp) nd.amp(0, 0.05); } catch (e) {}
    }
    setTimeout(() => {
      for (const nd of s.nodes) {
        try {
          if (nd.stop) nd.stop();
          if (nd.dispose) nd.dispose();
        } catch (e) {}
      }
    }, 90);
  }
  for (const q of qzAllQs()) {
    if (q.snd) { try { q.snd.stop(); } catch (e) {} }
    if (q.vid) { try { q.vid.pause(); } catch (e) {} }
  }
}

function qzPlaySynth(kind) {
  qzStopSound();
  if (!qzHasSound()) return;
  qzUnlockAudio();
  const s = { kind, t0: millis(), dur: 4200, nodes: [], events: [], tick: null };
  try {
    if (kind === "rain") {
      // 雨聲：白噪音 → 帶通濾波器（沙沙聲）＋ 隨機的「滴答」短音
      const n = new p5.Noise("white");
      const f = new p5.BandPass();
      n.disconnect();
      f.process(n, 3500, 0.6);
      n.amp(0);
      n.start();
      n.amp(0.35, 0.3);
      const o = new p5.Oscillator("sine");
      const env = new p5.Envelope();
      env.setADSR(0.002, 0.04, 0, 0.03);
      env.setRange(0.2, 0);
      o.amp(env);
      o.start();
      s.nodes.push(n, f, o, env);
      for (let at = 150; at < s.dur - 200; at += random(70, 170)) {
        s.events.push({ at, fn: () => { o.freq(random(1800, 3800)); env.play(); } });
      }
    } else if (kind === "wind") {
      // 風聲：粉紅噪音 → 濾波頻率慢慢起伏（呼～呼～）
      const n = new p5.Noise("pink");
      const f = new p5.BandPass();
      n.disconnect();
      f.process(n, 700, 1.5);
      n.amp(0);
      n.start();
      s.nodes.push(n, f);
      s.tick = (el) => {
        const k = el / 1000;
        f.freq(650 + 350 * sin(k * 1.7) + 120 * sin(k * 4.1));
        const swell = 0.35 + 0.4 * (0.5 + 0.5 * sin(k * 1.4 - 1));
        const fade = constrain(min(el / 400, (s.dur - el) / 400), 0, 1);
        n.amp(swell * fade, 0.1);
      };
    } else if (kind === "thunder") {
      // 雷聲：布朗噪音（低沉）→ 先大聲、再慢慢變小
      const n = new p5.Noise("brown");
      const f = new p5.LowPass();
      n.disconnect();
      f.process(n, 350, 1);
      n.amp(0);
      n.start();
      s.nodes.push(n, f);
      s.events.push({ at: 100, fn: () => { f.freq(420); n.amp(0.8, 0.05); } });
      s.events.push({ at: 260, fn: () => n.amp(0, 2.4) });
      s.events.push({ at: 2400, fn: () => n.amp(0.6, 0.08) });
      s.events.push({ at: 2560, fn: () => n.amp(0, 1.5) });
    } else if (kind === "birds") {
      // 鳥叫：很短、往上滑的高音，一串一串出現
      const o = new p5.Oscillator("sine");
      const env = new p5.Envelope();
      env.setADSR(0.01, 0.06, 0, 0.03);
      env.setRange(0.25, 0);
      o.amp(env);
      o.start();
      s.nodes.push(o, env);
      let at = 250;
      while (at < s.dur - 500) {
        const cnt = floor(random(2, 5));
        const base = random(2300, 3500);
        for (let j = 0; j < cnt; j++) {
          const b = base * (1 + j * 0.05);
          s.events.push({ at: at + j * 150, fn: () => { o.freq(b); o.freq(b * 1.7, 0.09); env.play(); } });
        }
        at += cnt * 150 + random(500, 1000);
      }
    }
    qzSynth = s;
  } catch (e) {
    console.warn("聲音合成失敗：", e);
    for (const nd of s.nodes) {
      try { if (nd.stop) nd.stop(); } catch (e2) {}
    }
  }
}

function qzSynthUpdate() {
  const s = qzSynth;
  if (!s) return;
  const el = millis() - s.t0;
  while (s.events.length && s.events[0].at <= el) {
    const e = s.events.shift();
    try { e.fn(); } catch (err) {}
  }
  if (s.tick) {
    try { s.tick(el); } catch (err) {}
  }
  if (el > s.dur) qzStopSound();
}

// ---------- 版面 ----------
function qzLayout() {
  const m = 12;
  const small = width < 560;
  qzL = {};
  textFont(FONT);

  if (qzScreen === "start") {
    const sw = small ? 180 : 220;
    const sh = small ? 50 : 58;
    const ph = small ? 30 : 34;
    const cw = constrain(min(width - 40, 360, ((height - 290) * 220) / 150), 130, 360);
    const ch = (cw * 150) / 220;
    const total = 50 + ph + 14 + ch + 14 + 22 + 16 + sh + 16 + 18;
    const top = max(44, (height - total) / 2);
    qzL.titleY = top + 22;

    // 題組切換按鈕
    const pw = small ? 88 : 104;
    const tabsW = QZ_TOPICS.length * pw + (QZ_TOPICS.length - 1) * 8;
    qzTabs = QZ_TOPICS.map((tp, i) => ({
      x: (width - tabsW) / 2 + i * (pw + 8),
      y: top + 50,
      w: pw,
      h: ph,
      label: tp.name,
    }));

    qzL.card = { x: (width - cw) / 2, y: top + 50 + ph + 14, w: cw, h: ch };
    qzL.subY = qzL.card.y + ch + 22;
    qzL.startBtn = { x: width / 2 - sw / 2, y: qzL.subY + 22, w: sw, h: sh, label: "開始測驗" };
    qzL.hintY = qzL.startBtn.y + sh + 22;
  } else if (qzScreen === "quiz" && qzList.length > 0) {
    const item = qzList[qzIdx];
    const q = item.q;
    const n = item.opts.length;
    const cols = width >= 600 ? 2 : 1;
    const rows = ceil(n / cols);
    const bh = small ? 50 : 62;
    const gap = 10;
    const optsH = rows * bh + (rows - 1) * gap;
    const nextW = small ? 96 : 120;
    const nextH = 44;
    const fbH = small ? 76 : 64;
    const fbY = height - m - fbH;
    qzL.next = {
      x: width - m - nextW, y: fbY + (fbH - nextH) / 2, w: nextW, h: nextH,
      label: qzIdx + 1 >= qzList.length ? "看成績" : "下一題",
    };
    qzL.fb = { x: m, y: fbY, w: width - 2 * m - nextW - 12, h: fbH };

    const optsY = fbY - 10 - optsH;
    const ow = (min(width - 2 * m, 760) - gap * (cols - 1)) / cols;
    const ox0 = (width - (cols * ow + (cols - 1) * gap)) / 2;
    qzL.opts = item.opts.map((_, i) => ({
      x: ox0 + (i % cols) * (ow + gap),
      y: optsY + floor(i / cols) * (bh + gap),
      w: ow,
      h: bh,
    }));

    const qSize = small ? 18 : 22;
    textStyle(BOLD);
    textSize(qSize);
    qzL.qLines = pzWrap(q.q, min(width - 2 * m, 760));
    textStyle(NORMAL);
    qzL.qSize = qSize;
    qzL.qlh = qSize * 1.35;
    const qH = qzL.qLines.length * qzL.qlh;
    qzL.qY = optsY - 10 - qH;

    const topY = 70;
    const availH = qzL.qY - 10 - topY;
    const mw = min(width - 2 * m, 560, (max(100, availH) * 220) / 150);
    const mh = (mw * 150) / 220;
    qzL.media = { x: (width - mw) / 2, y: topY + max(0, (availH - mh) / 2), w: mw, h: mh };
  } else {
    const btnH = small ? 46 : 50;
    const btnW = small ? 130 : 150;
    qzL.again = { x: width / 2 - btnW - 8, y: height - m - btnH, w: btnW, h: btnH, label: "再測一次" };
    qzL.home = { x: width / 2 + 8, y: height - m - btnH, w: btnW, h: btnH, label: "測驗首頁" };
  }
}

// 每一幀依 screen 畫對應的畫面
function qzDraw(t) {
  qzSynthUpdate();
  if (qzScreen === "start") qzDrawStart(t);
  else if (qzScreen === "quiz") qzDrawQuiz(t);
  else qzDrawResult();
}

function qzDrawStart(t) {
  const L = qzL;
  noStroke();
  fill(40, 50, 70);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(width < 500 ? 26 : 34);
  text(QZ_TOPICS[qzTopic].title, width / 2, L.titleY);
  textStyle(NORMAL);

  // 題組切換
  qzTabs.forEach((b, i) => {
    const on = i === qzTopic;
    const over = inRect(mouseX, mouseY, b.x, b.y, b.w, b.h);
    if (over) cursorType = "pointer";
    noStroke();
    fill(on ? color(46, 125, 230) : over ? color(230, 240, 255) : color(255));
    rect(b.x, b.y, b.w, b.h, b.h / 2);
    if (!on) {
      noFill();
      stroke(200, 210, 230);
      strokeWeight(2);
      rect(b.x, b.y, b.w, b.h, b.h / 2);
      noStroke();
    }
    fill(on ? 255 : color(60, 70, 90));
    textSize(b.h * 0.47);
    textStyle(BOLD);
    text(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
    textStyle(NORMAL);
  });

  // 預覽：輪流播放這個題組的動畫
  const c = L.card;
  noStroke();
  fill(0, 0, 0, 22);
  rect(c.x + 3, c.y + 5, c.w, c.h, 14);
  push();
  drawingContext.save();
  qzClipRound(c.x, c.y, c.w, c.h, 14);
  translate(c.x, c.y);
  scale(c.w / 220, c.h / 150);
  const keys = QZ_TOPICS[qzTopic].previewKeys;
  QZ_ANIMS[keys[floor(t / 2.5) % keys.length]](t);
  drawingContext.restore();
  pop();

  noStroke();
  fill(110, 120, 140);
  textSize(width < 500 ? 14 : 16);
  text("共 " + qzQs().length + " 題，" + QZ_TOPICS[qzTopic].sub, width / 2, L.subY);
  drawButton(L.startBtn, color(46, 125, 230));
  textSize(width < 500 ? 12 : 13);
  fill(150, 160, 180);
  text("鍵盤：1～4 選答案，Enter 下一題", width / 2, L.hintY);
}

function qzClipRound(x, y, w, h, r) {
  const ctx = drawingContext;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  ctx.clip();
}

function qzDrawQuiz(t) {
  const L = qzL;
  const item = qzList[qzIdx];
  const q = item.q;
  const n = qzList.length;
  const small = width < 560;

  // 進度
  noStroke();
  fill(40, 50, 70);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(16);
  text("第 " + (qzIdx + 1) + " / " + n + " 題", width / 2, 26);
  textAlign(RIGHT, CENTER);
  fill(46, 125, 230);
  text("得分 " + qzScoreN, width - 14, 26);
  textAlign(CENTER, CENTER);
  textStyle(NORMAL);
  const barX = 12, barW = width - 24;
  fill(225, 230, 240);
  rect(barX, 50, barW, 8, 4);
  fill(46, 125, 230);
  rect(barX, 50, (barW * (qzIdx + (qzPicked >= 0 ? 1 : 0))) / n, 8, 4);

  // 題目上方：動畫、聲音、圖片或影片
  qzDrawMedia(q, t);
  if (["sound", "audio", "video"].includes(q.type) && inRect(mouseX, mouseY, L.media.x, L.media.y, L.media.w, L.media.h)) {
    cursorType = "pointer";
  }

  // 題目文字
  noStroke();
  fill(40, 50, 70);
  textStyle(BOLD);
  textSize(L.qSize);
  L.qLines.forEach((ln, i) => text(ln, width / 2, L.qY + L.qlh * (i + 0.5)));
  textStyle(NORMAL);

  // 大按鈕選項
  item.opts.forEach((opt, i) => {
    const r = L.opts[i];
    const over = qzPicked < 0 && inRect(mouseX, mouseY, r.x, r.y, r.w, r.h);
    if (over) cursorType = "pointer";
    const isAnswer = opt === q.answer;
    let bg = over ? color(230, 240, 255) : color(255);
    let bd = over ? color(46, 125, 230) : color(205, 213, 230);
    let tc = color(40, 50, 70);
    let badge = color(46, 125, 230);
    if (qzPicked >= 0) {
      if (isAnswer) {
        bg = color(40, 170, 90);
        bd = color(40, 170, 90);
        tc = color(255);
        badge = color(30, 130, 70);
      } else if (i === qzPicked) {
        bg = color(230, 80, 70);
        bd = color(230, 80, 70);
        tc = color(255);
        badge = color(180, 55, 48);
      } else {
        bg = color(240, 243, 248);
        bd = color(225, 230, 240);
        tc = color(160, 170, 190);
        badge = color(190, 198, 212);
      }
    }
    stroke(bd);
    strokeWeight(2);
    fill(bg);
    rect(r.x, r.y, r.w, r.h, 14);
    noStroke();
    fill(badge);
    circle(r.x + 26, r.y + r.h / 2, min(30, r.h * 0.6));
    fill(255);
    textStyle(BOLD);
    textSize(min(30, r.h * 0.6) * 0.55);
    text(i + 1, r.x + 26, r.y + r.h / 2 + 1);
    fill(tc);
    let sz = constrain(r.h * 0.36, 15, 22);
    textSize(sz);
    while (textWidth(opt) > r.w - 72 && sz > 11) {
      sz--;
      textSize(sz);
    }
    textAlign(LEFT, CENTER);
    text(opt, r.x + 50, r.y + r.h / 2 + 1);
    textAlign(CENTER, CENTER);
    textStyle(NORMAL);
  });

  // 對錯與解說，再按「下一題」
  if (qzPicked >= 0) {
    const ok = qzResults[qzIdx];
    const f = L.fb;
    noStroke();
    textAlign(LEFT, TOP);
    textStyle(BOLD);
    textSize(small ? 15 : 17);
    fill(ok ? color(30, 150, 80) : color(210, 80, 60));
    text(ok ? "✓ 答對了！" : "✗ 答錯了，答案是「" + q.answer + "」", f.x, f.y + 2);
    textStyle(NORMAL);
    textSize(small ? 13 : 14);
    fill(90, 100, 120);
    const lh = (small ? 13 : 14) * 1.35;
    const lines = pzWrap(q.explain || "", f.w).slice(0, small ? 3 : 2);
    lines.forEach((ln, i) => text(ln, f.x, f.y + 26 + i * lh));
    textAlign(CENTER, CENTER);
    drawButton(L.next, color(46, 125, 230));
  }
}

function qzDrawMedia(q, t) {
  const M = qzL.media;
  const ctx = drawingContext;
  noStroke();
  fill(0, 0, 0, 22);
  rect(M.x + 3, M.y + 5, M.w, M.h, 14);

  push();
  ctx.save();
  qzClipRound(M.x, M.y, M.w, M.h, 14);
  if (q.type === "anim") {
    translate(M.x, M.y);
    scale(M.w / 220, M.h / 150);
    const f = QZ_ANIMS[q.anim];
    if (f) f(t);
  } else if (q.type === "image" || q.type === "video") {
    noStroke();
    fill(24, 28, 40);
    rect(M.x, M.y, M.w, M.h);
    const im = q.type === "image" ? q.img : q.vid;
    if (im && !q.err) {
      const iw = q.type === "image" ? im.width : im.elt.videoWidth || 16;
      const ih = q.type === "image" ? im.height : im.elt.videoHeight || 9;
      const sc = min(M.w / iw, M.h / ih);
      image(im, M.x + (M.w - iw * sc) / 2, M.y + (M.h - ih * sc) / 2, iw * sc, ih * sc);
    } else {
      fill(200, 208, 225);
      textAlign(CENTER, CENTER);
      textSize(15);
      text(q.err ? "找不到檔案：" + q.src : "載入中…", M.x + M.w / 2, M.y + M.h / 2);
    }
  } else {
    qzDrawSoundPanel(q, M);
  }
  ctx.restore();
  pop();

  noFill();
  stroke(255);
  strokeWeight(3);
  rect(M.x, M.y, M.w, M.h, 14);
  noStroke();
}

// 聲音題的畫面：p5.FFT 分析出來的頻譜長條
function qzDrawSoundPanel(q, M) {
  noStroke();
  fill(28, 36, 64);
  rect(M.x, M.y, M.w, M.h);
  textAlign(CENTER, CENTER);

  if (!qzHasSound()) {
    fill(220, 226, 240);
    textSize(14);
    text("需要在 index.html 載入 p5.sound.min.js", M.x + M.w / 2, M.y + M.h / 2);
    return;
  }
  if (!qzFFT) qzFFT = new p5.FFT(0.8, 64);
  const spec = qzFFT.analyze();
  const nb = 32;
  const padX = M.w * 0.08;
  const bw = (M.w - 2 * padX) / nb;
  const baseY = M.y + M.h * 0.8;
  for (let i = 0; i < nb; i++) {
    const v = spec[i * 2] || 0;
    const h = map(v, 0, 255, 4, M.h * 0.55);
    fill(lerp(90, 80, i / nb), lerp(160, 230, i / nb), 255);
    rect(M.x + padX + i * bw + bw * 0.15, baseY - h, bw * 0.7, h, 3);
  }
  const playing = q.type === "sound" ? qzSynth !== null : q.snd && q.snd.isPlaying();
  fill(235, 240, 255);
  textSize(M.h * 0.13);
  text("🎧 聽聲音", M.x + M.w / 2, M.y + M.h * 0.17);
  fill(170, 185, 220);
  textSize(M.h * 0.07);
  text(playing ? "播放中…" : "點一下畫面再聽一次", M.x + M.w / 2, M.y + M.h * 0.9);
}

function qzStar(cx, cy, r, on) {
  noStroke();
  fill(on ? color(255, 196, 0) : color(215, 220, 230));
  beginShape();
  for (let i = 0; i < 10; i++) {
    const a = -HALF_PI + (i * PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    vertex(cx + cos(a) * rr, cy + sin(a) * rr);
  }
  endShape(CLOSE);
}

function qzDrawResult() {
  const L = qzL;
  const n = qzList.length;
  const small = width < 560;
  const ratio = n > 0 ? qzScoreN / n : 0;
  const el = millis() - qzResultAt;

  noStroke();
  fill(40, 50, 70);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(width < 500 ? 22 : 28);
  text("測驗結果", width / 2, 28);

  // 星星：答對的比例越高，亮的星星越多
  const filled = round(ratio * 5);
  const r = small ? 20 : 26;
  const starY = 52 + r + 10;
  for (let i = 0; i < 5; i++) {
    const k = constrain((el - i * 180) / 250, 0, 1);
    if (k > 0) qzStar(width / 2 + (i - 2) * r * 2.5, starY, r * k, i < filled);
  }

  // 分數與一句話
  const scoreY = starY + r + 36;
  fill(46, 125, 230);
  textSize(small ? 34 : 42);
  text(qzScoreN + " / " + n, width / 2, scoreY);
  textStyle(NORMAL);
  fill(110, 120, 140);
  textSize(small ? 14 : 16);
  const msg =
    ratio === 1 ? "全對！太厲害了" : ratio >= 0.8 ? "很棒，繼續保持" : ratio >= 0.6 ? "不錯喔，再練習一下" : "別灰心，再試一次吧";
  text(msg, width / 2, scoreY + 34);

  // 每題的對錯
  const cols = min(5, n);
  const rows = ceil(n / cols);
  const gap = 8;
  const gridTop = scoreY + 62;
  const availH = L.again.y - 14 - gridTop;
  const cs = max(24, min(76, (min(width - 24, 520) - gap * (cols - 1)) / cols, (availH - gap * (rows - 1)) / rows));
  const gw = cols * cs + (cols - 1) * gap;
  const gx = (width - gw) / 2;
  for (let i = 0; i < n; i++) {
    const cx = gx + (i % cols) * (cs + gap);
    const cy = gridTop + floor(i / cols) * (cs + gap);
    const ok = qzResults[i];
    noStroke();
    fill(ok ? color(40, 170, 90) : color(230, 80, 70));
    rect(cx, cy, cs, cs, 10);
    fill(255, 255, 255, 200);
    textSize(cs * 0.22);
    text(i + 1, cx + cs * 0.2, cy + cs * 0.2);
    fill(255);
    textStyle(BOLD);
    textSize(cs * 0.5);
    text(ok ? "✓" : "✗", cx + cs / 2, cy + cs * 0.58);
    textStyle(NORMAL);
  }

  drawButton(L.again, color(46, 125, 230));
  drawButton(L.home, color(120, 130, 150));
}

// ---------- 按下、放開、鍵盤 ----------
function qzTarget() {
  const L = qzL;
  if (qzScreen === "start") {
    for (let i = 0; i < qzTabs.length; i++) {
      const b = qzTabs[i];
      if (inRect(mouseX, mouseY, b.x, b.y, b.w, b.h)) return "tab" + i;
    }
    return inRect(mouseX, mouseY, L.startBtn.x, L.startBtn.y, L.startBtn.w, L.startBtn.h) ? "start" : "";
  }
  if (qzScreen === "quiz") {
    const q = qzList[qzIdx].q;
    if (qzPicked >= 0) {
      if (inRect(mouseX, mouseY, L.next.x, L.next.y, L.next.w, L.next.h)) return "next";
    } else {
      for (let i = 0; i < L.opts.length; i++) {
        const r = L.opts[i];
        if (inRect(mouseX, mouseY, r.x, r.y, r.w, r.h)) return "opt" + i;
      }
    }
    if (["sound", "audio", "video"].includes(q.type) && inRect(mouseX, mouseY, L.media.x, L.media.y, L.media.w, L.media.h)) {
      return "media";
    }
    return "";
  }
  if (inRect(mouseX, mouseY, L.again.x, L.again.y, L.again.w, L.again.h)) return "again";
  if (inRect(mouseX, mouseY, L.home.x, L.home.y, L.home.w, L.home.h)) return "home";
  return "";
}

function qzDown() {
  qzPress = qzTarget();
}

function qzUp() {
  const tg = qzTarget();
  const press = qzPress;
  qzPress = "";
  if (tg === "" || tg !== press) return;
  if (tg === "start" || tg === "again") qzStart();
  else if (tg.startsWith("tab")) qzTopic = int(tg.slice(3));
  else if (tg === "home") {
    qzStopSound();
    qzScreen = "start";
    qzLayout();
  } else if (tg === "next") qzNext();
  else if (tg === "media") {
    qzUnlockAudio();
    qzPlayMedia();
  } else if (tg.startsWith("opt")) qzAnswer(int(tg.slice(3)));
}

function qzKey() {
  if (qzScreen === "start" || qzScreen === "result") {
    if (keyCode === ENTER) {
      qzStart();
      return true;
    }
    return false;
  }
  if (/^[1-4]$/.test(key)) {
    const k = int(key) - 1;
    if (k < qzList[qzIdx].opts.length) qzAnswer(k);
    return true;
  }
  if (keyCode === ENTER) {
    qzNext();
    return true;
  }
  return false;
}

// ==================================================================
// 模式 1：動態連連看
// ==================================================================

// ① 題目放在最上面：換題目只改這個陣列
// name：標籤上的名稱，也是正確答案
// gif ：留空就用程式畫的動畫；填入網址就改用網路 GIF
// anim：內建動畫的函式名稱
const WEATHER_ITEMS = [
  { name: "晴天", en: "Sunny",   gif: "", anim: drawSunny  },
  { name: "多雲", en: "Cloudy",  gif: "", anim: drawCloudy },
  { name: "下雨", en: "Rainy",   gif: "", anim: drawRainy  },
  { name: "下雪", en: "Snowy",   gif: "", anim: drawSnowy  },
  { name: "打雷", en: "Thunder", gif: "", anim: drawThunder },
  { name: "有風", en: "Windy",   gif: "", anim: drawWindy  },
  { name: "起霧", en: "Foggy",   gif: "", anim: drawFoggy  },
];

const FRUIT_ITEMS = [
  { name: "蘋果", en: "Apple",      gif: "", anim: drawApple      },
  { name: "香蕉", en: "Banana",     gif: "", anim: drawBanana     },
  { name: "西瓜", en: "Watermelon", gif: "", anim: drawWatermelon },
  { name: "橘子", en: "Orange",     gif: "", anim: drawOrange     },
  { name: "草莓", en: "Strawberry", gif: "", anim: drawStrawberry },
  { name: "葡萄", en: "Grape",      gif: "", anim: drawGrape      },
];

// 主題：每一局從 items 裡隨機挑 pick 個出題（天氣有 7 種，每局挑 6 種）
const TOPICS = [
  { name: "天氣", title: "天氣動態連連看", items: WEATHER_ITEMS, pick: 6 },
  { name: "水果", title: "水果動態連連看", items: FRUIT_ITEMS, pick: 6 },
];

let matchTopic = 0;   // 目前的主題
let ITEMS = [];       // 這一局實際出的題目（由 matchNewGame 決定）
let matchTabs = [];   // 主題切換按鈕

// 用變數記住狀態
let slots = [];     // 每一格：{ x, y, item }
let tags = [];      // 每個標籤：{ name, x, y, hx, hy, slot }
let place = [];     // place[格子編號] = 標籤編號（-1 表示空的）

let dragging = -1;  // 按下去的標籤
let moved = false;  // 是否已經算「拖曳」
let offX = 0, offY = 0, pressX = 0, pressY = 0;
let selected = -1;  // 點選（尚未放置）的標籤
let checked = false;

// 版面（由 matchLayout() 依視窗大小算出）
let cardW = 220, cardH = 150, labelH = 48;
let tagW = 120, tagH = 38;
let headH = 84;
let trayY = 0, trayH = 0, trayPerRow = 6;
let resultY = 0;
let btnCheck = { x: 0, y: 0, w: 0, h: 0, label: "檢查答案" };
let btnReset = { x: 0, y: 0, w: 0, h: 0, label: "重新開始" };

function matchNewGame() {
  const tp = TOPICS[matchTopic];
  ITEMS = shuffle(tp.items).slice(0, tp.pick || tp.items.length);

  const order = shuffle(ITEMS.map((_, i) => i));
  slots = order.map((idx) => ({ x: 0, y: 0, item: ITEMS[idx] }));

  const names = shuffle(ITEMS.map((it) => it.name));
  tags = names.map((n) => ({ name: n, x: 0, y: 0, hx: 0, hy: 0, slot: -1 }));

  place = slots.map(() => -1);
  dragging = -1;
  selected = -1;
  moved = false;
  checked = false;
  matchLayout();
}

// 依目前視窗大小，算出所有東西的位置與尺寸
function matchLayout() {
  const n = ITEMS.length;
  const small = width < 700;
  const cols = small ? 2 : 3;
  const rows = ceil(n / cols);
  const m = small ? 12 : 20;
  const gapX = small ? 10 : 24;
  const gapY = small ? 8 : 14;

  headH = width < 500 ? 64 : 84;

  // 主題切換按鈕（標題下方一排）
  const pw = small ? 72 : 88;
  const ph = small ? 28 : 32;
  const tabsW = TOPICS.length * pw + (TOPICS.length - 1) * 8;
  matchTabs = TOPICS.map((tp, i) => ({
    x: (width - tabsW) / 2 + i * (pw + 8),
    y: headH * 0.72 - ph / 2,
    w: pw,
    h: ph,
    label: tp.name,
  }));

  tagH = small ? 32 : 38;
  tagW = small ? 88 : 120;
  labelH = tagH + 10;

  // 底部：按鈕、結果文字、標籤盤（由下往上排）
  const btnH = small ? 38 : 44;
  const btnW = small ? 110 : 140;
  btnCheck = { x: width / 2 - btnW - 8, y: height - m - btnH, w: btnW, h: btnH, label: "檢查答案" };
  btnReset = { x: width / 2 + 8, y: height - m - btnH, w: btnW, h: btnH, label: "重新開始" };
  resultY = btnCheck.y - 16;

  const tgap = 10;
  trayPerRow = max(1, floor((width - 2 * m + tgap) / (tagW + tgap)));
  const trayRows = ceil(n / trayPerRow);
  trayH = trayRows * (tagH + tgap) + tgap;
  trayY = resultY - 16 - trayH;

  // 卡片區：用剩下的空間，等比例縮放
  const availW = width - 2 * m;
  const availH = trayY - 10 - headH;
  let cw = (availW - (cols - 1) * gapX) / cols;
  const chMax = (availH - (rows - 1) * gapY) / rows - labelH;
  cw = min(cw, (chMax * 220) / 150);
  cw = max(cw, 60);
  cardW = cw;
  cardH = (cw * 150) / 220;

  const gridW = cols * cardW + (cols - 1) * gapX;
  const gridH = rows * (cardH + labelH) + (rows - 1) * gapY;
  const gridX = (width - gridW) / 2;
  const gridY = headH + max(0, (availH - gridH) / 2);

  slots.forEach((s, i) => {
    s.x = gridX + (i % cols) * (cardW + gapX);
    s.y = gridY + floor(i / cols) * (cardH + labelH + gapY);
  });

  // 標籤的「家」：標籤盤裡一列一列排，每列置中
  tags.forEach((tg, i) => {
    const row = floor(i / trayPerRow);
    const col = i % trayPerRow;
    const count = min(trayPerRow, n - row * trayPerRow);
    const rowW = count * tagW + (count - 1) * tgap;
    tg.hx = (width - rowW) / 2 + col * (tagW + tgap);
    tg.hy = trayY + tgap + row * (tagH + tgap);
    if (i === dragging && moved) return;
    if (tg.slot >= 0) snap(i);
    else {
      tg.x = tg.hx;
      tg.y = tg.hy;
    }
  });
}

function matchDraw(t) {
  // 標題
  noStroke();
  fill(40, 50, 70);
  textSize(width < 500 ? 20 : 26);
  textStyle(BOLD);
  text(TOPICS[matchTopic].title, width / 2, headH * 0.33);
  textStyle(NORMAL);

  // 主題切換
  matchTabs.forEach((b, i) => {
    const on = i === matchTopic;
    const over = inRect(mouseX, mouseY, b.x, b.y, b.w, b.h);
    if (over) cursorType = "pointer";
    noStroke();
    fill(on ? color(46, 125, 230) : over ? color(230, 240, 255) : color(255));
    rect(b.x, b.y, b.w, b.h, b.h / 2);
    if (!on) {
      noFill();
      stroke(200, 210, 230);
      strokeWeight(2);
      rect(b.x, b.y, b.w, b.h, b.h / 2);
      noStroke();
    }
    fill(on ? 255 : color(60, 70, 90));
    textSize(b.h * 0.5);
    textStyle(BOLD);
    text(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
    textStyle(NORMAL);
  });

  // 卡片
  for (let s = 0; s < slots.length; s++) drawCard(slots[s], s, t);

  // 標籤盤
  noStroke();
  fill(225, 230, 240);
  rect(8, trayY, width - 16, trayH, 14);

  // 標籤（拖曳中的放最上層）
  for (let i = 0; i < tags.length; i++) {
    if (!(i === dragging && moved)) drawTag(i);
  }
  if (dragging >= 0 && moved) drawTag(dragging);

  // 成績或進度
  const placed = place.filter((p) => p >= 0).length;
  noStroke();
  textSize(width < 500 ? 15 : 18);
  textStyle(BOLD);
  if (checked) {
    const k = score();
    fill(k === slots.length ? color(30, 150, 80) : color(210, 80, 60));
    text(
      k === slots.length ? "全部答對！太棒了 🎉" : "答對 " + k + " / " + slots.length + "，再試試看",
      width / 2,
      resultY
    );
  } else {
    fill(110, 120, 140);
    if (placed === 0) {
      textSize(width < 500 ? 13 : 16);
      text("把名稱拖到對應的動畫上，或先點名稱再點卡片", width / 2, resultY);
    } else {
      text("已放置 " + placed + " / " + slots.length, width / 2, resultY);
    }
  }
  textStyle(NORMAL);

  // 按鈕
  drawButton(btnCheck, placed === slots.length ? color(46, 125, 230) : color(160, 175, 200));
  drawButton(btnReset, color(120, 130, 150));

  // 游標
  if (dragging >= 0 && moved) cursorType = "grabbing";
  else if (tagAt(mouseX, mouseY) >= 0) cursorType = "pointer";
}

function drawCard(s, si, t) {
  const it = s.item;
  const r = max(6, cardW * 0.04);

  // 卡片陰影
  noStroke();
  fill(0, 0, 0, 25);
  rect(s.x + 3, s.y + 4, cardW, cardH, r);

  // ③ 動畫縮放：把 220x150 的畫縮放成卡片大小
  push();
  drawingContext.save();
  drawingContext.beginPath();
  if (drawingContext.roundRect) drawingContext.roundRect(s.x, s.y, cardW, cardH, r);
  else drawingContext.rect(s.x, s.y, cardW, cardH);
  drawingContext.clip();
  translate(s.x, s.y);
  scale(cardW / 220, cardH / 150);
  if (it.gif && imgs[it.name]) {
    image(imgs[it.name], 0, 0, 220, 150);
  } else {
    it.anim(t);
  }
  drawingContext.restore();
  pop();

  // 邊框
  noFill();
  strokeWeight(3);
  const tagIdx = place[si];
  if (checked && tagIdx >= 0) {
    stroke(tags[tagIdx].name === it.name ? color(40, 170, 90) : color(230, 80, 70));
  } else if (selected >= 0 && tagIdx < 0) {
    stroke(46, 125, 230);
  } else {
    stroke(255);
  }
  rect(s.x, s.y, cardW, cardH, r);

  // 標籤放置區
  noStroke();
  fill(255);
  rect(s.x, s.y + cardH + 6, cardW, labelH - 6, 8);
  if (tagIdx < 0) {
    fill(190, 198, 212);
    textSize(width < 500 ? 11 : 13);
    text("放這裡", s.x + cardW / 2, s.y + cardH + 6 + (labelH - 6) / 2);
  }

  // 對錯圖示
  if (checked && tagIdx >= 0) {
    const ok = tags[tagIdx].name === it.name;
    const d = min(26, cardW * 0.13);
    fill(ok ? color(40, 170, 90) : color(230, 80, 70));
    circle(s.x + cardW - d * 0.7, s.y + d * 0.7, d);
    fill(255);
    textSize(d * 0.62);
    textStyle(BOLD);
    text(ok ? "✓" : "✕", s.x + cardW - d * 0.7, s.y + d * 0.7 + 1);
    textStyle(NORMAL);
  }
}

function drawTag(i) {
  const tg = tags[i];
  const isDrag = i === dragging && moved;
  noStroke();
  if (isDrag) {
    fill(0, 0, 0, 35);
    rect(tg.x + 3, tg.y + 6, tagW, tagH, tagH / 2);
  }
  if (checked && tg.slot >= 0) {
    fill(tg.name === slots[tg.slot].item.name ? color(40, 170, 90) : color(230, 80, 70));
  } else {
    fill(i === selected ? color(46, 125, 230) : color(255, 255, 255));
  }
  stroke(i === selected ? color(46, 125, 230) : color(190, 200, 218));
  strokeWeight(2);
  rect(tg.x, tg.y, tagW, tagH, tagH / 2);

  noStroke();
  const light = i === selected || (checked && tg.slot >= 0);
  fill(light ? 255 : color(40, 50, 70));
  textSize(tagH * 0.46);
  textStyle(BOLD);
  text(tg.name, tg.x + tagW / 2, tg.y + tagH / 2 + 1);
  textStyle(NORMAL);
}

// ② 拖曳的三個事件
// 按下：記住拿起哪一個標籤
function matchDown() {
  for (let i = 0; i < matchTabs.length; i++) {
    const b = matchTabs[i];
    if (inRect(mouseX, mouseY, b.x, b.y, b.w, b.h)) {
      if (i !== matchTopic) {
        matchTopic = i;
        matchNewGame();
      }
      return;
    }
  }
  if (inRect(mouseX, mouseY, btnCheck.x, btnCheck.y, btnCheck.w, btnCheck.h)) {
    if (place.every((p) => p >= 0)) checked = true;
    return;
  }
  if (inRect(mouseX, mouseY, btnReset.x, btnReset.y, btnReset.w, btnReset.h)) {
    matchNewGame();
    return;
  }
  dragging = tagAt(mouseX, mouseY);
  moved = false;
  pressX = mouseX;
  pressY = mouseY;
  if (dragging >= 0) {
    offX = mouseX - tags[dragging].x;
    offY = mouseY - tags[dragging].y;
  }
}

// 移動：超過 6 像素才算「拖曳」，標籤跟著滑鼠
function matchMove() {
  if (dragging < 0) return;
  if (!moved && dist(mouseX, mouseY, pressX, pressY) > 6) {
    moved = true;
    selected = -1;
    checked = false;
  }
  if (moved) {
    tags[dragging].x = mouseX - offX;
    tags[dragging].y = mouseY - offY;
  }
}

// 放開：檢查落在哪一格，記錄到 place
function matchUp() {
  if (dragging >= 0 && moved) {
    const si = slotAt(mouseX, mouseY);
    if (si >= 0) placeTag(dragging, si);
    else sendHome(dragging);
  } else if (dragging >= 0) {
    // 沒移動就放開 = 點一下
    clickTag(dragging);
  } else {
    // 點在空白處或卡片上
    const si = slotAt(mouseX, mouseY);
    if (si >= 0 && selected >= 0) {
      placeTag(selected, si);
      selected = -1;
    } else if (si < 0) {
      selected = -1;
    }
  }
  dragging = -1;
  moved = false;
}

function clickTag(i) {
  if (selected >= 0 && selected !== i && tags[i].slot >= 0) {
    // 已有選取的標籤，又點到卡片上的標籤：放到那一格（交換）
    const si = tags[i].slot;
    const pick = selected;
    selected = -1;
    placeTag(pick, si);
  } else {
    selected = selected === i ? -1 : i;
  }
}

function placeTag(ti, si) {
  const prev = tags[ti].slot;
  const old = place[si];
  if (prev >= 0) place[prev] = -1;
  if (old >= 0 && old !== ti) {
    if (prev >= 0) {
      place[prev] = old;
      tags[old].slot = prev;
      snap(old);
    } else {
      sendHome(old);
    }
  }
  place[si] = ti;
  tags[ti].slot = si;
  snap(ti);
  checked = false;
}

function sendHome(ti) {
  const tg = tags[ti];
  if (tg.slot >= 0) place[tg.slot] = -1;
  tg.slot = -1;
  tg.x = tg.hx;
  tg.y = tg.hy;
  checked = false;
}

function snap(ti) {
  const tg = tags[ti];
  const s = slots[tg.slot];
  tg.x = s.x + (cardW - tagW) / 2;
  tg.y = s.y + cardH + 6 + (labelH - 6 - tagH) / 2;
}

function score() {
  let k = 0;
  for (let s = 0; s < slots.length; s++) {
    if (place[s] >= 0 && tags[place[s]].name === slots[s].item.name) k++;
  }
  return k;
}

function tagAt(px, py) {
  for (let i = tags.length - 1; i >= 0; i--) {
    if (inRect(px, py, tags[i].x, tags[i].y, tagW, tagH)) return i;
  }
  return -1;
}

function slotAt(px, py) {
  for (let s = 0; s < slots.length; s++) {
    if (inRect(px, py, slots[s].x, slots[s].y, cardW, cardH + labelH)) return s;
  }
  return -1;
}

// ---------- 連連看的內建動畫（畫布大小 220 x 150） ----------
function cloud(x, y, s, c) {
  noStroke();
  fill(c);
  ellipse(x, y, 60 * s, 34 * s);
  ellipse(x - 20 * s, y + 6 * s, 44 * s, 28 * s);
  ellipse(x + 22 * s, y + 6 * s, 48 * s, 30 * s);
  ellipse(x + 2 * s, y - 12 * s, 38 * s, 30 * s);
}

function drawSunny(t) {
  noStroke();
  fill(135, 206, 250);
  rect(0, 0, 220, 150);
  fill(110, 200, 120);
  rect(0, 122, 220, 28);
  push();
  translate(110, 65);
  rotate(t * 0.6);
  stroke(255, 196, 0);
  strokeWeight(4);
  strokeCap(ROUND);
  for (let i = 0; i < 12; i++) {
    rotate(TWO_PI / 12);
    line(38, 0, 54 + sin(t * 3 + i) * 5, 0);
  }
  pop();
  noStroke();
  fill(255, 214, 0);
  circle(110, 65, 62);
}

function drawCloudy(t) {
  noStroke();
  fill(176, 192, 208);
  rect(0, 0, 220, 150);
  const cols = [color(245), color(228, 232, 238), color(255)];
  for (let i = 0; i < 3; i++) {
    const x = ((t * (12 + i * 6) + i * 110) % 320) - 50;
    cloud(x, 40 + i * 38, 1.3 - i * 0.12, cols[i]);
  }
}

function drawRainy(t) {
  noStroke();
  fill(86, 102, 124);
  rect(0, 0, 220, 150);
  cloud(110, 36, 1.7, color(60, 70, 88));
  stroke(140, 190, 255);
  strokeWeight(2);
  strokeCap(ROUND);
  for (let i = 0; i < 26; i++) {
    const x = (i * 37) % 220;
    const y = ((t * 150 + i * 53) % 110) + 50;
    line(x, y, x - 3, y + 11);
  }
}

function drawSnowy(t) {
  noStroke();
  fill(44, 62, 104);
  rect(0, 0, 220, 150);
  fill(240, 245, 255);
  rect(0, 130, 220, 20);
  for (let i = 0; i < 34; i++) {
    const x = ((i * 47) % 220) + sin(t * 2 + i) * 8;
    const y = (t * (24 + (i % 4) * 8) + i * 29) % 135;
    circle(x, y, 3 + (i % 3));
  }
}

function drawThunder(t) {
  noStroke();
  fill(38, 38, 64);
  rect(0, 0, 220, 150);
  cloud(60, 34, 1.5, color(78, 78, 104));
  cloud(150, 40, 1.7, color(66, 66, 92));
  const ph = t % 2.6;
  const flash = ph < 0.15 || (ph > 0.3 && ph < 0.4);
  if (flash) {
    fill(255, 255, 255, 60);
    rect(0, 0, 220, 150);
    fill(255, 226, 60);
    beginShape();
    vertex(118, 56);
    vertex(96, 96);
    vertex(111, 96);
    vertex(98, 140);
    vertex(138, 86);
    vertex(120, 86);
    vertex(132, 56);
    endShape(CLOSE);
  }
}

// 起霧：樹林一層一層藏進霧裡，霧慢慢飄動（遠處的樹最淡、最被霧遮住）
function drawFoggy(t) {
  noStroke();
  for (let y = 0; y < 150; y += 5) {
    const k = y / 150;
    fill(lerp(168, 214, k), lerp(180, 220, k), lerp(192, 226, k));
    rect(0, y, 220, 5);
  }
  // 霧裡模糊的太陽
  for (let i = 4; i > 0; i--) {
    fill(255, 255, 255, 26);
    circle(172, 34, 18 + i * 14);
  }
  fogTrees(98, 150, 0, 0.55);
  fogBand(t, 80, 5, 70);
  fogTrees(118, 110, 17, 0.85);
  fogBand(t, 102, 9, 80);
  fogTrees(144, 70, 8, 1.2);
  fogBand(t, 130, 14, 95);
  fill(235, 240, 245, 40);
  rect(0, 0, 220, 150);
}

function fogTrees(yb, g, off, sc) {
  noStroke();
  fill(g, g + 8, g + 16);
  for (let i = 0; i < 8; i++) {
    const x = off + i * 34 + (i % 2) * 6;
    const h = (28 + ((i * 13) % 14)) * sc;
    rect(x - 2 * sc, yb - 6 * sc, 4 * sc, 6 * sc);
    triangle(x - 11 * sc, yb - 5 * sc, x + 11 * sc, yb - 5 * sc, x, yb - h);
  }
}

function fogBand(t, y, spd, alpha) {
  noStroke();
  for (let j = 0; j < 6; j++) {
    const x = ((t * spd + j * 80) % 480) - 130;
    const yy = y + sin(t * 0.6 + j * 1.7) * 5;
    fill(238, 242, 246, alpha * 0.4);
    ellipse(x, yy, 260, 70);
    fill(238, 242, 246, alpha);
    ellipse(x, yy, 200, 44);
  }
}

// ---------- 水果動畫（畫布大小 220 x 150） ----------
function fruitBg(r, g, b) {
  noStroke();
  fill(r, g, b);
  rect(0, 0, 220, 150);
  fill(r - 18, g - 18, b - 18);
  rect(0, 118, 220, 32);
}

function drawApple(t) {
  fruitBg(222, 240, 214);
  const bob = sin(t * 2.5) * 6;
  noStroke();
  fill(0, 0, 0, 40 - bob * 1.5);
  ellipse(110, 128, 84 - bob * 1.5, 10);
  push();
  translate(110, 76 + bob);
  rotate(sin(t * 2) * 0.1);
  noStroke();
  fill(214, 48, 49);
  ellipse(-17, 0, 60, 64);
  ellipse(17, 0, 60, 64);
  fill(255, 255, 255, 90);
  ellipse(-27, -12, 10, 20);
  stroke(110, 70, 40);
  strokeWeight(4);
  strokeCap(ROUND);
  line(0, -28, 3, -44);
  noStroke();
  fill(90, 170, 70);
  push();
  translate(8, -40);
  rotate(-0.5 + sin(t * 3) * 0.15);
  ellipse(12, 0, 26, 12);
  pop();
  pop();
}

function drawBanana(t) {
  noStroke();
  fill(255, 243, 201);
  rect(0, 0, 220, 150);
  stroke(150, 120, 80);
  strokeWeight(2);
  line(50, 0, 50, 20);
  push();
  translate(50, 20);
  rotate(sin(t * 2) * 0.3);
  noStroke();
  fill(250, 210, 50);
  beginShape();
  vertex(0, 0);
  bezierVertex(-10, 80, 70, 112, 110, 32);
  bezierVertex(80, 62, 30, 48, 0, 0);
  endShape(CLOSE);
  fill(255, 255, 255, 80);
  ellipse(48, 56, 40, 6);
  fill(110, 90, 40);
  rect(-5, -10, 10, 14, 2);
  fill(80, 60, 30);
  circle(109, 32, 7);
  pop();
}

function drawWatermelon(t) {
  fruitBg(224, 242, 255);
  const bob = sin(t * 2.2) * 4;
  noStroke();
  fill(0, 0, 0, 40);
  ellipse(110, 128, 120 - bob * 2, 10);
  push();
  translate(110, 52 + bob);
  rotate(sin(t * 1.8) * 0.06);
  noStroke();
  fill(46, 140, 60);
  arc(0, 0, 150, 150, 0, PI, CHORD);
  fill(225, 240, 200);
  arc(0, 0, 138, 138, 0, PI, CHORD);
  fill(236, 64, 72);
  arc(0, 0, 124, 124, 0, PI, CHORD);
  fill(30, 30, 30);
  const seeds = [[-46, 10], [-32, 24], [0, 20], [32, 24], [46, 10], [-18, 42], [18, 42], [0, 54]];
  for (const s of seeds) ellipse(s[0], s[1], 6, 10);
  pop();
}

function drawOrange(t) {
  fruitBg(214, 236, 250);
  const b = abs(sin(t * 3));
  const cy = 94 - b * 50;
  const sq = pow(1 - b, 4) * 0.12;
  noStroke();
  fill(0, 0, 0, 45 * (1 - b * 0.5));
  ellipse(110, 128, 76 * (1 - b * 0.4), 10 * (1 - b * 0.4));
  push();
  translate(110, cy);
  scale(1 + sq, 1 - sq);
  noStroke();
  fill(250, 150, 30);
  circle(0, 0, 70);
  push();
  rotate(t * 1.5);
  fill(235, 125, 15, 140);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    circle(cos(a) * (8 + (i % 3) * 8), sin(a) * (8 + (i % 3) * 8), 4);
  }
  pop();
  fill(255, 255, 255, 80);
  ellipse(-14, -14, 14, 9);
  fill(90, 170, 70);
  ellipse(6, -35, 18, 9);
  fill(120, 90, 40);
  circle(0, -34, 5);
  pop();
}

function drawStrawberry(t) {
  fruitBg(255, 226, 232);
  const bob = sin(t * 2.2) * 5;
  noStroke();
  fill(0, 0, 0, 36);
  ellipse(110, 128, 80 - bob, 10);
  push();
  translate(110, 76 + bob);
  rotate(sin(t * 1.6) * 0.12);
  scale(1.2);
  noStroke();
  fill(226, 40, 60);
  beginShape();
  vertex(0, -26);
  bezierVertex(30, -34, 42, -6, 28, 22);
  bezierVertex(18, 40, 6, 48, 0, 50);
  bezierVertex(-6, 48, -18, 40, -28, 22);
  bezierVertex(-42, -6, -30, -34, 0, -26);
  endShape(CLOSE);
  fill(255, 225, 120);
  const seeds = [[-14, -6], [0, -10], [14, -6], [-20, 10], [-6, 6], [8, 6], [20, 10], [-12, 24], [2, 22], [14, 24], [0, 38]];
  for (const s of seeds) ellipse(s[0], s[1], 4, 7);
  fill(70, 160, 70);
  for (let k = -2; k <= 2; k++) {
    push();
    translate(0, -24);
    rotate(k * 0.55);
    ellipse(0, -8, 10, 20);
    pop();
  }
  stroke(60, 120, 50);
  strokeWeight(4);
  strokeCap(ROUND);
  line(0, -30, 2, -46);
  pop();
}

function drawGrape(t) {
  noStroke();
  fill(236, 226, 250);
  rect(0, 0, 220, 150);
  stroke(150, 120, 80);
  strokeWeight(2);
  line(110, 0, 110, 14);
  push();
  translate(110, 14);
  rotate(sin(t * 2) * 0.12);
  stroke(110, 80, 50);
  strokeWeight(4);
  strokeCap(ROUND);
  line(0, 0, 0, 20);
  noStroke();
  fill(90, 170, 70);
  push();
  translate(4, 8);
  rotate(-0.4 + sin(t * 3) * 0.15);
  ellipse(14, 0, 30, 14);
  pop();
  let n = 0;
  for (let row = 0; row < 4; row++) {
    const count = 4 - row;
    for (let c = 0; c < count; c++) {
      const x = (c - (count - 1) / 2) * 21;
      const y = 30 + row * 20 + sin(t * 3 + n) * 1.5;
      fill(112 + (n % 3) * 8, 60, 150 + (n % 2) * 10);
      circle(x, y, 23);
      fill(255, 255, 255, 90);
      circle(x - 4, y - 4, 5);
      n++;
    }
  }
  pop();
}

// ---------- 交通安全動畫（畫布大小 220 x 150） ----------

// 人物（正面）：x 是身體中心，fy 是腳底的 y，s 是大小
// o：walk 走路相位、look 眼睛看的方向（-1 左到 1 右）、tilt 頭往下低的程度、
//    phone 是否拿手機、armUp 是否舉手
function person(x, fy, s, shirt, pants, o) {
  o = o || {};
  const sw = o.walk === undefined ? 0 : sin(o.walk) * 7 * s;
  const hipY = fy - 22 * s;
  const hx = x + (o.look || 0) * 1.5 * s;
  const hy = fy - 51 * s + (o.tilt || 0) * s;
  strokeCap(ROUND);
  // 腿與鞋
  stroke(pants);
  strokeWeight(5 * s);
  line(x - 3 * s, hipY, x - 3 * s + sw, fy - 2 * s);
  line(x + 3 * s, hipY, x + 3 * s - sw, fy - 2 * s);
  noStroke();
  fill(40, 40, 50);
  ellipse(x - 3 * s + sw, fy - 1 * s, 8 * s, 4 * s);
  ellipse(x + 3 * s - sw, fy - 1 * s, 8 * s, 4 * s);
  // 身體
  fill(shirt);
  rect(x - 7 * s, fy - 44 * s, 14 * s, 23 * s, 5 * s);
  // 手
  stroke(shirt);
  strokeWeight(4 * s);
  if (o.phone) {
    line(x - 7 * s, fy - 40 * s, x - 3 * s, fy - 31 * s);
    line(x + 7 * s, fy - 40 * s, x + 3 * s, fy - 31 * s);
    noStroke();
    fill(40, 44, 60);
    rect(x - 4 * s, fy - 39 * s, 8 * s, 10 * s, 1.5 * s);
    fill(130, 205, 255);
    rect(x - 3 * s, fy - 38 * s, 6 * s, 8 * s, 1 * s);
  } else {
    line(x - 7 * s, fy - 40 * s, x - 10 * s - sw * 0.5, fy - 27 * s);
    if (o.armUp) {
      line(x + 7 * s, fy - 40 * s, x + 12 * s, fy - 57 * s);
      noStroke();
      fill(255, 214, 170);
      circle(x + 12 * s, fy - 58 * s, 5 * s);
    } else {
      line(x + 7 * s, fy - 40 * s, x + 10 * s + sw * 0.5, fy - 27 * s);
    }
  }
  // 頭
  noStroke();
  fill(255, 214, 170);
  circle(hx, hy, 16 * s);
  fill(60, 40, 30);
  arc(hx, hy - 1 * s, 17 * s, 15 * s, PI, TWO_PI);
  fill(30);
  const lk = (o.look || 0) * 2 * s;
  circle(hx - 3 * s + lk, hy + 1 * s, 2.2 * s);
  circle(hx + 3 * s + lk, hy + 1 * s, 2.2 * s);
}

// 側面的汽車（面向右）。x 是車尾，gy 是地面，dir 為 -1 時車子往左開
function carSide(x, gy, s, col, spin, dir) {
  push();
  translate(x, gy);
  scale(dir * s, s);
  noStroke();
  fill(0, 0, 0, 40);
  ellipse(36, 2, 84, 6);
  fill(col);
  rect(0, -26, 72, 16, 5);
  rect(14, -40, 40, 18, 6, 6, 0, 0);
  fill(200, 230, 250);
  rect(18, -37, 15, 12, 2);
  rect(36, -37, 15, 12, 2);
  fill(255, 240, 150);
  rect(68, -22, 5, 5, 1);
  fill(255, 60, 60);
  rect(-1, -22, 3, 5, 1);
  carWheel(15, -8, 8, spin * dir);
  carWheel(57, -8, 8, spin * dir);
  pop();
}

function carWheel(cx, cy, r, a) {
  noStroke();
  fill(40);
  circle(cx, cy, r * 2);
  fill(185);
  circle(cx, cy, r * 1.1);
  stroke(70);
  strokeWeight(1);
  line(cx + cos(a) * r * 0.5, cy + sin(a) * r * 0.5, cx - cos(a) * r * 0.5, cy - sin(a) * r * 0.5);
  noStroke();
}

function skyBg() {
  noStroke();
  for (let y = 0; y < 90; y += 6) {
    fill(lerp(170, 222, y / 90), lerp(212, 240, y / 90), 250);
    rect(0, y, 220, 6);
  }
  fill(222, 240, 250);
  rect(0, 90, 220, 60);
}

function sidewalk(y) {
  noStroke();
  fill(206, 206, 200);
  rect(0, y, 220, 150 - y);
  fill(182, 182, 176);
  rect(0, y, 220, 4);
}

function roadStrip(y, h, t, spd) {
  noStroke();
  fill(84, 88, 98);
  rect(0, y, 220, h);
  fill(240, 230, 120);
  const off = (t * spd) % 36;
  for (let x = -36 + off; x < 220; x += 36) rect(x, y + h / 2 - 1.5, 20, 3, 1);
}

// 行人號誌上的小人（站著或走路）
function pedIcon(cx, cy, walking, col) {
  noStroke();
  fill(col);
  circle(cx, cy - 9, 6);
  stroke(col);
  strokeWeight(2.6);
  strokeCap(ROUND);
  if (walking) {
    line(cx, cy - 5, cx - 1, cy + 4);
    line(cx - 1, cy + 4, cx - 6, cy + 11);
    line(cx - 1, cy + 4, cx + 5, cy + 11);
    line(cx, cy - 4, cx + 6, cy + 2);
    line(cx, cy - 4, cx - 5, cy + 3);
  } else {
    line(cx, cy - 5, cx, cy + 4);
    line(cx, cy + 4, cx - 3, cy + 12);
    line(cx, cy + 4, cx + 3, cy + 12);
    line(cx, cy - 4, cx - 5, cy + 3);
    line(cx, cy - 4, cx + 5, cy + 3);
  }
  noStroke();
}

// 行人號誌：state 是 "red" 或 "green"，on 控制閃爍，count 是倒數秒數（可省略）
function pedSignal(x, gy, state, on, count) {
  noStroke();
  fill(100, 104, 116);
  rect(x - 2, gy - 30, 4, 30);
  fill(36, 40, 52);
  rect(x - 16, gy - 92, 32, 64, 6);
  const redOn = state === "red";
  const grOn = state === "green" && on;
  if (redOn) {
    fill(255, 70, 60, 60);
    circle(x, gy - 76, 30);
  }
  pedIcon(x, gy - 76, false, redOn ? color(255, 70, 60) : color(90, 40, 40));
  if (grOn) {
    fill(70, 230, 120, 60);
    circle(x, gy - 44, 30);
  }
  pedIcon(x, gy - 44, true, grOn ? color(70, 230, 120) : color(30, 70, 45));
  if (count !== undefined) {
    fill(255, 150, 40);
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    textSize(15);
    text(count, x + 28, gy - 60);
    textStyle(NORMAL);
  }
}

// 1. 紅燈：車子一輛一輛開過去，小朋友站在路邊等
function drawPedRed(t) {
  skyBg();
  roadStrip(84, 28, t, 0);
  carSide(((t * 70) % 340) - 90, 110, 0.85, color(230, 70, 70), t * 8, 1);
  sidewalk(112);
  pedSignal(36, 146, "red", true);
  person(150, 144, 1, color(70, 130, 230), color(60, 70, 110), { walk: sin(t * 2.2) * 0.3 });
}

// 2. 綠燈閃爍：號誌閃爍並倒數，車子停在線後面，小朋友還在路邊
function drawPedBlink(t) {
  skyBg();
  roadStrip(84, 28, t, 0);
  carSide(96, 110, 0.85, color(80, 170, 120), 0, 1);
  sidewalk(112);
  const on = floor(t * 3) % 2 === 0;
  pedSignal(36, 146, "green", on, 5 - floor(t % 6));
  person(160, 144, 1, color(250, 170, 50), color(60, 70, 110), { walk: sin(t * 2.2) * 0.3 });
}

// 3. 斑馬線：從上面往下看，車子停在線前，小朋友走在斑馬線上
function topCar(x, y, col, dir, t) {
  push();
  translate(x, y);
  scale(dir, 1);
  noStroke();
  fill(0, 0, 0, 40);
  rect(2, 3, 46, 24, 7);
  fill(col);
  rect(0, 0, 46, 24, 7);
  fill(red(col) * 0.8, green(col) * 0.8, blue(col) * 0.8);
  rect(8, 3, 14, 18, 3);
  fill(200, 230, 250);
  rect(26, 3, 10, 18, 3);
  fill(255, 255, 255, 90 + 60 * sin(t * 6));
  circle(-2, 6, 10);
  circle(-2, 18, 10);
  fill(255, 40, 40);
  rect(-1, 3, 3, 6, 1);
  rect(-1, 15, 3, 6, 1);
  pop();
}

function topKid(x, y, col, dirY, t) {
  noStroke();
  fill(0, 0, 0, 40);
  ellipse(x + 1, y + 2, 24, 14);
  fill(40, 40, 50);
  const st = sin(t * 8) * 3;
  ellipse(x - 4, y + 9 * dirY + st, 5, 7);
  ellipse(x + 4, y + 9 * dirY - st, 5, 7);
  fill(col);
  ellipse(x, y, 22, 11);
  fill(255, 214, 170);
  circle(x, y, 12);
  fill(60, 40, 30);
  ellipse(x, y - 2 * dirY, 12, 8);
}

function drawZebra(t) {
  noStroke();
  fill(206, 206, 200);
  rect(0, 0, 220, 150);
  fill(84, 88, 98);
  rect(0, 34, 220, 82);
  fill(240, 230, 120);
  for (let x = 0; x < 220; x += 30) rect(x + 4, 74, 16, 3);
  fill(255);
  for (let y = 38; y < 114; y += 11) rect(84, y, 52, 6, 1);
  fill(255, 255, 255, 200);
  rect(70, 34, 4, 40);
  rect(146, 76, 4, 40);
  topCar(20, 46, color(230, 70, 70), 1, t);
  topCar(190, 82, color(70, 130, 220), -1, t);
  const p = (sin(t * 0.9) + 1) / 2;
  topKid(110, 22 + p * 106, color(250, 150, 40), cos(t * 0.9) > 0 ? 1 : -1, t);
}

// 4. 停看聽：小朋友在路邊左右張望，車子從前面開過去
function drawLookBoth(t) {
  skyBg();
  roadStrip(84, 28, t, 0);
  carSide(((t * 55) % 360) - 100, 110, 0.85, color(60, 130, 220), t * 7, 1);
  sidewalk(112);
  const look = sin(t * 1.6);
  const aL = 70 + 185 * constrain(-look, 0, 1);
  const aR = 70 + 185 * constrain(look, 0, 1);
  noFill();
  strokeWeight(4);
  strokeCap(ROUND);
  stroke(255, 150, 40, aL);
  line(60, 120, 48, 130);
  line(48, 130, 60, 140);
  stroke(255, 150, 40, aR);
  line(160, 120, 172, 130);
  line(172, 130, 160, 140);
  noStroke();
  person(110, 146, 1.15, color(255, 120, 60), color(60, 70, 110), { look: look });
}

// 5. 安全帽：戴安全帽的小朋友騎腳踏車
function bikeWheel(cx, cy, r, a) {
  noFill();
  stroke(40);
  strokeWeight(3);
  circle(cx, cy, r * 2);
  stroke(120);
  strokeWeight(1);
  for (let i = 0; i < 4; i++) {
    const b = a + (i * PI) / 4;
    line(cx + cos(b) * r, cy + sin(b) * r, cx - cos(b) * r, cy - sin(b) * r);
  }
  noStroke();
}

function drawHelmet(t) {
  skyBg();
  noStroke();
  for (let i = 0; i < 5; i++) {
    const x = ((((i * 60 - t * 30) % 300) + 300) % 300) - 40;
    fill(110, 170, 110);
    circle(x, 82, 34);
    fill(120, 90, 60);
    rect(x - 2, 90, 4, 20);
  }
  roadStrip(108, 42, t, -50);
  const a = t * 8;
  bikeWheel(82, 124, 15, a);
  bikeWheel(142, 124, 15, a);
  stroke(210, 60, 60);
  strokeWeight(3.5);
  strokeCap(ROUND);
  line(82, 124, 104, 100);
  line(104, 100, 128, 100);
  line(128, 100, 142, 124);
  line(82, 124, 110, 124);
  line(110, 124, 128, 100);
  line(128, 100, 124, 90);
  line(124, 90, 134, 90);
  // 騎士
  const bob = sin(t * 8) * 0.8;
  const hipX = 104, hipY = 94 + bob;
  const footX = 110 + cos(a) * 9;
  const footY = 124 + sin(a) * 9;
  stroke(60, 70, 110);
  strokeWeight(5);
  line(hipX, hipY, (hipX + footX) / 2 + 6, (hipY + footY) / 2 - 4);
  line((hipX + footX) / 2 + 6, (hipY + footY) / 2 - 4, footX, footY);
  stroke(70, 190, 130);
  strokeWeight(10);
  line(hipX, hipY, 116, 72 + bob);
  strokeWeight(4);
  line(116, 74 + bob, 130, 90);
  noStroke();
  fill(255, 214, 170);
  circle(121, 62 + bob, 18);
  fill(255, 200, 0);
  arc(121, 61 + bob, 24, 22, PI, TWO_PI, CHORD);
  stroke(255, 255, 255, 170);
  strokeWeight(1.5);
  line(121, 51 + bob, 121, 60 + bob);
  line(113, 62 + bob, 117, 70 + bob);
  noStroke();
  fill(30);
  circle(125, 63 + bob, 2.2);
}

// 6. 安全帶：車子行駛，乘客繫著安全帶輕輕晃動
function drawSeatbelt(t) {
  skyBg();
  noStroke();
  for (let i = 0; i < 4; i++) {
    const x = ((((i * 80 - t * 40) % 320) + 320) % 320) - 50;
    fill(120, 175, 120);
    circle(x, 100, 36);
    fill(120, 90, 60);
    rect(x - 2, 108, 4, 12);
  }
  roadStrip(118, 32, t, -80);
  push();
  translate(0, sin(t * 9) * 0.8);
  noStroke();
  const col = color(70, 140, 230);
  fill(col);
  rect(14, 84, 192, 34, 10);
  quad(44, 84, 64, 40, 156, 40, 184, 84);
  fill(208, 236, 252);
  quad(52, 82, 68, 46, 154, 46, 176, 82);
  push();
  translate(112, 84);
  rotate(sin(t * 1.5) * 0.07);
  translate(-112, -84);
  fill(255, 150, 60);
  rect(101, 58, 22, 26, 6);
  fill(255, 214, 170);
  circle(112, 48, 18);
  fill(60, 40, 30);
  arc(112, 47, 19, 17, PI, TWO_PI);
  fill(30);
  circle(109, 49, 2.2);
  circle(116, 49, 2.2);
  stroke(40, 46, 64);
  strokeWeight(4);
  line(104, 56, 122, 82);
  noStroke();
  fill(250, 200, 40);
  rect(120, 80, 7, 6, 1);
  pop();
  fill(255, 240, 150);
  rect(200, 92, 8, 8, 2);
  pop();
  carWheel(56, 118, 14, t * 9);
  carWheel(164, 118, 14, t * 9);
}

// 7. 夜間反光：車燈掃過，穿反光衣的小朋友會發亮，全黑的幾乎看不見
function drawNightWalk(t) {
  noStroke();
  for (let y = 0; y < 100; y += 5) {
    fill(lerp(10, 28, y / 100), lerp(14, 34, y / 100), lerp(38, 64, y / 100));
    rect(0, y, 220, 5);
  }
  fill(255, 255, 255, 180);
  for (let i = 0; i < 12; i++) circle((i * 53) % 220, (i * 29) % 70 + 6, 1.6);
  fill(34, 38, 54);
  rect(0, 100, 220, 50);
  fill(70, 74, 92);
  rect(0, 100, 220, 3);

  const carX = ((t * 38) % 320) - 100;
  const front = carX + 72 * 0.9;
  fill(255, 245, 170, 55);
  triangle(front, 100, front + 140, 70, front + 140, 128);
  carSide(carX, 118, 0.9, color(150, 60, 60), t * 8, 1);

  const lit = (px) => (front < px && px < front + 140 ? 1 : 0);
  // 全黑衣服的小朋友
  const L1 = lit(116);
  person(116, 142, 1, color(lerp(26, 70, L1), lerp(30, 76, L1), lerp(48, 104, L1)),
    color(lerp(22, 56, L1), lerp(26, 62, L1), lerp(42, 86, L1)), { walk: sin(t * 2) * 0.3 });
  // 穿反光衣的小朋友
  const L2 = lit(172);
  noStroke();
  fill(255, 255, 200, 50 * L2);
  circle(172, 112, 40);
  person(172, 142, 1, color(lerp(90, 250, L2), lerp(80, 200, L2), lerp(40, 60, L2)),
    color(60, 70, 110), { walk: sin(t * 2 + 1) * 0.3 });
  noStroke();
  fill(255, 255, 255, 120 + 135 * L2);
  rect(165, 108, 14, 3);
  rect(165, 116, 14, 3);
}

// 8. 邊走邊滑手機：低頭走路，旁邊車子開過去，警告標誌閃爍
function drawPhoneWalk(t) {
  skyBg();
  roadStrip(84, 28, t, 0);
  carSide(((t * 80) % 360) - 100, 110, 0.85, color(240, 190, 40), t * 9, 1);
  sidewalk(112);
  const x = ((t * 30) % 260) - 20;
  person(x, 144, 1, color(120, 90, 220), color(60, 70, 110), { walk: t * 8, phone: true, tilt: 3 });
  const al = 120 + 135 * abs(sin(t * 5));
  noStroke();
  fill(255, 205, 0, al);
  triangle(x - 11, 84, x + 11, 84, x, 62);
  fill(60, 40, 0, al);
  rect(x - 1.2, 70, 2.4, 8, 1);
  circle(x, 81, 3);
}

// 9. 球滾到馬路：球滾進車道，小朋友停在路邊舉手，不衝出去
function drawBallRoad(t) {
  skyBg();
  roadStrip(84, 28, t, 0);
  sidewalk(112);
  carSide(330 - ((t * 62) % 420), 110, 0.85, color(70, 110, 220), t * 9, -1);
  const bx = 70 + ((t * 32) % 130);
  const by = 104 - abs(sin(t * 5)) * 20;
  const a = t * 6;
  noStroke();
  fill(240, 70, 70);
  circle(bx, by, 14);
  stroke(255);
  strokeWeight(1.5);
  line(bx + cos(a) * 6, by + sin(a) * 6, bx - cos(a) * 6, by - sin(a) * 6);
  noStroke();
  person(36, 144, 1, color(70, 180, 120), color(60, 70, 110), { armUp: true, look: 1 });
  const k = 1 + 0.12 * sin(t * 6);
  fill(255, 205, 0);
  circle(66, 80, 20 * k);
  fill(60, 40, 0);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(14 * k);
  text("!", 66, 81);
  textStyle(NORMAL);
}

function drawWindy(t) {
  noStroke();
  fill(196, 228, 240);
  rect(0, 0, 220, 150);
  noFill();
  stroke(255);
  strokeWeight(3);
  strokeCap(ROUND);
  for (let i = 0; i < 4; i++) {
    const y = 32 + i * 30;
    beginShape();
    for (let x = 0; x <= 220; x += 6) {
      vertex(x, y + sin(x * 0.06 - t * 4 + i) * 6);
    }
    endShape();
  }
  noStroke();
  fill(90, 170, 90);
  for (let i = 0; i < 3; i++) {
    const x = ((t * 100 + i * 90) % 280) - 30;
    const y = 55 + i * 28 + sin(t * 5 + i) * 10;
    push();
    translate(x, y);
    rotate(t * 4 + i);
    ellipse(0, 0, 14, 7);
    pop();
  }
}