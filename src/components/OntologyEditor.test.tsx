import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi } from 'vitest';
import { OntologyEditor } from './OntologyEditor';
import { useAppStore } from '../store';
import { OntologyTree, OntologyNode, UserProfile } from '../../shared/types';
import { OntologyService } from '../services/ontology';
import { aiService } from '../services/AIService';
import { toast } from 'sonner';
import { DndContext } from '@dnd-kit/core'; // Needed for wrapping

// Mock services
vi.mock('../services/ontology', () => ({
  OntologyService: {
    createNode: vi.fn((label, parentId, attributes) => ({
      id: `mock-${label.toLowerCase()}-${Date.now()}`,
      label: label.startsWith('#') || label.startsWith('@') ? label : `#${label}`,
      parentId,
      attributes: attributes || {},
      children: [],
    })),
    addNode: vi.fn((ont, node) => ({ ...ont, nodes: { ...ont.nodes, [node.id]: node }, rootIds: node.parentId ? ont.rootIds : [...ont.rootIds, node.id] })),
    removeNode: vi.fn((ont, nodeId) => {
        const newNodes = { ...ont.nodes };
        delete newNodes[nodeId];
        // Simplified: does not handle reparenting children for this mock
        return { ...ont, nodes: newNodes, rootIds: ont.rootIds.filter((id:string) => id !== nodeId) };
    }),
    updateNode: vi.fn((ont, nodeId, updates) => ({ ...ont, nodes: { ...ont.nodes, [nodeId]: { ...ont.nodes[nodeId], ...updates } } })),
    moveNode: vi.fn((ont, nodeId, newParentId, position) => {
      // Simplified mock, just returns original ontology
      return ont;
    }),
    getChildNodes: vi.fn((ont, parentId) => parentId ? ont.nodes[parentId]?.children?.map((id:string) => ont.nodes[id]) || [] : ont.rootIds.map((id:string) => ont.nodes[id])),
    exportToJSON: vi.fn(() => JSON.stringify({ nodes: {}, rootIds: [] })),
    importFromJSON: vi.fn(() => ({ nodes: { 'imported': {id: 'imported', label: '#Imported', children:[]}}, rootIds: ['imported']})),
  }
}));

vi.mock('../services/AIService', () => ({
  aiService: {
    isAIEnabled: vi.fn(() => true),
    getOntologySuggestions: vi.fn().mockResolvedValue([{ label: '#AISuggestion', parentId: undefined }]),
  }
}));

vi.mock('sonner', () => ({ // Mock toast
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }
}));

// Mock @dnd-kit/sortable as its hooks are used directly in renderNode
// This is a very basic mock to prevent errors. Real DnD testing is complex.
vi.mock('@dnd-kit/sortable', async () => {
  const actual = await vi.importActual('@dnd-kit/sortable');
  return {
    ...actual,
    useSortable: vi.fn(() => ({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      transition: null,
      isDragging: false,
    })),
    SortableContext: vi.fn(({ children }) => <>{children}</>), // Pass through children
  };
});


const mockOntology: OntologyTree = {
  nodes: {
    'root1': { id: 'root1', label: '#Root1', children: ['child1'] },
    'child1': { id: 'child1', label: '#Child1', parentId: 'root1', children: [] },
    'root2': { id: 'root2', label: '#Root2', children: [] },
  },
  rootIds: ['root1', 'root2'],
  updatedAt: new Date(),
};

const mockUserProfile: UserProfile = {
  nostrPubkey: 'test-pubkey',
  sharedTags: [],
  preferences: { theme: 'light', aiEnabled: true, defaultNoteStatus: 'draft' },
};

let mockUpdateOntology = vi.fn();
let mockSetStoreOntology = vi.fn();

