import { useAppStore } from '../store';
import { OntologyTree, OntologyNode } from '../../shared/types';

export class OntologyEditor extends HTMLElement {
  private ontology: OntologyTree | null = null;
  private unsubscribe: () => void = () => {};

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.unsubscribe = useAppStore.subscribe(
      (state) => {
        this.ontology = state.ontology;
        this.render();
      },
      (state) => [state.ontology]
    );
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe();
  }

  private _handleAddNode() {
    const label = prompt('Enter new node label:');
    if (!label) return;
    const newNode: OntologyNode = {
      id: Date.now().toString(),
      label,
      children: [],
    };
    const newOntology = {
      ...this.ontology!,
      nodes: {
        ...this.ontology!.nodes,
        [newNode.id]: newNode,
      },
      rootIds: [...this.ontology!.rootIds, newNode.id],
    };
    useAppStore.getState().setOntology(newOntology);
  }

  private _renderNode(node: OntologyNode): string {
    const children = node.children?.map(childId => this.ontology!.nodes[childId]).filter(Boolean) || [];
    return `
      <li class="ontology-node" data-node-id="${node.id}">
        <span>${node.label}</span>
        ${children.length > 0 ? `
          <ul>
            ${children.map(child => this._renderNode(child)).join('')}
          </ul>
        ` : ''}
      </li>
    `;
  }

  render() {
    if (!this.shadowRoot) return;

    const styles = `
      .ontology-editor {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .ontology-tree {
        list-style: none;
        padding-left: 16px;
      }
      .ontology-node {
        padding: 4px;
      }
      .add-node-button {
        padding: 8px 12px;
        background-color: var(--color-primary);
        color: var(--color-primary-foreground);
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
    `;

    if (!this.ontology) {
      this.shadowRoot.innerHTML = `<p>Loading ontology...</p>`;
      return;
    }

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="ontology-editor">
        <h2>Ontology</h2>
        <button class="add-node-button">Add Root Node</button>
        <ul class="ontology-tree">
          ${this.ontology.rootIds.map(rootId => this._renderNode(this.ontology!.nodes[rootId])).join('')}
        </ul>
      </div>
    `;

    this.shadowRoot.querySelector('.add-node-button')?.addEventListener('click', this._handleAddNode.bind(this));
  }
}

customElements.define('notention-ontology-editor', OntologyEditor);
