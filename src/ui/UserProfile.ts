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
              <button>Edit Profile</button>
            `
						: '<p>Loading profile...</p>'
				}
      </div>
    `;
	}
}

customElements.define('notention-user-profile', UserProfile);
