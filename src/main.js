import Phaser from 'phaser';

const GAME_WIDTH = 800;
const GAME_HEIGHT = 500;
const GROUND_HEIGHT = 60;
const GROUND_TOP = GAME_HEIGHT - GROUND_HEIGHT;
const PLAYER_WIDTH = 60;
const PLAYER_HEIGHT = 80;
const PLAYER_X = 150;
const JUMP_VELOCITY = -650;
const GRAVITY = 1600;
const SCROLL_SPEED = 480;
const CLOUD_SPEED = 100;
const CITY_BACK_SPEED = 65;
const CITY_FRONT_SPEED = 130;
const OBSTACLE_MIN_GAP = 900;
const OBSTACLE_MAX_GAP = 1600;

const JUMP_EVENT = 'player-jump';
const BEEP_FREQUENCY = 880;
const BEEP_DURATION = 0.12;
const BEEP_VOLUME = 0.16;

let audioContext = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;

  if (!audioContext) {
    audioContext = new AudioContext();
  }

  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  return audioContext;
}

function playBuildingTouchBeep() {
  const context = getAudioContext();
  if (!context) return;

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const startTime = context.currentTime;
  const endTime = startTime + BEEP_DURATION;

  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(BEEP_FREQUENCY, startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(BEEP_VOLUME, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, endTime);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(endTime);
}

const CHARACTER_TYPES = [
  { key: 'known', label: 'דמויות מוכרות', description: 'גיבורים שאתם כבר מכירים' },
  { key: 'funny', label: 'דמויות מצחיקות', description: 'חבורה חדשה ומוזרה במיוחד' },
];

const FUNNY_CHARACTER_NAMES = [
  'בנצי בננה',
  'גברת גרביים',
  'פרופסור פיתה',
  'קפטן קציצה',
  'מלך מלפפון',
  'דוקטור דגדוג',
  'נינג׳ה נודלס',
  'רובו רקדנית',
  'חדקרן חומוס',
  'זברה זיגזג',
  'שבלול שמש',
  'טוסטר טורבו',
  'פינגווין פנקייק',
  'כריש כובע',
  'דרקון דבש',
  'סבא סוכריה',
  'לימון ליצן',
  'מפלצת מרשמלו',
  'חתול חצוצרה',
  'קוסם קרטיב',
];

const FUNNY_CHARACTER_COLORS = [
  [0xffd166, 0x7a4f00],
  [0xef476f, 0x7a1230],
  [0xf7ede2, 0x9d6b53],
  [0x9b5de5, 0x3c096c],
  [0x06d6a0, 0x006d52],
  [0x118ab2, 0x06445c],
  [0xff9f1c, 0x8f4f00],
  [0xa0c4ff, 0x355070],
  [0xffafcc, 0x9d4edd],
  [0x90be6d, 0x31572c],
  [0xf15bb5, 0x7b2cbf],
  [0xcaf0f8, 0x0077b6],
  [0xffc8dd, 0xff5d8f],
  [0xbde0fe, 0x4361ee],
  [0xf4a261, 0x9a3412],
  [0xffea00, 0xa16207],
  [0xd9ed92, 0x52b788],
  [0xf8edeb, 0xe5989b],
  [0xcdb4db, 0x6d597a],
  [0x80ed99, 0x2d6a4f],
];

// Playable characters. `unlock` is the best-score needed to use them.
// srcW/srcH are the cropped source-image dimensions used for scaling + hitbox.
const FUNNY_CHARACTERS = FUNNY_CHARACTER_NAMES.map((label, index) => {
  const [color, accent] = FUNNY_CHARACTER_COLORS[index];
  return {
    key: `funny-${index + 1}`,
    type: 'funny',
    label,
    color,
    accent,
    srcW: 120,
    srcH: 160,
    unlock: index * 1000,
    bodyWFrac: 0.62,
    bodyHFrac: 0.82,
    generated: true,
  };
});

const CHARACTERS = [
  { key: 'sonic',   type: 'known', label: 'סוניק', asset: '/assets/sonic.png',                srcW: 1015, srcH: 1002, unlock: 0,    bodyWFrac: 0.5,  bodyHFrac: 0.85 },
  { key: 'patrick', type: 'known', label: 'פטריק', asset: '/assets/patrick.png',              srcW: 742,  srcH: 838,  unlock: 2001, bodyWFrac: 0.55, bodyHFrac: 0.85 },
  { key: 'mario',   type: 'known', label: 'מריו',  asset: '/assets/mario_running_ssbwiu.png', srcW: 941,  srcH: 850,  unlock: 5001, bodyWFrac: 0.5,  bodyHFrac: 0.85 },
  ...FUNNY_CHARACTERS,
];

const STORAGE_BEST = 'dadOri.bestScore';
const STORAGE_CHAR = 'dadOri.character';

function getBestScore() {
  return parseInt(localStorage.getItem(STORAGE_BEST) || '0', 10) || 0;
}
function setBestScore(value) {
  localStorage.setItem(STORAGE_BEST, String(Math.floor(value)));
}
function getSelectedCharacter() {
  const key = localStorage.getItem(STORAGE_CHAR);
  return CHARACTERS.find((c) => c.key === key) ? key : 'sonic';
}
function setSelectedCharacter(key) {
  localStorage.setItem(STORAGE_CHAR, key);
}
function isUnlocked(character, bestScore) {
  return bestScore >= character.unlock;
}
function getCharacterType(typeKey) {
  return CHARACTER_TYPES.find((type) => type.key === typeKey) || CHARACTER_TYPES[0];
}
function getCharactersByType(typeKey) {
  return CHARACTERS.filter((character) => character.type === typeKey);
}

function ensureCharacterTexture(scene, character) {
  if (character.generated && !scene.textures.exists(character.key)) {
    createFunnyCharacterTexture(scene, character);
  }
}

function drawStar(graphics, centerX, centerY, points, innerRadius, outerRadius) {
  graphics.beginPath();

  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    if (i === 0) {
      graphics.moveTo(x, y);
    } else {
      graphics.lineTo(x, y);
    }
  }

  graphics.closePath();
  graphics.fillPath();
}

