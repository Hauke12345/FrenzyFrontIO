import { PlayerID } from "../Game";
import { TileRef } from "../GameMap";

/**
 * Frenzy Mode: Strategic unit-based warfare with continuous movement
 * and flowing territory boundaries
 *
 * ALL buildings and units are managed by FrenzyManager as Frenzy structures/units.
 * This avoids confusion between game units and Frenzy units.
 */

/**
 * Frenzy structure types (stationary buildings)
 * - HQ: Main building, spawns soldiers
 * - Mine: Generates gold from nearby crystals
 * - Factory: Spawns soldiers (tier 2: elite soldiers)
 * - Port: Spawns warships (tier 2: elite warships)
 */
export enum FrenzyStructureType {
  HQ = "hq",
  Mine = "mine",
  Factory = "factory",
  Port = "port",
}

/**
 * Frenzy unit types
 * - Mobile: soldier, eliteSoldier, warship (move and attack)
 * - Towers: defensePost, samLauncher, missileSilo, shieldGenerator, artillery (stationary defensive)
 */
export enum FrenzyUnitType {
  // Mobile units
  Soldier = "soldier",
  EliteSoldier = "eliteSoldier",
  Warship = "warship",
  // Towers (stationary)
  DefensePost = "defensePost",
  SAMLauncher = "samLauncher",
  MissileSilo = "missileSilo",
  ShieldGenerator = "shieldGenerator",
  Artillery = "artillery",
}

/**
 * Unified structure configuration for all buildable structures
 * Centralizes all structure parameters: costs, health, construction, upgrades, selling
 */
export interface StructureConfig {
  // Building
  buildCost: number; // Gold cost to build
  constructionTime: number; // Ticks to construct (10 ticks = 1 second)
  health: number; // Base HP at tier 1

  // Upgrades
  maxTier: number; // Maximum tier (1 = not upgradable)
  upgradeCost: number; // Gold cost to upgrade to next tier
  upgradeHealthBonus: number; // Additional HP per tier upgrade
  requiredHQTier: number; // Minimum HQ tier required to upgrade

  // Selling
  sellRefundPercent: number; // Percentage of build cost refunded when selling (0-100)

  // Special properties (optional)
  spawnInterval?: number; // For spawners (Factory, Port): seconds between spawns
  goldPerMinute?: number; // For Mine: gold generation per minute
  tier2GoldMultiplier?: number; // For Mine: multiplier for tier 2 gold generation
}

/**
 * Structure type keys for configuration lookup
 */
export type StructureTypeKey =
  | "hq"
  | "mine"
  | "factory"
  | "port"
  | "defensePost"
  | "samLauncher"
  | "missileSilo"
  | "shieldGenerator"
  | "artillery";

/**
 * Default structure configurations
 * All structures in one place for easy balancing
 */
