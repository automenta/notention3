import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ContactsPanel } from './ContactsPanel';
import { useAppStore } from '../store';
import { UserProfile, Contact } from '../../shared/types';

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock useAppStore
const mockAddContact = vi.fn();
const mockRemoveContact = vi.fn();
const mockUpdateContactAlias = vi.fn();
const mockSendDirectMessage = vi.fn();

const mockUserWithoutContacts: UserProfile = {
  nostrPubkey: 'test-user-pubkey',
  sharedTags: [],
  preferences: { theme: 'light', aiEnabled: false, defaultNoteStatus: 'draft' },
  contacts: [],
};

const mockContacts: Contact[] = [
  { pubkey: 'contact1-pubkey', alias: 'Alice' },
  { pubkey: 'contact2-pubkey', alias: 'Bob' },
  { pubkey: 'contact3-pubkey' }, // No alias
];

const mockUserWithContacts: UserProfile = {
  ...mockUserWithoutContacts,
  contacts: mockContacts,
};

// Default mock state for the store
let mockStoreState = {
  userProfile: mockUserWithoutContacts as UserProfile | undefined,
  addContact: mockAddContact,
  removeContact: mockRemoveContact,
  updateContactAlias: mockUpdateContactAlias,
  sendDirectMessage: mockSendDirectMessage,
};

vi.mock('../store', () => ({
  useAppStore: vi.fn((selector) => selector(mockStoreState)),
}));

// Helper to reset store and mocks before each test
const setupMockStore = (profile?: UserProfile) => {
  mockStoreState = {
    userProfile: profile,
    addContact: mockAddContact,
    removeContact: mockRemoveContact,
    updateContactAlias: mockUpdateContactAlias,
    sendDirectMessage: mockSendDirectMessage,
  };
  mockAddContact.mockReset();
  mockRemoveContact.mockReset();
  mockUpdateContactAlias.mockReset();
  mockSendDirectMessage.mockReset();
  (useAppStore as any).mockImplementation((selector: any) => selector(mockStoreState));
};


