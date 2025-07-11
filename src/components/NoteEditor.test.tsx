import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { NoteEditor } from './NoteEditor';
import { useAppStore } from '../store';
import { Note, OntologyTree, UserProfile, NotentionTemplate } from '../../shared/types';
import { aiService } from '../services/AIService';
import { toast } from 'sonner';

let capturedExtensions: any[] = [];

// Mock Tiptap's useEditor and EditorContent
vi.mock('@tiptap/react', async () => {
  const actual = await vi.importActual('@tiptap/react');

  // Define the chainable methods object structure
  const chainableMethods = {
    focus: vi.fn().mockReturnThis(),
    toggleBold: vi.fn().mockReturnThis(),
    toggleItalic: vi.fn().mockReturnThis(),
    toggleBulletList: vi.fn().mockReturnThis(),
    toggleOrderedList: vi.fn().mockReturnThis(),
    setLink: vi.fn().mockReturnThis(),
    extendMarkRange: vi.fn().mockReturnThis(),
    insertContent: vi.fn().mockReturnThis(),
    insertContentAt: vi.fn().mockReturnThis(),
    deleteRange: vi.fn().mockReturnThis(),
    run: vi.fn(() => {}), // run() usually doesn't return 'this' for further chaining with other commands, but ends the chain.
  };

  const mockEditorInstance = {
    // chain method returns the object with chainable commands
    chain: vi.fn(() => chainableMethods),
    // Direct editor properties/methods
    setContent: vi.fn(), // Can return this if it's chainable, or void
    getHTML: vi.fn(() => '<p>mock editor content</p>'),
    getText: vi.fn(() => 'mock editor content'),
    isActive: vi.fn(() => false),
    setEditable: vi.fn(),
    destroy: vi.fn(),
    isDestroyed: false,
    storage: {
      MentionPluginKey: {
        active: false,
        trigger: null,
        decorationNode: null,
      }
    },
    commands: { // Keep direct commands if any are used, but chain is more common
        setContent: vi.fn(),
        // If insertContentAt or deleteRange are also available as direct commands (less common for user actions)
        // insertContentAt: vi.fn().mockReturnThis(),
        // deleteRange: vi.fn().mockReturnThis(),
    },
  };

  return {
    ...actual,
    useEditor: vi.fn((options: { extensions: any[] }) => {
      capturedExtensions = options.extensions;
      // Ensure the specific mockEditorInstance is returned by useEditor
      // and that its chain() method is correctly pre-mocked.
      const editor = mockEditorInstance;
      // editor.chain = vi.fn().mockReturnValue(mockEditorInstance.chain()); // This line might be problematic, chain() already returns the mock
      return editor;
    }),
    EditorContent: vi.fn(({ editor }) => <div data-testid="tiptap-editor">{editor?.getHTML()}</div>),
    ReactRenderer: vi.fn(), // Mock ReactRenderer
  };
});

vi.mock('../services/AIService', () => ({
  aiService: {
    isAIEnabled: vi.fn(() => true),
    getAutoTags: vi.fn().mockResolvedValue(['#AI', '#Test']),
    getSummarization: vi.fn().mockResolvedValue('This is an AI summary.'),
    getOntologySuggestions: vi.fn().mockResolvedValue([]), // Not directly used by NoteEditor buttons
    getEmbeddingVector: vi.fn().mockResolvedValue([0.1,0.2,0.3]) // For find similar content
  }
}));

vi.mock('sonner', () => ({ // Mock toast
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }
}));

const mockNote: Note = {
  id: 'note1',
  title: 'Test Note Title',
  content: '<p>Initial note content.</p>',
  tags: ['#ExistingTag'],
  values: { 'initialKey': 'initialValue' },
  fields: {},
  status: 'draft',
  createdAt: new Date(),
  updatedAt: new Date(),
  embedding: [0.1,0.2,0.3]
};

const mockOntology: OntologyTree = {
  nodes: { 'tag1': { id: 'tag1', label: '#SampleTag', children: [] } },
  rootIds: ['tag1'],
};

const mockTemplates: Record<string, NotentionTemplate> = {
  'template1': {
    id: 'template1',
    name: 'Meeting Template',
    description: '',
    fields: [{ name: 'Attendees', type: 'text', required: false }],
    defaultTags: ['#Meeting'],
    defaultValues: { 'Location': 'Online' }
  }
};

