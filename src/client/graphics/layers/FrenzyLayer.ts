import { GameFork, UnitType } from "../../../core/game/Game";
import { GameView, PlayerView, UnitView } from "../../../core/game/GameView";
import { FrameProfiler } from "../FrameProfiler";
import { TransformHandler } from "../TransformHandler";
import { Layer } from "./Layer";

/**
 * Floating gold text effect for mine income
 */
interface GoldTextFx {
  x: number;
  y: number;
  gold: number;
  lifeTime: number;
  duration: number;
}

/**
 * Artillery explosion effect
 */
interface ExplosionFx {
  x: number;
  y: number;
  radius: number;
  lifeTime: number;
  duration: number;
}

/**
 * Mine data for protomolecule rendering
 */
interface MineData {
  x: number;
  y: number;
  playerId: string;
  tier: number;
  crystalsInCell: Array<{ x: number; y: number; count: number }>;
}

/**
 * Unified structure type for Frenzy mode rendering
 */
enum FrenzyStructureType {
  HQ = "hq",
  Mine = "mine",
  Factory = "factory",
  DefensePost = "defensePost",
  Port = "port",
  MissileSilo = "missileSilo",
  SAMLauncher = "samLauncher",
  Artillery = "artillery",
  ShieldGenerator = "shieldGenerator",
  Construction = "construction",
}

/**
 * Unified structure interface for consistent rendering
 */
interface FrenzyStructure {
  type: FrenzyStructureType;
  x: number;
  y: number;
  playerId: string;
  tier: number;
  health: number;
  maxHealth: number;
  unit?: UnitView; // Reference to actual game unit for non-HQ structures
  constructionType?: FrenzyStructureType; // The type being constructed
  constructionProgress?: number; // 0-1 progress
}

/**
 * Frenzy Layer: Renders units and core buildings for Frenzy mode
 */
export class FrenzyLayer implements Layer {
  private goldTextEffects: GoldTextFx[] = [];
  private explosionEffects: ExplosionFx[] = [];
  private lastPayoutIds = new Set<string>();
  private lastArtilleryIds = new Set<number>();
  private lastFrameTime: number = 0;

  // Cached values to avoid repeated calculations per frame
  private cachedTime: number = 0;
  private cachedHalfWidth: number = 0;
  private cachedHalfHeight: number = 0;
  private viewportBounds: { minX: number; maxX: number; minY: number; maxY: number } = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

  // Protomolecule static cache (veins and boundaries - only redrawn when mines change)
  private protoCache: {
    canvas: HTMLCanvasElement | null;
    context: CanvasRenderingContext2D | null;
    mineHash: string; // Hash of mine positions to detect changes
    veins: Array<{ x1: number; y1: number; x2: number; y2: number; ctrlX: number; ctrlY: number; isCrystal: boolean; crystalCount: number; alpha: number }>;
  } = { canvas: null, context: null, mineHash: '', veins: [] };

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

    // Cache frequently used values for this frame
    this.cachedTime = now / 1000;
    this.cachedHalfWidth = this.game.width() / 2;
    this.cachedHalfHeight = this.game.height() / 2;

    // Calculate viewport bounds for culling (in world coordinates)
    const [topLeft, bottomRight] = this.transformHandler.screenBoundingRect();
    const margin = 50; // Extra margin for objects at edges
    this.viewportBounds = {
      minX: topLeft.x - margin,
      maxX: bottomRight.x + margin,
      minY: topLeft.y - margin,
      maxY: bottomRight.y + margin,
    };

    // Process new gold payouts - convert to animated text effects only
    if (
      frenzyState.pendingGoldPayouts &&
      frenzyState.pendingGoldPayouts.length > 0
    ) {
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

    // Gather all structures into unified list
    const gatherStart = FrameProfiler.start();
    const structures = this.gatherAllStructures(frenzyState);
    FrameProfiler.end("FrenzyLayer:gatherStructures", gatherStart);

    // Get all mine data for protomolecule rendering
    const mineStart = FrameProfiler.start();
    const allMines: MineData[] = structures
      .filter((s) => s.type === FrenzyStructureType.Mine)
      .map((s) => ({
        x: s.x,
        y: s.y,
        playerId: s.playerId,
        tier: s.tier,
        crystalsInCell: [], // Will be populated below
      }));

    // Assign crystals to their Voronoi cells
    const mineRadius = 40; // Should match config.mineRadius
    if (frenzyState.crystals) {
      for (const crystal of frenzyState.crystals) {
        // Find which mine this crystal belongs to (closest within radius)
        let closestMine: MineData | null = null;
        let closestDist = Infinity;

        for (const mine of allMines) {
          const dist = Math.hypot(crystal.x - mine.x, crystal.y - mine.y);
          if (dist <= mineRadius && dist < closestDist) {
            // Check if closer to this mine than any other
            let isClosest = true;
            for (const other of allMines) {
              if (other === mine) continue;
              const otherDist = Math.hypot(crystal.x - other.x, crystal.y - other.y);
              if (otherDist < dist) {
                isClosest = false;
                break;
              }
            }
            if (isClosest) {
              closestMine = mine;
              closestDist = dist;
            }
          }
        }

        if (closestMine) {
          closestMine.crystalsInCell.push({
            x: crystal.x,
            y: crystal.y,
            count: crystal.crystalCount,
          });
        }
      }
    }
    FrameProfiler.end("FrenzyLayer:crystalAssignment", mineStart);

    // Render protomolecule effect (permanent veins and boundaries)
    const protoStart = FrameProfiler.start();
    this.renderProtomoleculeEffect(context, allMines, frenzyState.crystals ?? []);
    FrameProfiler.end("FrenzyLayer:protomolecule", protoStart);

    // Render crystals (above protomolecule veins) with viewport culling
    const crystalStart = FrameProfiler.start();
    if (frenzyState.crystals) {
      for (const crystal of frenzyState.crystals) {
        if (this.isInViewport(crystal.x, crystal.y)) {
          this.renderCrystal(context, crystal);
        }
      }
    }
    FrameProfiler.end("FrenzyLayer:crystals", crystalStart);

    // Render all structures with unified system and viewport culling
    const structStart = FrameProfiler.start();
    for (const structure of structures) {
      if (this.isInViewport(structure.x, structure.y)) {
        this.renderStructure(context, structure);
      }
    }
    FrameProfiler.end("FrenzyLayer:structures", structStart);

    // Render units with viewport culling
    const unitStart = FrameProfiler.start();
    for (const unit of frenzyState.units) {
      if (this.isInViewport(unit.x, unit.y)) {
        this.renderUnit(context, unit);
      }
    }
    FrameProfiler.end("FrenzyLayer:units", unitStart);

    const projectileSize = Math.max(0.5, frenzyState.projectileSize ?? 2);

    // Track artillery projectiles to detect impacts
    const currentArtilleryIds = new Set<number>();
    for (const projectile of frenzyState.projectiles) {
      if (projectile.isArtillery) {
        currentArtilleryIds.add(projectile.id);
        // If this is a new artillery projectile we haven't seen, track it
        if (!this.lastArtilleryIds.has(projectile.id)) {
          this.lastArtilleryIds.add(projectile.id);
        }
      }
    }
    
    // Check for artillery impacts (projectiles that were tracked but are now gone)
    for (const id of this.lastArtilleryIds) {
      if (!currentArtilleryIds.has(id)) {
        // Find the projectile info from last frame if possible
        // Since we don't have it, we need to check the last known position
        // Instead, we'll spawn explosion when projectile progress >= 0.95
        this.lastArtilleryIds.delete(id);
      }
    }
    
    // Render projectiles and check for near-impact artillery with viewport culling
    const projStart = FrameProfiler.start();
    for (const projectile of frenzyState.projectiles) {
      if (!this.isInViewport(projectile.x, projectile.y)) continue;
      this.renderProjectile(context, projectile, projectileSize);
      
      // Spawn explosion effect when artillery is about to impact (progress > 0.95)
      const progress = projectile.progress ?? 0;
      const targetX = projectile.targetX ?? projectile.x;
      const targetY = projectile.targetY ?? projectile.y;
      if (projectile.isArtillery && progress >= 0.95 && targetX !== undefined && targetY !== undefined) {
        // Check if we already spawned an explosion for this projectile
        const existingExplosion = this.explosionEffects.find(e => 
          Math.abs(e.x - targetX) < 1 && Math.abs(e.y - targetY) < 1 && e.lifeTime < 100
        );
        if (!existingExplosion) {
          this.explosionEffects.push({
            x: targetX,
            y: targetY,
            radius: projectile.areaRadius || 15,
            lifeTime: 0,
            duration: 600, // 0.6 seconds
          });
        }
      }
    }
    FrameProfiler.end("FrenzyLayer:projectiles", projStart);
    
    // Update last artillery ids
    this.lastArtilleryIds = currentArtilleryIds;

    // Render explosion effects
    this.updateAndRenderExplosions(context, deltaTime);

    // Update and render gold text effects
    this.updateAndRenderGoldEffects(context, deltaTime);
  }