export const STRUCTURE_CONFIGS: Record<StructureTypeKey, StructureConfig> = {
  // === Buildings (economic/production) ===
  hq: {
    buildCost: 0, // Not buildable
    constructionTime: 0,
    health: 1000,
    maxTier: 2,
    upgradeCost: 500000,
    upgradeHealthBonus: 500,
    requiredHQTier: 1,
    sellRefundPercent: 0, // Cannot sell HQ
    spawnInterval: 4.0,
  },
  mine: {
    buildCost: 50000,
    constructionTime: 20, // 2 seconds
    health: 400,
    maxTier: 2,
    upgradeCost: 100000,
    upgradeHealthBonus: 200,
    requiredHQTier: 2,
    sellRefundPercent: 50,
    goldPerMinute: 10000,
    tier2GoldMultiplier: 2,
  },
  factory: {
    buildCost: 100000,
    constructionTime: 20, // 2 seconds
    health: 400,
    maxTier: 2,
    upgradeCost: 100000,
    upgradeHealthBonus: 200,
    requiredHQTier: 2,
    sellRefundPercent: 50,
    spawnInterval: 4.0,
  },
  port: {
    buildCost: 100000,
    constructionTime: 20, // 2 seconds
    health: 400,
    maxTier: 2,
    upgradeCost: 100000,
    upgradeHealthBonus: 200,
    requiredHQTier: 2,
    sellRefundPercent: 50,
    spawnInterval: 4.0,
  },

  // === Towers (military/defensive) ===
  defensePost: {
    buildCost: 25000,
    constructionTime: 50, // 5 seconds
    health: 200,
    maxTier: 2,
    upgradeCost: 100000,
    upgradeHealthBonus: 100,
    requiredHQTier: 2,
    sellRefundPercent: 50,
  },
  samLauncher: {
    buildCost: 1500000,
    constructionTime: 300, // 30 seconds
    health: 150,
    maxTier: 2,
    upgradeCost: 100000,
    upgradeHealthBonus: 75,
    requiredHQTier: 2,
    sellRefundPercent: 50,
  },
  missileSilo: {
    buildCost: 1000000,
    constructionTime: 100, // 10 seconds
    health: 300,
    maxTier: 2,
    upgradeCost: 100000,
    upgradeHealthBonus: 150,
    requiredHQTier: 2,
    sellRefundPercent: 50,
  },
  shieldGenerator: {
    buildCost: 150000,
    constructionTime: 150, // 15 seconds
    health: 100,
    maxTier: 2,
    upgradeCost: 100000,
    upgradeHealthBonus: 50,
    requiredHQTier: 2,
    sellRefundPercent: 50,
  },
  artillery: {
    buildCost: 200000,
    constructionTime: 200, // 20 seconds
    health: 150,
    maxTier: 2,
    upgradeCost: 100000,
    upgradeHealthBonus: 75,
    requiredHQTier: 2,
    sellRefundPercent: 50,
  },
};

/**
 * Get structure config by type key
 */
export function getStructureConfig(type: StructureTypeKey): StructureConfig {
  return STRUCTURE_CONFIGS[type];
}

/**
 * Get structure type key from FrenzyStructureType
 */
export function structureTypeToKey(
  type: FrenzyStructureType,
): StructureTypeKey {
  switch (type) {
    case FrenzyStructureType.HQ:
      return "hq";
    case FrenzyStructureType.Mine:
      return "mine";
    case FrenzyStructureType.Factory:
      return "factory";
    case FrenzyStructureType.Port:
      return "port";
  }
}

/**
 * Get structure type key from FrenzyUnitType (for towers)
 */
export function unitTypeToStructureKey(
  type: FrenzyUnitType,
): StructureTypeKey | null {
  switch (type) {
    case FrenzyUnitType.DefensePost:
      return "defensePost";
    case FrenzyUnitType.SAMLauncher:
      return "samLauncher";
    case FrenzyUnitType.MissileSilo:
      return "missileSilo";
    case FrenzyUnitType.ShieldGenerator:
      return "shieldGenerator";
    case FrenzyUnitType.Artillery:
      return "artillery";
    default:
      return null; // Mobile units don't have structure configs
  }
}

/**
 * Calculate sell value for a structure
 */
export function getStructureSellValue(
  type: StructureTypeKey,
  tier: number = 1,
): number {
  const config = STRUCTURE_CONFIGS[type];
  const baseCost = config.buildCost;
  const upgradeCost = (tier - 1) * config.upgradeCost;
  const totalInvested = baseCost + upgradeCost;
  return Math.floor(totalInvested * (config.sellRefundPercent / 100));
}

/**
 * Check if a structure can be upgraded
 */
export function canUpgradeStructureConfig(
  type: StructureTypeKey,
  currentTier: number,
  hqTier: number,
  playerGold: bigint,
): boolean {
  const config = STRUCTURE_CONFIGS[type];
  if (currentTier >= config.maxTier) return false;
  if (hqTier < config.requiredHQTier) return false;
  if (playerGold < BigInt(config.upgradeCost)) return false;
  return true;
}

/**
 * Get health for a structure at a specific tier
 */
export function getStructureHealthForTier(
  type: StructureTypeKey,
  tier: number = 1,
): number {
  const config = STRUCTURE_CONFIGS[type];
  return config.health + (tier - 1) * config.upgradeHealthBonus;
}

