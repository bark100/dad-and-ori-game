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
const OBSTACLE_MIN_GAP = 900;
const OBSTACLE_MAX_GAP = 1600;

const JUMP_EVENT = 'player-jump';

// Playable characters. `unlock` is the best-score needed to use them.
// srcW/srcH are the cropped source-image dimensions used for scaling + hitbox.
const CHARACTERS = [
  { key: 'sonic',   label: 'סוניק', asset: '/assets/sonic.png',                srcW: 1015, srcH: 1002, unlock: 0,    bodyWFrac: 0.5,  bodyHFrac: 0.85 },
  { key: 'patrick', label: 'פטריק', asset: '/assets/patrick.png',              srcW: 742,  srcH: 838,  unlock: 2001, bodyWFrac: 0.55, bodyHFrac: 0.85 },
  { key: 'mario',   label: 'מריו',  asset: '/assets/mario_running_ssbwiu.png', srcW: 941,  srcH: 850,  unlock: 5001, bodyWFrac: 0.5,  bodyHFrac: 0.85 },
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
      this.load.image(c.key, c.asset);
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

    this.add.text(GAME_WIDTH / 2, 90, 'משחק הקפיצות של אבא ואורי', {
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
      this.scene.start('CharacterScene')
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
    button.on('pointerdown', onClick);
    return button;
  }

  startGame() {
    this.scene.start('GameScene');
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.startGame();
    }
  }
}

// Character picker. Unlocked characters are selectable; locked ones show a
// lock icon and the score needed to unlock them.
class CharacterScene extends Phaser.Scene {
  constructor() {
    super('CharacterScene');
  }

  create() {
    setControlsVisible(false);
    const best = getBestScore();
    const selected = getSelectedCharacter();

    this.add.text(GAME_WIDTH / 2, 50, 'בחר דמות', {
      fontSize: '36px',
      fontFamily: 'sans-serif',
      fontStyle: 'bold',
      color: '#1a1a2e',
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 92, `שיא: ${best}`, {
      fontSize: '20px',
      fontFamily: 'sans-serif',
      color: '#1a1a2e',
    }).setOrigin(0.5);

    const slotW = GAME_WIDTH / CHARACTERS.length;
    const cardY = 240;

    CHARACTERS.forEach((c, i) => {
      const cx = slotW * i + slotW / 2;
      const unlocked = isUnlocked(c, best);

      const card = this.add.rectangle(cx, cardY, slotW - 30, 230, 0xffffff, 0.9)
        .setStrokeStyle(4, c.key === selected ? 0xff6b35 : 0xcccccc);

      // Character preview, scaled to fit the card.
      const preview = this.add.image(cx, cardY - 20, c.key);
      const maxDim = 120;
      const scale = Math.min(maxDim / c.srcW, maxDim / c.srcH);
      preview.setScale(scale);
      if (!unlocked) preview.setTint(0x000000).setAlpha(0.45);

      this.add.text(cx, cardY + 70, c.label, {
        fontSize: '24px',
        fontFamily: 'sans-serif',
        fontStyle: 'bold',
        color: '#1a1a2e',
      }).setOrigin(0.5);

      if (unlocked) {
        if (c.key === selected) {
          this.add.text(cx, cardY + 100, '✓ נבחר', {
            fontSize: '18px',
            fontFamily: 'sans-serif',
            color: '#2d7a2d',
          }).setOrigin(0.5);
        }
        card.setInteractive({ useHandCursor: true });
        card.on('pointerdown', () => {
          setSelectedCharacter(c.key);
          this.scene.restart();
        });
      } else {
        // Lock icon + required score.
        this.add.text(cx, cardY - 20, '🔒', { fontSize: '48px' }).setOrigin(0.5);
        this.add.text(cx, cardY + 100, `🔒 ${c.unlock} נק'`, {
          fontSize: '18px',
          fontFamily: 'sans-serif',
          color: '#cc2222',
        }).setOrigin(0.5);
      }
    });

    // Back button.
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

    // Cactus texture: tall stem + two side arms
    const cac = this.make.graphics({ x: 0, y: 0, add: false });
    cac.fillStyle(0x2d7a2d);
    // stem
    cac.fillRect(16, 0, 18, 72);
    // left arm
    cac.fillRect(0, 18, 16, 12);
    cac.fillRect(0, 6, 12, 12);
    // right arm
    cac.fillRect(34, 24, 16, 12);
    cac.fillRect(38, 12, 12, 12);
    cac.generateTexture('cactus', 50, 72);
    cac.destroy();
  }

  create() {
    // Show the on-screen jump controls now that we're playing.
    setControlsVisible(true);

    this.gameOver = false;
    this.quizActive = false;
    this.score = 0;
    this.bestScore = getBestScore();
    this.nextObstacleX = GAME_WIDTH + Phaser.Math.Between(400, 800);

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
    this.restartText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, 'לחץ על כפתור הרווח או קפיצה כדי להפעיל מחדש', {
      fontSize: '20px',
      fontFamily: 'monospace',
      color: '#ffffff',
    }).setOrigin(0.5).setVisible(false);

    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.jumpHandler = () => {
      if (this.quizActive) return;
      if (this.gameOver) {
        this.restartGame();
      } else {
        this.tryJump();
      }
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
      document.removeEventListener(JUMP_EVENT, this.jumpHandler);
      this.quizForm.removeEventListener('submit', this.quizSubmitHandler);
      this.quizModal.classList.remove('show');
    });
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
      // Another turn: clear the cactus he hit and keep running with his score.
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
    const cactusH = 72;
    const obs = this.obstacles.create(
      GAME_WIDTH + 50,
      GROUND_TOP - cactusH / 2,
      'cactus'
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
  scene: [PreloadScene, MenuScene, CharacterScene, DifficultyScene, GameScene],
};

new Phaser.Game(config);

const jumpButton = document.getElementById('jump-button');
const hint = document.querySelector('.hint');
const dispatchJump = () => document.dispatchEvent(new CustomEvent(JUMP_EVENT));
jumpButton.addEventListener('click', dispatchJump);

// Show/hide the on-screen jump controls depending on the active scene.
function setControlsVisible(visible) {
  const display = visible ? '' : 'none';
  jumpButton.style.display = display;
  if (hint) hint.style.display = display;
}
