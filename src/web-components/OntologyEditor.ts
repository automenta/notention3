import { useAppStore } from '../store';
import { OntologyTree, OntologyNode } from '../../shared/types';
import Sortable from 'sortablejs';

export class OntologyEditor extends HTMLElement {
  private ontology: OntologyTree | null = null;
  private unsubscribe: () => void = () => {};
  private sortable: Sortable | null = null;
  private selectedNodeId: string | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.unsubscribe = useAppStore.subscribe(
      (state) => {
        this.ontology = state.ontology;
        this.render();
        this._initSortable();
      },
      (state) => [state.ontology]
    );
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe();
    this.sortable?.destroy();
  }

  private _initSortable() {
    const tree = this.shadowRoot?.querySelector('.ontology-tree');
    if (tree) {
      this.sortable = Sortable.create(tree as HTMLElement, {
        group: 'ontology',
        animation: 150,
        onEnd: (evt) => {
          const { item, to, from, oldIndex, newIndex } = evt;
          const nodeId = item.dataset.nodeId;
          const newParentId = to.dataset.nodeId;
          if (nodeId && oldIndex !== undefined && newIndex !== undefined) {
            useAppStore.getState().moveOntologyNode(nodeId, newParentId, newIndex);
          }
        },
      });
    }
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

  private _handleNodeClick(nodeId: string) {
    this.selectedNodeId = nodeId;
    this.render();
  }

  private _handleAttributeChange(nodeId: string, key: string, value: string) {
    if (!this.ontology) return;
    const node = this.ontology.nodes[nodeId];
    if (!node) return;
    const newAttributes = { ...(node.attributes || {}), [key]: value };
    const newNode = { ...node, attributes: newAttributes };
    const newOntology = {
      ...this.ontology,
      nodes: {
        ...this.ontology.nodes,
        [nodeId]: newNode,
      },
    };
    useAppStore.getState().setOntology(newOntology);
  }

  private _handleDeleteAttribute(nodeId: string, key: string) {
    if (!this.ontology) return;
    const node = this.ontology.nodes[nodeId];
    if (!node || !node.attributes) return;
    const newAttributes = { ...node.attributes };
    delete newAttributes[key];
    const newNode = { ...node, attributes: newAttributes };
    const newOntology = {
      ...this.ontology,
      nodes: {
        ...this.ontology.nodes,
        [nodeId]: newNode,
      },
    };
    useAppStore.getState().setOntology(newOntology);
  }

  private _renderNode(node: OntologyNode): string {
    const children = node.children?.map(childId => this.ontology!.nodes[childId]).filter(Boolean) || [];
    return `
      <li class="ontology-node ${this.selectedNodeId === node.id ? 'selected' : ''}" data-node-id="${node.id}">
        <span class="node-label">${node.label}</span>
        ${children.length > 0 ? `
          <ul class="ontology-tree" data-node-id="${node.id}">
            ${children.map(child => this._renderNode(child)).join('')}
          </ul>
        ` : ''}
      </li>
    `;
  }

  private _renderAttributeEditor() {
    if (!this.selectedNodeId || !this.ontology) return '';
    const node = this.ontology.nodes[this.selectedNodeId];
    if (!node) return '';

    return `
      <div class="attribute-editor">
        <h3>Attributes for ${node.label}</h3>
        ${Object.entries(node.attributes || {}).map(([key, value]) => `
          <div class="attribute">
            <input type="text" value="${key}" disabled>
            <input type="text" value="${value}" data-key="${key}">
            <button class="delete-attribute" data-key="${key}">Delete</button>
          </div>
        `).join('')}
        <div class="attribute new-attribute">
          <input type="text" placeholder="New key" class="new-key">
          <input type="text" placeholder="New value" class="new-value">
          <button class="add-attribute">Add</button>
        </div>
      </div>
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
        cursor: grab;
      }
      .ontology-node.selected > .node-label {
        font-weight: bold;
        background-color: #eee;
      }
      .node-label {
        cursor: pointer;
      }
      .add-node-button {
        padding: 8px 12px;
        background-color: var(--color-primary);
        color: var(--color-primary-foreground);
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      .attribute-editor {
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid #ccc;
      }
      .attribute {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
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
        ${this._renderAttributeEditor()}
      </div>
    `;

    this.shadowRoot.querySelector('.add-node-button')?.addEventListener('click', this._handleAddNode.bind(this));
    this.shadowRoot.querySelectorAll('.node-label').forEach(label => {
      label.addEventListener('click', () => {
        const nodeId = (label.parentElement as HTMLElement).dataset.nodeId;
        if (nodeId) {
          this._handleNodeClick(nodeId);
        }
      });
    });

    this.shadowRoot.querySelectorAll('.attribute input[type="text"]').forEach(input => {
      input.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const key = target.dataset.key;
        if (this.selectedNodeId && key) {
          this._handleAttributeChange(this.selectedNodeId, key, target.value);
        }
      });
    });

    this.shadowRoot.querySelectorAll('.delete-attribute').forEach(button => {
      button.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const key = target.dataset.key;
        if (this.selectedNodeId && key) {
          this._handleDeleteAttribute(this.selectedNodeId, key);
        }
      });
    });

    this.shadowRoot.querySelector('.add-attribute')?.addEventListener('click', () => {
      const newKeyInput = this.shadowRoot?.querySelector('.new-key') as HTMLInputElement;
      const newValueInput = this.shadowRoot?.querySelector('.new-value') as HTMLInputElement;
      if (this.selectedNodeId && newKeyInput && newValueInput) {
        const key = newKeyInput.value.trim();
        const value = newValueInput.value.trim();
        if (key && value) {
          this._handleAttributeChange(this.selectedNodeId, key, value);
        }
      }
    });

    this._initSortable();
  }
}

customElements.define('notention-ontology-editor', OntologyEditor);