describe.skip('ContactsPanel', () => {
  beforeEach(() => {
    // Default to user with no contacts for most tests unless specified
    setupMockStore(mockUserWithoutContacts);
  });

  it('renders "No contacts yet" message when there are no contacts', () => {
    render(<ContactsPanel />);
    expect(screen.getByText('No contacts yet')).toBeInTheDocument();
    expect(screen.getByText('Add contacts to easily start direct messages.')).toBeInTheDocument();
  });

  it('renders a list of contacts if they exist', () => {
    setupMockStore(mockUserWithContacts);
    render(<ContactsPanel />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('(contact1-pubkey...)' , { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('(contact2-pubkey...)' , { exact: false })).toBeInTheDocument();
    expect(screen.getByText('contact3-pubkey...', { exact: false })).toBeInTheDocument(); // Contact with no alias
  });

  it('opens "Add Contact" modal when "Add Contact" button is clicked', () => {
    render(<ContactsPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Add Contact/i }));
    expect(screen.getByRole('dialog', { name: /Add New Contact/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Nostr Public Key/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Alias \(Optional\)/i)).toBeInTheDocument();
  });

  it('allows adding a new contact through the modal', async () => {
    mockAddContact.mockResolvedValue(undefined); // Simulate successful add
    render(<ContactsPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Add Contact/i }));

    const pubkeyInput = screen.getByLabelText(/Nostr Public Key/i);
    const aliasInput = screen.getByLabelText(/Alias \(Optional\)/i);
    const addButtonInModal = screen.getByRole('button', { name: 'Add Contact' }); // Modal's add button

    fireEvent.change(pubkeyInput, { target: { value: 'newcontact-pubkey-is-64-chars-long-----------------------------' } });
    fireEvent.change(aliasInput, { target: { value: 'Charlie' } });
    fireEvent.click(addButtonInModal);

    await waitFor(() => {
      expect(mockAddContact).toHaveBeenCalledWith({
        pubkey: 'newcontact-pubkey-is-64-chars-long-----------------------------',
        alias: 'Charlie',
      });
    });
    expect(vi.mocked(global.sonner.toast.success).mock.calls[0][0]).toContain('Contact Charlie added!');
  });

  it('validates nostr public key format on add', async () => {
    render(<ContactsPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Add Contact/i }));

    const pubkeyInput = screen.getByLabelText(/Nostr Public Key/i);
    const addButtonInModal = screen.getByRole('button', { name: 'Add Contact' }); // Modal's add button

    fireEvent.change(pubkeyInput, { target: { value: 'invalid-pubkey' } });
    fireEvent.click(addButtonInModal);

    await waitFor(() => {
        expect(vi.mocked(global.sonner.toast.error).mock.calls[0][0]).toContain('Invalid Nostr public key format.');
    });
    expect(mockAddContact).not.toHaveBeenCalled();
  });


  it('allows editing a contact alias', async () => {
    setupMockStore(mockUserWithContacts);
    mockUpdateContactAlias.mockResolvedValue(undefined);
    render(<ContactsPanel />);

    const aliceContactRow = screen.getByText('Alice').closest('div'); // Find the row containing "Alice"
    // Find the edit button within Alice's row. A more robust selector (e.g., data-testid) is preferred.
    const editButtons = aliceContactRow ? aliceContactRow.querySelectorAll('button') : [];
    const editButton = Array.from(editButtons).find(btn => btn.querySelector('svg[lucide="edit-3"]'));

    if (!editButton) throw new Error("Edit button for Alice not found. Consider adding data-testid attributes for robust testing.");
    fireEvent.click(editButton);

    const aliasInput = aliceContactRow?.querySelector('input[value="Alice"]'); // Input should have current alias
    if (!aliasInput) throw new Error("Alias input for Alice not found after clicking edit. Check input's default value or selector.");

    fireEvent.change(aliasInput, { target: { value: 'Alice Smith' } });

    const saveButtons = aliceContactRow ? aliceContactRow.querySelectorAll('button') : [];
    const saveButton = Array.from(saveButtons).find(btn => btn.querySelector('svg[lucide="check"]'));
    if (!saveButton) throw new Error("Save button for Alice not found. Consider adding data-testid.");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateContactAlias).toHaveBeenCalledWith('contact1-pubkey', 'Alice Smith');
    });
    expect(vi.mocked(global.sonner.toast.success).mock.calls[0][0]).toContain('Alias updated.');
  });

  it('allows removing a contact', async () => {
    setupMockStore(mockUserWithContacts);
    mockRemoveContact.mockResolvedValue(undefined);
    window.confirm = vi.fn(() => true); // Auto-confirm deletion

    render(<ContactsPanel />);

    const bobContactRow = screen.getByText('Bob').closest('div');
    const removeButtons = bobContactRow ? bobContactRow.querySelectorAll('button') : [];
    const removeButton = Array.from(removeButtons).find(btn => btn.querySelector('svg[lucide="trash-2"]'));

    if (!removeButton) throw new Error("Remove button for Bob not found. Consider adding data-testid.");
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(mockRemoveContact).toHaveBeenCalledWith('contact2-pubkey');
    });
    expect(window.confirm).toHaveBeenCalled();
    expect(vi.mocked(global.sonner.toast.success).mock.calls[0][0]).toContain('Contact removed.');
  });

  it('opens DM modal when DM button is clicked for a contact', () => {
    setupMockStore(mockUserWithContacts);
    render(<ContactsPanel />);

    const bobContactRow = screen.getByText('Bob').closest('div[class*="border rounded-lg"]');
    const dmButton = bobContactRow?.querySelector('button[aria-label*="DM Bob"]'); // Or more generic if no aria-label like that

    if (!dmButton) {
        // Fallback if specific aria-label isn't there, find button with "DM" text within the row
        const allDmButtons = bobContactRow?.querySelectorAll('button');
        const actualDmButton = Array.from(allDmButtons || []).find(btn => btn.textContent?.includes("DM"));
        if (!actualDmButton) throw new Error("DM button for Bob not found");
        fireEvent.click(actualDmButton);
    } else {
        fireEvent.click(dmButton);
    }

    // Check if the DM modal for Bob is open
    expect(screen.getByRole('dialog', { name: /Send Direct Message/i })).toBeInTheDocument();
    expect(screen.getByText(/To: Bob/i)).toBeInTheDocument(); // Check if recipient is correct
  });

   it('SendDmModal allows sending a message', async () => {
    setupMockStore({ ...mockUserWithContacts, nostrPubkey: 'test-user-pubkey' }); // Ensure current user has pubkey
    mockSendDirectMessage.mockResolvedValue(undefined);
    render(<ContactsPanel />);

    // Open DM modal for Alice
    const aliceContactRow = screen.getByText('Alice').closest('div[class*="border rounded-lg"]');
    const dmButtonAlice = Array.from(aliceContactRow?.querySelectorAll('button') || []).find(btn => btn.textContent?.includes("DM"));
    if (!dmButtonAlice) throw new Error("DM button for Alice not found");
    fireEvent.click(dmButtonAlice);

    const messageInput = screen.getByPlaceholderText(/Your encrypted message.../i);
    const sendButtonInModal = screen.getByRole('button', { name: /Send/i });

    fireEvent.change(messageInput, { target: { value: 'Hello Alice!' } });
    fireEvent.click(sendButtonInModal);

    await waitFor(() => {
      expect(mockSendDirectMessage).toHaveBeenCalledWith('contact1-pubkey', 'Hello Alice!');
    });
    expect(vi.mocked(global.alert).mock.calls[0][0]).toContain('Direct Message sent to Alice');
  });

});

// Minimalist mock for global.alert for these tests
// In a real setup, you might use a more sophisticated way or check for toasts
global.alert = vi.fn();
