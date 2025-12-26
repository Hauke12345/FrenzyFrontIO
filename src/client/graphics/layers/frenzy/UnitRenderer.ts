import { GameView, PlayerView } from "../../../../core/game/GameView";
import { FrenzyRenderContext, getPlayerById } from "./FrenzyRenderContext";

/**
 * Frenzy unit data from the game state
 */
export interface FrenzyUnitData {
  id: number;
  playerId: string;
  x: number;
  y: number;
  unitType: string;
  health: number;
  maxHealth?: number;
  tier?: number;
  shieldHealth?: number;
  maxShieldHealth?: number;
}

/**
 * Renders all mobile unit types in Frenzy mode:
 * Soldier, EliteSoldier, Warship, Artillery, ShieldGenerator, DefensePost
 */
export class UnitRenderer {
  constructor(private game: GameView) {}

  /**
   * Render a single unit
   */
  render(ctx: FrenzyRenderContext, unit: FrenzyUnitData) {
    const player = this.game.player(unit.playerId);
    if (!player) return;

    const x = unit.x - ctx.halfWidth;
    const y = unit.y - ctx.halfHeight;

    const isDefensePost = unit.unitType === "defensePost";
    const isEliteSoldier = unit.unitType === "eliteSoldier";
    const isWarship = unit.unitType === "warship";
    const isArtillery = unit.unitType === "artillery";
    const isShieldGenerator = unit.unitType === "shieldGenerator";

    if (isShieldGenerator) {
      this.renderShieldGenerator(ctx, x, y, player, unit);
    } else if (isArtillery) {
      this.renderArtillery(ctx.context, x, y, player);
    } else if (isDefensePost) {
      this.renderDefensePost(ctx.context, x, y, player);
    } else if (isEliteSoldier) {
      this.renderEliteSoldier(ctx.context, x, y, player);
    } else if (isWarship) {
      this.renderWarship(ctx.context, x, y, player);
    } else {
      this.renderSoldier(ctx.context, x, y, player);
    }
  }