  /**
   * Gather all structures from frenzy state and game state into unified list
   */
  private gatherAllStructures(frenzyState: any): FrenzyStructure[] {
    const structures: FrenzyStructure[] = [];

    // Add HQs from frenzy state
    for (const building of frenzyState.coreBuildings) {
      structures.push({
        type: FrenzyStructureType.HQ,
        x: building.x,
        y: building.y,
        playerId: building.playerId,
        tier: building.tier ?? 1,
        health: building.health ?? 1000,
        maxHealth: building.maxHealth ?? 1000,
      });
    }

    // Add factories from frenzy state
    if (frenzyState.factories) {
      for (const factory of frenzyState.factories) {
        structures.push({
          type: FrenzyStructureType.Factory,
          x: factory.x,
          y: factory.y,
          playerId: factory.playerId,
          tier: factory.tier ?? 1,
          health: factory.health ?? 400,
          maxHealth: factory.maxHealth ?? 400,
        });
      }
    }

    // Add structures from game units
    for (const player of this.game.players()) {
      for (const unit of player.units()) {
        const tile = unit.tile();
        if (!tile) continue;

        const x = this.game.x(tile);
        const y = this.game.y(tile);
        const unitInfo = this.game.unitInfo(unit.type());
        const maxHealth = unitInfo?.maxHealth ?? 100;
        const health = unit.health();

        let structureType: FrenzyStructureType | null = null;
        switch (unit.type()) {
          case UnitType.City:
            structureType = FrenzyStructureType.Mine;
            break;
          case UnitType.DefensePost:
            structureType = FrenzyStructureType.DefensePost;
            break;
          case UnitType.Port:
            structureType = FrenzyStructureType.Port;
            break;
          case UnitType.MissileSilo:
            structureType = FrenzyStructureType.MissileSilo;
            break;
          case UnitType.SAMLauncher:
            structureType = FrenzyStructureType.SAMLauncher;
            break;
          case UnitType.Artillery:
            structureType = FrenzyStructureType.Artillery;
            break;
          case UnitType.ShieldGenerator:
            structureType = FrenzyStructureType.ShieldGenerator;
            break;
        }

        if (structureType) {
          structures.push({
            type: structureType,
            x,
            y,
            playerId: player.id(),
            tier: unit.level(),
            health,
            maxHealth,
            unit,
          });
        }

        // Handle construction units
        if (unit.type() === UnitType.Construction) {
          const constructionUnitType = unit.constructionType();
          let constrType: FrenzyStructureType | null = null;
          switch (constructionUnitType) {
            case UnitType.City:
              constrType = FrenzyStructureType.Mine;
              break;
            case UnitType.Factory:
              constrType = FrenzyStructureType.Factory;
              break;
            case UnitType.DefensePost:
              constrType = FrenzyStructureType.DefensePost;
              break;
            case UnitType.Port:
              constrType = FrenzyStructureType.Port;
              break;
            case UnitType.MissileSilo:
              constrType = FrenzyStructureType.MissileSilo;
              break;
            case UnitType.SAMLauncher:
              constrType = FrenzyStructureType.SAMLauncher;
              break;
            case UnitType.Artillery:
              constrType = FrenzyStructureType.Artillery;
              break;
            case UnitType.ShieldGenerator:
              constrType = FrenzyStructureType.ShieldGenerator;
              break;
          }
          if (constrType && constructionUnitType) {
            const unitInfo = this.game.unitInfo(constructionUnitType);
            const constDuration = unitInfo?.constructionDuration ?? 100;
            const elapsed = this.game.ticks() - unit.createdAt();
            const progress = Math.min(
              1,
              elapsed / (constDuration === 0 ? 1 : constDuration),
            );
            structures.push({
              type: FrenzyStructureType.Construction,
              x,
              y,
              playerId: player.id(),
              tier: 1,
              health: 1,
              maxHealth: 1,
              unit,
              constructionType: constrType,
              constructionProgress: progress,
            });
          }
        }
      }
    }

    return structures;
  }

