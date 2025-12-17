import { GameFork } from "../../../core/game/Game";
import { GameView } from "../../../core/game/GameView";
import { TransformHandler } from "../TransformHandler";
import { Layer } from "./Layer";

/**
 * Floating gold text effect for city income
 */
interface GoldTextFx {
  x: number;
  y: number;
  gold: number;
  lifeTime: number;
  duration: number;
}

/**
 * Frenzy Layer: Renders units and core buildings for Frenzy mode
 */
export class FrenzyLayer implements Layer {
  private goldTextEffects: GoldTextFx[] = [];
  private lastPayoutIds = new Set<string>();
  private lastFrameTime: number = 0;

  constructor(
    private game: GameView,
    private transformHandler: TransformHandler,
  ) {}

  shouldTransform(): boolean {
    return true;
  }

  init() {
    console.log("[FrenzyLayer] Initialized");
    this.lastFrameTime = performance.now();
  }

  tick() {
    // No per-tick updates needed
  }

  renderLayer(context: CanvasRenderingContext2D) {
    // Check if we're in Frenzy fork
    if (this.game.config().gameConfig().gameFork !== GameFork.Frenzy) {
      return;
    }

    const frenzyState = this.game.frenzyManager();
    if (!frenzyState) {
      return; // No state yet, skip rendering
    }

    // Calculate delta time for animations
    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Process new gold payouts - convert to animated effects
    if (frenzyState.pendingGoldPayouts && frenzyState.pendingGoldPayouts.length > 0) {
      const newPayoutIds = new Set<string>();
      for (const payout of frenzyState.pendingGoldPayouts) {
        const payoutId = `${payout.x}_${payout.y}_${payout.gold}`;
        newPayoutIds.add(payoutId);
        
        // Only add if this is a new payout we haven't seen
        if (!this.lastPayoutIds.has(payoutId)) {
          this.goldTextEffects.push({
            x: payout.x,
            y: payout.y,
            gold: payout.gold,
            lifeTime: 0,
            duration: 1500, // 1.5 seconds
          });
        }
      }
      this.lastPayoutIds = newPayoutIds;
    } else {
      this.lastPayoutIds.clear();
    }

    // Render crystals first (bottom layer)
    if (frenzyState.crystals) {
      for (const crystal of frenzyState.crystals) {
        this.renderCrystal(context, crystal);
      }
    }

    // Render core buildings
    for (const building of frenzyState.coreBuildings) {
      this.renderCoreBuilding(context, building);
    }

    // Render units
    for (const unit of frenzyState.units) {
      this.renderUnit(context, unit);
    }

    const projectileSize = Math.max(0.5, frenzyState.projectileSize ?? 2);

    // Render projectiles last so they sit on top
    for (const projectile of frenzyState.projectiles) {
      this.renderProjectile(context, projectile, projectileSize);
    }

    // Update and render gold text effects
    this.updateAndRenderGoldEffects(context, deltaTime);
  }

  private updateAndRenderGoldEffects(context: CanvasRenderingContext2D, deltaTime: number) {
    // Update and filter expired effects
    this.goldTextEffects = this.goldTextEffects.filter((effect) => {
      effect.lifeTime += deltaTime;
      if (effect.lifeTime >= effect.duration) {
        return false; // Remove expired
      }

      // Calculate animation progress
      const t = effect.lifeTime / effect.duration;
      const riseDistance = 30;
      const x = effect.x - this.game.width() / 2;
      const y = effect.y - this.game.height() / 2 - t * riseDistance;
      const alpha = 1 - t;

      // Gold text styling
      const goldText = `+${effect.gold}`;

      // Draw with fade and rise
      context.save();
      context.font = "bold 12px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";

      // Black outline for visibility
      context.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
      context.lineWidth = 3;
      context.strokeText(goldText, x, y);

      // Gold fill
      context.fillStyle = `rgba(255, 215, 0, ${alpha})`;
      context.fillText(goldText, x, y);
      context.restore();

      return true; // Keep effect
    });
  }

