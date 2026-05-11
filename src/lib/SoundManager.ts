export const SOUNDS = {
  LOBBY: 'https://assets.mixkit.co/music/preview/mixkit-game-show-suspense-waiting-667.mp3',
  QUESTION: 'https://assets.mixkit.co/music/preview/mixkit-electronic-game-603.mp3',
  CORRECT: 'https://assets.mixkit.co/sfx/preview/mixkit-winning-chime-2065.mp3',
  INCORRECT: 'https://assets.mixkit.co/sfx/preview/mixkit-falling-game-over-213.mp3',
  COUNTDOWN: 'https://assets.mixkit.co/sfx/preview/mixkit-clock-ticking-countdown-2415.mp3',
  PODIUM: 'https://assets.mixkit.co/music/preview/mixkit-celebration-64.mp3',
};

class SoundManager {
  private audio: HTMLAudioElement | null = null;
  private currentSound: string | null = null;

  play(url: string, loop: boolean = false) {
    if (this.currentSound === url && this.audio && !this.audio.paused) return;
    
    this.stop();
    this.audio = new Audio(url);
    this.audio.loop = loop;
    this.audio.play().catch(e => console.log('Audio play blocked:', e));
    this.currentSound = url;
  }

  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
      this.currentSound = null;
    }
  }

  playOneShot(url: string) {
    const shot = new Audio(url);
    shot.play().catch(e => console.log('Audio play blocked:', e));
  }
}

export const soundManager = new SoundManager();