function createFunnyCharacterTexture(scene, character) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const { color, accent } = character;

  // Legs
  g.fillStyle(accent);
  g.fillRoundedRect(34, 112, 18, 36, 8);
  g.fillRoundedRect(68, 112, 18, 36, 8);
  g.fillStyle(0x1a1a2e);
  g.fillRoundedRect(24, 142, 30, 12, 6);
  g.fillRoundedRect(66, 142, 30, 12, 6);

  // Body
  g.fillStyle(color);
  g.fillRoundedRect(26, 52, 68, 76, 24);
  g.lineStyle(5, accent, 1);
  g.strokeRoundedRect(26, 52, 68, 76, 24);

  // Arms
  g.lineStyle(10, accent, 1);
  g.beginPath();
  g.moveTo(30, 76);
  g.lineTo(12, 104);
  g.moveTo(90, 76);
  g.lineTo(108, 48);
  g.strokePath();
  g.fillStyle(color);
  g.fillCircle(11, 105, 8);
  g.fillCircle(109, 47, 8);

  // Head
  g.fillStyle(color);
  g.fillCircle(60, 34, 30);
  g.lineStyle(5, accent, 1);
  g.strokeCircle(60, 34, 30);

  // Hair or silly crown spikes
  g.fillStyle(accent);
  g.fillTriangle(36, 17, 45, 0, 52, 18);
  g.fillTriangle(56, 8, 64, -8, 72, 12);
  g.fillTriangle(74, 17, 86, 2, 86, 24);

  // Face
  g.fillStyle(0xffffff);
  g.fillCircle(48, 30, 8);
  g.fillCircle(72, 30, 8);
  g.fillStyle(0x1a1a2e);
  g.fillCircle(50, 32, 3);
  g.fillCircle(74, 32, 3);
  g.lineStyle(4, 0x1a1a2e, 1);
  g.beginPath();
  g.arc(60, 42, 13, 0, Math.PI, false);
  g.strokePath();
  g.fillStyle(0xff6b35);
  g.fillCircle(60, 52, 4);

  // Chest badge makes every generated character feel like a collectible.
  g.fillStyle(0xffffff, 0.85);
  g.fillCircle(60, 87, 18);
  g.fillStyle(accent);
  drawStar(g, 60, 87, 5, 7, 15);

  g.generateTexture(character.key, character.srcW, character.srcH);
  g.destroy();
}

// Quiz difficulty levels. `example` is shown on the picker screen.
const DIFFICULTIES = [
  { key: 'easy',   label: 'קל',   example: '3 ועוד 5' },
  { key: 'normal', label: 'רגיל', example: '4 כפול 2' },
  { key: 'hard',   label: 'קשה',  example: '4995 ועוד 9089' },
];

const STORAGE_DIFF = 'dadOri.difficulty';

function getDifficulty() {
  const key = localStorage.getItem(STORAGE_DIFF);
  return DIFFICULTIES.find((d) => d.key === key) ? key : 'normal';
}
function setDifficulty(key) {
  localStorage.setItem(STORAGE_DIFF, key);
}

// Build a question for the given difficulty: { text, answer }.
function generateQuestion(difficultyKey) {
  if (difficultyKey === 'easy') {
    const a = Phaser.Math.Between(1, 9);
    const b = Phaser.Math.Between(1, 9);
    return { text: `כמה זה ${a} ועוד ${b}?`, answer: a + b };
  }
  if (difficultyKey === 'hard') {
    const a = Phaser.Math.Between(1000, 9999);
    const b = Phaser.Math.Between(1000, 9999);
    return { text: `כמה זה ${a} ועוד ${b}?`, answer: a + b };
  }
  // normal — multiplication of small numbers
  const a = Phaser.Math.Between(2, 9);
  const b = Phaser.Math.Between(2, 9);
  return { text: `כמה זה ${a} כפול ${b}?`, answer: a * b };
}

