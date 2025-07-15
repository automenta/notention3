import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('notention-note-editor')
export class NoteEditor extends LitElement {
  @property({ type: String }) content: string = '';

  private editor: Editor | undefined;

  firstUpdated() {
    const editorContainer = this.shadowRoot?.querySelector('#editor-content') as HTMLElement;
    if (editorContainer) {
      this.editor = new Editor({
        element: editorContainer,
        extensions: [
          StarterKit,
        ],
        content: this.content,
        onUpdate: ({ editor }) => {
          this.content = editor.getHTML();
          this.dispatchEvent(new CustomEvent('note-change', { detail: this.content }));
        },
      });
    }
  }

  disconnectedCallback() {
    this.editor?.destroy();
    super.disconnectedCallback();
  }

  render() {
    return html`
      <style>
        :host {
          display: block;
          border: 1px solid #ccc;
          padding: 16px;
          min-height: 200px;
        }
        #editor-content {
          min-height: 150px;
          outline: none;
        }
      </style>
      <div id="editor-content"></div>
    `;
  }
}
