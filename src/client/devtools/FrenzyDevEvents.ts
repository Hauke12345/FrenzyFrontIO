import { GameEvent } from "../../core/EventBus";
import { FrenzyConfig } from "../../core/game/frenzy/FrenzyTypes";

export class UpdateFrenzyConfigEvent implements GameEvent {
  constructor(public readonly config: Partial<FrenzyConfig>) {}
}