  private renderShieldGenerator(
    ctx: FrenzyRenderContext,
    x: number,
    y: number,
    player: PlayerView,
    unit: FrenzyUnitData,
  ) {
    const context = ctx.context;
    const size = 6;
    const shieldRadius = 30;

    // Draw shield bubble if active
    if (unit.shieldHealth && unit.shieldHealth > 0) {
      const shieldAlpha = 0.15 + 0.1 * Math.sin(ctx.time * 2);
      const shieldGradient = context.createRadialGradient(x, y, 0, x, y, shieldRadius);
      shieldGradient.addColorStop(0, `rgba(100, 200, 255, ${shieldAlpha * 0.3})`);
      shieldGradient.addColorStop(0.7, `rgba(80, 180, 240, ${shieldAlpha * 0.5})`);
      shieldGradient.addColorStop(1, `rgba(60, 150, 220, ${shieldAlpha})`);

      context.fillStyle = shieldGradient;
      context.beginPath();
      context.arc(x, y, shieldRadius, 0, Math.PI * 2);
      context.fill();

      // Shield edge glow
      context.strokeStyle = `rgba(120, 220, 255, ${0.3 + 0.2 * Math.sin(ctx.time * 3.3)})`;
      context.lineWidth = 2;
      context.stroke();
    }

    // Generator base (hexagon)
    context.fillStyle = player.territoryColor().toRgbString();
    context.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 - Math.PI / 6;
      const px = x + Math.cos(angle) * size;
      const py = y + Math.sin(angle) * size;
      if (i === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    context.fill();

    // Center energy core
    const coreGlow = 0.5 + 0.3 * Math.sin(ctx.time * 5);
    context.fillStyle = `rgba(100, 200, 255, ${coreGlow})`;
    context.beginPath();
    context.arc(x, y, size * 0.4, 0, Math.PI * 2);
    context.fill();

    // Border
    context.strokeStyle = "#1a5a8e";
    context.lineWidth = 1;
    context.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 - Math.PI / 6;
      const px = x + Math.cos(angle) * size;
      const py = y + Math.sin(angle) * size;
      if (i === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    context.stroke();
  }

  private renderArtillery(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    player: PlayerView,
  ) {
    const size = 4;

    // Base platform
    context.fillStyle = "#555";
    context.fillRect(x - size / 2, y + size / 4, size, size / 3);

    // Cannon barrel (angled)
    context.save();
    context.translate(x, y);
    context.rotate(-Math.PI / 6);

    context.fillStyle = player.territoryColor().toRgbString();
    context.fillRect(-size / 6, -size / 2, size / 3, size * 0.8);

    context.fillStyle = "#333";
    context.fillRect(-size / 6, -size / 2, size / 3, size / 5);

    context.restore();

    // Wheels
    context.fillStyle = "#444";
    context.beginPath();
    context.arc(x - size / 3, y + size / 3, size / 5, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(x + size / 3, y + size / 3, size / 5, 0, Math.PI * 2);
    context.fill();

    // Border
    context.strokeStyle = "#000";
    context.lineWidth = 0.5;
    context.strokeRect(x - size / 2, y + size / 4, size, size / 3);
  }

  private renderDefensePost(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    player: PlayerView,
  ) {
    const size = 4;

    // Shield shape
    context.fillStyle = player.territoryColor().toRgbString();
    context.beginPath();
    context.moveTo(x, y - size / 2);
    context.lineTo(x + size / 2, y - size / 4);
    context.lineTo(x + size / 2, y + size / 4);
    context.quadraticCurveTo(x, y + size / 2 + 2, x, y + size / 2);
    context.quadraticCurveTo(x, y + size / 2 + 2, x - size / 2, y + size / 4);
    context.lineTo(x - size / 2, y - size / 4);
    context.closePath();
    context.fill();

    context.strokeStyle = "#fff";
    context.lineWidth = 1;
    context.stroke();

    context.strokeStyle = "#000";
    context.lineWidth = 0.5;
    context.stroke();
  }

  private renderEliteSoldier(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    player: PlayerView,
  ) {
    const size = 8;

    // Diamond shape
    context.fillStyle = player.territoryColor().toRgbString();
    context.beginPath();
    context.moveTo(x, y - size / 2);
    context.lineTo(x + size / 2, y);
    context.lineTo(x, y + size / 2);
    context.lineTo(x - size / 2, y);
    context.closePath();
    context.fill();

    // Golden border
    context.strokeStyle = "#FFD700";
    context.lineWidth = 1.5;
    context.stroke();

    context.strokeStyle = "#000";
    context.lineWidth = 0.5;
    context.stroke();
  }

  private renderWarship(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    player: PlayerView,
  ) {
    const size = 10;

    // Ship hull
    context.fillStyle = player.territoryColor().toRgbString();
    context.beginPath();
    context.moveTo(x, y - size / 2);
    context.lineTo(x + size / 3, y - size / 6);
    context.lineTo(x + size / 3, y + size / 3);
    context.lineTo(x - size / 3, y + size / 3);
    context.lineTo(x - size / 3, y - size / 6);
    context.closePath();
    context.fill();

    // Deck line
    context.fillStyle = "#fff";
    context.fillRect(x - size / 4, y - size / 10, size / 2, size / 6);

    // Cannon turret
    context.beginPath();
    context.arc(x, y + size / 8, size / 6, 0, Math.PI * 2);
    context.fillStyle = "#444";
    context.fill();

    // Border
    context.strokeStyle = "#1a3a6e";
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(x, y - size / 2);
    context.lineTo(x + size / 3, y - size / 6);
    context.lineTo(x + size / 3, y + size / 3);
    context.lineTo(x - size / 3, y + size / 3);
    context.lineTo(x - size / 3, y - size / 6);
    context.closePath();
    context.stroke();

    context.strokeStyle = "#000";
    context.lineWidth = 0.5;
    context.stroke();
  }

  private renderSoldier(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    player: PlayerView,
  ) {
    const size = 6;

    // Triangle
    context.fillStyle = player.territoryColor().toRgbString();
    context.beginPath();
    context.moveTo(x, y - size / 2);
    context.lineTo(x - size / 2, y + size / 2);
    context.lineTo(x + size / 2, y + size / 2);
    context.closePath();
    context.fill();

    context.strokeStyle = "#000";
    context.lineWidth = 1;
    context.stroke();
  }
}