// Loads all character images once before any scene that draws them.
class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    for (const c of CHARACTERS) {
      if (c.asset) this.load.image(c.key, c.asset);
    }
  }

  create() {
    this.scene.start('MenuScene');
  }
}

class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    // On the menu there is no jumping — hide the on-screen jump button + hint.
    setControlsVisible(false);

    this.add.text(GAME_WIDTH / 2, 90, 'הרץ החכם', {
      fontSize: '40px',
      fontFamily: 'sans-serif',
      fontStyle: 'bold',
      color: '#1a1a2e',
      align: 'center',
    }).setOrigin(0.5);

    // Best score so far (drives character unlocks).
    this.add.text(GAME_WIDTH / 2, 150, `שיא: ${getBestScore()}`, {
      fontSize: '24px',
      fontFamily: 'sans-serif',
      color: '#1a1a2e',
    }).setOrigin(0.5);

    this.makeButton(GAME_WIDTH / 2, 220, 'התחל', 0xff6b35, 0xc44a1a, () => this.startGame());
    this.makeButton(GAME_WIDTH / 2, 300, 'דמויות', 0x1a1a2e, 0x0d0d18, () =>
      this.scene.start('CharacterTypeScene')
    );
    this.makeButton(GAME_WIDTH / 2, 380, 'רמת קושי', 0x1a1a2e, 0x0d0d18, () =>
      this.scene.start('DifficultyScene')
    );

    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  }

  makeButton(x, y, text, fill, stroke, onClick) {
    const button = this.add.rectangle(x, y, 240, 64, fill)
      .setStrokeStyle(4, stroke)
      .setInteractive({ useHandCursor: true });
    this.add.text(x, y, text, {
      fontSize: '30px',
      fontFamily: 'sans-serif',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);
    const base = fill;
    const hover = Phaser.Display.Color.IntegerToColor(fill).brighten(20).color;
    button.on('pointerover', () => button.setFillStyle(hover));
    button.on('pointerout', () => button.setFillStyle(base));
    button.on('pointerdown', () => {
      getAudioContext();
      onClick();
    });
    return button;
  }

  startGame() {
    getAudioContext();
    this.scene.start('GameScene');
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      getAudioContext();
      this.startGame();
    }
  }
}

// Character type submenu shown before the character picker.
class CharacterTypeScene extends Phaser.Scene {
  constructor() {
    super('CharacterTypeScene');
  }

  create() {
    setControlsVisible(false);
    const selectedCharacter = CHARACTERS.find((c) => c.key === getSelectedCharacter());

    this.add.text(GAME_WIDTH / 2, 62, 'סוג הדמות', {
      fontSize: '38px',
      fontFamily: 'sans-serif',
      fontStyle: 'bold',
      color: '#1a1a2e',
      align: 'center',
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 108, `דמות נוכחית: ${selectedCharacter.label}`, {
      fontSize: '20px',
      fontFamily: 'sans-serif',
      color: '#1a1a2e',
    }).setOrigin(0.5);

    CHARACTER_TYPES.forEach((type, i) => {
      const y = 190 + i * 105;
      const isCurrentType = selectedCharacter.type === type.key;
      const card = this.add.rectangle(GAME_WIDTH / 2, y, 500, 80, 0xffffff, 0.95)
        .setStrokeStyle(4, isCurrentType ? 0xff6b35 : 0xcccccc)
        .setInteractive({ useHandCursor: true });

      this.add.text(GAME_WIDTH / 2 + 210, y - 12, type.label, {
        fontSize: '28px',
        fontFamily: 'sans-serif',
        fontStyle: 'bold',
        color: '#1a1a2e',
        align: 'right',
      }).setOrigin(1, 0.5);

      this.add.text(GAME_WIDTH / 2 + 210, y + 20, type.description, {
        fontSize: '18px',
        fontFamily: 'sans-serif',
        color: '#666666',
        align: 'right',
      }).setOrigin(1, 0.5);

      this.add.text(GAME_WIDTH / 2 - 205, y, isCurrentType ? '✓' : '›', {
        fontSize: '30px',
        fontFamily: 'sans-serif',
        color: isCurrentType ? '#2d7a2d' : '#1a1a2e',
      }).setOrigin(0.5);

      card.on('pointerdown', () => this.scene.start('CharacterScene', { type: type.key, page: 0 }));
    });

    const back = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 50, 200, 56, 0x1a1a2e)
      .setStrokeStyle(4, 0x0d0d18)
      .setInteractive({ useHandCursor: true });
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 50, 'חזרה', {
      fontSize: '26px',
      fontFamily: 'sans-serif',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);
    back.on('pointerdown', () => this.scene.start('MenuScene'));
  }
}