  /**
   * Render a structure with unified icon and healthbar system
   */
  private renderStructure(
    context: CanvasRenderingContext2D,
    structure: FrenzyStructure,
  ) {
    const player = this.game.player(structure.playerId);
    if (!player) return;

    const x = structure.x - this.cachedHalfWidth;
    const y = structure.y - this.cachedHalfHeight;

    // Render icon based on type
    switch (structure.type) {
      case FrenzyStructureType.HQ:
        this.renderHQIcon(context, x, y, player, structure.tier);
        break;
      case FrenzyStructureType.Mine:
        this.renderMineIcon(context, x, y, player, structure.tier);
        break;
      case FrenzyStructureType.Factory:
        this.renderFactoryIcon(context, x, y, player, structure.tier);
        break;
      case FrenzyStructureType.DefensePost:
        this.renderDefensePostIcon(context, x, y, player, structure.tier);
        break;
      case FrenzyStructureType.Port:
        this.renderPortIcon(context, x, y, player, structure.tier);
        break;
      case FrenzyStructureType.MissileSilo:
        this.renderMissileSiloIcon(context, x, y, player, structure.tier);
        break;
      case FrenzyStructureType.SAMLauncher:
        this.renderSAMLauncherIcon(context, x, y, player, structure.tier);
        break;
      case FrenzyStructureType.Construction:
        this.renderConstructionIcon(
          context,
          x,
          y,
          player,
          structure.constructionType!,
          structure.constructionProgress ?? 0,
        );
        break;
    }

    // Render healthbar if damaged
    if (structure.health < structure.maxHealth && structure.health > 0) {
      this.renderHealthBar(
        context,
        x,
        y,
        structure.health,
        structure.maxHealth,
        this.getStructureSize(structure.type),
      );
    }
  }

  /**
   * Get the base size for a structure type
   */
  private getStructureSize(type: FrenzyStructureType): number {
    switch (type) {
      case FrenzyStructureType.HQ:
        return 14;
      case FrenzyStructureType.Mine:
      case FrenzyStructureType.Factory:
      case FrenzyStructureType.Port:
        return 10;
      case FrenzyStructureType.DefensePost:
      case FrenzyStructureType.MissileSilo:
      case FrenzyStructureType.SAMLauncher:
        return 8;
      default:
        return 8;
    }
  }

  /**
   * Render healthbar below a structure
   */
  private renderHealthBar(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    health: number,
    maxHealth: number,
    structureSize: number,
  ) {
    const barWidth = structureSize + 4;
    const barHeight = 2;
    const barY = y + structureSize / 2 + 3;
    const healthPercent = health / maxHealth;

    // Background (dark)
    context.fillStyle = "rgba(0, 0, 0, 0.7)";
    context.fillRect(x - barWidth / 2, barY, barWidth, barHeight);

    // Health fill (green to red gradient based on health)
    const r = Math.floor(255 * (1 - healthPercent));
    const g = Math.floor(255 * healthPercent);
    context.fillStyle = `rgb(${r}, ${g}, 0)`;
    context.fillRect(
      x - barWidth / 2,
      barY,
      barWidth * healthPercent,
      barHeight,
    );

    // Border
    context.strokeStyle = "#000";
    context.lineWidth = 0.5;
    context.strokeRect(x - barWidth / 2, barY, barWidth, barHeight);
  }

  /**
   * HQ Icon: Circle with spikes - the most prominent building
   */
  private renderHQIcon(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    player: PlayerView,
    tier: number,
  ) {
    const circleRadius = 6;
    const spikeCount = 8;
    const spikeLength = 5;
    const spikeBaseWidth = 2.5;

    // Draw spikes first (behind circle)
    context.fillStyle = player.territoryColor().toRgbString();
    for (let i = 0; i < spikeCount; i++) {
      const angle = (i * 2 * Math.PI) / spikeCount - Math.PI / 2;
      const tipX = x + Math.cos(angle) * (circleRadius + spikeLength);
      const tipY = y + Math.sin(angle) * (circleRadius + spikeLength);
      const leftAngle = angle - Math.PI / 2;
      const rightAngle = angle + Math.PI / 2;
      const baseX1 =
        x +
        Math.cos(angle) * circleRadius +
        Math.cos(leftAngle) * spikeBaseWidth;
      const baseY1 =
        y +
        Math.sin(angle) * circleRadius +
        Math.sin(leftAngle) * spikeBaseWidth;
      const baseX2 =
        x +
        Math.cos(angle) * circleRadius +
        Math.cos(rightAngle) * spikeBaseWidth;
      const baseY2 =
        y +
        Math.sin(angle) * circleRadius +
        Math.sin(rightAngle) * spikeBaseWidth;

      context.beginPath();
      context.moveTo(tipX, tipY);
      context.lineTo(baseX1, baseY1);
      context.lineTo(baseX2, baseY2);
      context.closePath();
      context.fill();

      // Spike border
      context.strokeStyle = "#000";
      context.lineWidth = 1;
      context.stroke();
    }

    // Outer glow (circle)
    context.fillStyle = player.territoryColor().alpha(0.4).toRgbString();
    context.beginPath();
    context.arc(x, y, circleRadius + 2, 0, Math.PI * 2);
    context.fill();

    // Main circle body
    context.fillStyle = player.territoryColor().toRgbString();
    context.beginPath();
    context.arc(x, y, circleRadius, 0, Math.PI * 2);
    context.fill();

    // Circle border
    context.strokeStyle = "#000";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(x, y, circleRadius, 0, Math.PI * 2);
    context.stroke();

    // Tier indicator
    if (tier >= 1) {
      const tierText = this.getTierRoman(tier);
      context.fillStyle = "#fff";
      context.font = "bold 6px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(tierText, x, y);
    }
  }

