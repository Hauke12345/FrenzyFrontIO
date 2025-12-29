import { getMobileConfig } from "../../MobileOptimizations";
import { FrenzyRenderContext } from "./FrenzyRenderContext";

/**
 * Gold text floating effect
 */
export interface GoldTextEffect {
  x: number;
  y: number;
  gold: number;
  lifeTime: number;
  duration: number;
}

/**
 * Artillery explosion effect
 */
export interface ExplosionEffect {
  x: number;
  y: number;
  radius: number;
  lifeTime: number;
  duration: number;
}

/**
 * Renders visual effects in Frenzy mode:
 * - Gold income text popups
 * - Artillery explosion flashes
 */
export class EffectsRenderer {
  private goldTextEffects: GoldTextEffect[] = [];
  private explosionEffects: ExplosionEffect[] = [];
  private lastPayoutIds = new Set<string>();
  private lastArtilleryIds = new Set<number>();

  /**
   * Process new gold payouts from frenzy state
   */
  processGoldPayouts(payouts: Array<{ x: number; y: number; gold: number }>) {
    if (!payouts || payouts.length === 0) {
      this.lastPayoutIds.clear();
      return;
    }

    const newPayoutIds = new Set<string>();
    for (const payout of payouts) {
      const payoutId = `${payout.x}_${payout.y}_${payout.gold}`;
      newPayoutIds.add(payoutId);

      if (!this.lastPayoutIds.has(payoutId)) {
        this.goldTextEffects.push({
          x: payout.x,
          y: payout.y,
          gold: payout.gold,
          lifeTime: 0,
          duration: 1500,
        });
      }
    }
    this.lastPayoutIds = newPayoutIds;
  }

  /**
   * Track artillery projectiles and spawn explosions on impact
   */
  processArtilleryProjectiles(
    projectiles: Array<{
      id: number;
      isArtillery?: boolean;
      progress?: number;
      targetX?: number;
      targetY?: number;
      areaRadius?: number;
      x: number;
      y: number;
    }>,
  ) {
    const currentArtilleryIds = new Set<number>();

    for (const projectile of projectiles) {
      if (projectile.isArtillery) {
        currentArtilleryIds.add(projectile.id);

        if (!this.lastArtilleryIds.has(projectile.id)) {
          this.lastArtilleryIds.add(projectile.id);
        }

        // Spawn explosion when near impact
        const progress = projectile.progress ?? 0;
        const targetX = projectile.targetX ?? projectile.x;
        const targetY = projectile.targetY ?? projectile.y;

        if (progress >= 0.95) {
          const existingExplosion = this.explosionEffects.find(
            (e) =>
              Math.abs(e.x - targetX) < 1 &&
              Math.abs(e.y - targetY) < 1 &&
              e.lifeTime < 100,
          );

          if (!existingExplosion) {
            this.explosionEffects.push({
              x: targetX,
              y: targetY,
              radius: projectile.areaRadius ?? 15,
              lifeTime: 0,
              duration: 600,
            });
          }
        }
      }
    }

    // Clean up tracked IDs for projectiles that are gone
    for (const id of this.lastArtilleryIds) {
      if (!currentArtilleryIds.has(id)) {
        this.lastArtilleryIds.delete(id);
      }
    }

    this.lastArtilleryIds = currentArtilleryIds;
  }

  /**
   * Update and render gold text effects
   */
  renderGoldEffects(ctx: FrenzyRenderContext, deltaTime: number) {
    const context = ctx.context;

    this.goldTextEffects = this.goldTextEffects.filter((effect) => {
      effect.lifeTime += deltaTime;
      if (effect.lifeTime >= effect.duration) {
        return false;
      }

      const t = effect.lifeTime / effect.duration;
      const riseDistance = 15;
      const x = effect.x - ctx.halfWidth;
      const y = effect.y - ctx.halfHeight - t * riseDistance;
      const alpha = 1 - t;

      const goldText = `+${effect.gold}`;

      context.save();
      context.font = "bold 6px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";

      // Black outline
      context.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
      context.lineWidth = 1.5;
      context.strokeText(goldText, x, y);

      // Gold fill
      context.fillStyle = `rgba(255, 215, 0, ${alpha})`;
      context.fillText(goldText, x, y);
      context.restore();

      return true;
    });
  }

  /**
   * Update and render explosion effects
   */
  renderExplosions(ctx: FrenzyRenderContext, deltaTime: number) {
    const context = ctx.context;
    const mobileConfig = getMobileConfig();

    this.explosionEffects = this.explosionEffects.filter((explosion) => {
      explosion.lifeTime += deltaTime;
      if (explosion.lifeTime >= explosion.duration) {
        return false;
      }

      const t = explosion.lifeTime / explosion.duration;
      const x = explosion.x - ctx.halfWidth;
      const y = explosion.y - ctx.halfHeight;

      // Flash grows quickly then fades
      const growthPhase = Math.min(t * 5, 1);
      const currentRadius = explosion.radius * growthPhase;
      const alpha = Math.pow(1 - t, 2);

      // Simplified rendering for mobile - single circle instead of gradient
      if (mobileConfig.reducedParticles) {
        context.fillStyle = `rgba(255, 200, 100, ${alpha * 0.5})`;
        context.beginPath();
        context.arc(x, y, currentRadius, 0, Math.PI * 2);
        context.fill();
      } else {
        // Flash gradient
        const flashGradient = context.createRadialGradient(
          x,
          y,
          0,
          x,
          y,
          currentRadius,
        );
        flashGradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        flashGradient.addColorStop(0.3, `rgba(255, 255, 200, ${alpha * 0.8})`);
        flashGradient.addColorStop(0.6, `rgba(255, 200, 100, ${alpha * 0.4})`);
        flashGradient.addColorStop(1, `rgba(255, 150, 50, 0)`);

        context.fillStyle = flashGradient;
        context.beginPath();
        context.arc(x, y, currentRadius, 0, Math.PI * 2);
        context.fill();
      }

      return true;
    });
  }
}