// Character picker. Unlocked characters are selectable; locked ones show a
// lock icon and the score needed to unlock them.
class CharacterScene extends Phaser.Scene {
  constructor() {
    super('CharacterScene');
  }

  init(data) {
    this.characterType = getCharacterType(data?.type || 'known');
    this.page = data?.page || 0;
  }

  create() {
    setControlsVisible(false);
    const best = getBestScore();
    const selected = getSelectedCharacter();
    const characters = getCharactersByType(this.characterType.key);
    const perPage = this.characterType.key === 'funny' ? 10 : 3;
    const maxPage = Math.max(0, Math.ceil(characters.length / perPage) - 1);
    this.page = Phaser.Math.Clamp(this.page, 0, maxPage);
    const pageCharacters = characters.slice(this.page * perPage, (this.page + 1) * perPage);

    this.add.text(GAME_WIDTH / 2, 36, this.characterType.label, {
      fontSize: '32px',
      fontFamily: 'sans-serif',
      fontStyle: 'bold',
      color: '#1a1a2e',
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 74, `שיא: ${best}`, {
      fontSize: '18px',
      fontFamily: 'sans-serif',
      color: '#1a1a2e',
    }).setOrigin(0.5);

    if (this.characterType.key === 'funny') {
      this.add.text(GAME_WIDTH / 2, 100, 'הראשונה בחינם, ואז דמות חדשה כל 1000 נקודות', {
        fontSize: '16px',
        fontFamily: 'sans-serif',
        color: '#444444',
      }).setOrigin(0.5);
    }

    const columns = this.characterType.key === 'funny' ? 5 : characters.length;
    const cardW = this.characterType.key === 'funny' ? 138 : GAME_WIDTH / characters.length - 30;
    const cardH = this.characterType.key === 'funny' ? 136 : 230;
    const startY = this.characterType.key === 'funny' ? 178 : 240;
    const gapX = this.characterType.key === 'funny' ? 150 : GAME_WIDTH / characters.length;
    const startX = this.characterType.key === 'funny'
      ? (GAME_WIDTH - gapX * (columns - 1)) / 2
      : gapX / 2;

    pageCharacters.forEach((c, i) => {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const cx = this.characterType.key === 'funny' ? startX + col * gapX : gapX * i + startX;
      const cy = this.characterType.key === 'funny' ? startY + row * 150 : startY;
      const unlocked = isUnlocked(c, best);

      const card = this.add.rectangle(cx, cy, cardW, cardH, 0xffffff, 0.9)
        .setStrokeStyle(4, c.key === selected ? 0xff6b35 : 0xcccccc);

      // Character preview, scaled to fit the card.
      ensureCharacterTexture(this, c);
      const preview = this.add.image(cx, cy - (this.characterType.key === 'funny' ? 22 : 20), c.key);
      const maxDim = this.characterType.key === 'funny' ? 64 : 120;
      const scale = Math.min(maxDim / c.srcW, maxDim / c.srcH);
      preview.setScale(scale);
      if (!unlocked) preview.setTint(0x000000).setAlpha(0.45);

      this.add.text(cx, cy + (this.characterType.key === 'funny' ? 38 : 70), c.label, {
        fontSize: this.characterType.key === 'funny' ? '16px' : '24px',
        fontFamily: 'sans-serif',
        fontStyle: 'bold',
        color: '#1a1a2e',
        align: 'center',
        wordWrap: { width: cardW - 12, useAdvancedWrap: true },
      }).setOrigin(0.5);

      if (unlocked) {
        if (c.key === selected) {
          this.add.text(cx, cy + (this.characterType.key === 'funny' ? 61 : 100), '✓ נבחר', {
            fontSize: this.characterType.key === 'funny' ? '14px' : '18px',
            fontFamily: 'sans-serif',
            color: '#2d7a2d',
          }).setOrigin(0.5);
        }
        card.setInteractive({ useHandCursor: true });
        card.on('pointerdown', () => {
          setSelectedCharacter(c.key);
          this.scene.restart({ type: this.characterType.key, page: this.page });
        });
      } else {
        // Lock icon + required score.
        this.add.text(cx, cy - (this.characterType.key === 'funny' ? 22 : 20), '🔒', {
          fontSize: this.characterType.key === 'funny' ? '34px' : '48px',
        }).setOrigin(0.5);
        this.add.text(cx, cy + (this.characterType.key === 'funny' ? 61 : 100), `🔒 ${c.unlock} נק'`, {
          fontSize: this.characterType.key === 'funny' ? '14px' : '18px',
          fontFamily: 'sans-serif',
          color: '#cc2222',
        }).setOrigin(0.5);
      }
    });

    if (maxPage > 0) {
      this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 92, `עמוד ${this.page + 1} מתוך ${maxPage + 1}`, {
        fontSize: '18px',
        fontFamily: 'sans-serif',
        color: '#1a1a2e',
      }).setOrigin(0.5);

      this.makePagerButton(260, GAME_HEIGHT - 92, 'הקודם', this.page > 0, () => {
        this.scene.restart({ type: this.characterType.key, page: this.page - 1 });
      });
      this.makePagerButton(540, GAME_HEIGHT - 92, 'הבא', this.page < maxPage, () => {
        this.scene.restart({ type: this.characterType.key, page: this.page + 1 });
      });
    }

    // Back button.
    const back = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 40, 200, 52, 0x1a1a2e)
      .setStrokeStyle(4, 0x0d0d18)
      .setInteractive({ useHandCursor: true });
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 40, 'חזרה', {
      fontSize: '26px',
      fontFamily: 'sans-serif',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);
    back.on('pointerdown', () => this.scene.start('CharacterTypeScene'));
  }

  makePagerButton(x, y, label, enabled, onClick) {
    const button = this.add.rectangle(x, y, 120, 42, enabled ? 0xff6b35 : 0x999999, enabled ? 0.95 : 0.55)
      .setStrokeStyle(3, enabled ? 0xc44a1a : 0x777777);
    this.add.text(x, y, label, {
      fontSize: '18px',
      fontFamily: 'sans-serif',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);
    if (enabled) {
      button.setInteractive({ useHandCursor: true });
      button.on('pointerdown', onClick);
    }
  }
}