  /**
   * Mine Icon: Hexagon (6-sided) - represents resource extraction
   */
  private renderMineIcon(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    player: PlayerView,
    level: number,
  ) {
    const size = 8;
    const sides = 6;
    const angleOffset = Math.PI / 6; // Rotate so flat side is on bottom

    // Outer glow
    context.fillStyle = player.territoryColor().alpha(0.4).toRgbString();
    context.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides + angleOffset;
      const px = x + Math.cos(angle) * (size / 2 + 2);
      const py = y + Math.sin(angle) * (size / 2 + 2);
      if (i === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    context.fill();

    // Main hexagon body
    context.fillStyle = player.territoryColor().toRgbString();
    context.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides + angleOffset;
      const px = x + Math.cos(angle) * (size / 2);
      const py = y + Math.sin(angle) * (size / 2);
      if (i === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    context.fill();

    // Border
    context.strokeStyle = "#000";
    context.lineWidth = 1.5;
    context.stroke();

    // Level indicator
    if (level >= 1) {
      const tierText = this.getTierRoman(level);
      context.fillStyle = "#fff";
      context.font = "bold 5px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(tierText, x, y);
    }
  }

  /**
   * Factory Icon: Square with notched corners (gear-like) - industrial
   */
  private renderFactoryIcon(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    player: PlayerView,
    tier: number,
  ) {
    const size = 8;
    const halfSize = size / 2;
    const notch = size * 0.15;

    // Outer glow
    context.fillStyle = player.territoryColor().alpha(0.4).toRgbString();
    context.beginPath();
    context.moveTo(x - halfSize - 2 + notch, y - halfSize - 2);
    context.lineTo(x + halfSize + 2 - notch, y - halfSize - 2);
    context.lineTo(x + halfSize + 2, y - halfSize - 2 + notch);
    context.lineTo(x + halfSize + 2, y + halfSize + 2 - notch);
    context.lineTo(x + halfSize + 2 - notch, y + halfSize + 2);
    context.lineTo(x - halfSize - 2 + notch, y + halfSize + 2);
    context.lineTo(x - halfSize - 2, y + halfSize + 2 - notch);
    context.lineTo(x - halfSize - 2, y - halfSize - 2 + notch);
    context.closePath();
    context.fill();

    // Main body
    context.fillStyle = player.territoryColor().toRgbString();
    context.beginPath();
    context.moveTo(x - halfSize + notch, y - halfSize);
    context.lineTo(x + halfSize - notch, y - halfSize);
    context.lineTo(x + halfSize, y - halfSize + notch);
    context.lineTo(x + halfSize, y + halfSize - notch);
    context.lineTo(x + halfSize - notch, y + halfSize);
    context.lineTo(x - halfSize + notch, y + halfSize);
    context.lineTo(x - halfSize, y + halfSize - notch);
    context.lineTo(x - halfSize, y - halfSize + notch);
    context.closePath();
    context.fill();

    // Border
    context.strokeStyle = "#000";
    context.lineWidth = 1.5;
    context.stroke();

    // Tier indicator
    if (tier >= 1) {
      const tierText = this.getTierRoman(tier);
      context.fillStyle = "#fff";
      context.font = "bold 5px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(tierText, x, y);
    }
  }

  /**
   * Defense Post Icon: Shield shape - defensive structure
   */
  private renderDefensePostIcon(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    player: PlayerView,
    tier: number,
  ) {
    const size = 6.4;
    const halfSize = size / 2;

    // Outer glow
    context.fillStyle = player.territoryColor().alpha(0.4).toRgbString();
    context.beginPath();
    context.moveTo(x, y - halfSize - 2);
    context.lineTo(x + halfSize + 2, y - halfSize * 0.3);
    context.lineTo(x + halfSize + 2, y + halfSize * 0.5);
    context.quadraticCurveTo(x, y + halfSize + 4, x, y + halfSize + 2);
    context.quadraticCurveTo(
      x,
      y + halfSize + 4,
      x - halfSize - 2,
      y + halfSize * 0.5,
    );
    context.lineTo(x - halfSize - 2, y - halfSize * 0.3);
    context.closePath();
    context.fill();

    // Main shield body
    context.fillStyle = player.territoryColor().toRgbString();
    context.beginPath();
    context.moveTo(x, y - halfSize);
    context.lineTo(x + halfSize, y - halfSize * 0.3);
    context.lineTo(x + halfSize, y + halfSize * 0.5);
    context.quadraticCurveTo(x, y + halfSize + 2, x, y + halfSize);
    context.quadraticCurveTo(
      x,
      y + halfSize + 2,
      x - halfSize,
      y + halfSize * 0.5,
    );
    context.lineTo(x - halfSize, y - halfSize * 0.3);
    context.closePath();
    context.fill();

    // Border
    context.strokeStyle = "#000";
    context.lineWidth = 1;
    context.stroke();

    // Tier indicator
    if (tier >= 1) {
      const tierText = this.getTierRoman(tier);
      context.fillStyle = "#fff";
      context.font = "bold 5px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(tierText, x, y - 1);
    }
  }

  /**
   * Port Icon: Anchor shape - naval structure
   */
  private renderPortIcon(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    player: PlayerView,
    tier: number,
  ) {
    const size = 8;
    const halfSize = size / 2;

    // Outer glow (circle)
    context.fillStyle = player.territoryColor().alpha(0.4).toRgbString();
    context.beginPath();
    context.arc(x, y, halfSize + 2, 0, Math.PI * 2);
    context.fill();

    // Main circle body
    context.fillStyle = player.territoryColor().toRgbString();
    context.beginPath();
    context.arc(x, y, halfSize, 0, Math.PI * 2);
    context.fill();

    // Wave pattern on bottom half
    context.strokeStyle = "rgba(255, 255, 255, 0.5)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x - halfSize * 0.7, y + 1);
    context.quadraticCurveTo(x - halfSize * 0.35, y - 1, x, y + 1);
    context.quadraticCurveTo(
      x + halfSize * 0.35,
      y + 3,
      x + halfSize * 0.7,
      y + 1,
    );
    context.stroke();

    // Border
    context.strokeStyle = "#000";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(x, y, halfSize, 0, Math.PI * 2);
    context.stroke();

    // Tier indicator
    if (tier >= 1) {
      const tierText = this.getTierRoman(tier);
      context.fillStyle = "#fff";
      context.font = "bold 5px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(tierText, x, y);
    }
  }

  /**
   * Missile Silo Icon: Diamond with vertical line - offensive structure
   */
  private renderMissileSiloIcon(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    player: PlayerView,
    tier: number,
  ) {
    const size = 6.4;
    const halfSize = size / 2;

    // Outer glow
    context.fillStyle = player.territoryColor().alpha(0.4).toRgbString();
    context.beginPath();
    context.moveTo(x, y - halfSize - 2);
    context.lineTo(x + halfSize + 2, y);
    context.lineTo(x, y + halfSize + 2);
    context.lineTo(x - halfSize - 2, y);
    context.closePath();
    context.fill();

    // Main diamond body
    context.fillStyle = player.territoryColor().toRgbString();
    context.beginPath();
    context.moveTo(x, y - halfSize);
    context.lineTo(x + halfSize, y);
    context.lineTo(x, y + halfSize);
    context.lineTo(x - halfSize, y);
    context.closePath();
    context.fill();

    // Missile indicator (vertical line)
    context.strokeStyle = "rgba(255, 255, 255, 0.7)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(x, y - halfSize * 0.5);
    context.lineTo(x, y + halfSize * 0.5);
    context.stroke();

    // Border
    context.strokeStyle = "#000";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x, y - halfSize);
    context.lineTo(x + halfSize, y);
    context.lineTo(x, y + halfSize);
    context.lineTo(x - halfSize, y);
    context.closePath();
    context.stroke();

    // Tier indicator
    if (tier >= 1) {
      const tierText = this.getTierRoman(tier);
      context.fillStyle = "#fff";
      context.font = "bold 4px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(tierText, x, y);
    }
  }

  /**
   * SAM Launcher Icon: Triangle pointing up with circle - anti-air
   */
  private renderSAMLauncherIcon(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    player: PlayerView,
    tier: number,
  ) {
    const size = 6.4;
    const halfSize = size / 2;

    // Outer glow
    context.fillStyle = player.territoryColor().alpha(0.4).toRgbString();
    context.beginPath();
    context.moveTo(x, y - halfSize - 2);
    context.lineTo(x + halfSize + 2, y + halfSize + 2);
    context.lineTo(x - halfSize - 2, y + halfSize + 2);
    context.closePath();
    context.fill();

    // Main triangle body
    context.fillStyle = player.territoryColor().toRgbString();
    context.beginPath();
    context.moveTo(x, y - halfSize);
    context.lineTo(x + halfSize, y + halfSize);
    context.lineTo(x - halfSize, y + halfSize);
    context.closePath();
    context.fill();

    // Radar circle on top
    context.strokeStyle = "rgba(255, 255, 255, 0.7)";
    context.lineWidth = 1;
    context.beginPath();
    context.arc(x, y - halfSize * 0.3, halfSize * 0.35, 0, Math.PI * 2);
    context.stroke();

    // Border
    context.strokeStyle = "#000";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x, y - halfSize);
    context.lineTo(x + halfSize, y + halfSize);
    context.lineTo(x - halfSize, y + halfSize);
    context.closePath();
    context.stroke();

    // Tier indicator
    if (tier >= 1) {
      const tierText = this.getTierRoman(tier);
      context.fillStyle = "#fff";
      context.font = "bold 4px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(tierText, x, y + 1);
    }
  }

