import { GameView, PlayerView } from "../../../../core/game/GameView";
import { TransformHandler } from "../../TransformHandler";

/**
 * Shared rendering context passed to all Frenzy sub-renderers.
 * Contains cached values and helper methods to avoid duplication.
 */
export interface FrenzyRenderContext {
  game: GameView;
  context: CanvasRenderingContext2D;
  transformHandler: TransformHandler;

  // Cached values (updated each frame)
  time: number;
  deltaTime: number;
  halfWidth: number;
  halfHeight: number;

  // Viewport bounds for culling
  viewportBounds: ViewportBounds;
}

export interface ViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Check if a point is within the viewport bounds
 */
export function isInViewport(
  x: number,
  y: number,
  bounds: ViewportBounds,
): boolean {
  return (
    x >= bounds.minX &&
    x <= bounds.maxX &&
    y >= bounds.minY &&
    y <= bounds.maxY
  );
}

/**
 * Get player by ID helper
 */
export function getPlayerById(
  game: GameView,
  playerId: string,
): PlayerView | null {
  for (const player of game.players()) {
    if (player.id() === playerId) {
      return player;
    }
  }
  return null;
}

/**
 * Convert tier number to Roman numeral
 */
export function getTierRoman(tier: number): string {
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
