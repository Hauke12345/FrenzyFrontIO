import { FrenzyRenderContext } from "./FrenzyRenderContext";

/**
 * Projectile data from game state
 */
export interface FrenzyProjectileData {
  id: number;
  playerId: string;
  x: number;
  y: number;
  isBeam?: boolean;
  isElite?: boolean;
  isArtillery?: boolean;
  isMissile?: boolean;
  areaRadius?: number;
  startX?: number;
  startY?: number;
  targetX?: number;
  targetY?: number;
  progress?: number;
}

/**
 * Renders all projectile types in Frenzy mode:
 * - Plasma projectiles (default)
 * - Elite projectiles (golden glow)
 * - Artillery shells (ballistic arc)
 * - Defense post beams (red laser)
 * - Missiles (tier 2 warship, fast straight trajectory)
 */
export class ProjectileRenderer {
  /**
   * Render a projectile
   */
  render(ctx: FrenzyRenderContext, projectile: FrenzyProjectileData, diameter: number) {
    const x = projectile.x - ctx.halfWidth;
    const y = projectile.y - ctx.halfHeight;

    // Beam rendering
    if (projectile.isBeam && projectile.startX !== undefined && projectile.startY !== undefined) {
      this.renderBeam(ctx, projectile);
      return;
    }

    const radius = Math.max(1, diameter / 2);

    // Elite projectile
    if (projectile.isElite) {
      this.renderEliteProjectile(ctx.context, x, y, radius);
      return;
    }

    // Artillery shell
    if (projectile.isArtillery) {
      this.renderArtilleryProjectile(ctx, projectile);
      return;
    }

    // Missile (tier 2 warship)
    if (projectile.isMissile) {
      this.renderMissile(ctx, projectile);
      return;
    }

    // Default plasma projectile
    this.renderPlasmaProjectile(ctx.context, x, y, radius);
  }

