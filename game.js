'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#f06292', // Turca - pink
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Turca - anillo 3x3 con hueco central
];

const LINE_SCORES = [0, 100, 300, 500, 800];

/* ---- Skins (temas visuales) ---- */
// Cada skin define su propia paleta de colores (paralela a COLORS, índices 1-8)
// y se dibuja mediante un `case` dedicado dentro de drawBlock().
const SKINS = {
  retro: {
    label: 'Retro',
    colors: [
      null,
      '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784',
      '#e57373', '#90caf9', '#ffb74d', '#f06292',
    ],
    grid: null, // usa GRID_LINE_COLORS por defecto
  },
  neon: {
    label: 'Neón',
    colors: [
      null,
      '#00fff2', '#faff00', '#ff00e6', '#39ff14',
      '#ff2d55', '#00aaff', '#ff9100', '#ff00ff',
    ],
    grid: { dark: '#0a0a14', light: '#1c1c2c' },
  },
  pastel: {
    label: 'Pastel',
    colors: [
      null,
      '#a8dadc', '#ffe8a3', '#d6a8e0', '#b8e0b8',
      '#f4a8a8', '#a8c8f0', '#f0c8a8', '#f0a8d0',
    ],
    grid: { dark: '#3a3a45', light: '#e8e0f0' },
  },
  pixel: {
    label: 'Pixel art',
    colors: null, // se completa abajo: reutiliza la paleta de "retro"
    grid: null,
  },
};
SKINS.pixel.colors = SKINS.retro.colors;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const holdSection = document.getElementById('hold-section');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');

const THEME_STORAGE_KEY = 'tetris-theme';
const GRID_LINE_COLORS = { dark: '#22222e', light: '#dde1ee' };

/* ---- Skins: estado y persistencia ---- */
const SKIN_STORAGE_KEY = 'tetris-skin';
let currentSkin = 'retro';

let board, current, next, hold, holdUsed, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function applyTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  themeToggle.checked = theme === 'light';
}

function initTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
  applyTheme(savedTheme);
  themeToggle.addEventListener('change', () => {
    const theme = themeToggle.checked ? 'light' : 'dark';
    applyTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  });
}

/* ---- Skins: aplicar e inicializar (mismo patrón que applyTheme/initTheme) ---- */
function applySkin(name) {
  currentSkin = SKINS[name] ? name : 'retro';
  Object.keys(SKINS).forEach(key => document.body.classList.remove('skin-' + key));
  document.body.classList.add('skin-' + currentSkin);
  if (skinSelect) skinSelect.value = currentSkin;
  // Redibujar de inmediato para que el cambio se vea aunque el juego esté en pausa.
  if (current) {
    draw();
    drawNext();
    drawHold();
  }
}

function initSkin() {
  const savedSkin = localStorage.getItem(SKIN_STORAGE_KEY) || 'retro';
  applySkin(savedSkin);
  if (skinSelect) {
    skinSelect.addEventListener('change', () => {
      applySkin(skinSelect.value);
      localStorage.setItem(SKIN_STORAGE_KEY, currentSkin);
    });
  }
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function makePiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPiece() {
  const type = Math.random() < 1 / 12 ? 8 : Math.floor(Math.random() * 7) + 1;
  return makePiece(type);
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  holdUsed = false;
  spawn();
  drawHold();
}

function holdPiece() {
  if (holdUsed) return;
  const heldType = hold;
  hold = current.type;
  if (heldType === null) {
    spawn();
  } else {
    current = makePiece(heldType);
    if (collide(current.shape, current.x, current.y)) endGame();
  }
  holdUsed = true;
  dropAccum = 0;
  drawHold();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

/* ---- Skins: dibujo de bloques ---- */
// Dibuja un rectángulo con esquinas redondeadas, usando ctx.roundRect si está
// disponible o un trazado manual (arcTo) como respaldo en navegadores viejos.
function drawRoundedRect(context, x, y, w, h, r) {
  if (typeof context.roundRect === 'function') {
    context.beginPath();
    context.roundRect(x, y, w, h, r);
    context.fill();
    return;
  }
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + w - r, y);
  context.arcTo(x + w, y, x + w, y + r, r);
  context.lineTo(x + w, y + h - r);
  context.arcTo(x + w, y + h, x + w - r, y + h, r);
  context.lineTo(x + r, y + h);
  context.arcTo(x, y + h, x, y + h - r, r);
  context.lineTo(x, y + r);
  context.arcTo(x, y, x + r, y, r);
  context.closePath();
  context.fill();
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = SKINS[currentSkin] || SKINS.retro;
  const color = skin.colors[colorIndex] || COLORS[colorIndex];
  const px = x * size + 1;
  const py = y * size + 1;
  const s = size - 2;

  context.globalAlpha = alpha ?? 1;

  switch (currentSkin) {
    case 'neon': {
      context.shadowBlur = Math.max(6, size * 0.4);
      context.shadowColor = color;
      context.fillStyle = color;
      context.fillRect(px, py, s, s);
      context.shadowBlur = 0;
      context.strokeStyle = 'rgba(255,255,255,0.6)';
      context.lineWidth = 1;
      context.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
      break;
    }
    case 'pastel': {
      const r = Math.min(6, s / 2);
      context.fillStyle = color;
      drawRoundedRect(context, px, py, s, s, r);
      break;
    }
    case 'pixel': {
      context.fillStyle = color;
      context.fillRect(px, py, s, s);
      // Bisel de píxeles: brillo arriba/izquierda, sombra abajo/derecha
      const bevel = Math.max(2, Math.floor(s / 6));
      context.fillStyle = 'rgba(255,255,255,0.4)';
      context.fillRect(px, py, s, bevel);
      context.fillRect(px, py, bevel, s);
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.fillRect(px, py + s - bevel, s, bevel);
      context.fillRect(px + s - bevel, py, bevel, s);
      break;
    }
    default: { // retro
      context.fillStyle = color;
      context.fillRect(px, py, s, s);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(px, py, s, 4);
    }
  }

  // Restaurar el estado del contexto que pudo haber sido tocado arriba,
  // para que no se filtre a los siguientes bloques dibujados (de cualquier skin).
  context.globalAlpha = 1;
  context.shadowBlur = 0;
  context.lineWidth = 1;
}

function drawGrid() {
  const skin = SKINS[currentSkin] || SKINS.retro;
  const gridColors = skin.grid || GRID_LINE_COLORS;
  ctx.strokeStyle = document.body.classList.contains('light') ? gridColors.light : gridColors.dark;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function drawHold() {
  const NB = 30;
  holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
  holdSection.classList.toggle('locked', holdUsed);
  if (hold === null) return;
  const shape = PIECES[hold];
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(holdCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
      if (gameOver) { draw(); return; }
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  hold = null;
  holdUsed = false;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  drawHold();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  // Skins: no interceptar teclas si el foco está en un control de formulario
  // (p.ej. el <select> de skin), para no pelear con su interacción nativa.
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
    case 'KeyC':
      holdPiece();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

initTheme();
initSkin();
init();
