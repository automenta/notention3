import { useAppStore } from '../store';
import { OntologyTree, OntologyNode } from '../../shared/types';
import Sortable from 'sortablejs';

export class OntologyEditor extends HTMLElement {
	private ontology: OntologyTree | null = null;
	private unsubscribe: () => void = () => {};
	private sortable: Sortable | null = null;
	private selectedNodeId: string | null = null;
	private contextMenu: { x: number; y: number; nodeId: string } | null = null;

	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
	}

	connectedCallback() {
		this.unsubscribe = useAppStore.subscribe(
			state => {
				this.ontology = state.ontology;
				this.render();
				this._initSortable();
			},
			state => [state.ontology]
		);
		this.render();
		document.addEventListener('click', () => this._closeContextMenu());
	}

	disconnectedCallback() {
		this.unsubscribe();
		this.sortable?.destroy();
		document.removeEventListener('click', () => this._closeContextMenu());
	}

	private _initSortable() {
		this.shadowRoot?.querySelectorAll('.ontology-tree').forEach(tree => {
			Sortable.create(tree as HTMLElement, {
				group: 'ontology',
				animation: 150,
				onEnd: evt => {
					const { item, to, from, oldIndex, newIndex } = evt;
					const nodeId = item.dataset.nodeId;
					const newParentId = to.dataset.nodeId;
					if (nodeId && oldIndex !== undefined && newIndex !== undefined) {
						useAppStore
							.getState()
							.moveOntologyNode(nodeId, newParentId, newIndex);
					}
				},
			});
		});
	}

	private _handleAddNode(parentId?: string) {
		const label = prompt('Enter new node label:');
		if (!label) return;
		const newNode: OntologyNode = {
			id: Date.now().toString(),
			label,
			children: [],
			parentId,
		};
		const newOntology = {
			...this.ontology!,
			nodes: {
				...this.ontology!.nodes,
				[newNode.id]: newNode,
			},
			rootIds: parentId
				? this.ontology!.rootIds
				: [...this.ontology!.rootIds, newNode.id],
		};
		if (parentId) {
			const parent = newOntology.nodes[parentId];
			if (parent) {
				parent.children = [...(parent.children || []), newNode.id];
			}
		}
		useAppStore.getState().setOntology(newOntology);
	}

	private _handleEditNode(nodeId: string) {
		const node = this.ontology?.nodes[nodeId];
		if (!node) return;
		const newLabel = prompt('Enter new label:', node.label);
		if (newLabel) {
			const newNode = { ...node, label: newLabel };
			const newOntology = {
				...this.ontology!,
				nodes: {
					...this.ontology!.nodes,
					[nodeId]: newNode,
				},
			};
			useAppStore.getState().setOntology(newOntology);
		}
	}

	private _handleDeleteNode(nodeId: string) {
		if (!this.ontology) return;
		const newOntology = { ...this.ontology };
		delete newOntology.nodes[nodeId];
		newOntology.rootIds = newOntology.rootIds.filter(id => id !== nodeId);
		Object.values(newOntology.nodes).forEach(node => {
			node.children = node.children?.filter(id => id !== nodeId);
		});
		useAppStore.getState().setOntology(newOntology);
	}

	private _handleNodeClick(nodeId: string) {
		this.selectedNodeId = nodeId;
		this.render();
	}

	private _handleNodeContextMenu(event: MouseEvent, nodeId: string) {
		event.preventDefault();
		this.contextMenu = { x: event.clientX, y: event.clientY, nodeId };
		this.render();
	}

	private _closeContextMenu() {
		if (this.contextMenu) {
			this.contextMenu = null;
			this.render();
		}
	}

	private async _handleAiSuggest() {
		const { getAIService, ontology, setOntology } = useAppStore.getState();
		const aiService = getAIService();
		const suggestions = await aiService.suggestOntology(
			JSON.stringify(ontology)
		);
		if (suggestions) {
			// for now, just add the suggestions as root nodes
			const newNodes = suggestions.map(label => ({
				id: Date.now().toString() + Math.random(),
				label,
				children: [],
			}));
			const newOntology = {
				...ontology,
				nodes: {
					...ontology.nodes,
					...newNodes.reduce((acc, node) => ({ ...acc, [node.id]: node }), {}),
				},
				rootIds: [...ontology.rootIds, ...newNodes.map(n => n.id)],
			};
			setOntology(newOntology);
		}
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
		const children =
			node.children
				?.map(childId => this.ontology!.nodes[childId])
				.filter(Boolean) || [];
		return `
      <li class="ontology-node ${this.selectedNodeId === node.id ? 'selected' : ''}" data-node-id="${node.id}">
        <div class="node-content">
          <span class="node-label">${node.label}</span>
        </div>
        ${
					children.length > 0
						? `
          <ul class="ontology-tree" data-node-id="${node.id}">
            ${children.map(child => this._renderNode(child)).join('')}
          </ul>
        `
						: ''
				}
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
        ${Object.entries(node.attributes || {})
					.map(
						([key, value]) => `
          <div class="attribute">
            <input type="text" value="${key}" disabled>
            <input type="text" value="${value}" data-key="${key}">
            <button class="delete-attribute" data-key="${key}">Delete</button>
          </div>
        `
					)
					.join('')}
        <div class="attribute new-attribute">
          <input type="text" placeholder="New key" class="new-key">
          <input type="text" placeholder="New value" class="new-value">
          <button class="add-attribute">Add</button>
        </div>
      </div>
    `;
	}

	private _renderContextMenu() {
		if (!this.contextMenu) return '';
		const { x, y, nodeId } = this.contextMenu;
		return `
      <div class="context-menu" style="top: ${y}px; left: ${x}px;">
        <button class="context-menu-button edit-node" data-node-id="${nodeId}">Edit</button>
        <button class="context-menu-button delete-node" data-node-id="${nodeId}">Delete</button>
        <button class="context-menu-button add-child-node" data-node-id="${nodeId}">Add Child</button>
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
      .ontology-node.selected > .node-content > .node-label {
        font-weight: bold;
        background-color: #eee;
      }
      .node-label {
        cursor: pointer;
      }
      .add-node-button, .ai-suggest-button {
        padding: 8px 12px;
        background-color: var(--color-primary);
        color: var(--color-primary-foreground);
        border: none;
        border-radius: 4px;
        cursor: pointer;
        width: fit-content;
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
      .context-menu {
        position: absolute;
        background: white;
        border: 1px solid #ccc;
        padding: 8px;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .context-menu-button {
        background: none;
        border: none;
        text-align: left;
        padding: 4px 8px;
        cursor: pointer;
      }
      .context-menu-button:hover {
        background: #eee;
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
        <button class="ai-suggest-button">AI Suggest</button>
        <ul class="ontology-tree">
          ${this.ontology.rootIds.map(rootId => this._renderNode(this.ontology!.nodes[rootId])).join('')}
        </ul>
        ${this._renderAttributeEditor()}
        ${this._renderContextMenu()}
      </div>
    `;

		this.shadowRoot
			.querySelector('.add-node-button')
			?.addEventListener('click', () => this._handleAddNode());
		this.shadowRoot
			.querySelector('.ai-suggest-button')
			?.addEventListener('click', this._handleAiSuggest.bind(this));
		this.shadowRoot.querySelectorAll('.ontology-node').forEach(node => {
			node.addEventListener('click', e => {
				e.stopPropagation();
				const nodeId = (node as HTMLElement).dataset.nodeId;
				if (nodeId) {
					this._handleNodeClick(nodeId);
				}
			});
			node.addEventListener('contextmenu', e => {
				e.preventDefault();
				e.stopPropagation();
				const nodeId = (node as HTMLElement).dataset.nodeId;
				if (nodeId) {
					this._handleNodeContextMenu(e as MouseEvent, nodeId);
				}
			});
		});

		this.shadowRoot
			.querySelectorAll('.attribute input[type="text"]')
			.forEach(input => {
				input.addEventListener('change', e => {
					const target = e.target as HTMLInputElement;
					const key = target.dataset.key;
					if (this.selectedNodeId && key) {
						this._handleAttributeChange(this.selectedNodeId, key, target.value);
					}
				});
			});

		this.shadowRoot.querySelectorAll('.delete-attribute').forEach(button => {
			button.addEventListener('click', e => {
				const target = e.target as HTMLButtonElement;
				const key = target.dataset.key;
				if (this.selectedNodeId && key) {
					this._handleDeleteAttribute(this.selectedNodeId, key);
				}
			});
		});

		this.shadowRoot
			.querySelector('.add-attribute')
			?.addEventListener('click', () => {
				const newKeyInput = this.shadowRoot?.querySelector(
					'.new-key'
				) as HTMLInputElement;
				const newValueInput = this.shadowRoot?.querySelector(
					'.new-value'
				) as HTMLInputElement;
				if (this.selectedNodeId && newKeyInput && newValueInput) {
					const key = newKeyInput.value.trim();
					const value = newValueInput.value.trim();
					if (key && value) {
						this._handleAttributeChange(this.selectedNodeId, key, value);
					}
				}
			});

		this.shadowRoot.querySelector('.edit-node')?.addEventListener('click', e => {
			const nodeId = (e.target as HTMLElement).dataset.nodeId;
			if (nodeId) this._handleEditNode(nodeId);
			this._closeContextMenu();
		});
		this.shadowRoot
			.querySelector('.delete-node')
			?.addEventListener('click', e => {
				const nodeId = (e.target as HTMLElement).dataset.nodeId;
				if (nodeId) this._handleDeleteNode(nodeId);
				this._closeContextMenu();
			});
		this.shadowRoot
			.querySelector('.add-child-node')
			?.addEventListener('click', e => {
				const nodeId = (e.target as HTMLElement).dataset.nodeId;
				if (nodeId) this._handleAddNode(nodeId);
				this._closeContextMenu();
			});

		this._initSortable();
	}
}

customElements.define('notention-ontology-editor', OntologyEditor);