// Per-unit-type configuration
export interface UnitTypeConfig {
  health: number; // HP for this unit type
  speed: number; // Movement speed (pixels/sec), 0 for stationary
  dps: number; // Damage per second
  range: number; // Combat range in pixels
  fireInterval: number; // Seconds between shots
  projectileDamage?: number; // If set, deals instant damage instead of DPS
  areaRadius?: number; // Area of effect radius for splash damage
  shieldRadius?: number; // Shield protection radius
  shieldHealth?: number; // Shield HP (regenerates when not taking damage)
  shieldRegenTime?: number; // Seconds to fully regenerate shield from 0 to max
}

export interface FrenzyUnit {
  id: number;
  playerId: PlayerID;
  x: number; // Pixel coordinates
  y: number;
  vx: number; // Velocity
  vy: number;
  health: number;
  maxHealth: number;
  targetX: number;
  targetY: number;
  weaponCooldown: number;
  unitType: FrenzyUnitType;
  fireInterval: number; // Unit-specific fire interval
  tier: number; // Unit tier (1 = base, 2+ = upgraded)
  shieldHealth?: number; // Current shield HP (for shield generators)
  maxShieldHealth?: number; // Max shield HP
  shieldRegenTimer?: number; // Timer for shield regeneration
  // Per-unit attack order (direct targeting)
  attackOrderX?: number; // Attack order target X
  attackOrderY?: number; // Attack order target Y
  hasAttackOrder?: boolean; // Whether unit has an active attack order
  // Tier 2 warship missile barrage state
  barrageCount?: number; // Current number of missiles fired in this barrage (0-5)
  barrageCooldown?: number; // Cooldown between barrage volleys (short, for rapid fire)
  barragePhase?: number; // 0 = first volley of 5, 1 = second volley of 5, then reload
}

export interface FrenzyProjectile {
  id: number;
  playerId: PlayerID;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  isBeam?: boolean; // True for defense post red beam
  isElite?: boolean; // True for elite soldier projectiles
  isArtillery?: boolean; // True for artillery shells (area damage)
  isMissile?: boolean; // True for tier 2 warship missiles (non-guided, small AOE)
  areaRadius?: number; // Splash damage radius
  damage?: number; // Damage to deal on impact
  startX?: number; // Beam origin X
  startY?: number; // Beam origin Y
  targetX?: number; // Target position X (for artillery/missiles)
  targetY?: number; // Target position Y (for artillery/missiles)
}

/**
 * Base structure interface for all Frenzy buildings
 */
export interface FrenzyStructure {
  id: number; // Unique structure ID
  type: FrenzyStructureType;
  playerId: PlayerID;
  x: number; // Pixel coordinates
  y: number;
  tile: TileRef;
  tier: number; // Structure tier (1 = base, 2+ = upgraded)
  health: number; // Current HP
  maxHealth: number; // Max HP
  // Spawner properties (for HQ, Factory, Port)
  spawnTimer?: number; // Seconds until next spawn
  spawnInterval?: number; // Seconds between spawns
  unitCount?: number; // Only for HQ - total units spawned
  // Construction properties
  constructionProgress?: number; // 0-1 for buildings under construction
  isConstruction?: boolean; // True while building
}

/**
 * HQ building (spawns soldiers, main base)
 */
export interface CoreBuilding extends FrenzyStructure {
  type: FrenzyStructureType.HQ;
  spawnTimer: number;
  spawnInterval: number;
  unitCount: number;
}

/**
 * Factory building (spawns soldiers/elite soldiers)
 */
export interface FactorySpawner extends FrenzyStructure {
  type: FrenzyStructureType.Factory;
  spawnTimer: number;
  spawnInterval: number;
}

/**
 * Port building (spawns warships)
 */
export interface PortSpawner extends FrenzyStructure {
  type: FrenzyStructureType.Port;
  spawnTimer: number;
  spawnInterval: number;
}

/**
 * Mine building (generates gold from crystals)
 */
export interface MineStructure extends FrenzyStructure {
  type: FrenzyStructureType.Mine;
}

export interface CrystalCluster {
  id: number;
  x: number; // Pixel coordinates (center)
  y: number;
  tile: TileRef;
  crystalCount: number; // Number of crystals in this cluster (1-5)
  rotations: number[]; // Rotation angles in radians for each crystal (bottom anchored)
}