  private renderTestMarker(context: CanvasRenderingContext2D) {
    // Draw a circle at 0,0 (map center in transformed coordinates)
    context.fillStyle = "#FF0000";
    context.beginPath();
    context.arc(0, 0, 20, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = "#000";
    context.lineWidth = 2;
    context.stroke();
  }

  private renderCoreBuilding(context: CanvasRenderingContext2D, building: any) {
    const player = this.game.player(building.playerId);
    if (!player) return;

    const x = building.x - this.game.width() / 2;
    const y = building.y - this.game.height() / 2;

    // Draw city icon (larger than units)
    const size = 12; // Halved from 24

    // Outer circle (glow)
    context.fillStyle = player.territoryColor().alpha(0.5).toRgbString();
    context.beginPath();
    context.arc(x, y, size / 2 + 4, 0, Math.PI * 2);
    context.fill();

    // Inner circle (building)
    context.fillStyle = player.territoryColor().toRgbString();
    context.beginPath();
    context.arc(x, y, size / 2, 0, Math.PI * 2);
    context.fill();

    // Border
    context.strokeStyle = "#000";
    context.lineWidth = 2;
    context.stroke();

    // Draw tier indicator for upgraded HQs (tier 2+)
    const tier = building.tier ?? 1;
    if (tier >= 2) {
      const tierText = this.getTierRoman(tier);
      context.fillStyle = "#fff";
      context.font = "bold 8px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(tierText, x, y);
    }

    // Spawn progress indicator (ring around building)
    const spawnProgress =
      1 - (building.spawnTimer ?? 0) / (building.spawnInterval ?? 1);
    if (spawnProgress > 0 && spawnProgress < 1) {
      context.strokeStyle = "#fff";
      context.lineWidth = 3;
      context.beginPath();
      context.arc(
        x,
        y,
        size / 2 + 6,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * spawnProgress,
      );
      context.stroke();
    }
  }

  private getTierRoman(tier: number): string {
    const romans = [
      "I",
      "II",
      "III",
      "IV",
      "V",
      "VI",
      "VII",
      "VIII",
      "IX",
      "X",
    ];
    return romans[tier - 1] || tier.toString();
  }

  private renderUnit(context: CanvasRenderingContext2D, unit: any) {
    const player = this.game.player(unit.playerId);
    if (!player) return;

    const x = unit.x - this.game.width() / 2;
    const y = unit.y - this.game.height() / 2;

    const isDefensePost = unit.unitType === "defensePost";
    const isEliteSoldier = unit.unitType === "eliteSoldier";

    if (isDefensePost) {
      // Defense post: shield icon (50% smaller than before)
      const size = 4; // Reduced from 8 for 50% smaller

      // Draw shield shape
      context.fillStyle = player.territoryColor().toRgbString();
      context.beginPath();
      context.moveTo(x, y - size / 2); // Top center
      context.lineTo(x + size / 2, y - size / 4); // Top right
      context.lineTo(x + size / 2, y + size / 4); // Bottom right curve start
      context.quadraticCurveTo(x, y + size / 2 + 2, x, y + size / 2); // Bottom point
      context.quadraticCurveTo(x, y + size / 2 + 2, x - size / 2, y + size / 4); // Left curve
      context.lineTo(x - size / 2, y - size / 4); // Top left
      context.closePath();
      context.fill();

      // White border for visibility
      context.strokeStyle = "#fff";
      context.lineWidth = 1;
      context.stroke();

      // Black outline
      context.strokeStyle = "#000";
      context.lineWidth = 0.5;
      context.stroke();
    } else if (isEliteSoldier) {
      // Elite soldier: larger diamond/star shape
      const size = 8; // Larger than regular soldier

      // Draw diamond shape
      context.fillStyle = player.territoryColor().toRgbString();
      context.beginPath();
      context.moveTo(x, y - size / 2); // Top point
      context.lineTo(x + size / 2, y); // Right point
      context.lineTo(x, y + size / 2); // Bottom point
      context.lineTo(x - size / 2, y); // Left point
      context.closePath();
      context.fill();

      // Golden border for elite units
      context.strokeStyle = "#FFD700";
      context.lineWidth = 1.5;
      context.stroke();

      // Black outer outline
      context.strokeStyle = "#000";
      context.lineWidth = 0.5;
      context.stroke();
    } else {
      // Regular soldier: triangle pointing up
      const size = 6; // Halved from 12

      // Fill
      context.fillStyle = player.territoryColor().toRgbString();
      context.beginPath();
      context.moveTo(x, y - size / 2); // Top point
      context.lineTo(x - size / 2, y + size / 2); // Bottom left
      context.lineTo(x + size / 2, y + size / 2); // Bottom right
      context.closePath();
      context.fill();

      // Black outline for visibility
      context.strokeStyle = "#000";
      context.lineWidth = 1;
      context.stroke();
    }
  }

  private renderProjectile(
    context: CanvasRenderingContext2D,
    projectile: any,
    diameter: number,
  ) {
    const x = projectile.x - this.game.width() / 2;
    const y = projectile.y - this.game.height() / 2;

    // Check if this is a beam (defense post red laser)
    if (
      projectile.isBeam &&
      projectile.startX !== undefined &&
      projectile.startY !== undefined
    ) {
      this.renderBeam(context, projectile);
      return;
    }

    const radius = Math.max(1, diameter / 2);

    // Check if this is an elite projectile (draws as stripes)
    if (projectile.isElite) {
      this.renderEliteProjectile(context, x, y, radius);
      return;
    }

    // Plasma projectile effect with glowing core
    // Outer glow
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius * 2.5);
    gradient.addColorStop(0, "rgba(0, 255, 255, 0.9)"); // Cyan core
    gradient.addColorStop(0.3, "rgba(100, 200, 255, 0.7)"); // Light blue
    gradient.addColorStop(0.6, "rgba(150, 100, 255, 0.4)"); // Purple edge
    gradient.addColorStop(1, "rgba(100, 50, 200, 0)"); // Transparent

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
    // Elite projectiles are spherical with golden/yellow glow
    const eliteRadius = radius * 1.5;

    // Outer glow (gold/orange)
    const gradient = context.createRadialGradient(
      x,
      y,
      0,
      x,
      y,
      eliteRadius * 2.5,
    );
    gradient.addColorStop(0, "rgba(255, 255, 150, 0.95)"); // Bright yellow core
    gradient.addColorStop(0.3, "rgba(255, 220, 100, 0.8)"); // Golden
    gradient.addColorStop(0.6, "rgba(255, 180, 50, 0.5)"); // Orange-gold edge
    gradient.addColorStop(1, "rgba(255, 150, 0, 0)"); // Transparent

    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, eliteRadius * 2.5, 0, Math.PI * 2);
    context.fill();

