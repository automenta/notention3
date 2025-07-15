import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('notention-ontology-editor')
export class OntologyEditor extends LitElement {
  @property({ type: Array }) ontology: any[] = []; // Placeholder for ontology data

  render() {
    return html`
      <style>
        :host {
          display: block;
          padding: 16px;
        }
        h3 {
          margin-top: 0;
        }
        .ontology-tree {
          border: 1px solid #ccc;
          min-height: 200px;
          padding: 8px;
          margin-bottom: 16px;
        }
        .concept-form {
          border: 1px solid #eee;
          padding: 12px;
          border-radius: 4px;
        }
        .concept-form label {
          display: block;
          margin-bottom: 8px;
        }
        .concept-form input {
          width: calc(100% - 16px);
          padding: 8px;
          margin-top: 4px;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        .concept-form button {
          background: #007bff;
          color: white;
          padding: 8px 12px;
          border-radius: 4px;
          border: none;
          cursor: pointer;
          margin-top: 12px;
        }
      </style>
      <h3>Ontology Editor</h3>
      <div class="ontology-tree">
        <p>Ontology tree goes here (drag-and-drop editor)</p>
        ${this.ontology.length === 0 ? html`<p>No ontology defined yet.</p>` : html``}
      </div>
      <div class="concept-form">
        <h4>Concept Details</h4>
        <label>
          Label:
          <input type="text" placeholder="e.g., #Project">
        </label>
        <label>
          Attributes (JSON):
          <input type="text" placeholder="e.g., { \"type\": \"date\" }">
        </label>
        <button>Save Concept</button>
      </div>
    `;
  }
}