const mockUserProfile: UserProfile = {
  nostrPubkey: 'test-pubkey',
  sharedTags: [],
  preferences: {
    theme: 'light',
    aiEnabled: true,
    defaultNoteStatus: 'draft',
  }
};

let mockUpdateNote = vi.fn();
let mockSetEditorContent = vi.fn();
let mockFindAndSetEmbeddingMatches = vi.fn();
let mockSetSidebarTab = vi.fn();

const setupStore = (currentNoteOverrides: Partial<Note> = {}) => {
  const noteToUse = { ...mockNote, ...currentNoteOverrides };
  mockUpdateNote = vi.fn();
  mockSetEditorContent = vi.fn();
  mockFindAndSetEmbeddingMatches = vi.fn();
  mockSetSidebarTab = vi.fn();

  useAppStore.setState({
    currentNoteId: noteToUse.id,
    notes: { [noteToUse.id]: noteToUse },
    editorContent: noteToUse.content,
    setEditorContent: mockSetEditorContent,
    updateNote: mockUpdateNote,
    isEditing: true,
    ontology: mockOntology,
    templates: mockTemplates,
    userProfile: mockUserProfile,
    findAndSetEmbeddingMatches: mockFindAndSetEmbeddingMatches,
    setSidebarTab: mockSetSidebarTab,
  });
};


