import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsPanel } from './SettingsPanel';
import { useAppStore } from '../store';
import { UserProfile } from '../../shared/types';

// Minimal initial state
const initialUserProfile: UserProfile = {
  nostrPubkey: 'test-pubkey',
  sharedTags: [],
  preferences: {
    theme: 'light',
    aiEnabled: false,
    defaultNoteStatus: 'draft',
  },
  nostrRelays: [],
  privacySettings: {
    sharePublicNotesGlobally: false,
    shareTagsWithPublicNotes: true,
    shareValuesWithPublicNotes: true,
  },
};

import { fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'sonner'; // For checking toast messages

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

// Mock window.confirm
global.confirm = vi.fn(() => true); // Default to true (user confirms)
global.alert = vi.fn();


// More comprehensive initial state
const getMockUserProfile = (overrides: Partial<UserProfile['preferences']> = {}): UserProfile => ({
  nostrPubkey: 'test-pubkey-123',
  sharedTags: [],
  preferences: {
    theme: 'light',
    aiEnabled: false,
    defaultNoteStatus: 'draft',
    ollamaApiEndpoint: 'http://localhost:11434',
    ollamaEmbeddingModel: 'nomic-embed-text',
    ollamaChatModel: 'llama3',
    geminiApiKey: '',
    geminiEmbeddingModel: 'embedding-001',
    geminiChatModel: 'gemini-pro',
    aiProviderPreference: 'ollama',
    ...overrides,
  },
  nostrRelays: ['wss://relay.damus.io', 'wss://relay.nostr.band'],
  privacySettings: {
    sharePublicNotesGlobally: false,
    shareTagsWithPublicNotes: true,
    shareValuesWithPublicNotes: true,
  },
});


describe('SettingsPanel', () => {
  let mockGenerateAndStoreNostrKeys: ReturnType<typeof vi.fn>;
  let mockLogoutFromNostr: ReturnType<typeof vi.fn>;
  let mockAddNostrRelay: ReturnType<typeof vi.fn>;
  let mockRemoveNostrRelay: ReturnType<typeof vi.fn>;
  let mockUpdateUserProfile: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks(); // Clear all mocks including toast, confirm, etc.

    mockGenerateAndStoreNostrKeys = vi.fn();
    mockLogoutFromNostr = vi.fn().mockResolvedValue(undefined);
    mockAddNostrRelay = vi.fn();
    mockRemoveNostrRelay = vi.fn();
    mockUpdateUserProfile = vi.fn((profileUpdates) => {
      const currentProfile = useAppStore.getState().userProfile || getMockUserProfile();
      const newPreferences = { ...currentProfile.preferences, ...profileUpdates.preferences };
      const newPrivacySettings = { ...currentProfile.privacySettings, ...profileUpdates.privacySettings };
      const updatedProfile = { ...currentProfile, ...profileUpdates, preferences: newPreferences, privacySettings: newPrivacySettings };
      useAppStore.setState({ userProfile: updatedProfile });
    });

    useAppStore.setState({
      userProfile: getMockUserProfile(),
      nostrRelays: getMockUserProfile().nostrRelays!, // Use relays from profile
      generateAndStoreNostrKeys: mockGenerateAndStoreNostrKeys,
      logoutFromNostr: mockLogoutFromNostr,
      addNostrRelay: mockAddNostrRelay,
      removeNostrRelay: mockRemoveNostrRelay,
      updateUserProfile: mockUpdateUserProfile, // This is the store's main updateUserProfile
    });
  });

  // Mock DBService globally for this test file
  const mockDBService = {
    exportData: vi.fn().mockResolvedValue({ notes: [], ontology: { nodes: {}, rootIds: [] } }),
    importData: vi.fn().mockResolvedValue(undefined),
    clearAllData: vi.fn().mockResolvedValue(undefined),
  };
  vi.mock('../services/db', () => ({
    DBService: mockDBService,
  }));

  it('renders Appearance settings and toggles dark mode', () => {
    render(<SettingsPanel />);
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    const darkModeSwitch = screen.getByRole('switch', { name: /Dark Mode/i });
    expect(darkModeSwitch).not.toBeChecked();

    fireEvent.click(darkModeSwitch);
    expect(mockUpdateUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: expect.objectContaining({ theme: 'dark' }),
      })
    );
    // To verify document.documentElement.classList.toggle, we might need to check it directly
    // or ensure the store state reflects the change which then triggers the effect.
    // For simplicity, checking the store call is usually sufficient for unit tests.
  });

  it('renders AI Features settings and toggles AI enabled', () => {
    render(<SettingsPanel />);
    const aiEnableSwitch = screen.getByRole('switch', { name: /Enable AI/i });
    expect(aiEnableSwitch).not.toBeChecked(); // Based on default getMockUserProfile

    fireEvent.click(aiEnableSwitch);
    expect(mockUpdateUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: expect.objectContaining({ aiEnabled: true }),
      })
    );
  });

  it('updates Ollama API endpoint when AI is enabled', async () => {
    useAppStore.setState({ userProfile: getMockUserProfile({ aiEnabled: true }) });
    render(<SettingsPanel />);

    const ollamaEndpointInput = screen.getByLabelText(/Ollama API Endpoint/i);
    fireEvent.change(ollamaEndpointInput, { target: { value: 'http://new-ollama:11434' } });

    // The actual update to the store happens on blur or other events if debounced.
    // Here, it's direct onChange.
    await waitFor(() => {
      expect(mockUpdateUserProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          preferences: expect.objectContaining({ ollamaApiEndpoint: 'http://new-ollama:11434' }),
        })
      );
    });
  });

  it('updates Gemini API Key when AI is enabled', async () => {
    useAppStore.setState({ userProfile: getMockUserProfile({ aiEnabled: true }) });
    render(<SettingsPanel />);
    const geminiKeyInput = screen.getByLabelText(/Google Gemini API Key/i);
    fireEvent.change(geminiKeyInput, { target: { value: 'new-gemini-key' } });
    await waitFor(() => {
      expect(mockUpdateUserProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          preferences: expect.objectContaining({ geminiApiKey: 'new-gemini-key' }),
        })
      );
    });
  });

  it('updates AI provider preference', async () => {
    useAppStore.setState({ userProfile: getMockUserProfile({ aiEnabled: true }) });
    render(<SettingsPanel />);
    const providerSelect = screen.getByLabelText(/Preferred AI Provider/i);
    fireEvent.change(providerSelect, { target: { value: 'gemini' } });
    await waitFor(() => {
      expect(mockUpdateUserProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          preferences: expect.objectContaining({ aiProviderPreference: 'gemini' }),
        })
      );
    });
  });


  it('adds and removes Nostr relays', () => {
    render(<SettingsPanel />);
    const relayInput = screen.getByPlaceholderText('wss://your.relay.com');
    const addButton = screen.getByRole('button', { name: /Add/i });

    fireEvent.change(relayInput, { target: { value: 'wss://new.relay.com' } });
    fireEvent.click(addButton);
    expect(mockAddNostrRelay).toHaveBeenCalledWith('wss://new.relay.com');

    // Test removing a relay (assuming one is displayed)
    // Need to ensure a relay is in the list to find its remove button
    const removeButtons = screen.getAllByRole('button', { name: /trash-2/i }); // Lucide icon name
    if (removeButtons.length > 0) {
      fireEvent.click(removeButtons[0]); // Click the first remove button
      // Expect removeNostrRelay to be called with the URL of the first relay
      expect(mockRemoveNostrRelay).toHaveBeenCalledWith(getMockUserProfile().nostrRelays![0]);
    }
  });

  it('handles data export', async () => {
    // Mock URL.createObjectURL and a.click for download simulation
    global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock-url');
    const mockAnchorClick = vi.fn();
    const mockAnchor = { href: '', download: '', click: mockAnchorClick, remove: vi.fn() };
    document.createElement = vi.fn(() => mockAnchor as any);
    document.body.appendChild = vi.fn();
    document.body.removeChild = vi.fn();


    render(<SettingsPanel />);
    const exportButton = screen.getByRole('button', { name: /Export Data/i });
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(mockDBService.exportData).toHaveBeenCalled();
    });
    expect(mockAnchor.download).toContain('notention-backup-');
    expect(mockAnchorClick).toHaveBeenCalled();
  });

  it('handles clear all data with confirmation', async () => {
    render(<SettingsPanel />);
    const clearButton = screen.getByRole('button', { name: /Clear All Data/i });

    fireEvent.click(clearButton);
    expect(global.confirm).toHaveBeenCalledWith('Are you sure you want to clear all data? This cannot be undone.');

    await waitFor(() => {
      expect(mockDBService.clearAllData).toHaveBeenCalled();
    });
    expect(global.alert).toHaveBeenCalledWith('All data cleared! Please refresh the page.');
  });

  it('opens generate new keys backup modal when generate new keys is clicked and successful', async () => {
    mockGenerateAndStoreNostrKeys.mockResolvedValue({ publicKey: 'new-pk', privateKey: 'new-sk-nsec1...' });
    render(<SettingsPanel />);
    const generateKeysButton = screen.getByRole('button', { name: /Generate New Keys/i });

    fireEvent.click(generateKeysButton); // This button is inside the "Identity & Keys" card
    // Confirm the initial dialog
    expect(global.confirm).toHaveBeenCalled();


    await waitFor(() => {
        // Check if the backup modal title is present
        expect(screen.getByText('IMPORTANT: Back Up Your New Private Key')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('new-pk')).toBeInTheDocument(); // Public key display
    expect(screen.getByDisplayValue('new-sk-nsec1...')).toBeInTheDocument(); // Private key display
  });

  it('opens import private key modal', async () => {
    render(<SettingsPanel />);
    const importKeyButton = screen.getByRole('button', { name: /Import Existing Private Key/i });
    fireEvent.click(importKeyButton);
    await waitFor(() => {
        expect(screen.getByRole('dialog', {name: /Import Existing Private Key/i})).toBeInTheDocument();
    });
  });

  it('handles logout', async () => {
    render(<SettingsPanel />);
    const logoutButton = screen.getByRole('button', { name: /Log Out & Clear Keys/i });
    fireEvent.click(logoutButton);
    expect(global.confirm).toHaveBeenCalledWith('Are you sure you want to log out? This will clear your local keys.');
    await waitFor(() => {
        expect(mockLogoutFromNostr).toHaveBeenCalled();
    });
    expect(global.alert).toHaveBeenCalledWith('Logged out successfully.');
  });

  it('updates privacy settings switches', async () => {
    render(<SettingsPanel />);
    const sharePubliclySwitch = screen.getByLabelText(/Share Notes Publicly/i);
    fireEvent.click(sharePubliclySwitch);
    await waitFor(() => {
        expect(mockUpdateUserProfile).toHaveBeenCalledWith(expect.objectContaining({
            privacySettings: expect.objectContaining({ sharePublicNotesGlobally: true })
        }));
    });

    // Enable global sharing to test dependent switches
    useAppStore.setState({ userProfile: getMockUserProfile({ preferences: {}, privacySettings: { sharePublicNotesGlobally: true, shareTagsWithPublicNotes: false, shareValuesWithPublicNotes: false } }) });

    const shareTagsSwitch = screen.getByLabelText(/Share Tags with Public Notes/i);
    expect(shareTagsSwitch).not.toBeDisabled();
    fireEvent.click(shareTagsSwitch);
     await waitFor(() => {
        expect(mockUpdateUserProfile).toHaveBeenCalledWith(expect.objectContaining({
            privacySettings: expect.objectContaining({ shareTagsWithPublicNotes: true })
        }));
    });
  });

});
