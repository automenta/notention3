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
    shareEmbeddingsWithPublicNotes: false, // Add default for the new field
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
    shareEmbeddingsWithPublicNotes: false, // Added new field
  },
});


describe.skip('SettingsPanel', () => {
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

  it('updates Ollama and Gemini model inputs when AI is enabled', async () => {
    useAppStore.setState({ userProfile: getMockUserProfile({ aiEnabled: true }) });
    render(<SettingsPanel />);

    const ollamaChatInput = screen.getByLabelText(/Ollama Chat Model/i);
    fireEvent.change(ollamaChatInput, { target: { value: 'new-ollama-chat' } });
    await waitFor(() => {
      expect(mockUpdateUserProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          preferences: expect.objectContaining({ ollamaChatModel: 'new-ollama-chat' }),
        })
      );
    });

    const ollamaEmbedInput = screen.getByLabelText(/Ollama Embedding Model/i);
    fireEvent.change(ollamaEmbedInput, { target: { value: 'new-ollama-embed' } });
    await waitFor(() => {
      expect(mockUpdateUserProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          preferences: expect.objectContaining({ ollamaEmbeddingModel: 'new-ollama-embed' }),
        })
      );
    });

    const geminiChatInput = screen.getByLabelText(/Gemini Chat Model/i);
    fireEvent.change(geminiChatInput, { target: { value: 'new-gemini-chat' } });
    await waitFor(() => {
      expect(mockUpdateUserProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          preferences: expect.objectContaining({ geminiChatModel: 'new-gemini-chat' }),
        })
      );
    });

    const geminiEmbedInput = screen.getByLabelText(/Gemini Embedding Model/i);
    fireEvent.change(geminiEmbedInput, { target: { value: 'new-gemini-embed' } });
    await waitFor(() => {
      expect(mockUpdateUserProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          preferences: expect.objectContaining({ geminiEmbeddingModel: 'new-gemini-embed' }),
        })
      );
    });
  });

  vi.mock('../services/db', () => {
  const mockDBService = {
    exportData: vi.fn().mockResolvedValue({ notes: [], ontology: { nodes: {}, rootIds: [] } }),
    importData: vi.fn().mockResolvedValue(undefined),
    clearAllData: vi.fn().mockResolvedValue(undefined),
  };
  return {
    DBService: mockDBService,
  };
});

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

    const shareEmbeddingsSwitch = screen.getByLabelText(/Share Embeddings with Public Notes/i);
    // This switch should be disabled if global public sharing is off OR AI is off.
    // In the default mock, global public is false, AI is false. So it should be disabled.
    expect(shareEmbeddingsSwitch).toBeDisabled();

    // Enable global public sharing and AI to test the switch itself
    const profileWithAiAndPublicSharing = getMockUserProfile();
    if (profileWithAiAndPublicSharing.preferences) profileWithAiAndPublicSharing.preferences.aiEnabled = true;
    if (profileWithAiAndPublicSharing.privacySettings) profileWithAiAndPublicSharing.privacySettings.sharePublicNotesGlobally = true;

    useAppStore.setState({ userProfile: profileWithAiAndPublicSharing });

    // Re-render to pick up new state for switch enabled status
    // Note: It's often better to set up the desired state *before* the initial render of a test case
    // if the initial enabled/disabled state is critical.
    // However, if testing dynamic changes, re-rendering or waiting for updates is fine.
    // For this specific test, we'll re-render to ensure the switch is enabled by the new state.
    const { rerender } = render(<SettingsPanel />);
    rerender(<SettingsPanel />); // Rerender with the updated store state.

    const nowEnabledShareEmbeddingsSwitch = screen.getByLabelText(/Share Embeddings with Public Notes/i);
    expect(nowEnabledShareEmbeddingsSwitch).not.toBeDisabled();
    fireEvent.click(nowEnabledShareEmbeddingsSwitch);
    await waitFor(() => {
        expect(mockUpdateUserProfile).toHaveBeenCalledWith(expect.objectContaining({
            privacySettings: expect.objectContaining({ shareEmbeddingsWithPublicNotes: true })
        }));
    });
  });

  // Test for "Import Private Key" modal logic
  it('handles importing a valid private key (nsec)', async () => {
    mockGenerateAndStoreNostrKeys.mockResolvedValue({ publicKey: 'imported-pk', privateKey: undefined });
    render(<SettingsPanel />);

    const importKeyButton = screen.getByRole('button', { name: /Import Existing Private Key/i });
    fireEvent.click(importKeyButton);

    const privateKeyInput = await screen.findByLabelText(/Private Key \(nsec\)/i);
    // More robust selector for the modal's primary action button
    const modalDialog = screen.getByRole('dialog', { name: /Import Existing Private Key/i });
    const modalImportButton = Array.from(modalDialog.querySelectorAll('button')).find(btn => btn.textContent === 'Import Key');

    expect(privateKeyInput).toBeInTheDocument();
    expect(modalImportButton).toBeInTheDocument();

    fireEvent.change(privateKeyInput, { target: { value: 'nsec1validkeyformat' } });

    const mockConfirmImport = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(modalImportButton!);

    expect(mockConfirmImport).toHaveBeenCalledWith(expect.stringContaining('replace your current Nostr identity'));
    await waitFor(() => {
      expect(mockGenerateAndStoreNostrKeys).toHaveBeenCalledWith('nsec1validkeyformat');
    });
    // Check for alert instead of toast for this specific action in component
    expect(global.alert).toHaveBeenCalledWith(expect.stringContaining('Private key imported successfully!'));

    // Check if modal closes by querying for its absence
    await waitFor(() => {
        expect(screen.queryByRole('dialog', {name: /Import Existing Private Key/i})).not.toBeInTheDocument();
    });
    mockConfirmImport.mockRestore();
  });

  it('shows error for invalid nsec format during import', async () => {
    render(<SettingsPanel />);
    const importKeyButton = screen.getByRole('button', { name: /Import Existing Private Key/i });
    fireEvent.click(importKeyButton);

    const privateKeyInput = await screen.findByLabelText(/Private Key \(nsec\)/i);
    const modalDialog = screen.getByRole('dialog', { name: /Import Existing Private Key/i });
    const modalImportButton = Array.from(modalDialog.querySelectorAll('button')).find(btn => btn.textContent === 'Import Key');

    fireEvent.change(privateKeyInput, { target: { value: 'invalidkeyformat' } });
    fireEvent.click(modalImportButton!);

    await waitFor(() => {
      expect(screen.getByText(/Invalid private key format. It should start with 'nsec'./i)).toBeInTheDocument();
    });
    expect(mockGenerateAndStoreNostrKeys).not.toHaveBeenCalled();
  });

  // Test for "New Private Key Backup" modal logic
  it('handles copy and confirmation in new private key backup modal', async () => {
    mockGenerateAndStoreNostrKeys.mockResolvedValue({ publicKey: 'new-pk-for-backup', privateKey: 'nsec1newkeyforbackup' });
    render(<SettingsPanel />);

    const generateKeysButton = screen.getByRole('button', { name: /Generate New Keys/i });
    const mockConfirmGenerate = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(generateKeysButton);
    mockConfirmGenerate.mockRestore();

    await screen.findByText('IMPORTANT: Back Up Your New Private Key');

    const copyButton = screen.getByRole('button', { name: /Copy Private Key/i });
    fireEvent.click(copyButton);
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('nsec1newkeyforbackup');
    });

    const confirmCheckbox = screen.getByLabelText(/I have securely backed up my new private key./i);
    fireEvent.click(confirmCheckbox);

    const confirmBackupButton = screen.getByRole('button', { name: /Confirm Backup & Continue/i });
    expect(confirmBackupButton).not.toBeDisabled();
    fireEvent.click(confirmBackupButton);

    await waitFor(() => {
      expect(screen.queryByText('IMPORTANT: Back Up Your New Private Key')).not.toBeInTheDocument();
    });
    expect(toast.success).toHaveBeenCalledWith("New Nostr identity set up successfully!");
  });

  // Test for "Import Data"
  it('handles data import flow', async () => {
    const mockImportData = { notes: [{id: 'importedNote', title: 'Imported', content: '', tags:[], values:{}, fields:{}, status: 'draft', createdAt: new Date(), updatedAt: new Date() }] };
    const mockFile = new File([JSON.stringify(mockImportData)], 'backup.json', { type: 'application/json' });

    const mockReaderInstance = {
      onload: null as ((e: any) => void) | null,
      readAsText: vi.fn(function(this: any) {
        if (this.onload) {
          this.onload({ target: { result: JSON.stringify(mockImportData) } });
        }
      }),
      onerror: null as (() => void) | null,
    };
    const FileReaderMock = vi.spyOn(global, 'FileReader').mockImplementation(() => mockReaderInstance as any);

    render(<SettingsPanel />);
    const fileInput = document.getElementById('import-file') as HTMLInputElement;

    // Simulate file selection - this will trigger reader.readAsText, then onload
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    await waitFor(() => {
      expect(mockDBService.importData).toHaveBeenCalledWith(mockImportData);
    });
    expect(global.alert).toHaveBeenCalledWith('Data imported successfully! Please refresh the page.');
    FileReaderMock.mockRestore();
  });

  it('disables AI model configuration inputs when AI is globally disabled', () => {
    useAppStore.setState({ userProfile: getMockUserProfile({ aiEnabled: false }) });
    render(<SettingsPanel />);

    expect(screen.getByLabelText(/Ollama API Endpoint/i)).toBeDisabled();
    expect(screen.getByLabelText(/Ollama Chat Model/i)).toBeDisabled();
    expect(screen.getByLabelText(/Ollama Embedding Model/i)).toBeDisabled();
    expect(screen.getByLabelText(/Google Gemini API Key/i)).toBeDisabled();
    expect(screen.getByLabelText(/Gemini Chat Model/i)).toBeDisabled();
    expect(screen.getByLabelText(/Gemini Embedding Model/i)).toBeDisabled();
    expect(screen.getByLabelText(/Preferred AI Provider/i)).toBeDisabled();
    // The AI matching sensitivity slider might also be disabled
    // expect(screen.getByLabelText(/AI Matching Sensitivity/i)).toBeDisabled();
    // Check if it exists first, as it might be conditionally rendered too.
    const sensitivitySlider = screen.queryByLabelText(/AI Matching Sensitivity/i);
    if (sensitivitySlider) {
        expect(sensitivitySlider).toBeDisabled();
    }
  });

  it('shows an error if generating new Nostr keys fails', async () => {
    mockGenerateAndStoreNostrKeys.mockRejectedValueOnce(new Error('Key generation failed'));
    render(<SettingsPanel />);

    const generateKeysButton = screen.getByRole('button', { name: /Generate New Keys/i });
    const mockConfirmGenerate = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(generateKeysButton);
    mockConfirmGenerate.mockRestore(); // Restore after the first confirm

    await waitFor(() => {
      expect(mockGenerateAndStoreNostrKeys).toHaveBeenCalled();
    });
    expect(global.alert).toHaveBeenCalledWith('Error generating new keys: Key generation failed');
    // Ensure backup modal does not show
    expect(screen.queryByText('IMPORTANT: Back Up Your New Private Key')).not.toBeInTheDocument();
  });

  it('does not call addNostrRelay if relay URL is invalid', () => {
    render(<SettingsPanel />);
    const relayInput = screen.getByPlaceholderText('wss://your.relay.com');
    const addButton = screen.getByRole('button', { name: /Add/i });

    fireEvent.change(relayInput, { target: { value: 'http://invalid.relay.com' } }); // Invalid prefix
    fireEvent.click(addButton);

    expect(mockAddNostrRelay).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Invalid relay URL. Must start with wss:// or ws://");
  });
});
