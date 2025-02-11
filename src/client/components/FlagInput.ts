import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import Countries from '../data/countries.json';

@customElement('flag-input')
export class FlagInput extends LitElement {
	@state() private flag: string = '';

	static styles = css``;

	render() {
		return html`
			<div>
				<div class="selectIcon"></div>
				<div class="dropdown">
					<!-- Show each flag as button -->
					<div>
						<img class="flag" src=${'asd'} />
						<span>test</span>
					</div>
				</div>
			</div>
		`;
	}
}