  private renderPlasmaProjectile(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
  ) {
    // Outer glow
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius * 2.5);
    gradient.addColorStop(0, "rgba(0, 255, 255, 0.9)");
    gradient.addColorStop(0.3, "rgba(100, 200, 255, 0.7)");
    gradient.addColorStop(0.6, "rgba(150, 100, 255, 0.4)");
    gradient.addColorStop(1, "rgba(100, 50, 200, 0)");

    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius * 2.5, 0, Math.PI * 2);
    context.fill();

    // Bright core
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(x, y, radius * 0.5, 0, Math.PI * 2);
    context.fill();
  }

  private renderEliteProjectile(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
  ) {
    const eliteRadius = radius * 1.5;

    // Golden glow
    const gradient = context.createRadialGradient(x, y, 0, x, y, eliteRadius * 2.5);
    gradient.addColorStop(0, "rgba(255, 255, 150, 0.95)");
    gradient.addColorStop(0.3, "rgba(255, 220, 100, 0.8)");
    gradient.addColorStop(0.6, "rgba(255, 180, 50, 0.5)");
    gradient.addColorStop(1, "rgba(255, 150, 0, 0)");

    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, eliteRadius * 2.5, 0, Math.PI * 2);
    context.fill();

    // Bright core
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(x, y, eliteRadius * 0.5, 0, Math.PI * 2);
    context.fill();
  }

  private renderArtilleryProjectile(ctx: FrenzyRenderContext, projectile: FrenzyProjectileData) {
    const context = ctx.context;
    const spotSize = 3;
    const progress = projectile.progress || 0;

    const startX = (projectile.startX ?? projectile.x) - ctx.halfWidth;
    const startY = (projectile.startY ?? projectile.y) - ctx.halfHeight;
    const targetX = (projectile.targetX ?? projectile.x) - ctx.halfWidth;
    const targetY = (projectile.targetY ?? projectile.y) - ctx.halfHeight;

    const dx = targetX - startX;
    const dy = targetY - startY;
    const dist = Math.hypot(dx, dy);

    // Ballistic arc
    const arcHeight = Math.min(dist * 0.4, 60);
    const arcOffset = -4 * arcHeight * progress * (1 - progress);

    const x = startX + dx * progress;
    const y = startY + dy * progress + arcOffset;

    // Outer glow
    const glowRadius = spotSize * 4;
    const glowGradient = context.createRadialGradient(x, y, 0, x, y, glowRadius);
    glowGradient.addColorStop(0, "rgba(255, 150, 50, 0.6)");
    glowGradient.addColorStop(0.4, "rgba(255, 80, 0, 0.3)");
    glowGradient.addColorStop(1, "rgba(255, 0, 0, 0)");
    context.fillStyle = glowGradient;
    context.beginPath();
    context.arc(x, y, glowRadius, 0, Math.PI * 2);
    context.fill();

    // Core
    context.fillStyle = "#ffffcc";
    context.beginPath();
    context.arc(x, y, spotSize, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(x, y, spotSize * 0.5, 0, Math.PI * 2);
    context.fill();
  }

  private renderBeam(ctx: FrenzyRenderContext, projectile: FrenzyProjectileData) {
    const context = ctx.context;
    const startX = projectile.startX! - ctx.halfWidth;
    const startY = projectile.startY! - ctx.halfHeight;
    const endX = projectile.x - ctx.halfWidth;
    const endY = projectile.y - ctx.halfHeight;

    // Outer glow
    context.strokeStyle = "rgba(255, 0, 0, 0.3)";
    context.lineWidth = 6;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.stroke();

    // Middle glow
    context.strokeStyle = "rgba(255, 50, 50, 0.6)";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.stroke();

    // Inner core
    context.strokeStyle = "rgba(255, 200, 200, 0.9)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.stroke();

    // Impact flash
    const gradient = context.createRadialGradient(endX, endY, 0, endX, endY, 4);
    gradient.addColorStop(0, "rgba(255, 255, 200, 0.9)");
    gradient.addColorStop(0.5, "rgba(255, 100, 50, 0.6)");
    gradient.addColorStop(1, "rgba(255, 0, 0, 0)");

    context.fillStyle = gradient;
    context.beginPath();
    context.arc(endX, endY, 4, 0, Math.PI * 2);
    context.fill();
  }

  /**
   * Render a missile (tier 2 warship projectile)
   * Fast, straight trajectory with smoke trail effect
   */
  private renderMissile(ctx: FrenzyRenderContext, projectile: FrenzyProjectileData) {
    const context = ctx.context;
    const x = projectile.x - ctx.halfWidth;
    const y = projectile.y - ctx.halfHeight;
    const startX = (projectile.startX ?? projectile.x) - ctx.halfWidth;
    const startY = (projectile.startY ?? projectile.y) - ctx.halfHeight;

    // Calculate direction for missile shape
    const dx = x - startX;
    const dy = y - startY;
    const dist = Math.hypot(dx, dy);
    const dirX = dist > 0 ? dx / dist : 1;
    const dirY = dist > 0 ? dy / dist : 0;

    // Smoke trail (faint gray line behind missile)
    const trailLength = Math.min(15, dist * 0.3);
    const trailStartX = x - dirX * trailLength;
    const trailStartY = y - dirY * trailLength;
    
    const trailGradient = context.createLinearGradient(trailStartX, trailStartY, x, y);
    trailGradient.addColorStop(0, "rgba(100, 100, 100, 0)");
    trailGradient.addColorStop(1, "rgba(150, 150, 150, 0.4)");
    
    context.strokeStyle = trailGradient;
    context.lineWidth = 2;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(trailStartX, trailStartY);
    context.lineTo(x, y);
    context.stroke();

    // Missile body (small elongated shape)
    const missileLength = 4;
    const missileWidth = 1.5;
    
    context.save();
    context.translate(x, y);
    context.rotate(Math.atan2(dirY, dirX));
    
    // Body
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.ellipse(0, 0, missileLength, missileWidth, 0, 0, Math.PI * 2);
    context.fill();
    
    // Engine glow at back
    const glowGradient = context.createRadialGradient(-missileLength, 0, 0, -missileLength, 0, 4);
    glowGradient.addColorStop(0, "rgba(255, 200, 100, 0.8)");
    glowGradient.addColorStop(0.5, "rgba(255, 100, 50, 0.4)");
    glowGradient.addColorStop(1, "rgba(255, 50, 0, 0)");
    
    context.fillStyle = glowGradient;
    context.beginPath();
    context.arc(-missileLength, 0, 4, 0, Math.PI * 2);
    context.fill();
    
    context.restore();
  }
}
