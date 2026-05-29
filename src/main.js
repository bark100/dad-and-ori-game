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

class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    // On the menu there is no jumping — hide the on-screen jump button + hint.
    setControlsVisible(false);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 90, 'משחק הקפיצות של אבא ואורי', {
      fontSize: '40px',
      fontFamily: 'sans-serif',
      fontStyle: 'bold',
      color: '#1a1a2e',
      align: 'center',
    }).setOrigin(0.5);

    // Start button: rounded rectangle + label
    const btnW = 220;
    const btnH = 70;
    const btnY = GAME_HEIGHT / 2 + 30;
    const button = this.add.rectangle(GAME_WIDTH / 2, btnY, btnW, btnH, 0xff6b35)
      .setStrokeStyle(4, 0xc44a1a)
      .setInteractive({ useHandCursor: true });
    const label = this.add.text(GAME_WIDTH / 2, btnY, 'התחל', {
      fontSize: '34px',
      fontFamily: 'sans-serif',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);

    button.on('pointerover', () => button.setFillStyle(0xff8255));
    button.on('pointerout', () => button.setFillStyle(0xff6b35));
    button.on('pointerdown', () => this.startGame());

    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
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

    this.load.image('sonic', '/assets/sonic.png');

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

    // Scale sonic image (1900x1140) down to PLAYER_HEIGHT
    const sonicScale = PLAYER_HEIGHT / 1140;
    this.player = this.physics.add.sprite(PLAYER_X, GROUND_TOP - PLAYER_HEIGHT / 2, 'sonic');
    this.player.setScale(sonicScale);
    // Tighter physics body for fair hit detection
    this.player.body.setSize(PLAYER_WIDTH, PLAYER_HEIGHT);
    this.player.body.setCollideWorldBounds(true);
    this.baseScale = sonicScale;

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

  showQuiz(obstacle) {
    this.quizActive = true;
    this.hitObstacle = obstacle;
    this.physics.pause();

    // Simple multiplication quiz with small numbers.
    const a = Phaser.Math.Between(2, 9);
    const b = Phaser.Math.Between(2, 9);
    this.quizCorrectAnswer = a * b;

    this.quizQuestion.textContent = `כמה זה ${a} כפול ${b}?`;
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
      // Start over from the top.
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
  scene: [MenuScene, GameScene],
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
