import {
  Difficulty,
  GameFork,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
} from "../core/game/Game";
import { GameConfig } from "../core/Schemas";

// CircleMap-only playlist with max 20 players
// Bots are set to 20 here; the actual number spawned will be 20 - numRealPlayers
// (calculated in GameRunner.init())
const CIRCLE_MAP_MAX_PLAYERS = 20;

export class MapPlaylist {
  constructor(private disableTeams: boolean = false) {}

  public gameConfig(): GameConfig {
    // Always use CircleMap in FFA mode with 20 max players
    return {
      donateGold: false,
      donateTroops: false,
      gameMap: GameMapType.CircleMap,
      maxPlayers: CIRCLE_MAP_MAX_PLAYERS,
      gameType: GameType.Public,
      gameFork: GameFork.Frenzy,
      gameMapSize: GameMapSize.Normal,
      difficulty: Difficulty.Medium,
      infiniteGold: false,
      infiniteTroops: false,
      maxTimerValue: undefined,
      instantBuild: false,
      randomSpawn: false,
      disableNPCs: false,
      gameMode: GameMode.FFA,
      playerTeams: undefined,
      bots: CIRCLE_MAP_MAX_PLAYERS, // Will be adjusted to (20 - numRealPlayers) in GameRunner
      disabledUnits: [],
    } satisfies GameConfig;
  }
}
