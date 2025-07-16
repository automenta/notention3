export class Route extends HTMLElement {
	private _path: string = '';
	private _component: string = '';

	constructor() {
		super();
	}

	static get observedAttributes() {
		return ['path', 'component'];
	}

	attributeChangedCallback(name: string, oldVal: string, newVal: string) {
		if (name === 'path') {
			this._path = newVal;
		} else if (name === 'component') {
			this._component = newVal;
		}
	}

	get path(): string {
		return this._path;
	}

	set path(value: string) {
		if (this._path !== value) {
			this._path = value;
			this.setAttribute('path', value);
		}
	}

	get component(): string {
		return this._component;
	}

	set component(value: string) {
		if (this._component !== value) {
			this._component = value;
			this.setAttribute('component', value);
		}
	}
}
