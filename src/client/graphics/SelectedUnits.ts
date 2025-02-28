import { EventBus, GameEvent } from "../../core/EventBus";
import { UnitType } from "../../core/game/Game";
import { UnitView } from "../../core/game/GameView";

/**
 * Event emitted when a unit is selected or deselected
 */
export class UnitSelectionEvent implements GameEvent {
  constructor(
    public readonly unit: UnitView | null,
    public readonly isSelected: boolean,
  ) {}
}

/**
 * Manages the currently selected units in the game
 */
export class SelectedUnits {
  private selectedUnit: UnitView | null = null;

  constructor(private eventBus: EventBus) {}

  /**
   * Select a unit. Deselects any previously selected unit.
   * @param unit The unit to select
   * @returns true if the selection changed, false otherwise
   */
  selectUnit(unit: UnitView): boolean {
    if (this.selectedUnit === unit) {
      return false;
    }

    if (this.selectedUnit) {
      this.deselectCurrentUnit();
    }

    this.selectedUnit = unit;
    this.eventBus.emit(new UnitSelectionEvent(unit, true));
    return true;
  }

  /**
   * Deselect the currently selected unit, if any
   * @returns true if a unit was deselected, false otherwise
   */
  deselectCurrentUnit(): boolean {
    if (!this.selectedUnit) {
      return false;
    }

    const unit = this.selectedUnit;
    this.selectedUnit = null;
    this.eventBus.emit(new UnitSelectionEvent(unit, false));
    return true;
  }

  /**
   * Toggle selection for the given unit
   * @param unit The unit to toggle selection for
   * @returns true if the unit is now selected, false if it was deselected
   */
  toggleUnitSelection(unit: UnitView): boolean {
    if (this.selectedUnit === unit) {
      this.deselectCurrentUnit();
      return false;
    } else {
      this.selectUnit(unit);
      return true;
    }
  }

  /**
   * Get the currently selected unit, if any
   */
  getSelectedUnit(): UnitView | null {
    return this.selectedUnit;
  }

  /**
   * Check if the given unit is currently selected
   * @param unit The unit to check
   */
  isSelected(unit: UnitView): boolean {
    return this.selectedUnit === unit;
  }

  /**
   * Check if a unit of the specified type is currently selected
   * @param type The unit type to check for
   */
  hasSelectedUnitOfType(type: UnitType): boolean {
    return this.selectedUnit !== null && this.selectedUnit.type() === type;
  }
}