// Quiz difficulty picker.
class DifficultyScene extends Phaser.Scene {
  constructor() {
    super('DifficultyScene');
  }

  create() {
    setControlsVisible(false);
    const selected = getDifficulty();

    this.add.text(GAME_WIDTH / 2, 60, 'רמת קושי של השאלות', {
      fontSize: '34px',
      fontFamily: 'sans-serif',
      fontStyle: 'bold',
      color: '#1a1a2e',
    }).setOrigin(0.5);

    const startY = 140;
    const rowH = 86;

    DIFFICULTIES.forEach((d, i) => {
      const y = startY + i * rowH;
      const isSel = d.key === selected;

      const card = this.add.rectangle(GAME_WIDTH / 2, y, 460, 72, 0xffffff, 0.95)
        .setStrokeStyle(4, isSel ? 0xff6b35 : 0xcccccc)
        .setInteractive({ useHandCursor: true });

      this.add.text(GAME_WIDTH / 2 - 200, y, d.label, {
        fontSize: '28px',
        fontFamily: 'sans-serif',
        fontStyle: 'bold',
        color: '#1a1a2e',
      }).setOrigin(0, 0.5);

      this.add.text(GAME_WIDTH / 2 + 200, y, `${d.example} = ?`, {
        fontSize: '22px',
        fontFamily: 'monospace',
        color: '#666666',
      }).setOrigin(1, 0.5);

      if (isSel) {
        this.add.text(GAME_WIDTH / 2 - 120, y, '✓', {
          fontSize: '26px',
          fontFamily: 'sans-serif',
          color: '#2d7a2d',
        }).setOrigin(0.5);
      }

      card.on('pointerdown', () => {
        setDifficulty(d.key);
        this.scene.restart();
      });
    });

    const back = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 45, 200, 52, 0x1a1a2e)
      .setStrokeStyle(4, 0x0d0d18)
      .setInteractive({ useHandCursor: true });
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 45, 'חזרה', {
      fontSize: '26px',
      fontFamily: 'sans-serif',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);
    back.on('pointerdown', () => this.scene.start('MenuScene'));
  }
}

