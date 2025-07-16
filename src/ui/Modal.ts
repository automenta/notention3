export class Modal extends HTMLElement {
	private onConfirm: (value: string) => void = () => {};

	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this._handleConfirm = this._handleConfirm.bind(this);
		this._handleCancel = this._handleCancel.bind(this);
	}

	connectedCallback() {
		this.render();
		this.shadowRoot
			?.querySelector('.confirm-button')
			?.addEventListener('click', this._handleConfirm);
		this.shadowRoot
			?.querySelector('.cancel-button')
			?.addEventListener('click', this._handleCancel);
	}

	disconnectedCallback() {
		this.shadowRoot
			?.querySelector('.confirm-button')
			?.removeEventListener('click', this._handleConfirm);
		this.shadowRoot
			?.querySelector('.cancel-button')
			?.removeEventListener('click', this._handleCancel);
	}

	public setContent(
		title: string,
		label: string,
		onConfirm: (value: string) => void
	) {
		this.onConfirm = onConfirm;
		const titleElement = this.shadowRoot?.querySelector('h2');
		if (titleElement) {
			titleElement.textContent = title;
		}
		const labelElement = this.shadowRoot?.querySelector('label');
		if (labelElement) {
			labelElement.textContent = label;
		}
		this.style.display = 'block';
	}

	private _handleConfirm() {
		const input = this.shadowRoot?.querySelector('input');
		if (input) {
			this.onConfirm(input.value);
			input.value = '';
		}
		this.style.display = 'none';
	}

	private _handleCancel() {
		this.style.display = 'none';
	}

	render() {
		if (!this.shadowRoot) return;
		this.shadowRoot.innerHTML = `
      <style>
        :host {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);
          display: none;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        .modal-content {
          background-color: var(--color-background, #fff);
          padding: 24px;
          border-radius: var(--radius-lg, 8px);
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          width: 90%;
          max-width: 400px;
        }
        h2 {
          margin-top: 0;
          font-size: 1.5em;
          font-weight: bold;
        }
        .form-group {
          margin-bottom: 16px;
        }
        label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
        }
        input {
          width: 100%;
          padding: 8px;
          border: 1px solid var(--color-border, #ccc);
          border-radius: var(--radius-md, 4px);
        }
        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
        .confirm-button, .cancel-button {
          padding: 8px 16px;
          border-radius: var(--radius-md, 4px);
          border: none;
          cursor: pointer;
        }
        .confirm-button {
          background-color: var(--color-primary, #007bff);
          color: white;
        }
        .cancel-button {
          background-color: var(--color-secondary, #6c757d);
          color: white;
        }
      </style>
      <div class="modal-content">
        <h2></h2>
        <div class="form-group">
          <label></label>
          <input type="text">
        </div>
        <div class="modal-actions">
          <button class="cancel-button">Cancel</button>
          <button class="confirm-button">Confirm</button>
        </div>
      </div>
    `;
	}
}

customElements.define('notention-modal', Modal);