  /**
   * Artillery Icon: Cannon/mortar shape for construction preview
   */
  private renderArtilleryIcon(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    player: PlayerView,
  ) {
    const size = 6;

    // Base platform
    context.fillStyle = player.territoryColor().toRgbString();
    context.beginPath();
    context.ellipse(x, y + size * 0.3, size, size * 0.4, 0, 0, Math.PI * 2);
    context.fill();

    // Cannon barrel (angled)
    context.fillStyle = "#4a4a4a";
    context.save();
    context.translate(x, y);
    context.rotate(-Math.PI / 4);
    context.fillRect(-size * 0.2, -size * 1.2, size * 0.4, size * 1.2);
    context.restore();

    // Border
    context.strokeStyle = "#000";
    context.lineWidth = 0.5;
    context.beginPath();
    context.ellipse(x, y + size * 0.3, size, size * 0.4, 0, 0, Math.PI * 2);
    context.stroke();
  }

  /**
   * Shield Generator Icon: Hexagon with shield dome for construction preview
   */
  private renderShieldGeneratorIcon(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    player: PlayerView,
  ) {
    const size = 6;

    // Hexagon base
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

    // Energy core
    context.fillStyle = "rgba(100, 200, 255, 0.6)";
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

  /**
   * Construction Icon: Animated building-in-progress using the target structure shape
   */
  private renderConstructionIcon(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    player: PlayerView,
    targetType: FrenzyStructureType,
    progress: number,
  ) {
    // Pulsing scale animation (gentle pulse) - use cached time
    const pulse = 0.9 + 0.1 * Math.sin(this.cachedTime * 4);

    context.save();
    context.translate(x, y);
    context.scale(pulse, pulse);

    // Draw the target structure with gray/transparent overlay
    const grayColor = {
      territoryColor: () => ({
        alpha: (a: number) => ({
          toRgbString: () => `rgba(150, 150, 150, ${a})`,
        }),
        toRgbString: () => "rgb(150, 150, 150)",
      }),
    } as unknown as PlayerView;

    // Render the ghost shape of the target structure
    switch (targetType) {
      case FrenzyStructureType.Mine:
        this.renderMineIcon(context, 0, 0, grayColor, 0);
        break;
      case FrenzyStructureType.Factory:
        this.renderFactoryIcon(context, 0, 0, grayColor, 0);
        break;
      case FrenzyStructureType.DefensePost:
        this.renderDefensePostIcon(context, 0, 0, grayColor, 0);
        break;
      case FrenzyStructureType.Port:
        this.renderPortIcon(context, 0, 0, grayColor, 0);
        break;
      case FrenzyStructureType.MissileSilo:
        this.renderMissileSiloIcon(context, 0, 0, grayColor, 0);
        break;
      case FrenzyStructureType.SAMLauncher:
        this.renderSAMLauncherIcon(context, 0, 0, grayColor, 0);
        break;
      case FrenzyStructureType.Artillery:
        this.renderArtilleryIcon(context, 0, 0, grayColor);
        break;
      case FrenzyStructureType.ShieldGenerator:
        this.renderShieldGeneratorIcon(context, 0, 0, grayColor);
        break;
    }

    context.restore();

    // Draw progress bar below the structure
    const barWidth = 10;
    const barHeight = 2;
    const barY = y + 8;

    // Background
    context.fillStyle = "rgba(0, 0, 0, 0.5)";
    context.fillRect(x - barWidth / 2, barY, barWidth, barHeight);

    // Progress fill (yellow for construction)
    context.fillStyle = "rgba(255, 200, 0, 0.9)";
    context.fillRect(x - barWidth / 2, barY, barWidth * progress, barHeight);

    // Border
    context.strokeStyle = "#000";
    context.lineWidth = 0.5;
    context.strokeRect(x - barWidth / 2, barY, barWidth, barHeight);
  }

  /**
   * Render protomolecule effect - organic veins/roots from mines to crystals
   * with cold blue energy pulsing toward mines. Also draws Voronoi boundaries.
   * 
   * OPTIMIZATION: Static elements (veins, boundaries) are cached to an offscreen canvas.
   * Only the animated pulses are drawn each frame.
   */
  private renderProtomoleculeEffect(
    context: CanvasRenderingContext2D,
    allMines: MineData[],
    allCrystals: Array<{ x: number; y: number; crystalCount: number }>,
  ) {
    const halfWidth = this.cachedHalfWidth;
    const halfHeight = this.cachedHalfHeight;
    const time = this.cachedTime;

    // Create a hash of mine positions to detect when cache needs refresh
    const mineHash = allMines.map(m => `${m.x},${m.y},${m.playerId}`).join('|') + 
                     '|' + allCrystals.map(c => `${c.x},${c.y}`).join('|');

    // Check if we need to rebuild the static cache
    if (this.protoCache.mineHash !== mineHash || !this.protoCache.canvas) {
      this.rebuildProtomoleculeCache(allMines, allCrystals, halfWidth, halfHeight);
      this.protoCache.mineHash = mineHash;
    }

    // Draw the cached static elements (veins and boundaries)
    if (this.protoCache.canvas) {
      context.drawImage(
        this.protoCache.canvas,
        -halfWidth,
        -halfHeight,
      );
    }

    // Draw animated pulses on top (these change every frame)
    this.drawAnimatedPulses(context, time);
  }

  /**
   * Rebuild the static protomolecule cache (veins, boundaries)
   */
  private rebuildProtomoleculeCache(
    allMines: MineData[],
    allCrystals: Array<{ x: number; y: number; crystalCount: number }>,
    halfWidth: number,
    halfHeight: number,
  ) {
    const mineRadius = 40;

    // Create or resize canvas
    if (!this.protoCache.canvas) {
      this.protoCache.canvas = document.createElement('canvas');
      this.protoCache.canvas.width = this.game.width();
      this.protoCache.canvas.height = this.game.height();
      const ctx = this.protoCache.canvas.getContext('2d');
      if (!ctx) return;
      this.protoCache.context = ctx;
    }

    const ctx = this.protoCache.context;
    if (!ctx) return;

    // Clear the cache canvas
    ctx.clearRect(0, 0, this.protoCache.canvas.width, this.protoCache.canvas.height);

    // Save the context state and translate to match main canvas coordinates
    ctx.save();
    ctx.translate(halfWidth, halfHeight);

    // Clear vein cache
    this.protoCache.veins = [];

    // Draw Voronoi boundaries (simplified - no territory checks for performance)
    const drawnBisections = new Set<string>();
    ctx.strokeStyle = `rgba(100, 180, 255, 0.15)`;
    ctx.lineWidth = 1;

    for (let i = 0; i < allMines.length; i++) {
      const mine = allMines[i];
      for (let j = i + 1; j < allMines.length; j++) {
        const other = allMines[j];
        const dist = Math.hypot(other.x - mine.x, other.y - mine.y);

        if (dist < mineRadius * 2) {
          const pairKey = `${i}_${j}`;
          if (!drawnBisections.has(pairKey)) {
            drawnBisections.add(pairKey);

            const midX = (mine.x + other.x) / 2 - halfWidth;
            const midY = (mine.y + other.y) / 2 - halfHeight;
            const dx = other.x - mine.x;
            const dy = other.y - mine.y;
            const perpLen = Math.hypot(-dy, dx);
            if (perpLen === 0) continue;

            const normPerpX = -dy / perpLen;
            const normPerpY = dx / perpLen;
            const lineLen = Math.min(mineRadius, dist / 2 + 5);

            ctx.beginPath();
            ctx.moveTo(midX - normPerpX * lineLen, midY - normPerpY * lineLen);
            ctx.lineTo(midX + normPerpX * lineLen, midY + normPerpY * lineLen);
            ctx.stroke();
          }
        }
      }
    }

    // Draw veins and cache their geometry for pulse animation
    for (const mine of allMines) {
      const mx = mine.x - halfWidth;
      const my = mine.y - halfHeight;

      // Draw veins to crystals
      for (const crystal of mine.crystalsInCell) {
        const cx = crystal.x - halfWidth;
        const cy = crystal.y - halfHeight;
        this.drawStaticVein(ctx, mx, my, cx, cy, 1.5, 0.6, true, crystal.count);
      }

      // Draw area veins (simplified - no territory checks)
      const areaVeinCount = 8;
      const angleStep = (Math.PI * 2) / areaVeinCount;

      for (let i = 0; i < areaVeinCount; i++) {
        const baseAngle = i * angleStep + (mine.x * 0.1);
        const veinLength = mineRadius * (0.5 + 0.3 * Math.sin(baseAngle * 3 + mine.y * 0.05));
        const vx = mine.x + Math.cos(baseAngle) * veinLength - halfWidth;
        const vy = mine.y + Math.sin(baseAngle) * veinLength - halfHeight;

        // Simple Voronoi check (skip territory ownership for performance)
        let inCell = true;
        for (const other of allMines) {
          if (other === mine) continue;
          const distToOther = Math.hypot(vx + halfWidth - other.x, vy + halfHeight - other.y);
          const distToThis = Math.hypot(vx - mx, vy - my);
          if (distToOther < distToThis) {
            inCell = false;
            break;
          }
        }
        if (!inCell) continue;

        this.drawStaticVein(ctx, mx, my, vx, vy, 0.8, 0.25, false, 1);
      }

      // Draw cell boundary (simplified circular)
      this.drawSimpleCellBoundary(ctx, mine, allMines, halfWidth, halfHeight);
    }

    ctx.restore();
  }

  /**
   * Draw a static vein and cache its geometry for pulse animation
   */
  private drawStaticVein(
    ctx: CanvasRenderingContext2D,
    x1: number, y1: number,
    x2: number, y2: number,
    lineWidth: number, alpha: number,
    isCrystal: boolean, crystalCount: number,
  ) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    if (length < 2) return;

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const perpX = -dy / length;
    const perpY = dx / length;
    // Static waviness based on position (no time dependency)
    const waveAmp = length * 0.03 * Math.sin(x1 * 0.1 + y1 * 0.1);
    const ctrlX = midX + perpX * waveAmp;
    const ctrlY = midY + perpY * waveAmp;

    // Draw static vein
    ctx.strokeStyle = `rgba(80, 160, 220, ${alpha * 0.4})`;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(ctrlX, ctrlY, x2, y2);
    ctx.stroke();

    // Cache vein geometry for pulse animation
    this.protoCache.veins.push({ x1, y1, x2, y2, ctrlX, ctrlY, isCrystal, crystalCount, alpha });
  }