class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  preload() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x4a7c3a);
    g.fillRect(0, 0, 64, GROUND_HEIGHT);
    g.fillStyle(0x5e9a48);
    g.fillRect(0, 0, 64, 4);
    g.fillStyle(0x3a6028);
    g.fillRect(8, 12, 6, 4);
    g.fillRect(28, 22, 8, 3);
    g.fillRect(48, 14, 5, 5);
    g.fillRect(18, 36, 7, 4);
    g.fillRect(42, 44, 6, 3);
    g.generateTexture('ground', 64, GROUND_HEIGHT);
    g.destroy();

    const c = this.make.graphics({ x: 0, y: 0, add: false });
    c.fillStyle(0xffffff, 0.9);
    c.fillCircle(22, 24, 18);
    c.fillCircle(44, 20, 22);
    c.fillCircle(66, 26, 16);
    c.fillRect(18, 24, 54, 14);
    c.generateTexture('cloud', 90, 44);
    c.destroy();

    const cityBack = this.make.graphics({ x: 0, y: 0, add: false });
    cityBack.fillStyle(0x47657d);
    const cityBackBuildings = [
      [0, 62, 54, 88],
      [56, 34, 70, 116],
      [130, 54, 58, 96],
      [192, 24, 76, 126],
      [272, 48, 50, 102],
      [326, 72, 74, 78],
    ];
    cityBackBuildings.forEach(([x, y, w, h]) => cityBack.fillRect(x, y, w, h));
    cityBack.fillStyle(0xfff2a8, 0.55);
    cityBackBuildings.forEach(([buildingX, buildingY, buildingW, buildingH], buildingIndex) => {
      for (let x = buildingX + 12; x <= buildingX + buildingW - 16; x += 22) {
        for (let y = buildingY + 14; y <= buildingY + buildingH - 18; y += 24) {
          if ((x + y + buildingIndex) % 3 !== 0) cityBack.fillRect(x, y, 8, 10);
        }
      }
    });
    cityBack.generateTexture('city-back', 400, 150);
    cityBack.destroy();

    const cityFront = this.make.graphics({ x: 0, y: 0, add: false });
    cityFront.fillStyle(0x23364d);
    const cityFrontBuildings = [
      [0, 78, 62, 112],
      [66, 36, 92, 154],
      [162, 88, 54, 102],
      [222, 18, 84, 172],
      [312, 64, 76, 126],
      [392, 42, 88, 148],
    ];
    cityFrontBuildings.forEach(([x, y, w, h]) => cityFront.fillRect(x, y, w, h));
    cityFront.fillStyle(0xffd36e, 0.85);
    cityFrontBuildings.forEach(([buildingX, buildingY, buildingW, buildingH], buildingIndex) => {
      for (let x = buildingX + 14; x <= buildingX + buildingW - 18; x += 24) {
        for (let y = buildingY + 16; y <= buildingY + buildingH - 20; y += 26) {
          if ((x * y + buildingIndex) % 5 !== 0) cityFront.fillRect(x, y, 9, 12);
        }
      }
    });
    cityFront.generateTexture('city-front', 480, 190);
    cityFront.destroy();

    // Traffic light texture: hanging signal head on a roadside pole.
    const light = this.make.graphics({ x: 0, y: 0, add: false });
    // pole and base
    light.fillStyle(0x4b5563);
    light.fillRect(23, 34, 6, 46);
    light.fillStyle(0x374151);
    light.fillRect(16, 78, 20, 6);
    // signal housing
    light.fillStyle(0x111827);
    light.fillRoundedRect(10, 0, 42, 54, 8);
    light.fillStyle(0x1f2937);
    light.fillRoundedRect(14, 4, 34, 46, 6);
    // signal lights
    light.fillStyle(0xff2d2d);
    light.fillCircle(31, 13, 8);
    light.fillStyle(0xffd23f);
    light.fillCircle(31, 27, 8);
    light.fillStyle(0x32d96b);
    light.fillCircle(31, 41, 8);
    // glossy highlights
    light.fillStyle(0xffffff, 0.45);
    light.fillCircle(28, 10, 2);
    light.fillCircle(28, 24, 2);
    light.fillCircle(28, 38, 2);
    light.generateTexture('traffic-light', 62, 84);
    light.destroy();
  }

  create() {
    // Show the on-screen jump controls now that we're playing.
    setControlsVisible(true);

    this.gameOver = false;
    this.quizActive = false;
    this.score = 0;
    this.bestScore = getBestScore();
    this.nextObstacleX = GAME_WIDTH + Phaser.Math.Between(400, 800);

    this.cityBack = this.add.tileSprite(
      GAME_WIDTH / 2,
      GROUND_TOP - 150 / 2,
      GAME_WIDTH,
      150,
      'city-back'
    );
    this.cityFront = this.add.tileSprite(
      GAME_WIDTH / 2,
      GROUND_TOP - 190 / 2,
      GAME_WIDTH,
      190,
      'city-front'
    );

    this.clouds = [];
    for (let i = 0; i < 4; i++) {
      const cloud = this.add.image(
        (GAME_WIDTH / 4) * i + Phaser.Math.Between(0, 80),
        Phaser.Math.Between(40, 160),
        'cloud'
      );
      cloud.setAlpha(0.85);
      this.clouds.push(cloud);
    }

    this.ground = this.add.tileSprite(
      GAME_WIDTH / 2,
      GROUND_TOP + GROUND_HEIGHT / 2,
      GAME_WIDTH,
      GROUND_HEIGHT,
      'ground'
    );

    const groundBody = this.add.rectangle(
      GAME_WIDTH / 2,
      GROUND_TOP + GROUND_HEIGHT / 2,
      GAME_WIDTH,
      GROUND_HEIGHT
    );
    this.physics.add.existing(groundBody, true);

    this.obstacles = this.physics.add.group();

    // Use the player's chosen character; scale it down to PLAYER_HEIGHT.
    const character = CHARACTERS.find((c) => c.key === getSelectedCharacter());
    ensureCharacterTexture(this, character);
    const playerScale = PLAYER_HEIGHT / character.srcH;
    this.player = this.physics.add.sprite(PLAYER_X, GROUND_TOP - PLAYER_HEIGHT / 2, character.key);
    this.player.setScale(playerScale);
    // Hitbox: central body only (arms/legs reach out in the run pose),
    // bottom flush with the feet so they rest on the ground. Source pixels.
    const bodyW = character.srcW * character.bodyWFrac;
    const bodyH = character.srcH * character.bodyHFrac;
    this.player.body.setSize(bodyW, bodyH);
    this.player.body.setOffset((character.srcW - bodyW) / 2, character.srcH - bodyH);
    this.player.body.setCollideWorldBounds(true);
    this.baseScale = playerScale;

    this.physics.add.collider(this.player, groundBody);

    this.physics.add.overlap(this.player, this.obstacles, (player, obstacle) => {
      if (!this.quizActive && !this.gameOver) this.showQuiz(obstacle);
    });

    // Score text
    this.scoreText = this.add.text(GAME_WIDTH - 16, 16, 'Score: 0', {
      fontSize: '22px',
      fontFamily: 'monospace',
      color: '#1a1a2e',
    }).setOrigin(1, 0);

    // Back-to-menu button (top-left)
    const menuBtn = this.add.rectangle(16, 16, 96, 36, 0x1a1a2e, 0.8)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({ useHandCursor: true })
      .setDepth(20);
    const menuLabel = this.add.text(16 + 48, 16 + 18, 'תפריט', {
      fontSize: '20px',
      fontFamily: 'sans-serif',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(21);
    menuBtn.on('pointerover', () => menuBtn.setFillStyle(0x333355, 0.9));
    menuBtn.on('pointerout', () => menuBtn.setFillStyle(0x1a1a2e, 0.8));
    menuBtn.on('pointerdown', () => this.scene.start('MenuScene'));

    // Game-over overlay (hidden initially)
    this.overlayCover = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.45
    ).setVisible(false);
    this.overText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'אואץ׳!!!', {
      fontSize: '52px',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      color: '#ff6b35',
    }).setOrigin(0.5).setVisible(false);
    this.restartText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, 'לחץ על רווח, גע במסך או לחץ קפיצה כדי להפעיל מחדש', {
      fontSize: '20px',
      fontFamily: 'monospace',
      color: '#ffffff',
    }).setOrigin(0.5).setVisible(false);

    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.touchJumpHandler = (_pointer, currentlyOver = []) => {
      if (currentlyOver.includes(menuBtn)) return;
      this.handleJumpInput();
    };
    this.input.on('pointerdown', this.touchJumpHandler);

    this.jumpHandler = () => {
      this.handleJumpInput();
    };
    document.addEventListener(JUMP_EVENT, this.jumpHandler);

    // Quiz modal wiring
    this.quizModal = document.getElementById('quiz-modal');
    this.quizQuestion = document.getElementById('quiz-question');
    this.quizAnswer = document.getElementById('quiz-answer');
    this.quizForm = document.getElementById('quiz-form');
    this.quizFeedback = document.getElementById('quiz-feedback');

    this.quizSubmitHandler = (e) => {
      e.preventDefault();
      this.checkQuizAnswer();
    };
    this.quizForm.addEventListener('submit', this.quizSubmitHandler);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.persistBest();
      this.input.off('pointerdown', this.touchJumpHandler);
      document.removeEventListener(JUMP_EVENT, this.jumpHandler);
      this.quizForm.removeEventListener('submit', this.quizSubmitHandler);
      this.quizModal.classList.remove('show');
    });
  }

  handleJumpInput() {
    if (this.quizActive) return;
    if (this.gameOver) {
      this.restartGame();
    } else {
      this.tryJump();
    }
  }

  tryJump() {
    const body = this.player.body;
    if (body.blocked.down || body.touching.down) {
      body.setVelocityY(JUMP_VELOCITY);
    }
  }

  // Save the best score reached if it beats what's stored (drives unlocks).
  persistBest() {
    if (this.bestScore > getBestScore()) {
      setBestScore(this.bestScore);
    }
  }

  showQuiz(obstacle) {
    playBuildingTouchBeep();
    this.quizActive = true;
    this.hitObstacle = obstacle;
    this.physics.pause();

    // Question depends on the chosen difficulty level.
    const question = generateQuestion(getDifficulty());
    this.quizCorrectAnswer = question.answer;

    this.quizQuestion.textContent = question.text;
    this.quizFeedback.textContent = '';
    this.quizAnswer.value = '';
    this.quizModal.classList.add('show');
    // Focus after the modal is visible so mobile keyboards open.
    window.setTimeout(() => this.quizAnswer.focus(), 50);
  }

  checkQuizAnswer() {
    if (!this.quizActive) return;
    const value = parseInt(this.quizAnswer.value, 10);
    if (Number.isNaN(value)) {
      this.quizFeedback.textContent = 'כתבו מספר';
      this.quizFeedback.style.color = '#c44a1a';
      return;
    }

    if (value === this.quizCorrectAnswer) {
      this.quizFeedback.textContent = 'כל הכבוד! 🎉';
      this.quizFeedback.style.color = '#2d7a2d';
      window.setTimeout(() => this.resolveQuiz(true), 700);
    } else {
      this.quizFeedback.textContent = `אופס! התשובה היא ${this.quizCorrectAnswer}`;
      this.quizFeedback.style.color = '#cc2222';
      window.setTimeout(() => this.resolveQuiz(false), 1400);
    }
  }

  resolveQuiz(correct) {
    this.quizModal.classList.remove('show');
    this.quizActive = false;
    this.physics.resume();

    if (correct) {
      // Another turn: clear the traffic light he hit and keep running with his score.
      if (this.hitObstacle && this.hitObstacle.active) {
        this.hitObstacle.destroy();
      }
      this.hitObstacle = null;
    } else {
      // Start over from the top — but bank the best score first (for unlocks).
      this.persistBest();
      this.restartGame();
    }
  }

  spawnObstacle() {
    const trafficLightH = 84;
    const obs = this.obstacles.create(
      GAME_WIDTH + 50,
      GROUND_TOP - trafficLightH / 2,
      'traffic-light'
    );
    obs.body.setAllowGravity(false);
    obs.body.setImmovable(true);
    obs.body.setVelocityX(-SCROLL_SPEED);
    this.nextObstacleX += Phaser.Math.Between(OBSTACLE_MIN_GAP, OBSTACLE_MAX_GAP);
  }

  triggerGameOver() {
    this.gameOver = true;
    this.player.setTint(0xcc2222);
    this.obstacles.getChildren().forEach(o => o.body.setVelocityX(0));
    this.overlayCover.setVisible(true);
    this.overText.setVisible(true);
    this.restartText.setVisible(true);
  }

  restartGame() {
    this.obstacles.clear(true, true);
    this.score = 0;
    this.gameOver = false;
    this.nextObstacleX = GAME_WIDTH + Phaser.Math.Between(400, 800);
    this.player.clearTint();
    this.player.angle = 0;
    this.player.setScale(this.baseScale);
    this.player.body.setVelocityY(0);
    this.player.y = GROUND_TOP - PLAYER_HEIGHT / 2;
    this.overlayCover.setVisible(false);
    this.overText.setVisible(false);
    this.restartText.setVisible(false);
    this.scoreText.setText('Score: 0');
  }

  update(time, delta) {
    // Freeze everything while the math quiz is open.
    if (this.quizActive) return;

    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      if (this.gameOver) {
        this.restartGame();
        return;
      }
      this.tryJump();
    }

    if (this.gameOver) return;

    const deltaSec = delta / 1000;

    this.score += SCROLL_SPEED * deltaSec / 10;
    this.scoreText.setText(`Score: ${Math.floor(this.score)}`);
    if (Math.floor(this.score) > this.bestScore) {
      this.bestScore = Math.floor(this.score);
    }

    // Running animation: ONLY a lean rock. No scale change, no manual y —
    // anything touching y/scale read as jumping or fought the physics.
    const onGround = this.player.body.blocked.down;
    const freq = 7; // rock cycles per second
    const t = time / 1000;
    if (onGround) {
      const cycle = Math.sin(t * freq * Math.PI * 2);
      // rock the body forward/back around an -8° forward tilt
      this.player.angle = -8 + cycle * 6;
    } else {
      // In air: forward tuck
      this.player.angle = -20;
    }

    this.ground.tilePositionX += SCROLL_SPEED * deltaSec;
    this.cityBack.tilePositionX += CITY_BACK_SPEED * deltaSec;
    this.cityFront.tilePositionX += CITY_FRONT_SPEED * deltaSec;

    for (const cloud of this.clouds) {
      cloud.x -= CLOUD_SPEED * deltaSec;
      if (cloud.x < -cloud.displayWidth / 2) {
        cloud.x = GAME_WIDTH + cloud.displayWidth / 2;
        cloud.y = Phaser.Math.Between(40, 160);
      }
    }

    // Spawn obstacles based on distance scrolled
    this.nextObstacleX -= SCROLL_SPEED * deltaSec;
    if (this.nextObstacleX <= 0) {
      this.spawnObstacle();
    }

    // Remove obstacles that have left the screen
    this.obstacles.getChildren().forEach(obs => {
      if (obs.x < -100) obs.destroy();
    });
  }
}

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#87ceeb',
  parent: 'game-container',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: GRAVITY },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
  },
  scene: [PreloadScene, MenuScene, CharacterTypeScene, CharacterScene, DifficultyScene, GameScene],
};

new Phaser.Game(config);

const jumpButton = document.getElementById('jump-button');
const hint = document.querySelector('.hint');
const dispatchJump = () => {
  getAudioContext();
  document.dispatchEvent(new CustomEvent(JUMP_EVENT));
};
jumpButton.addEventListener('click', dispatchJump);

// Show/hide the on-screen jump controls depending on the active scene.
function setControlsVisible(visible) {
  const display = visible ? '' : 'none';
  jumpButton.style.display = display;
  if (hint) hint.style.display = display;
}
