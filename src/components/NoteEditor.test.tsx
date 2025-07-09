import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { NoteEditor } from './NoteEditor';
import { useAppStore } from '../store';
import { Note, OntologyTree, UserProfile, NotentionTemplate } from '../../shared/types';
import { aiService } from '../services/AIService';
import { toast } from 'sonner';

// Mock Tiptap's useEditor and EditorContent
vi.mock('@tiptap/react', async () => {
  const actual = await vi.importActual('@tiptap/react');
  const mockEditor = {
    chain: vi.fn().mockReturnThis(),
    focus: vi.fn().mockReturnThis(),
    toggleBold: vi.fn().mockReturnThis(),
    toggleItalic: vi.fn().mockReturnThis(),
    setLink: vi.fn().mockReturnThis(),
    extendMarkRange: vi.fn().mockReturnThis(),
    insertContent: vi.fn().mockReturnThis(),
    setContent: vi.fn().mockReturnThis(),
    getHTML: vi.fn(() => '<p>mock editor content</p>'),
    getText: vi.fn(() => 'mock editor content'),
    isActive: vi.fn(() => false),
    setEditable: vi.fn(),
    destroy: vi.fn(),
    isDestroyed: false,
    storage: {}, // Add storage for MentionPluginKey if needed by component logic directly
    commands: { // Mock common commands if directly accessed
        setContent: vi.fn()
    }
  };
  return {
    ...actual,
    useEditor: vi.fn(() => mockEditor),
    EditorContent: vi.fn(({ editor }) => <div data-testid="tiptap-editor">{editor?.getHTML()}</div>),
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

  it('toggles bold and italic formatting', () => {
    const { useEditor } = vi.mocked(require('@tiptap/react'));
    const mockEditorInstance = useEditor(); // Get the mocked editor instance
    render(<NoteEditor />);

    const boldButton = screen.getByRole('button', { name: /bold/i });
    fireEvent.click(boldButton);
    expect(mockEditorInstance.chain().focus().toggleBold().run).toHaveBeenCalled();

    const italicButton = screen.getByRole('button', { name: /italic/i });
    fireEvent.click(italicButton);
    expect(mockEditorInstance.chain().focus().toggleItalic().run).toHaveBeenCalled();
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

});
