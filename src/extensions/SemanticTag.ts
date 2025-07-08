import { Mark, mergeAttributes } from '@tiptap/core';

export interface SemanticTagOptions {
  HTMLAttributes: Record<string, any>;
}

export const SemanticTag = Mark.create<SemanticTagOptions>({
  name: 'semanticTag',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      tag: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-semantic-tag]',
        getAttrs: (element) => {
          const tag = (element as HTMLElement).getAttribute('data-tag');
          return tag ? { tag } : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        { 
          'data-semantic-tag': '',
          'data-tag': HTMLAttributes.tag,
          'class': 'semantic-tag bg-primary/10 text-primary px-2 py-1 rounded text-sm font-medium',
        },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
      HTMLAttributes.tag || '',
    ];
  },

  addCommands() {
    return {
      setSemanticTag:
        (attributes: { tag: string }) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      toggleSemanticTag:
        (attributes: { tag: string }) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, attributes);
        },
    };
  },
});

// Helper function to insert semantic tags
export const insertSemanticTag = (editor: any, tag: string) => {
  editor.chain().focus().insertContent(`<span data-semantic-tag data-tag="${tag}" class="semantic-tag bg-primary/10 text-primary px-2 py-1 rounded text-sm font-medium">${tag}</span>`).run();
};