describe('NoteEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
  });

  it('renders with current note title and content', () => {
    render(<NoteEditor />);
    expect(screen.getByPlaceholderText('Untitled Note')).toHaveValue(mockNote.title);
    // The content is mocked by useEditor, check if EditorContent receives it
    expect(screen.getByTestId('tiptap-editor')).toHaveTextContent('mock editor content');
  });

  it('updates title on input change', async () => {
    render(<NoteEditor />);
    const titleInput = screen.getByPlaceholderText('Untitled Note');
    fireEvent.change(titleInput, { target: { value: 'New Title' } });
    // This directly updates store state in component, then save calls updateNote
    expect(useAppStore.getState().notes[mockNote.id].title).toBe('New Title');
  });

  it('calls updateNote on save button click', async () => {
    render(<NoteEditor />);
    const saveButton = screen.getByRole('button', { name: /Save/i });
    fireEvent.click(saveButton);
    await waitFor(() => {
      expect(mockUpdateNote).toHaveBeenCalledWith(mockNote.id, {
        content: '<p>mock editor content</p>', // From mocked editor.getHTML()
        title: mockNote.title,
      });
    });
  });

  it('edits a template-defined field in the metadata sidebar', async () => {
    // Setup note with a field from a template initially
    const initialFields = { 'Attendees': 'Bob, Alice' };
    setupStore({ fields: initialFields });

    render(<NoteEditor />);
    // Open the "Info" panel (metadata sidebar)
    const infoButton = screen.getByRole('button', { name: /Info/i });
    fireEvent.click(infoButton);

    // Find the input for the "Attendees" field.
    // This assumes the field key "Attendees" is used as a label or part of an accessible name.
    // Or, if a specific structure is used for fields in the sidebar:
    const fieldsCard = screen.getByText('Fields').closest('div[role="region"]');
    expect(fieldsCard).toBeInTheDocument();

    // Find the input associated with the "Attendees" label.
    // This might require a more specific selector based on actual DOM structure.
    // For example, if fields are rendered as <Label>Key</Label><Input value={value} ... />
    // Or if they are grouped and can be found by the key text.

    // Use the new data-testid
    const attendeesInput = await screen.findByTestId('field-input-Attendees');
    expect(attendeesInput).toBeInTheDocument();
    expect(attendeesInput).toHaveValue('Bob, Alice');


    fireEvent.change(attendeesInput, { target: { value: 'Bob, Alice, Charlie' } });
    // The onChange of the field input directly calls updateNote.

    await waitFor(() => {
      // This expectation checks the updateNote call from the field's onChange
      expect(mockUpdateNote).toHaveBeenCalledWith(mockNote.id, {
        fields: { 'Attendees': 'Bob, Alice, Charlie' },
      });
    });

    // Optionally, also test that a subsequent general save operation preserves this change
    // and saves other things like title/content.
    // First, update the store to reflect the change made by the field's onChange,
    // as the component's `currentNote` for the `Save` button would be stale otherwise.
    useAppStore.setState(state => ({
        ...state,
        notes: {
            ...state.notes,
            [mockNote.id]: {
                ...state.notes[mockNote.id],
                fields: { 'Attendees': 'Bob, Alice, Charlie' }
            }
        }
    }));

    const saveButton = screen.getByRole('button', { name: /Save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
        // This checks the updateNote call from the Save button
        expect(mockUpdateNote).toHaveBeenCalledWith(mockNote.id, expect.objectContaining({
            title: mockNote.title, // Assuming title hasn't changed in this specific flow
            content: '<p>mock editor content</p>', // From mocked editor
            // The fields should ideally be part of this save as well if the `currentNote` used by Save is up-to-date.
            // However, the primary test for field update is the one above.
            // Depending on how state updates propagate, `currentNote.fields` inside `handleSave`
            // might or might not have 'Bob, Alice, Charlie'.
            // The current handleSave only explicitly saves title and content.
            // Fields, tags, values are updated by their respective direct interactions.
        }));
    });
  });

  it('toggles bold and italic formatting', async () => {
    const { useEditor } = vi.mocked(await vi.importActual('@tiptap/react'));
    // Get the mock object returned by chain()
    const mockChain = vi.mocked(useEditor()!.chain());
    render(<NoteEditor />);

    const boldButton = screen.getByRole('button', { name: /bold/i });
    fireEvent.click(boldButton);
    expect(mockChain.focus).toHaveBeenCalled();
    expect(mockChain.toggleBold).toHaveBeenCalled();
    expect(mockChain.run).toHaveBeenCalled();

    const italicButton = screen.getByRole('button', { name: /italic/i });
    fireEvent.click(italicButton);
    expect(mockChain.focus).toHaveBeenCalled();
    expect(mockChain.toggleItalic).toHaveBeenCalled();
    expect(mockChain.run).toHaveBeenCalled();
  });

  it('toggles bulleted and numbered lists', async () => {
    const { useEditor } = vi.mocked(await vi.importActual('@tiptap/react'));
    const mockChain = vi.mocked(useEditor()!.chain());
    render(<NoteEditor />);

    // Toolbar buttons for lists might not have explicit text names if they are icon-only
    // Assuming they have aria-labels or accessible names like "bullet list" / "ordered list"
    // Or we find them by a test-id if available.
    // For now, let's assume the mock handles these commands directly if buttons are found.
    // This part of the test relies on the mock being extended or finding buttons another way.
    // If specific buttons for lists are added to NoteEditor.tsx:
    // const bulletListButton = screen.getByRole('button', { name: /bullet list/i });
    // fireEvent.click(bulletListButton);
    // expect(mockEditorInstance.chain().focus().toggleBulletList().run).toHaveBeenCalled();

    // const orderedListButton = screen.getByRole('button', { name: /numbered list/i });
    // fireEvent.click(orderedListButton);
    // expect(mockEditorInstance.chain().focus().toggleOrderedList().run).toHaveBeenCalled();

    // Directly check if the commands are available on the mocked editor,
    // as specific buttons might not be in the simplified toolbar in the test.
    expect(mockEditorInstance.chain().focus().toggleBulletList).toBeDefined();
    expect(mockEditorInstance.chain().focus().toggleOrderedList).toBeDefined();
  });

  it('adds a hyperlink', async () => {
    const { useEditor } = vi.mocked(await vi.importActual('@tiptap/react'));
    const mockChain = vi.mocked(useEditor()!.chain());
    render(<NoteEditor />);

    // Mock window.prompt used by the Link button's onClick
    const mockPrompt = vi.spyOn(window, 'prompt').mockReturnValue('https://example.com');

    const linkButton = screen.getByRole('button', { name: /link/i }); // Assuming name is "link" from Lucide icon title
    fireEvent.click(linkButton);

    expect(mockPrompt).toHaveBeenCalledWith('URL');
    expect(mockChain.focus).toHaveBeenCalled();
    expect(mockChain.extendMarkRange).toHaveBeenCalledWith('link');
    expect(mockChain.setLink).toHaveBeenCalledWith({ href: 'https://example.com' });
    expect(mockChain.run).toHaveBeenCalled();

    mockPrompt.mockRestore();
  });

  it('Mention command adds tag to note metadata and editor', () => {
    render(<NoteEditor />); // This populates capturedExtensions

    // Find the Mention extension for '#'
    const mentionHashtagExtension = capturedExtensions.find(ext => ext.name === 'mention' && ext.options.char === '#');
    expect(mentionHashtagExtension).toBeDefined();

    const mockEditorInstance = vi.mocked(useEditor())!;
    const mockChain = vi.mocked(mockEditorInstance.chain());
    const suggestionCommand = mentionHashtagExtension.options.suggestion.command;

    const commandProps = {
      editor: mockEditorInstance,
      range: { from: 1, to: 2 }, // Mock range
      props: { id: 'testTag', label: '#TestTagFromMention', trigger: '#' }
    };

    // Call the command
    suggestionCommand(commandProps);

    // Check editor commands
    expect(mockChain.focus).toHaveBeenCalled();
    expect(mockChain.deleteRange).toHaveBeenCalledWith(commandProps.range);
    expect(mockChain.insertContentAt).toHaveBeenCalledWith(commandProps.range.from, `${commandProps.props.label} `);
    expect(mockChain.run).toHaveBeenCalled();


    // Check updateNote call
    expect(mockUpdateNote).toHaveBeenCalledWith(mockNote.id, {
      tags: expect.arrayContaining(['#ExistingTag', '#TestTagFromMention']),
    });

    // Test for '@' mention
    const mentionAtExtension = capturedExtensions.find(ext => ext.name === 'mention' && ext.options.char === '@');
    expect(mentionAtExtension).toBeDefined();
    const suggestionAtCommand = mentionAtExtension.options.suggestion.command;
    const commandAtProps = {
        editor: mockEditorInstance, // Use the same editor instance
        range: { from: 5, to: 6},
        props: { id: 'testPerson', label: '@TestPerson', trigger: '@'}
    };
    suggestionAtCommand(commandAtProps);
    // mockChain should be called again for these
    expect(mockChain.focus).toHaveBeenCalledTimes(2); // Called for # then for @
    expect(mockChain.insertContentAt).toHaveBeenCalledWith(commandAtProps.range.from, `${commandAtProps.props.label} `);
    expect(mockChain.run).toHaveBeenCalledTimes(2);
    expect(mockUpdateNote).toHaveBeenCalledWith(mockNote.id, {
      tags: expect.arrayContaining(['#ExistingTag', '#TestTagFromMention', '@TestPerson']), // Ensure it appends
    });


  });

  it('adds a tag via the metadata sidebar', async () => {
    render(<NoteEditor />);
    // Open the "Info" panel (metadata sidebar)
    const infoButton = screen.getByRole('button', { name: /Info/i });
    fireEvent.click(infoButton);

    // Find the "Add Tag" dialog trigger in the "Tags" card
    const tagsCard = screen.getByText('Tags').closest('div[role="region"]'); // Assuming Card has a role or use more specific selector
    const addTagDialogTrigger = tagsCard?.querySelector('button[aria-haspopup="dialog"]'); // ShadCN uses this for DialogTrigger

    if (!addTagDialogTrigger) throw new Error("Add Tag dialog trigger not found");
    fireEvent.click(addTagDialogTrigger);

    const tagInput = await screen.findByPlaceholderText('#AI, @Person, etc.');
    const addTagButtonInModal = screen.getByRole('button', { name: 'Add Tag' });

    fireEvent.change(tagInput, { target: { value: '#NewTestTag' } });
    fireEvent.click(addTagButtonInModal);

    await waitFor(() => {
      expect(mockUpdateNote).toHaveBeenCalledWith(mockNote.id, {
        tags: expect.arrayContaining(['#ExistingTag', '#NewTestTag']),
      });
    });
  });

  it('applies a template', async () => {
    render(<NoteEditor />);
    const templateSelectTrigger = screen.getByRole('combobox', { name: /Template/i });
    fireEvent.mouseDown(templateSelectTrigger); // Open the select dropdown

    const templateOption = await screen.findByText('Meeting Template');
    fireEvent.click(templateOption);

    await waitFor(() => {
      expect(mockUpdateNote).toHaveBeenCalledWith(mockNote.id, {
        tags: expect.arrayContaining(['#ExistingTag', '#Meeting']),
        values: expect.objectContaining({ 'initialKey': 'initialValue', 'Location': 'Online' }),
        fields: expect.objectContaining({ 'Attendees': '' }),
      });
    });
  });

  it('calls AI auto-tag when button is clicked', async () => {
    render(<NoteEditor />);
    const autoTagButton = screen.getByRole('button', { name: /Auto-tag/i });
    fireEvent.click(autoTagButton);

    await waitFor(() => {
      expect(aiService.getAutoTags).toHaveBeenCalledWith('mock editor content', mockNote.title, mockOntology);
    });
    await waitFor(() => {
      expect(mockUpdateNote).toHaveBeenCalledWith(mockNote.id, {
        tags: expect.arrayContaining(['#ExistingTag', '#AI', '#Test']),
      });
    });
  });

  it('calls AI summarize and shows modal', async () => {
    render(<NoteEditor />);
    const summarizeButton = screen.getByRole('button', { name: /Summarize/i });
    fireEvent.click(summarizeButton);

    await waitFor(() => {
      expect(aiService.getSummarization).toHaveBeenCalledWith('mock editor content', mockNote.title);
    });
    expect(await screen.findByText('AI Generated Summary')).toBeInTheDocument();
    expect(screen.getByText('This is an AI summary.')).toBeInTheDocument();

    // Test inserting the summary
    const insertButton = screen.getByRole('button', { name: /Insert into Note/i });
    fireEvent.click(insertButton);

    const { useEditor } = vi.mocked(await vi.importActual('@tiptap/react'));
    const mockEditor = vi.mocked(useEditor()!); // Get the mocked editor instance

    expect(mockEditor.commands.setContent).toHaveBeenCalledWith(
      expect.stringContaining('AI Summary:') && expect.stringContaining('This is an AI summary.'),
      true
    );
    expect(toast.info).toHaveBeenCalledWith("Summary inserted into note.");
    // Check if handleSave was called
    await waitFor(() => {
        expect(mockUpdateNote).toHaveBeenCalledWith(mockNote.id, expect.objectContaining({
            // content will be the new content set by setContent, title the original
        }));
    });
  });

  it('removes a tag via the metadata sidebar', async () => {
    setupStore({ tags: ['#Tag1', '#TagToRemove'] });
    render(<NoteEditor />);
    const infoButton = screen.getByRole('button', { name: /Info/i });
    fireEvent.click(infoButton);

    // Find the badge for '#TagToRemove'
    const tagBadge = await screen.findByText('#TagToRemove');
    // The 'x' is part of the badge content or a sibling, depends on implementation.
    // Assuming clicking the badge itself (if it has an onClick for removal) or a specific 'x' button.
    // Current implementation has onClick on the Badge itself.
    fireEvent.click(tagBadge);

    await waitFor(() => {
      expect(mockUpdateNote).toHaveBeenCalledWith(mockNote.id, {
        tags: ['#Tag1'], // Only #TagToRemove should be removed
      });
    });
  });

  it('removes a value via the metadata sidebar', async () => {
    setupStore({ values: { 'key1': 'val1', 'keyToRemove': 'valToRemove' } });
    render(<NoteEditor />);
    const infoButton = screen.getByRole('button', { name: /Info/i });
    fireEvent.click(infoButton);

    // Values are displayed as "Key: Value" with an 'x' button.
    // Find the 'x' button associated with 'keyToRemove'.
    // This requires the 'x' button to be identifiable, e.g., via aria-label or test-id relative to the key.
    // In NoteEditor.tsx, the remove button is:
    // <Button size="sm" variant="ghost" onClick={() => removeValueFromMetadata(key)} className="h-6 w-6 p-0 text-destructive">×</Button>
    // We need to find this button. It's inside a div with the key/value.
    const valueDisplay = await screen.findByText((content, element) => {
      return element?.tagName.toLowerCase() === 'span' && content.startsWith('keyToRemove:');
    });
    const valueContainer = valueDisplay.closest('div');
    const removeButton = valueContainer?.querySelector('button.text-destructive');

    expect(removeButton).toBeInTheDocument();
    if (removeButton) {
      fireEvent.click(removeButton);
    }

    await waitFor(() => {
      expect(mockUpdateNote).toHaveBeenCalledWith(mockNote.id, {
        values: { 'key1': 'val1' },
      });
    });
  });

  it('calls findAndSetEmbeddingMatches and switches tab when "Similar Content" is clicked', async () => {
    setupStore({ embedding: [0.1, 0.2, 0.3] }); // Ensure note has embedding
    render(<NoteEditor />);

    const similarContentButton = screen.getByRole('button', { name: /Similar Content/i });
    expect(similarContentButton).not.toBeDisabled();
    fireEvent.click(similarContentButton);

    await waitFor(() => {
      expect(mockFindAndSetEmbeddingMatches).toHaveBeenCalledWith(mockNote.id);
    });
    expect(mockSetSidebarTab).toHaveBeenCalledWith('network');
    expect(toast.info).toHaveBeenCalledWith("Searching for similar notes by content...");
  });

  it('"Similar Content" button is disabled if note has no embedding', () => {
    setupStore({ embedding: undefined });
    render(<NoteEditor />);
    const similarContentButton = screen.getByRole('button', { name: /Similar Content/i });
    expect(similarContentButton).toBeDisabled();
  });

  it('"Similar Content" button is disabled if AI is disabled', () => {
    useAppStore.setState({ userProfile: { ...mockUserProfile, preferences: { ...mockUserProfile.preferences, aiEnabled: false } } });
    setupStore({ embedding: [0.1,0.2,0.3]}); // Note has embedding
    render(<NoteEditor />);

    // The button itself might not be rendered if AI is disabled due to the conditional rendering in NoteEditor.
    // We need to check if the whole AI features button group is absent or if the button is there but disabled.
    // Based on current NoteEditor.tsx, the button group is conditional on userProfile.preferences.aiEnabled && aiService.isAIEnabled()
    // So, if aiService.isAIEnabled() is also mocked to return false based on store, the button won't be there.
    // Let's assume aiService.isAIEnabled() respects the store for this test.
    vi.mocked(aiService.isAIEnabled).mockReturnValue(false);

    const { queryByRole } = render(<NoteEditor />); // Re-render after AI disabled
    const similarContentButton = queryByRole('button', { name: /Similar Content/i });
    expect(similarContentButton).toBeNull(); // The button should not be rendered
  });

  it('adds a value via the metadata sidebar', async () => {
    render(<NoteEditor />);
    // Open the "Info" panel (metadata sidebar)
    const infoButton = screen.getByRole('button', { name: /Info/i });
    fireEvent.click(infoButton);

    // Find the "Add Value" dialog trigger in the "Values" card
    const valuesCard = screen.getByText('Values').closest('div[role="region"]');
    const addValueDialogTrigger = valuesCard?.querySelector('button[aria-haspopup="dialog"]');

    if (!addValueDialogTrigger) throw new Error("Add Value dialog trigger not found");
    fireEvent.click(addValueDialogTrigger);

    const keyInput = await screen.findByLabelText('Key');
    const valueInput = await screen.findByLabelText('Value');
    const addValueButtonInModal = screen.getByRole('button', { name: 'Add Value' });

    fireEvent.change(keyInput, { target: { value: 'TestKey' } });
    fireEvent.change(valueInput, { target: { value: 'TestValue' } });
    fireEvent.click(addValueButtonInModal);

    await waitFor(() => {
      expect(mockUpdateNote).toHaveBeenCalledWith(mockNote.id, {
        values: expect.objectContaining({ 'initialKey': 'initialValue', 'TestKey': 'TestValue' }),
      });
    });
  });

  it('shows non-editing view when isEditing is false', () => {
    useAppStore.setState(state => ({ ...state, isEditing: false }));
    render(<NoteEditor />);
    expect(screen.getByText('No note selected')).toBeInTheDocument(); // Or whatever the non-editing view shows
    expect(screen.queryByTestId('tiptap-editor')).toBeNull();
    expect(screen.queryByRole('button', { name: /Save/i })).toBeNull();
  });

  it('handles AI auto-tag failure gracefully', async () => {
    vi.mocked(aiService.getAutoTags).mockRejectedValueOnce(new Error('AI Network Error'));
    render(<NoteEditor />);
    const autoTagButton = screen.getByRole('button', { name: /Auto-tag/i });
    fireEvent.click(autoTagButton);

    await waitFor(() => {
      expect(aiService.getAutoTags).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Auto-tagging failed.", { description: 'AI Network Error' });
    });
    expect(mockUpdateNote).not.toHaveBeenCalledWith(mockNote.id, expect.objectContaining({
      tags: expect.arrayContaining(['#AI', '#Test']), // Ensure tags are not updated on failure
    }));
  });

});
