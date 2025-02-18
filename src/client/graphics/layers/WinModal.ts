import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Player } from "../../../core/game/Game";
import { ClientID } from "../../../core/Schemas";
import { GameView, PlayerView } from "../../../core/game/GameView";
import { Layer } from "./Layer";
import { GameUpdateType } from "../../../core/game/GameUpdates";
import { PseudoRandom } from "../../../core/PseudoRandom";
import { simpleHash } from "../../../core/Util";
import { EventBus } from "../../../core/EventBus";
import { SendWinnerEvent } from "../../Transport";

const lowRadiationVictoryQuotes = [
  "Victory is mine. The world endures - under new management.",
  "They thought they could stop me. Now they serve me.",
  "The old order has fallen. My reign begins.",
  "Not every victory requires destruction.",
  "From this day forward, all will know who rules.",
  "The war is over. Long live the victor.",
  "A new empire rises - with me at its helm.",
  "The throne is claimed. The crown is mine.",
  "Today marks the beginning of my dynasty.",
  "They feared my wrath. Now they'll know my rule.",
  "Victory was inevitable. Surrender was optional.",
  "A new era dawns - under my command.",
  "The pieces are in place. The victory is complete.",
  "Let history remember who conquered all.",
  "Their resistance only delayed the inevitable.",
  "Power shifts. Empires fall. I remain.",
  "The world has a new master now.",
  "Their armies fell. Their nations surrendered. I prevailed.",
  "All paths led to this victory.",
  "The world bows to its new ruler.",
  "From the ashes of their defeat, my victory rises.",
  "Destiny called. I answered. The world followed.",
  "They called me tyrant. Now they call me emperor.",
  "The old powers have fallen. Mine endures.",
  "Every empire needs a beginning. This is mine.",
  "Their defiance crumbled before my ambition.",
  "No more rebels. No more resistance. Only order.",
  "The final piece falls into place.",
  "Let them write of this day in their histories.",
  "My vision becomes reality.",
  "Their surrender was wise. My victory was certain.",
  "The wheels of fate turn in my favor.",
  "A new chapter begins - written by the victor.",
  "They fought the inevitable. The inevitable won.",
  "All that was theirs is now mine.",
  "The gods themselves bow before my triumph.",
  "Their kingdoms shatter. My empire rises.",
  "Victory tastes sweeter than wine.",
  "The crown suits me well, don't you think?",
  "Behold the dawn of my eternal reign.",
];

const highRadiationVictoryQuotes = [
  "Let the world burn. I just want to rule the ashes.",
  "The old world died screaming. My new one rises from its bones.",
  "They could have surrendered. Now they glow.",
  "Everything burns. The throne of ashes awaits.",
  "A wasteland needs a king. I have answered the call.",
  "Their cities turned to glass. My victory endures.",
  "Who needs a pristine world when you can rule its ruins?",
  "They feared the fire. I embraced it.",
  "The radiation clears the way for my reign.",
  "A dead world makes for quiet subjects.",
  "From atomic fire, my kingdom rises.",
  "Nothing left but ashes and victory.",
  "They wanted war. I gave them annihilation.",
  "The world burns green. My empire glows eternal.",
  "All thrones are built on ashes. Mine just glows.",
  "Look upon my works and despair - if you can still see.",
  "The mushroom clouds herald my coronation.",
  "A crown of thorns for a radioactive realm.",
  "They chose extinction. I chose supremacy.",
  "The wasteland's throne is mine to claim.",
  "The Geiger counter clicks. The masses bow.",
  "Atoms split. Nations fall. I reign supreme.",
  "My kingdom radiates with possibility.",
  "The isotopes of victory decay slowly.",
  "Critical mass achieved. Dominion secured.",
  "Chain reaction complete: world falls, empire rises.",
  "In nuclear fire, I forge my legacy.",
];

export const defeatQuotes = [
  // Last words and final thoughts
  "The flame of our nation flickers out...",
  "History will remember we fought to the last.",
  "Our glory fades into darkness.",
  "The end comes for all nations. Today, it comes for us.",
  "We fought. We failed. We fade.",
  "Our time in the sun is done.",
  "The pages of history close on our chapter.",
  "So falls the dream of empire.",
  "We built in stone, but even stone crumbles.",
  "The stars themselves will remember our defiance.",

  // Bitter defeats
  "Treachery and fate conspired against us.",
  "Our enemies dance on the graves of heroes.",
  "The vultures circle what remains.",
  "Let them celebrate. Dead men need no vengeance.",
  "The light dies. The darkness wins.",
  "Our walls fall. Our spirit breaks.",
  "Victory goes to the ruthless.",
  "Time claims another empire.",
  "The crown shatters. The throne burns.",
  "Our banners fall. Our story ends.",

  // Philosophical acceptance
  "All great nations must face their sunset.",
  "Time is the ultimate conqueror.",
  "Today we join the ghosts of fallen empires.",
  "What rises must also fall.",
  "Our legacy scatters like dust in the wind.",
  "The wheel turns. We descend.",
  "From glory to ashes, as all things must.",
  "The tides of fate show no mercy.",
  "Let history judge if we were worthy.",
  "We join the eternal silence.",

  // Defiant last stands
  "Our spirit remains unbroken.",
  "They may take our lands, but not our pride.",
  "Remember us as we were, not as we fell.",
  "We chose death before dishonor.",
  "Our courage lives beyond our defeat.",
  "Let them write of how we stood fast.",
  "We fall, but we fall fighting.",
  "Honor guides us to our end.",
  "Death before surrender.",
  "The echoes of our defiance will ring eternal.",

  // Prophetic/Cursed
  "Our shadow will haunt their victory.",
  "They'll learn the price of empire.",
  "Time will prove our cause was just.",
  "The seeds of their downfall are sown in our ashes.",
  "Our fall heralds their doom.",
  "Victory today. Nemesis tomorrow.",
  "The wheel turns for all.",
  "They'll remember us in their nightmares.",
  "Our curse follows them to their graves.",
  "What rises in our place will shake the world.",
];