  /**
   * Draw simplified cell boundary (no territory checks)
   */
  private drawSimpleCellBoundary(
    ctx: CanvasRenderingContext2D,
    mine: MineData,
    allMines: MineData[],
    halfWidth: number,
    halfHeight: number,
  ) {
    const mineRadius = 40;
    const sampleCount = 24;

    ctx.strokeStyle = `rgba(80, 160, 220, 0.2)`;
    ctx.lineWidth = 0.8;

    let lastPoint: { x: number; y: number } | null = null;

    for (let i = 0; i <= sampleCount; i++) {
      const angle = (i / sampleCount) * Math.PI * 2;
      let radius = mineRadius;

      // Voronoi clipping
      for (const other of allMines) {
        if (other === mine) continue;
        const dist = Math.hypot(other.x - mine.x, other.y - mine.y);
        if (dist < mineRadius * 2) {
          const midDist = dist / 2;
          const angleToMid = Math.atan2(other.y - mine.y, other.x - mine.x);
          const angleDiff = Math.abs(((angle - angleToMid + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (angleDiff < Math.PI / 2) {
            const clipDist = midDist / Math.cos(angleDiff);
            if (clipDist > 0 && clipDist < radius) {
              radius = clipDist;
            }
          }
        }
      }

      const px = mine.x - halfWidth + Math.cos(angle) * radius;
      const py = mine.y - halfHeight + Math.sin(angle) * radius;

      if (lastPoint) {
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(px, py);
        ctx.stroke();
      }

      lastPoint = { x: px, y: py };
    }
  }

  /**
   * Draw only the animated pulses (called every frame)
   */
  private drawAnimatedPulses(context: CanvasRenderingContext2D, time: number) {
    if (this.protoCache.veins.length === 0) return;

    for (const vein of this.protoCache.veins) {
      const pulseCount = vein.isCrystal ? Math.min(3, 2 + vein.crystalCount) : 1;
      const pulseSpeed = vein.isCrystal ? 0.8 : 0.4;

      for (let p = 0; p < pulseCount; p++) {
        const pulseT = ((time * pulseSpeed + p / pulseCount) % 1);
        const t = pulseT;

        // Position along quadratic curve
        const px = (1 - t) * (1 - t) * vein.x2 + 2 * (1 - t) * t * vein.ctrlX + t * t * vein.x1;
        const py = (1 - t) * (1 - t) * vein.y2 + 2 * (1 - t) * t * vein.ctrlY + t * t * vein.y1;

        const pulseSizeBase = vein.isCrystal ? 2.5 : 1.5;
        const pulseSize = pulseSizeBase * (0.6 + 0.4 * Math.sin(pulseT * Math.PI));
        const pulseAlpha = vein.alpha * (0.5 + 0.5 * Math.sin(pulseT * Math.PI));

        // Simple circle instead of gradient (much faster)
        context.fillStyle = `rgba(150, 220, 255, ${pulseAlpha})`;
        context.beginPath();
        context.arc(px, py, pulseSize, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  private updateAndRenderGoldEffects(
    context: CanvasRenderingContext2D,
    deltaTime: number,
  ) {
    // Update and filter expired effects
    this.goldTextEffects = this.goldTextEffects.filter((effect) => {
      effect.lifeTime += deltaTime;
      if (effect.lifeTime >= effect.duration) {
        return false; // Remove expired
      }

      // Calculate animation progress
      const t = effect.lifeTime / effect.duration;
      const riseDistance = 15; // 50% smaller
      const x = effect.x - this.cachedHalfWidth;
      const y = effect.y - this.cachedHalfHeight - t * riseDistance;
      const alpha = 1 - t;

      // Gold text styling
      const goldText = `+${effect.gold}`;

      // Draw with fade and rise (50% smaller)
      context.save();
      context.font = "bold 6px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";

      // Black outline for visibility
      context.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
      context.lineWidth = 1.5;
      context.strokeText(goldText, x, y);

      // Gold fill
      context.fillStyle = `rgba(255, 215, 0, ${alpha})`;
      context.fillText(goldText, x, y);
      context.restore();

      return true; // Keep effect
    });
  }

  private updateAndRenderExplosions(
    context: CanvasRenderingContext2D,
    deltaTime: number,
  ) {
    // Update and filter expired explosions
    this.explosionEffects = this.explosionEffects.filter((explosion) => {
      explosion.lifeTime += deltaTime;
      if (explosion.lifeTime >= explosion.duration) {
        return false; // Remove expired
      }

      // Calculate animation progress (0 to 1)
      const t = explosion.lifeTime / explosion.duration;
      const x = explosion.x - this.cachedHalfWidth;
      const y = explosion.y - this.cachedHalfHeight;
      
      // Flash grows quickly then fades
      const growthPhase = Math.min(t * 5, 1); // Reaches full size at 20% of duration
      const currentRadius = explosion.radius * growthPhase;
      const alpha = Math.pow(1 - t, 2); // Fade out quickly (quadratic)

      // Flash of light - white/yellow core that fades
      const flashGradient = context.createRadialGradient(x, y, 0, x, y, currentRadius);
      flashGradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      flashGradient.addColorStop(0.3, `rgba(255, 255, 200, ${alpha * 0.8})`);
      flashGradient.addColorStop(0.6, `rgba(255, 200, 100, ${alpha * 0.4})`);
      flashGradient.addColorStop(1, `rgba(255, 150, 50, 0)`);
      context.fillStyle = flashGradient;
      context.beginPath();
      context.arc(x, y, currentRadius, 0, Math.PI * 2);
      context.fill();

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

  /**
   * Check if a world coordinate is within the current viewport (with margin)
   */
  private isInViewport(worldX: number, worldY: number): boolean {
    return (
      worldX >= this.viewportBounds.minX &&
      worldX <= this.viewportBounds.maxX &&
      worldY >= this.viewportBounds.minY &&
      worldY <= this.viewportBounds.maxY
    );
  }

  private renderUnit(context: CanvasRenderingContext2D, unit: any) {
    const player = this.game.player(unit.playerId);
    if (!player) return;

    const x = unit.x - this.cachedHalfWidth;
    const y = unit.y - this.cachedHalfHeight;

    const isDefensePost = unit.unitType === "defensePost";
    const isEliteSoldier = unit.unitType === "eliteSoldier";
    const isWarship = unit.unitType === "warship";
    const isArtillery = unit.unitType === "artillery";
    const isShieldGenerator = unit.unitType === "shieldGenerator";

    if (isShieldGenerator) {
      // Shield Generator: dome/bubble with energy field
      const size = 6;
      const shieldRadius = 30; // Match config shieldRadius
      
      // Draw shield bubble (if active)
      if (unit.shieldHealth && unit.shieldHealth > 0) {
        const shieldAlpha = 0.15 + 0.1 * Math.sin(this.cachedTime * 2);
        const shieldGradient = context.createRadialGradient(x, y, 0, x, y, shieldRadius);
        shieldGradient.addColorStop(0, `rgba(100, 200, 255, ${shieldAlpha * 0.3})`);
        shieldGradient.addColorStop(0.7, `rgba(80, 180, 240, ${shieldAlpha * 0.5})`);
        shieldGradient.addColorStop(1, `rgba(60, 150, 220, ${shieldAlpha})`);
        
        context.fillStyle = shieldGradient;
        context.beginPath();
        context.arc(x, y, shieldRadius, 0, Math.PI * 2);
        context.fill();
        
        // Shield edge glow
        context.strokeStyle = `rgba(120, 220, 255, ${0.3 + 0.2 * Math.sin(this.cachedTime * 3.3)})`;
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
      const coreGlow = 0.5 + 0.3 * Math.sin(this.cachedTime * 5);
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
    } else if (isArtillery) {
      // Artillery: cannon/mortar shape
      const size = 4;
      
      // Base platform (rectangle)
      context.fillStyle = "#555";
      context.fillRect(x - size / 2, y + size / 4, size, size / 3);
      
      // Cannon barrel (angled rectangle)
      context.save();
      context.translate(x, y);
      context.rotate(-Math.PI / 6); // Angle upward
      
      context.fillStyle = player.territoryColor().toRgbString();
      context.fillRect(-size / 6, -size / 2, size / 3, size * 0.8);
      
      // Barrel tip (darker)
      context.fillStyle = "#333";
      context.fillRect(-size / 6, -size / 2, size / 3, size / 5);
      
      context.restore();
      
      // Wheels (circles)
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
    } else if (isDefensePost) {
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
    } else if (isWarship) {
      // Warship: boat/ship shape with pointed bow
      const size = 10;

      // Ship hull shape (pointed at front, flat at back)
      context.fillStyle = player.territoryColor().toRgbString();
      context.beginPath();
      // Bow (front point)
      context.moveTo(x, y - size / 2);
      // Right side
      context.lineTo(x + size / 3, y - size / 6);
      context.lineTo(x + size / 3, y + size / 3);
      // Stern (back, flat)
      context.lineTo(x - size / 3, y + size / 3);
      // Left side
      context.lineTo(x - size / 3, y - size / 6);
      context.closePath();
      context.fill();

      // Deck line (horizontal bar)
      context.fillStyle = "#fff";
      context.fillRect(x - size / 4, y - size / 10, size / 2, size / 6);

      // Cannon turret (small circle on deck)
      context.beginPath();
      context.arc(x, y + size / 8, size / 6, 0, Math.PI * 2);
      context.fillStyle = "#444";
      context.fill();

      // Navy blue border
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
    const x = projectile.x - this.cachedHalfWidth;
    const y = projectile.y - this.cachedHalfHeight;

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

    // Check if this is an artillery shell
    if (projectile.isArtillery) {
      this.renderArtilleryProjectile(context, x, y, projectile);
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

  private renderArtilleryProjectile(
    context: CanvasRenderingContext2D,
    baseX: number,
    baseY: number,
    projectile: any,
  ) {
    // Artillery shell follows a ballistic arc trajectory
    const spotSize = 3;
    
    // Get trajectory progress (0 = start, 1 = end)
    const progress = projectile.progress || 0;
    
    // Calculate start and end points in screen space
    const startX = (projectile.startX ?? projectile.x) - this.cachedHalfWidth;
    const startY = (projectile.startY ?? projectile.y) - this.cachedHalfHeight;
    const targetX = (projectile.targetX ?? projectile.x) - this.cachedHalfWidth;
    const targetY = (projectile.targetY ?? projectile.y) - this.cachedHalfHeight;
    
    // Calculate horizontal distance for arc height
    const dx = targetX - startX;
    const dy = targetY - startY;
    const dist = Math.hypot(dx, dy);
    
    // Ballistic arc: parabola that peaks at 50% progress
    const arcHeight = Math.min(dist * 0.4, 60); // Max 60 pixels high
    const arcOffset = -4 * arcHeight * progress * (1 - progress);
    
    // Interpolate position along straight line + arc offset
    const x = startX + dx * progress;
    const y = startY + dy * progress + arcOffset;

    // Outer glow (orange/red)
    const glowRadius = spotSize * 4;
    const glowGradient = context.createRadialGradient(x, y, 0, x, y, glowRadius);
    glowGradient.addColorStop(0, "rgba(255, 150, 50, 0.6)");
    glowGradient.addColorStop(0.4, "rgba(255, 80, 0, 0.3)");
    glowGradient.addColorStop(1, "rgba(255, 0, 0, 0)");
    context.fillStyle = glowGradient;
    context.beginPath();
    context.arc(x, y, glowRadius, 0, Math.PI * 2);
    context.fill();

    // Bright white/yellow core spot
    context.fillStyle = "#ffffcc";
    context.beginPath();
    context.arc(x, y, spotSize, 0, Math.PI * 2);
    context.fill();
    
    // Inner bright white center
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(x, y, spotSize * 0.5, 0, Math.PI * 2);
    context.fill();
  }

  private renderBeam(context: CanvasRenderingContext2D, projectile: any) {
    const startX = projectile.startX - this.cachedHalfWidth;
    const startY = projectile.startY - this.cachedHalfHeight;
    const endX = projectile.x - this.cachedHalfWidth;
    const endY = projectile.y - this.cachedHalfHeight;

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
    crystal: {
      id: number;
      x: number;
      y: number;
      crystalCount: number;
      rotations?: number[];
    },
  ) {
    const x = crystal.x - this.cachedHalfWidth;
    const y = crystal.y - this.cachedHalfHeight;
    const rotations = crystal.rotations ?? [];

    // Base size scales with crystal count
    const baseSize = 3 + crystal.crystalCount * 1.5;

    // Draw cluster of small crystals
    const crystalPositions = this.getCrystalClusterPositions(
      crystal.crystalCount,
      baseSize,
    );

    for (let i = 0; i < crystalPositions.length; i++) {
      const pos = crystalPositions[i];
      const rotation = rotations[i] ?? 0;
      this.renderSingleCrystal(
        context,
        x + pos.x,
        y + pos.y,
        pos.size,
        rotation,
      );
    }
  }

  private getCrystalClusterPositions(
    count: number,
    baseSize: number,
  ): Array<{ x: number; y: number; size: number }> {
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

  private renderSingleCrystal(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    rotation: number,
  ) {
    // Growth animation - subtle pulse (crystals are hard, no movement)
    const time = this.cachedTime;
    const halfWidth = size / 2;
    const height = size * 1.8; // Taller crystal
    const bottomY = y + height * 0.3; // Bottom anchor point

    // Save context and apply rotation around bottom center
    context.save();
    context.translate(x, bottomY);
    context.rotate(rotation);
    context.translate(-x, -bottomY);

    // Outer glow with animated intensity - cold blue protomolecule style
    const glowIntensity = 0.4 + Math.sin(time * 2.5) * 0.2; // Stronger pulse
    const radiationPulse = 1 + Math.sin(time * 3) * 0.15; // Radiation expansion
    const glowGradient = context.createRadialGradient(
      x,
      y - height * 0.2,
      0,
      x,
      y - height * 0.2,
      size * 1.5 * radiationPulse,
    );
    glowGradient.addColorStop(0, `rgba(120, 200, 255, ${glowIntensity})`); // Cold blue core
    glowGradient.addColorStop(0.5, `rgba(80, 160, 220, ${glowIntensity * 0.5})`); // Mid blue
    glowGradient.addColorStop(1, "rgba(40, 120, 200, 0)"); // Fade out
    context.fillStyle = glowGradient;
    context.beginPath();
    context.arc(x, y - height * 0.2, size * 1.5 * radiationPulse, 0, Math.PI * 2);
    context.fill();

    // Crystal body (pentagon shape - tall with flat bottom) - cold blue
    context.fillStyle = "rgba(60, 140, 200, 0.9)"; // Cold blue
    context.beginPath();
    context.moveTo(x, y - height * 0.7); // Top point
    context.lineTo(x + halfWidth, y - height * 0.2); // Upper right
    context.lineTo(x + halfWidth, y + height * 0.3); // Lower right (flat bottom)
    context.lineTo(x - halfWidth, y + height * 0.3); // Lower left (flat bottom)
    context.lineTo(x - halfWidth, y - height * 0.2); // Upper left
    context.closePath();
    context.fill();

    // Crystal highlight - bright cold blue
    context.fillStyle = "rgba(150, 210, 255, 0.8)";
    context.beginPath();
    context.moveTo(x, y - height * 0.6);
    context.lineTo(x + halfWidth * 0.4, y - height * 0.25);
    context.lineTo(x - halfWidth * 0.4, y - height * 0.25);
    context.closePath();
    context.fill();

    // Border - dark blue
    context.strokeStyle = "rgba(20, 60, 100, 0.8)"; // Dark blue
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x, y - height * 0.7);
    context.lineTo(x + halfWidth, y - height * 0.2);
    context.lineTo(x + halfWidth, y + height * 0.3);
    context.lineTo(x - halfWidth, y + height * 0.3);
    context.lineTo(x - halfWidth, y - height * 0.2);
    context.closePath();
    context.stroke();

    // Restore context
    context.restore();
  }
}
