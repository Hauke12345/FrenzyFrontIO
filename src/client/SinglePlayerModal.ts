import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Difficulty, GameMapType, GameType } from "../core/game/Game";
import { generateID as generateID } from "../core/Util";
import { consolex } from "../core/Consolex";

@customElement("single-player-modal")
export class SinglePlayerModal extends LitElement {
  @state() private isModalOpen = false;
  @state() private selectedMap: GameMapType = GameMapType.World;
  @state() private selectedDifficulty: Difficulty = Difficulty.Medium;
  @state() private disableNPCs = false;
  @state() private disableBots = false;
  @state() private creativeMode = false;

  static styles = css`
    .modal-overlay {
      display: none;
      position: fixed;
      z-index: 1000;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
    }

    .modal-content {
      background-color: white;
      margin: 15% auto;
      padding: 20px;
      border-radius: 8px;
      width: 80%;
      max-width: 500px;
      text-align: center;
    }

    .close {
      color: #aaa;
      float: right;
      font-size: 28px;
      font-weight: bold;
      cursor: pointer;
    }

    .close:hover,
    .close:focus {
      color: black;
      text-decoration: none;
      cursor: pointer;
    }

    button {
      padding: 10px 20px;
      font-size: 16px;
      cursor: pointer;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      transition: background-color 0.3s;
      display: inline-block;
      margin-top: 20px;
    }

    button:hover {
      background-color: #0056b3;
    }

    select {
      padding: 8px;
      font-size: 16px;
      margin-top: 10px;
      width: 200px;
    }
  `;

  render() {
    return html`
      <div
        class="modal-overlay"
        style="display: ${this.isModalOpen ? "block" : "none"}"
      >
        <div class="modal-content">
          <span class="close" @click=${this.close}>&times;</span>
          <h2>Start Single Player Game</h2>
          <div>
            <label for="map-select">Map: </label>
            <select id="map-select" @change=${this.handleMapChange}>
              ${Object.entries(GameMapType)
                .filter(([key]) => isNaN(Number(key)))
                .map(
                  ([key, value]) => html`
                    <option
                      value=${value}
                      ?selected=${this.selectedMap === value}
                    >
                      ${value}
                    </option>
                  `,
                )}
            </select>
          </div>
          <div>
            <label for="map-select">Difficulty: </label>
            <select id="map-select" @change=${this.handleDifficultyChange}>
              ${Object.entries(Difficulty)
                .filter(([key]) => isNaN(Number(key)))
                .map(
                  ([key, value]) => html`
                    <option
                      value=${value}
                      ?selected=${this.selectedDifficulty === value}
                    >
                      ${value}
                    </option>
                  `,
                )}
            </select>
          </div>
          <div>
            <input
              type="checkbox"
              id="disable-bots"
              @change=${this.handleDisableBotsChange}
            />
            <label for="disable-bots">Disable Bots</label>
          </div>
          <div>
            <input
              type="checkbox"
              id="disable-npcs"
              @change=${this.handleDisableNPCsChange}
            />
            <label for="disable-npcs">Disable NPCs</label>
          </div>

          <div>
            <input
              type="checkbox"
              id="creative-mode"
              @change=${this.handleCreativeModeChange}
            />
            <label for="creative-mode">Creative mode</label>
          </div>

          <button @click=${this.startGame}>Start Game</button>
        </div>
      </div>
    `;
  }

  public open() {
    this.isModalOpen = true;
  }

  public close() {
    this.isModalOpen = false;
  }

  private handleMapChange(e: Event) {
    this.selectedMap = String(
      (e.target as HTMLSelectElement).value,
    ) as GameMapType;
  }
  private handleDifficultyChange(e: Event) {
    this.selectedDifficulty = String(
      (e.target as HTMLSelectElement).value,
    ) as Difficulty;
  }
  private handleDisableBotsChange(e: Event) {
    this.disableBots = Boolean((e.target as HTMLInputElement).checked);
  }
  private handleDisableNPCsChange(e: Event) {
    this.disableNPCs = Boolean((e.target as HTMLInputElement).checked);
  }
  private handleCreativeModeChange(e: Event) {
    this.creativeMode = Boolean((e.target as HTMLInputElement).checked);
  }
  private startGame() {
    consolex.log(
      `Starting single player game with map: ${GameMapType[this.selectedMap]}`,
    );
    this.dispatchEvent(
      new CustomEvent("join-lobby", {
        detail: {
          gameType: GameType.Singleplayer,
          lobby: {
            id: generateID(),
          },
          map: this.selectedMap,
          difficulty: this.selectedDifficulty,
          disableBots: this.disableBots,
          disableNPCs: this.disableNPCs,
          creativeMode: this.creativeMode,
        },
        bubbles: true,
        composed: true,
      }),
    );
    this.close();
  }
}