export interface FrenzyConfig {
  // Unit type configurations
  units: {
    // Mobile units
    soldier: UnitTypeConfig;
    eliteSoldier: UnitTypeConfig;
    warship: UnitTypeConfig;
    eliteWarship: UnitTypeConfig;
    // Towers
    defensePost: UnitTypeConfig;
    eliteDefensePost: UnitTypeConfig;
    samLauncher: UnitTypeConfig;
    missileSilo: UnitTypeConfig;
    shieldGenerator: UnitTypeConfig;
    eliteShieldGenerator: UnitTypeConfig;
    artillery: UnitTypeConfig;
    eliteArtillery: UnitTypeConfig;
  };

  // Spawning
  spawnInterval: number; // Seconds between spawns (default: 4.0)
  maxUnitsPerPlayer: number; // Hard cap (default: 60)
  maxWarshipsPerPlayer: number; // Ship cap (default: 20)
  startingUnits: number; // Units at game start (default: 5)

  // Movement & Territory
  influenceRadius: number; // Territory control radius (default: 18px)
  separationRadius: number; // Personal space from friendlies (default: 10px)
  captureRadius: number; // Tiles around the unit that can be converted (default: 3)
  radialAlignmentWeight: number; // Strength of radial bias toward centroid (default: 0.75)
  borderAdvanceDistance: number; // How far past the border to push targets (default: 12px)
  stopDistance: number; // Distance to stop before reaching target (default: 2px)

  // Projectiles
  projectileSpeed: number; // Speed of visual shells (default: 140px/s)
  projectileSize: number; // Diameter of visual shells in pixels (default: 4px)

  // Buildings - DEPRECATED: Use STRUCTURE_CONFIGS instead
  // Kept for backward compatibility
  hqCaptureRadius: number; // Tiles around HQ that must fall before defeat (default: 2 tiles)
  mineHealth: number; // HP for mines/factories (default: 400)
  hqHealth: number; // HP for HQ (default: 1000)

  // Economy - DEPRECATED: Use STRUCTURE_CONFIGS instead for costs
  // Kept for backward compatibility
  startingGold: number; // Gold at spawn (default: 150000)
  baseGoldPerMinute: number; // Base gold income per minute (default: 20000)
  mineGoldPerMinute: number; // Gold per mine per minute (default: 10000 for tier 1)
  mineCost: number; // Fixed cost for mines (default: 50000)
  mineUpgradeCost: number; // Cost to upgrade mine to tier 2 (default: 100000)
  factoryCost: number; // Fixed cost for factories (default: 100000)
  factoryUpgradeCost: number; // Cost to upgrade factory to tier 2 (default: 100000)

  // Crystals (resources)
  crystalClusterCount: number; // Number of crystal clusters to spawn (default: 50)
  crystalGoldBonus: number; // Extra gold per crystal per 10s interval (default: 1000)
  mineGoldInterval: number; // Seconds between mine gold payouts (default: 10)
  mineRadius: number; // Max radius of mine Voronoi territory in pixels (default: 40)
}

// Helper to get unit config by type
export function getUnitConfig(
  config: FrenzyConfig,
  unitType: FrenzyUnitType,
): UnitTypeConfig {
  switch (unitType) {
    case FrenzyUnitType.Soldier:
      return config.units.soldier;
    case FrenzyUnitType.EliteSoldier:
      return config.units.eliteSoldier;
    case FrenzyUnitType.Warship:
      return config.units.warship;
    case FrenzyUnitType.DefensePost:
      return config.units.defensePost;
    case FrenzyUnitType.SAMLauncher:
      return config.units.samLauncher;
    case FrenzyUnitType.MissileSilo:
      return config.units.missileSilo;
    case FrenzyUnitType.ShieldGenerator:
      return config.units.shieldGenerator;
    case FrenzyUnitType.Artillery:
      return config.units.artillery;
    default:
      return config.units.soldier;
  }
}

