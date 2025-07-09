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

describe('SettingsPanel Minimal Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      userProfile: JSON.parse(JSON.stringify(initialUserProfile)),
      nostrRelays: ['wss://relay.damus.io'],
      // Mock essential functions used by SettingsPanel if any are called during initial render
      generateAndStoreNostrKeys: vi.fn().mockResolvedValue('new-test-pubkey'),
      logoutFromNostr: vi.fn().mockResolvedValue(undefined),
      addNostrRelay: vi.fn(),
      removeNostrRelay: vi.fn(),
      updateUserProfile: vi.fn((updates) => { // Renamed from storeUpdateUserProfile for clarity
        const currentProfile = useAppStore.getState().userProfile || initialUserProfile;
        const newProfile = { ...currentProfile, ...updates };
        useAppStore.setState({ userProfile: newProfile as UserProfile });
      }),
       // Mock DBService to avoid side effects if SettingsPanel calls it directly
      // This is a simplified approach; ideally, specific DBService functions are mocked
      // DBService: {
      //   exportData: vi.fn(),
      //   importData: vi.fn(),
      //   clearAllData: vi.fn()
      // } // This line is problematic, DBService is not part of store state. Mock it directly.
    });
  });

  // Mock DBService globally for this test file
  vi.mock('../services/db', () => ({
    DBService: {
      exportData: vi.fn().mockResolvedValue({ notes: [], ontology: { nodes: {}, rootIds: [] } }),
      importData: vi.fn().mockResolvedValue(undefined),
      clearAllData: vi.fn().mockResolvedValue(undefined),
    },
  }));


  it('renders the SettingsPanel title (Appearance section)', () => {
    render(<SettingsPanel />);
    // Look for a very basic, static element.
    // The "Appearance" card title is a good candidate.
    expect(screen.getByText('Appearance')).toBeInTheDocument();
  });
});
