import { useAppStore } from '../store';
import { OntologyNode } from '../../shared/types';

export class OntologyEditor extends HTMLElement {
  private ontology: OntologyNode[] = [];
  private unsubscribe: () => void = () => {};

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._handleCreateConcept = this._handleCreateConcept.bind(this);
    this._handleEditConcept = this._handleEditConcept.bind(this);
    this._handleDeleteConcept = this._handleDeleteConcept.bind(this);
    this._handleMoveConcept = this._handleMoveConcept.bind(this);
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();

    this.unsubscribe = useAppStore.subscribe(
      (state) => {
        this.ontology = Object.values(state.ontology).sort((a, b) => a.label.localeCompare(b.label));
        this.render();
      },
      (state) => [state.ontology]
    );
    useAppStore.getState().loadOntology();
  }

  disconnectedCallback() {
    this.unsubscribe();
    this.removeEventListeners();
  }

  private setupEventListeners() {
    if (!this.shadowRoot) return;

    this.shadowRoot.querySelector('.create-concept-button')?.addEventListener('click', this._handleCreateConcept);

    this.shadowRoot.querySelector('.ontology-tree')?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const conceptItem = target.closest('.concept-item');
      if (conceptItem) {
        const conceptId = conceptItem.dataset.conceptId;
        if (target.closest('.edit-concept-button')) {
          const conceptLabel = conceptItem.dataset.conceptLabel || '';
          this._handleEditConcept(conceptId as string, conceptLabel);
        } else if (target.closest('.delete-concept-button')) {
          const conceptLabel = conceptItem.dataset.conceptLabel || '';
          this._handleDeleteConcept(conceptId as string, conceptLabel);
        }
      }
    });
  }

  private removeEventListeners() {
    if (!this.shadowRoot) return;

    this.shadowRoot.querySelector('.create-concept-button')?.removeEventListener('click', this._handleCreateConcept);
    this.shadowRoot.querySelector('.ontology-tree')?.removeEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const conceptItem = target.closest('.concept-item');
      if (conceptItem) {
        const conceptId = conceptItem.dataset.conceptId;
        if (target.closest('.edit-concept-button')) {
          const conceptLabel = conceptItem.dataset.conceptLabel || '';
          this._handleEditConcept(conceptId as string, conceptLabel);
        } else if (target.closest('.delete-concept-button')) {
          const conceptLabel = conceptItem.dataset.conceptLabel || '';
          this._handleDeleteConcept(conceptId as string, conceptLabel);
        }
      }
    });
  }

  private async _handleCreateConcept() {
    const label = prompt('Enter new concept label:');
    if (label) {
      await useAppStore.getState().createOntologyNode(label);
    }
  }

  private async _handleEditConcept(id: string, currentLabel: string) {
    const newLabel = prompt('Rename concept:', currentLabel);
    if (newLabel && newLabel !== currentLabel) {
      await useAppStore.getState().updateOntologyNode(id, { label: newLabel });
    }
  }

  private async _handleDeleteConcept(id: string, label: string) {
    if (confirm(`Are you sure you want to delete the concept "${label}"?`)) {
      await useAppStore.getState().deleteOntologyNode(id);
    }
  }

  private async _handleMoveConcept(conceptId: string, newParentId: string | undefined) {
    // This would involve drag-and-drop logic, which is more complex for vanilla JS.
    // For now, we'll just log a message.
    console.log(`Move concept ${conceptId} to parent ${newParentId}`);
    // await useAppStore.getState().updateOntologyNode(conceptId, { parentId: newParentId });
  }

  private _renderOntologyTree(nodes: OntologyNode[], parentId: string | undefined = undefined, level: number = 0): string {
    const childNodes = nodes.filter(node => node.parentId === parentId);
    if (childNodes.length === 0) return '';

    return `
      <ul class="ontology-list" style="padding-left: ${level * 15}px;">
        ${childNodes.map(node => `
          <li class="concept-item" data-concept-id="${node.id}" data-concept-label="${node.label}">
            <div class="concept-label">
              <span class="concept-name">${node.label}</span>
            </div>
            <div class="concept-actions">
              <button class="icon-button edit-concept-button" title="Edit Concept">
                ✏️
              </button>
              <button class="icon-button delete-concept-button" title="Delete Concept">
                🗑️
              </button>
            </div>
            ${this._renderOntologyTree(nodes, node.id, level + 1)}
          </li>
        `).join('')}
      </ul>
    `;
  }

  render() {
    if (!this.shadowRoot) return;

    const styles = `
      :host {
        display: block;
        padding: 16px;
        background-color: var(--color-background);
        color: var(--color-foreground);
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .header h2 {
        margin: 0;
        color: var(--color-primary);
      }
      .create-concept-button {
        padding: 8px 16px;
        background-color: var(--color-primary);
        color: var(--color-primary-foreground);
        border: none;
        border-radius: var(--radius-sm);
        cursor: pointer;
        font-size: 1em;
        transition: background-color 0.2s;
      }
      .create-concept-button:hover {
        background-color: var(--color-primary-foreground);
        color: var(--color-primary);
      }
      .ontology-tree {
        max-height: calc(100vh - 200px); /* Adjust based on header/footer height */
        overflow-y: auto;
      }
      .ontology-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .concept-item {
        padding: 8px 0;
        color: var(--color-muted-foreground);
        transition: background-color 0.2s, color 0.2s;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .concept-item:hover {
        background-color: var(--color-accent);
        color: var(--color-accent-foreground);
      }
      .concept-label {
        flex-grow: 1;
        padding-right: 5px;
      }
      .concept-name {
        font-weight: bold;
      }
      .concept-actions {
        display: flex;
        gap: 5px;
      }
      .icon-button {
        background: none;
        border: none;
        font-size: 1em;
        cursor: pointer;
        padding: 3px;
        border-radius: var(--radius-sm);
        transition: background-color 0.2s;
        color: var(--color-muted-foreground);
      }
      .icon-button:hover {
        background-color: var(--color-accent);
        color: var(--color-accent-foreground);
      }
      .no-concepts-message {
        color: var(--color-muted-foreground);
        text-align: center;
        margin-top: 20px;
      }
    `;

    const rootConcepts = this.ontology.filter(node => node.parentId === undefined);
    const ontologyTreeHtml = this._renderOntologyTree(this.ontology, undefined);

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="header">
        <h2>Ontology Editor</h2>
        <button class="create-concept-button">Create New Concept</button>
      </div>
      <div class="ontology-tree">
        ${this.ontology.length === 0
          ? `<p class="no-concepts-message">No concepts defined yet.</p>`
          : ontologyTreeHtml
        }
      </div>
    `;

    this.setupEventListeners();
  }
}

customElements.define('notention-ontology-editor', OntologyEditor);