export const DEFAULT_FRENZY_CONFIG: FrenzyConfig = {
  // Unit configurations
  units: {
    // Mobile units
    soldier: {
      health: 100,
      speed: 2.5,
      dps: 15,
      range: 25,
      fireInterval: 1,
    },
    eliteSoldier: {
      health: 150, // 1.5x soldier health
      speed: 2.25, // 10% slower than soldier
      dps: 15,
      range: 37.5, // 1.5x soldier range
      fireInterval: 1,
    },
    warship: {
      health: 250, // Tough naval unit
      speed: 2.0, // Slower than land units
      dps: 20, // Strong damage
      range: 45, // Long range - can hit land from water
      fireInterval: 1.5, // Moderate fire rate
      projectileDamage: 50, // Good projectile damage
    },
    eliteWarship: {
      health: 375, // 1.5x warship health (250 * 1.5)
      speed: 2.0, // Same speed as tier 1
      dps: 30, // 1.5x warship dps
      range: 300, // 2x warship range (45 * 2) - long range missiles
      fireInterval: 8.0, // Slow reload (fires barrages)
      projectileDamage: 30, // Per-missile damage (fires 2x5 = 10 missiles)
      areaRadius: 5, // Small AOE per missile
    },
    // Towers
    defensePost: {
      health: 200, // 2x soldier health
      speed: 0, // Stationary
      dps: 0, // Uses projectileDamage instead
      range: 25, // Same as soldier (tier 2: 37.5)
      fireInterval: 0.5, // Double soldier fire rate (tier 2: 4.0)
      projectileDamage: 15, // Same as soldier damage (tier 2: 100, one-shots units)
    },
    eliteDefensePost: {
      health: 300, // 1.5x defense post health
      speed: 0, // Stationary
      dps: 0, // Uses projectileDamage instead
      range: 37.5, // 1.5x defense post range
      fireInterval: 4.0, // Slower but one-shots
      projectileDamage: 100, // One-shots most units
    },
    samLauncher: {
      health: 150, // Moderate HP
      speed: 0, // Stationary
      dps: 0, // Uses projectileDamage instead
      range: 60, // Good anti-air range
      fireInterval: 2.0, // Moderate fire rate
      projectileDamage: 100, // High damage to aircraft
    },
    missileSilo: {
      health: 300, // High HP
      speed: 0, // Stationary
      dps: 0, // Uses missiles
      range: 0, // Global range via missiles
      fireInterval: 0, // Manual launching
    },
    shieldGenerator: {
      health: 100, // Low HP
      speed: 0, // Stationary
      dps: 0, // No attack
      range: 0, // No attack range
      fireInterval: 0, // No firing
      shieldRadius: 30, // Protection radius
      shieldHealth: 900, // Shield absorbs 500 damage before breaking
      shieldRegenTime: 10, // 10 seconds to fully regenerate
    },
    eliteShieldGenerator: {
      health: 150, // 1.5x shield generator health
      speed: 0, // Stationary
      dps: 0, // No attack
      range: 0, // No attack range
      fireInterval: 0, // No firing
      shieldRadius: 45, // 1.5x protection radius
      shieldHealth: 2000, // 2x shield HP
      shieldRegenTime: 12, // Faster regen (12 seconds)
    },
    artillery: {
      health: 150, // Fragile
      speed: 0, // Stationary
      dps: 0, // Uses projectileDamage instead
      range: 80, // Very long range
      fireInterval: 8.0, // Very slow firing, long cooldown
      projectileDamage: 100, // High damage
      areaRadius: 15, // Splash damage radius
    },
    eliteArtillery: {
      health: 225, // 1.5x artillery health
      speed: 0, // Stationary
      dps: 0, // Uses projectileDamage instead
      range: 120, // 1.5x range
      fireInterval: 8.0, // Faster firing
      projectileDamage: 150, // 1.5x damage
      areaRadius: 30, // Larger splash radius (~1.5x)
    },
  },

  // Spawning
  spawnInterval: 4.0,
  maxUnitsPerPlayer: 100,
  maxWarshipsPerPlayer: 20,
  startingUnits: 5,

  // Movement & Territory
  influenceRadius: 9,
  separationRadius: 5,
  captureRadius: 10,
  radialAlignmentWeight: 0.75,
  borderAdvanceDistance: 0.5,
  stopDistance: 1,

  // Projectiles
  projectileSpeed: 10,
  projectileSize: 1,

  // Buildings - values now come from STRUCTURE_CONFIGS
  hqCaptureRadius: 2,
  mineHealth: STRUCTURE_CONFIGS.mine.health,
  hqHealth: STRUCTURE_CONFIGS.hq.health,

  // Economy - values now come from STRUCTURE_CONFIGS
  startingGold: 150000,
  baseGoldPerMinute: 20000,
  mineGoldPerMinute: STRUCTURE_CONFIGS.mine.goldPerMinute!,
  mineCost: STRUCTURE_CONFIGS.mine.buildCost,
  mineUpgradeCost: STRUCTURE_CONFIGS.mine.upgradeCost,
  factoryCost: STRUCTURE_CONFIGS.factory.buildCost,
  factoryUpgradeCost: STRUCTURE_CONFIGS.factory.upgradeCost,

  // Crystals (resources)
  crystalClusterCount: 50,
  crystalGoldBonus: 1000,
  mineGoldInterval: 10,
  mineRadius: 40,
};

