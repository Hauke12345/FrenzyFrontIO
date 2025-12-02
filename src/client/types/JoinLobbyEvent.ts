import { GameRecord, GameStartInfo } from "../../core/Schemas";

export interface JoinLobbyEvent {
  clientID: string;
  gameID: string;
  gameStartInfo?: GameStartInfo;
  gameRecord?: GameRecord;
}