@customElement("win-modal")
export class WinModal extends LitElement implements Layer {
  public game: GameView;
  public eventBus: EventBus;

  private rand: PseudoRandom;

  private hasShownDeathModal = false;

  @state()
  isVisible = false;

  private _title: string;
  private message: string;

  static styles = css`
    :host {
      display: block;
    }

    .modal {
      display: none;
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: rgba(30, 30, 30, 0.7);
      padding: 25px;
      border-radius: 10px;
      z-index: 9999;
      box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(5px);
      color: white;
      width: 300px;
      transition:
        opacity 0.3s ease-in-out,
        visibility 0.3s ease-in-out;
    }

    .modal.visible {
      display: block;
      animation: fadeIn 0.3s ease-out;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translate(-50%, -48%);
      }
      to {
        opacity: 1;
        transform: translate(-50%, -50%);
      }
    }

    h2 {
      margin: 0 0 15px 0;
      font-size: 24px;
      text-align: center;
      color: white;
    }

    p {
      margin: 0 0 20px 0;
      text-align: center;
      background-color: rgba(0, 0, 0, 0.3);
      padding: 10px;
      border-radius: 5px;
    }

    .button-container {
      display: flex;
      justify-content: space-between;
      gap: 10px;
    }

    button {
      flex: 1;
      padding: 12px;
      font-size: 16px;
      cursor: pointer;
      background: rgba(0, 150, 255, 0.6);
      color: white;
      border: none;
      border-radius: 5px;
      transition:
        background-color 0.2s ease,
        transform 0.1s ease;
    }

    button:hover {
      background: rgba(0, 150, 255, 0.8);
      transform: translateY(-1px);
    }

    button:active {
      transform: translateY(1px);
    }

    @media (max-width: 768px) {
      .modal {
        width: 90%;
        max-width: 300px;
        padding: 20px;
      }

      h2 {
        font-size: 20px;
      }

      button {
        padding: 10px;
        font-size: 14px;
      }
    }
  `;

  render() {
    return html`
      <div class="modal ${this.isVisible ? "visible" : ""}">
        <h2>${this._title}</h2>
        <p>${this.message}</p>
        <div class="button-container">
          <button @click=${this._handleExit}>Exit Game</button>
          <button @click=${this.hide}>Keep Playing</button>
        </div>
      </div>
    `;
  }

  show() {
    this.isVisible = true;
    this.requestUpdate();
  }

  hide() {
    this.isVisible = false;
    this.requestUpdate();
  }

  private _handleExit() {
    this.hide();
    window.location.href = "/";
  }

  init() {
    this.rand = new PseudoRandom(simpleHash(this.game.myClientID()));
  }

  tick() {
    const myPlayer = this.game.myPlayer();
    if (!this.hasShownDeathModal && myPlayer && !myPlayer.isAlive()) {
      this.hasShownDeathModal = true;
      this._title = "You died";
      this.message = this.rand.randElement(defeatQuotes);
      this.show();
    }
    this.game.updatesSinceLastTick()[GameUpdateType.WinUpdate].forEach((wu) => {
      const winner = this.game.playerBySmallID(wu.winnerID) as PlayerView;
      this.eventBus.emit(new SendWinnerEvent(winner.clientID()));
      if (winner == this.game.myPlayer()) {
        this._title = "You Won!";
        if (this.game.numTilesWithFallout() / this.game.numLandTiles() > 0.6) {
          this.message = this.rand.randElement(highRadiationVictoryQuotes);
        } else {
          this.message = this.rand.randElement(lowRadiationVictoryQuotes);
        }
      } else {
        this._title = `${winner.name()} has won!`;
        this.message = this.rand.randElement(defeatQuotes);
      }
      this.show();
    });
  }

  renderLayer(context: CanvasRenderingContext2D) {}

  shouldTransform(): boolean {
    return false;
  }
}
