import { useAppStore } from '../store';
import { UserProfile as UserProfileType } from '../../shared/types';

export class UserProfile extends HTMLElement {
	private profile: UserProfileType | undefined;
	private unsubscribe: () => void = () => {};

	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
	}

	connectedCallback() {
		this.unsubscribe = useAppStore.subscribe(
			profile => {
				this.profile = profile;
				this.render();
			},
			state => state.userProfile
		);
		this.render();
	}

	disconnectedCallback() {
		this.unsubscribe();
	}

	render() {
		if (!this.shadowRoot) return;

		this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 16px;
        }
        .profile-card {
          border: 1px solid #ccc;
          padding: 16px;
          border-radius: 8px;
        }
        .profile-field {
          margin-bottom: 8px;
        }
        .profile-field label {
          font-weight: bold;
        }
      </style>
      <div class="profile-card">
        <h2>User Profile</h2>
        ${
					this.profile
						? `
              <div class="profile-field">
                <label>Nostr Public Key:</label>
                <span>${this.profile.nostrPubkey}</span>
              </div>
              <div class="profile-field">
                <label>Shared Tags:</label>
                <span>${this.profile.sharedTags.join(', ')}</span>
              </div>
              <div class="profile-field">
                <label>Shared Values:</label>
                <span>${
									this.profile.sharedValues
										? this.profile.sharedValues.join(', ')
										: 'None'
								}</span>
              </div>
              <button class="edit-button">Edit Profile</button>
            `
						: '<p>Loading profile...</p>'
				}
      </div>
    `;

		this.shadowRoot.querySelector('.edit-button')?.addEventListener('click', () => {
			this.renderEditForm();
		});
	}

	renderEditForm() {
		if (!this.shadowRoot || !this.profile) return;

		this.shadowRoot.innerHTML = `
			<style>
				:host {
					display: block;
					padding: 16px;
				}
				.profile-card {
					border: 1px solid #ccc;
					padding: 16px;
					border-radius: 8px;
				}
				.form-group {
					margin-bottom: 16px;
				}
				label {
					display: block;
					margin-bottom: 8px;
				}
				input {
					width: 100%;
					padding: 8px;
					border: 1px solid var(--color-border);
					border-radius: var(--radius-md);
				}
			</style>
			<div class="profile-card">
				<h2>Edit User Profile</h2>
				<div class="form-group">
					<label for="nostrPubkey">Nostr Public Key</label>
					<input type="text" id="nostrPubkey" value="${
						this.profile.nostrPubkey || ''
					}" />
				</div>
				<div class="form-group">
					<label for="sharedTags">Shared Tags (comma-separated)</label>
					<input type="text" id="sharedTags" value="${
						this.profile.sharedTags.join(', ') || ''
					}" />
				</div>
				<div class="form-group">
					<label for="sharedValues">Shared Values (comma-separated)</label>
					<input type="text" id="sharedValues" value="${
						this.profile.sharedValues ? this.profile.sharedValues.join(', ') : ''
					}" />
				</div>
				<button class="save-button">Save</button>
				<button class="cancel-button">Cancel</button>
			</div>
		`;

		this.shadowRoot.querySelector('.save-button')?.addEventListener('click', () => {
			this.handleSave();
		});

		this.shadowRoot.querySelector('.cancel-button')?.addEventListener('click', () => {
			this.render();
		});
	}

	handleSave() {
		if (!this.shadowRoot || !this.profile) return;

		const nostrPubkey = (
			this.shadowRoot.querySelector('#nostrPubkey') as HTMLInputElement
		).value;
		const sharedTags = (
			this.shadowRoot.querySelector('#sharedTags') as HTMLInputElement
		).value
			.split(',')
			.map(t => t.trim());
		const sharedValues = (
			this.shadowRoot.querySelector('#sharedValues') as HTMLInputElement
		).value
			.split(',')
			.map(t => t.trim());

		const updatedProfile: UserProfileType = {
			...this.profile,
			nostrPubkey,
			sharedTags,
			sharedValues,
		};

		useAppStore.getState().updateUserProfile(updatedProfile);
		this.render();
	}
}

customElements.define('notention-user-profile', UserProfile);
