import { Node, mergeAttributes } from '@tiptap/core';

export const SemanticTag = Node.create({
  name: 'semanticTag',

  group: 'inline',

  inline: true,

  atom: true,

  addAttributes() {
    return {
      tag: {
        default: null,
        parseHTML: element => element.getAttribute('data-tag'),
        renderHTML: attributes => {
          return {
            'data-tag': attributes.tag,
          }
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-tag]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), `#${HTMLAttributes['data-tag']}`];
  },

  addCommands() {
    return {
      setSemanticTag: (tag) => ({ commands }) => {
        return commands.insertContent({
          type: this.type.name,
          attrs: { tag },
        });
      },
    };
  },
});
