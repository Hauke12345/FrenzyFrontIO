import * as fs from "fs";
import * as path from "path";

const LOG_DIR = "/var/log/frenzyfront";
const LOG_FILE = path.join(LOG_DIR, "games.log");

function ensureLogDir(): void {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  } catch (error) {
    console.error(`Failed to create log directory ${LOG_DIR}:`, error);
  }
}

function formatDate(date: Date): string {
  return date.toISOString().replace("T", " ").substring(0, 19);
}

function appendLog(line: string): void {
  try {
    ensureLogDir();
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch (error) {
    console.error("Failed to write game metrics:", error);
  }
}

export interface GameStartMetrics {
  gameId: string;
  map: string;
  playerCount: number;
  gameType: string;
  gameFork?: string;
}

export interface GameEndMetrics {
  gameId: string;
  durationMs: number;
  turns: number;
  winner?: unknown;
  playerCount: number;
}

function formatWinner(winner: unknown): string {
  if (!winner) return "none";
  if (Array.isArray(winner) && winner.length >= 2) {
    // Winner is ["player", id, ...] or ["team", name, ...]
    return `${winner[0]}:${winner[1]}`;
  }
  return String(winner);
}

export function logGameStart(metrics: GameStartMetrics): void {
  const timestamp = formatDate(new Date());
  const line = `${timestamp} | GAME_START | id=${metrics.gameId} | map=${metrics.map} | players=${metrics.playerCount} | type=${metrics.gameType} | fork=${metrics.gameFork ?? "classic"}`;
  appendLog(line);
}

export function logGameEnd(metrics: GameEndMetrics): void {
  const timestamp = formatDate(new Date());
  const durationMin = Math.round(metrics.durationMs / 1000 / 60);
  const winnerStr = formatWinner(metrics.winner);
  const line = `${timestamp} | GAME_END | id=${metrics.gameId} | duration=${durationMin}m | turns=${metrics.turns} | players=${metrics.playerCount} | winner=${winnerStr}`;
  appendLog(line);
}