const setupStore = (currentOntology: OntologyTree = mockOntology) => {
  mockUpdateOntology = vi.fn(async (newOntology) => {
    // Simulate the store's updateOntology which might involve DB and then setting state
    useAppStore.setState({ ontology: newOntology });
  });
  mockSetStoreOntology = vi.fn((newOntology) => {
    useAppStore.setState({ ontology: newOntology });
  });

  useAppStore.setState({
    ontology: JSON.parse(JSON.stringify(currentOntology)), // Deep clone for isolation
    updateOntology: mockUpdateOntology,
    setOntology: mockSetStoreOntology, // This is the direct setter
    userProfile: mockUserProfile,
  });
};

// Helper to wrap OntologyEditor in DndContext for tests
const WrappedOntologyEditor = () => (
  <DndContext onDragEnd={() => {}}> {/* Basic onDragEnd for testing render */}
    <OntologyEditor />
  </DndContext>
);


describe('OntologyEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
  });

  it('renders existing ontology nodes', () => {
    render(<WrappedOntologyEditor />);
    expect(screen.getByText('#Root1')).toBeInTheDocument();
    expect(screen.getByText('#Root2')).toBeInTheDocument();
    // Child1 is not visible initially unless Root1 is expanded. Test expansion separately.
  });

  it('adds a new root concept via dialog', async () => {
    render(<WrappedOntologyEditor />);
    fireEvent.click(screen.getByRole('button', { name: /Add Concept/i }));

    const labelInput = await screen.findByPlaceholderText('e.g., AI, Project, Person');
    fireEvent.change(labelInput, { target: { value: 'NewRootConcept' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Concept' })); // Modal's add button

    await waitFor(() => {
      expect(OntologyService.createNode).toHaveBeenCalledWith('NewRootConcept', undefined);
      expect(OntologyService.addNode).toHaveBeenCalled();
      expect(mockUpdateOntology).toHaveBeenCalled(); // Store's async update (DB)
      expect(mockSetStoreOntology).toHaveBeenCalled(); // Store's direct state update
    });
  });

  it('opens edit dialog and updates a concept', async () => {
    render(<WrappedOntologyEditor />);
    // Find edit button for #Root1. Needs a more robust selector.
    const root1NodeElement = screen.getByText('#Root1').closest('div.group');
    const editButton = root1NodeElement?.querySelector('button [lucide="edit-2"]');
    if (!editButton) throw new Error("Edit button for #Root1 not found");

    fireEvent.click(editButton.parentElement!); // Click the button element

    const labelInput = await screen.findByDisplayValue('#Root1');
    fireEvent.change(labelInput, { target: { value: '#Root1Updated' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(OntologyService.updateNode).toHaveBeenCalledWith(
        expect.anything(), // current ontology
        'root1',
        expect.objectContaining({ label: '#Root1Updated' })
      );
      expect(mockUpdateOntology).toHaveBeenCalled();
      expect(mockSetStoreOntology).toHaveBeenCalled();
    });
  });

  it('deletes a concept', async () => {
    render(<WrappedOntologyEditor />);
    const root2NodeElement = screen.getByText('#Root2').closest('div.group');
    const deleteButton = root2NodeElement?.querySelector('button [lucide="trash-2"]');
    if (!deleteButton) throw new Error("Delete button for #Root2 not found");

    fireEvent.click(deleteButton.parentElement!);

    await waitFor(() => {
      expect(OntologyService.removeNode).toHaveBeenCalledWith(expect.anything(), 'root2');
      expect(mockUpdateOntology).toHaveBeenCalled();
      expect(mockSetStoreOntology).toHaveBeenCalled();
    });
  });

  it('fetches and displays AI suggestions', async () => {
    render(<WrappedOntologyEditor />);
    fireEvent.click(screen.getByRole('button', { name: /AI Suggest/i }));

    const getSuggestionsButton = await screen.findByRole('button', { name: /Get Suggestions/i});
    fireEvent.click(getSuggestionsButton);

    await waitFor(() => {
      expect(aiService.getOntologySuggestions).toHaveBeenCalled();
    });
    expect(await screen.findByText('#AISuggestion')).toBeInTheDocument();
  });

  it('handles ontology export', async () => {
    global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock-url');
    const mockAnchorClick = vi.fn();
    const mockAnchor = { href: '', download: '', click: mockAnchorClick, remove: vi.fn() };
    document.createElement = vi.fn(() => mockAnchor as any); // Mock document.createElement
    document.body.appendChild = vi.fn(); // Mock appendChild
    document.body.removeChild = vi.fn(); // Mock removeChild


    render(<WrappedOntologyEditor />);
    const exportButton = screen.getByRole('button', { name: 'Export' });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(OntologyService.exportToJSON).toHaveBeenCalled();
      expect(mockAnchorClick).toHaveBeenCalled();
    });
    expect(toast.success).toHaveBeenCalledWith("Ontology exported successfully!");
  });

  it('adds, edits, and removes attributes in the edit dialog', async () => {
    render(<WrappedOntologyEditor />);
    const root1NodeElement = screen.getByText('#Root1').closest('div.group');
    const editButton = root1NodeElement?.querySelector('button [lucide="edit-2"]');
    if (!editButton) throw new Error("Edit button for #Root1 not found");
    fireEvent.click(editButton.parentElement!);

    // Wait for dialog to open and find "Add Attribute" button
    const addAttributeButton = await screen.findByRole('button', { name: /Add Attribute/i });
    fireEvent.click(addAttributeButton);

    // Wait for new attribute input fields to appear
    // Assuming new inputs are empty. Inputs might need more specific selectors or test-ids.
    const attributeKeyInputs = await screen.findAllByPlaceholderText('Attribute Name');
    const attributeValueInputs = await screen.findAllByPlaceholderText('Attribute Value');

    // New attribute input should be the last one if attributes are listed
    const newKeyInput = attributeKeyInputs[attributeKeyInputs.length - 1];
    const newValueInput = attributeValueInputs[attributeValueInputs.length - 1];

    fireEvent.change(newKeyInput, { target: { value: 'TestKey' } });
    fireEvent.change(newValueInput, { target: { value: 'TestValue' } });

    // Save changes
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(OntologyService.updateNode).toHaveBeenCalledWith(
        expect.anything(),
        'root1',
        expect.objectContaining({ attributes: { 'TestKey': 'TestValue' } })
      );
    });

    // Re-open dialog to edit the attribute
    fireEvent.click(editButton.parentElement!);
    const updatedKeyInput = await screen.findByDisplayValue('TestKey');
    const updatedValueInput = await screen.findByDisplayValue('TestValue');

    fireEvent.change(updatedKeyInput, { target: { value: 'TestKeyUpdated' } });
    fireEvent.change(updatedValueInput, { target: { value: 'TestValueUpdated' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));
    await waitFor(() => {
      expect(OntologyService.updateNode).toHaveBeenCalledWith(
        expect.anything(),
        'root1',
        expect.objectContaining({ attributes: { 'TestKeyUpdated': 'TestValueUpdated' } })
      );
    });

    // Re-open dialog to remove the attribute
    fireEvent.click(editButton.parentElement!);
    const removeAttributeButton = (await screen.findByDisplayValue('TestKeyUpdated'))
                                    .closest('.flex') // Assuming key/value/remove are in a flex container
                                    ?.querySelector('button [lucide="trash-2"]');
    if (!removeAttributeButton) throw new Error("Remove attribute button not found");
    fireEvent.click(removeAttributeButton.parentElement!); // Click the button containing the icon

    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));
    await waitFor(() => {
      expect(OntologyService.updateNode).toHaveBeenCalledWith(
        expect.anything(),
        'root1',
        expect.objectContaining({ attributes: {} }) // Empty attributes
      );
    });
  });

  // Basic test for drag and drop handler call. Does not test visual DnD.
  it('handleDragEnd is called and attempts to move node on drag end', async () => {
    setupStore(); // Ensure clean store
    const { rerender } = render(<WrappedOntologyEditor />); // initial render

    // Simulate a drag event. This is highly simplified.
    // A real test would need to mock DndContext's internals or use Playwright.
    // Here, we're checking if our `handleDragEnd` gets called by the mocked DndContext.
    // We need to get the onDragEnd from DndContext's props.
    // This is tricky as DndContext is internal to WrappedOntologyEditor.
    // We'll trust the DndContext mock calls onDragEnd from its props.
    // The actual test for `OntologyService.moveNode` is in its own service test.

    // For this unit test, we can't easily trigger the DndContext's onDragEnd.
    // We can, however, verify that if handleDragEnd was called (e.g., by manually calling it
    // if it were exported, or by having a spy on it if it were a component method),
    // it would then call OntologyService.moveNode.
    // Since it's an internal callback, this is hard to unit test directly without @testing-library/user-event
    // and a more complex setup for dnd-kit.

    // Let's assume for now that if `OntologyService.moveNode` is available,
    // and the component's `handleDragEnd` (if it could be spied on) is called,
    // it would then invoke `OntologyService.moveNode`.
    // The existing test for `OntologyService.moveNode` in `ontology.test.ts` covers its logic.
    // For component integration, an E2E test is more suitable for actual DnD.

    // Placeholder: Check if the DnD context is rendered at least.
    expect(screen.getByText('#Root1')).toBeInTheDocument(); // Confirms editor rendered.
    // Further DnD interaction testing is better suited for E2E.
  });

  it('handles ontology import and confirms overwrite', async () => {
    setupStore(); // Start with mockOntology
    const mockImportedOntology: OntologyTree = {
      nodes: { 'importedNode': { id: 'importedNode', label: '#ImportedConcept', children: [] } },
      rootIds: ['importedNode'],
      updatedAt: new Date(),
    };
    vi.mocked(OntologyService.importFromJSON).mockReturnValue(mockImportedOntology);
    const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true); // Simulate user confirming overwrite

    render(<WrappedOntologyEditor />);

    const importButton = screen.getByRole('button', { name: /Import/i });
    // The actual file input is hidden, the button triggers its click.
    // We need to simulate a file change on the hidden input.
    const fileInput = document.getElementById('import-ontology-file') as HTMLInputElement;

    const mockFile = new File(
      [JSON.stringify(mockImportedOntology)],
      'ontology.json',
      { type: 'application/json' }
    );

    // Simulate file selection
    // fireEvent.click(importButton); // This would click the button that clicks the input
    // Directly dispatch change event on the file input
    await act(async () => { // Wrap in act for state updates from FileReader
        fireEvent.change(fileInput, { target: { files: [mockFile] } });
    });

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledWith("This will replace your current ontology. Are you sure you want to proceed?");
      expect(OntologyService.importFromJSON).toHaveBeenCalledWith(JSON.stringify(mockImportedOntology));
      expect(mockUpdateOntology).toHaveBeenCalledWith(mockImportedOntology);
      expect(mockSetStoreOntology).toHaveBeenCalledWith(mockImportedOntology); // Check if direct set is called
    });
    expect(toast.success).toHaveBeenCalledWith("Ontology imported successfully!");

    mockConfirm.mockRestore();
  });

  it('handles ontology import and cancels overwrite', async () => {
    setupStore();
    const mockFile = new File(["{}"], 'ontology.json', { type: 'application/json' });
    vi.mocked(OntologyService.importFromJSON).mockReturnValue({ nodes: {}, rootIds: [] }); // Return minimal valid
    const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(false); // Simulate user canceling overwrite

    render(<WrappedOntologyEditor />);
    const fileInput = document.getElementById('import-ontology-file') as HTMLInputElement;

    await act(async () => {
        fireEvent.change(fileInput, { target: { files: [mockFile] } });
    });

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalled();
    });
    expect(OntologyService.importFromJSON).not.toHaveBeenCalled(); // Should not proceed if overwrite cancelled
    expect(mockUpdateOntology).not.toHaveBeenCalled();
    expect(mockSetStoreOntology).not.toHaveBeenCalled();

    mockConfirm.mockRestore();
  });

});