    // Bright white core
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(x, y, eliteRadius * 0.5, 0, Math.PI * 2);
    context.fill();
  }

  private renderBeam(context: CanvasRenderingContext2D, projectile: any) {
    const startX = projectile.startX - this.game.width() / 2;
    const startY = projectile.startY - this.game.height() / 2;
    const endX = projectile.x - this.game.width() / 2;
    const endY = projectile.y - this.game.height() / 2;

    // Red beam like C&C Obelisk of Light
    // Outer glow (wider, semi-transparent)
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

    // Inner bright core (white-red)
    context.strokeStyle = "rgba(255, 200, 200, 0.9)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.stroke();

    // Impact flash at target
    const gradient = context.createRadialGradient(endX, endY, 0, endX, endY, 4);
    gradient.addColorStop(0, "rgba(255, 255, 200, 0.9)");
    gradient.addColorStop(0.5, "rgba(255, 100, 50, 0.6)");
    gradient.addColorStop(1, "rgba(255, 0, 0, 0)");

    context.fillStyle = gradient;
    context.beginPath();
    context.arc(endX, endY, 4, 0, Math.PI * 2);
    context.fill();
  }

  private renderCrystal(
    context: CanvasRenderingContext2D,
    crystal: { id: number; x: number; y: number; crystalCount: number },
  ) {
    const x = crystal.x - this.game.width() / 2;
    const y = crystal.y - this.game.height() / 2;

    // Base size scales with crystal count
    const baseSize = 3 + crystal.crystalCount * 1.5;

    // Draw cluster of small crystals
    const crystalPositions = this.getCrystalClusterPositions(crystal.crystalCount, baseSize);
    
    for (const pos of crystalPositions) {
      this.renderSingleCrystal(context, x + pos.x, y + pos.y, pos.size);
    }
  }

  private getCrystalClusterPositions(count: number, baseSize: number): Array<{ x: number; y: number; size: number }> {
    const positions: Array<{ x: number; y: number; size: number }> = [];
    
    // Deterministic positions for crystal arrangement
    const angles = [0, 72, 144, 216, 288]; // Pentagon arrangement
    const radius = baseSize * 0.4;
    
    for (let i = 0; i < count; i++) {
      if (i === 0) {
        // Center crystal (largest)
        positions.push({ x: 0, y: 0, size: baseSize * 0.6 });
      } else {
        // Surrounding crystals
        const angle = (angles[(i - 1) % 5] * Math.PI) / 180;
        positions.push({
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          size: baseSize * 0.4,
        });
      }
    }
    
    return positions;
  }

  private renderSingleCrystal(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
    // Draw diamond/crystal shape
    const halfSize = size / 2;
    
    // Outer glow
    const glowGradient = context.createRadialGradient(x, y, 0, x, y, size * 1.5);
    glowGradient.addColorStop(0, "rgba(147, 112, 219, 0.4)"); // Purple glow
    glowGradient.addColorStop(1, "rgba(147, 112, 219, 0)");
    context.fillStyle = glowGradient;
    context.beginPath();
    context.arc(x, y, size * 1.5, 0, Math.PI * 2);
    context.fill();

    // Crystal body (diamond shape)
    context.fillStyle = "rgba(138, 43, 226, 0.9)"; // BlueViolet
    context.beginPath();
    context.moveTo(x, y - halfSize * 1.3); // Top point
    context.lineTo(x + halfSize, y); // Right point
    context.lineTo(x, y + halfSize * 1.3); // Bottom point
    context.lineTo(x - halfSize, y); // Left point
    context.closePath();
    context.fill();

    // Crystal highlight
    context.fillStyle = "rgba(200, 162, 255, 0.8)";
    context.beginPath();
    context.moveTo(x, y - halfSize * 1.1);
    context.lineTo(x + halfSize * 0.3, y - halfSize * 0.3);
    context.lineTo(x - halfSize * 0.3, y - halfSize * 0.3);
    context.closePath();
    context.fill();

    // Border
    context.strokeStyle = "rgba(75, 0, 130, 0.8)"; // Indigo
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x, y - halfSize * 1.3);
    context.lineTo(x + halfSize, y);
    context.lineTo(x, y + halfSize * 1.3);
    context.lineTo(x - halfSize, y);
    context.closePath();
    context.stroke();
  }
}
