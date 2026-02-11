export class IdleAnimator {
  private time = 0;
  private nextBlink = 2 + Math.random() * 4;
  private blinkTimer = 0;
  private isBlinking = false;

  update(delta: number): Record<string, number> {
    this.time += delta;
    const shapes: Record<string, number> = {};

    // Breathing: subtle chest/head movement via sine
    const breathCycle = Math.sin(this.time * 1.2) * 0.5 + 0.5;
    shapes["neutral"] = breathCycle * 0.02;

    // Blink logic
    this.blinkTimer += delta;
    if (!this.isBlinking && this.blinkTimer >= this.nextBlink) {
      this.isBlinking = true;
      this.blinkTimer = 0;
    }

    if (this.isBlinking) {
      // Blink takes ~150ms
      const blinkProgress = this.blinkTimer / 0.15;
      if (blinkProgress >= 1) {
        this.isBlinking = false;
        this.blinkTimer = 0;
        this.nextBlink = 2 + Math.random() * 4;
        shapes["blinkLeft"] = 0;
        shapes["blinkRight"] = 0;
      } else {
        // Quick close, slower open
        const blinkValue =
          blinkProgress < 0.4
            ? blinkProgress / 0.4
            : 1 - (blinkProgress - 0.4) / 0.6;
        shapes["blinkLeft"] = blinkValue;
        shapes["blinkRight"] = blinkValue;
      }
    }

    // Subtle head micro-movement
    shapes["lookUp"] = Math.sin(this.time * 0.3) * 0.02;
    shapes["lookLeft"] = Math.sin(this.time * 0.2 + 1) * 0.02;

    return shapes;
  }
}