/**
 * Structure upgrade configuration - DEPRECATED
 * Use STRUCTURE_CONFIGS instead
 * Kept for backward compatibility
 */
export interface StructureUpgradeInfo {
  requiredHQTier: number; // Minimum HQ tier required to upgrade this structure
  upgradeCost: number; // Gold cost for upgrade
  maxTier: number; // Maximum tier for this structure
}

/**
 * DEPRECATED: Use STRUCTURE_CONFIGS instead
 * Structure upgrade configurations for all upgradable structures
 */
export const STRUCTURE_UPGRADES: Record<string, StructureUpgradeInfo> = {
  // Buildings
  mine: {
    requiredHQTier: STRUCTURE_CONFIGS.mine.requiredHQTier,
    upgradeCost: STRUCTURE_CONFIGS.mine.upgradeCost,
    maxTier: STRUCTURE_CONFIGS.mine.maxTier,
  },
  factory: {
    requiredHQTier: STRUCTURE_CONFIGS.factory.requiredHQTier,
    upgradeCost: STRUCTURE_CONFIGS.factory.upgradeCost,
    maxTier: STRUCTURE_CONFIGS.factory.maxTier,
  },
  port: {
    requiredHQTier: STRUCTURE_CONFIGS.port.requiredHQTier,
    upgradeCost: STRUCTURE_CONFIGS.port.upgradeCost,
    maxTier: STRUCTURE_CONFIGS.port.maxTier,
  },
  // Towers
  defensePost: {
    requiredHQTier: STRUCTURE_CONFIGS.defensePost.requiredHQTier,
    upgradeCost: STRUCTURE_CONFIGS.defensePost.upgradeCost,
    maxTier: STRUCTURE_CONFIGS.defensePost.maxTier,
  },
  sam: {
    requiredHQTier: STRUCTURE_CONFIGS.samLauncher.requiredHQTier,
    upgradeCost: STRUCTURE_CONFIGS.samLauncher.upgradeCost,
    maxTier: STRUCTURE_CONFIGS.samLauncher.maxTier,
  },
  shield: {
    requiredHQTier: STRUCTURE_CONFIGS.shieldGenerator.requiredHQTier,
    upgradeCost: STRUCTURE_CONFIGS.shieldGenerator.upgradeCost,
    maxTier: STRUCTURE_CONFIGS.shieldGenerator.maxTier,
  },
  artillery: {
    requiredHQTier: STRUCTURE_CONFIGS.artillery.requiredHQTier,
    upgradeCost: STRUCTURE_CONFIGS.artillery.upgradeCost,
    maxTier: STRUCTURE_CONFIGS.artillery.maxTier,
  },
  silo: {
    requiredHQTier: STRUCTURE_CONFIGS.missileSilo.requiredHQTier,
    upgradeCost: STRUCTURE_CONFIGS.missileSilo.upgradeCost,
    maxTier: STRUCTURE_CONFIGS.missileSilo.maxTier,
  },
};

export enum Stance {
  ATTACK = "ATTACK",
  DEFEND = "DEFEND",
  NEUTRAL = "NEUTRAL",
}
