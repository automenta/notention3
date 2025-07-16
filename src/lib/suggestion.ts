import { MentionOptions } from '@tiptap/extension-mention';
import tippy from 'tippy.js';
import { useAppStore } from '../store';

const getSuggestionItems = ({ query }: { query: string }) => {
  const ontology = useAppStore.getState().ontology;
  if (!ontology) return [];

  const tags = Object.values(ontology.nodes)
    .map(node => node.label)
    .filter(label => label.toLowerCase().startsWith(query.toLowerCase()));

  return tags.slice(0, 5);
};

export const suggestion = (shadowRoot: ShadowRoot): MentionOptions['suggestion'] => ({
  items: getSuggestionItems,
  render: () => {
    let popup: any;
    let suggestionList: HTMLDivElement | null = null;
    let selectedIndex = 0;

    const createSuggestionList = (items: string[]) => {
      const list = document.createElement('div');
      list.className = 'suggestion-list';
      list.innerHTML = `
        <style>
          .suggestion-list {
            background-color: #fff;
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 4px;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .suggestion-item {
            padding: 4px 8px;
            cursor: pointer;
            border-radius: 4px;
          }
          .suggestion-item.is-selected {
            background-color: #eee;
          }
        </style>
      `;
      items.forEach((item, index) => {
        const button = document.createElement('button');
        button.className = `suggestion-item ${index === selectedIndex ? 'is-selected' : ''}`;
        button.innerText = item;
        list.appendChild(button);
      });
      return list;
    };

    return {
      onStart: props => {
        const items = getSuggestionItems({ query: props.query });
        if (!items.length) return;

        suggestionList = createSuggestionList(items);

        popup = tippy(shadowRoot.body, {
          getReferenceClientRect: props.clientRect,
          appendTo: () => shadowRoot.body,
          content: suggestionList,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        });

        suggestionList.addEventListener('click', (event) => {
          const target = event.target as HTMLButtonElement;
          if (target.matches('.suggestion-item')) {
            props.command({ id: target.innerText, label: target.innerText });
            popup[0].hide();
          }
        });
      },

      onUpdate(props) {
        const items = getSuggestionItems({ query: props.query });
        if (!items.length) {
          popup?.[0].hide();
          return;
        }

        selectedIndex = 0;
        suggestionList = createSuggestionList(items);
        popup[0].setContent(suggestionList);
        popup[0].show();
      },

      onKeyDown(props) {
        if (!suggestionList) return false;

        if (props.event.key === 'ArrowUp') {
          selectedIndex = (selectedIndex + suggestionList.children.length - 2) % (suggestionList.children.length -1);
          suggestionList.querySelectorAll('.suggestion-item').forEach((item, index) => {
            item.classList.toggle('is-selected', index === selectedIndex);
          });
          return true;
        }
        if (props.event.key === 'ArrowDown') {
          selectedIndex = (selectedIndex + 1) % (suggestionList.children.length - 1);
          suggestionList.querySelectorAll('.suggestion-item').forEach((item, index) => {
            item.classList.toggle('is-selected', index === selectedIndex);
          });
          return true;
        }
        if (props.event.key === 'Enter') {
          const selectedButton = suggestionList.querySelector('.is-selected') as HTMLButtonElement;
          if (selectedButton) {
            props.command({ id: selectedButton.innerText, label: selectedButton.innerText });
            popup?.[0].hide();
          }
          return true;
        }
        if (props.event.key === 'Escape') {
          popup?.[0].hide();
          return true;
        }
        return false;
      },

      onExit() {
        popup?.[0].destroy();
      },
    };
  },
});
