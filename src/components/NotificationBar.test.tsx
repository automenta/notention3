import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { NotificationBar } from './NotificationBar';
import { useAppStore } from '../store';
import { DirectMessage, Match } from '../../shared/types';

// Mock Zustand store
const mockSetSidebarTab = vi.fn();
let mockDirectMessages: DirectMessage[] = [];
let mockMatches: Match[] = [];

vi.mock('../store', () => ({
  useAppStore: vi.fn(selector => selector({
    directMessages: mockDirectMessages,
    matches: mockMatches,
    setSidebarTab: mockSetSidebarTab,
    userProfile: { nostrPubkey: 'userPubkey' },
  })),
}));

describe.skip('NotificationBar', () => {
  beforeEach(() => {
    mockDirectMessages = [];
    mockMatches = [];
    mockSetSidebarTab.mockClear();
    // Reset the Zustand store state for each test if useAppStore directly returns values
     useAppStore.setState({
      directMessages: [],
      matches: [],
      setSidebarTab: mockSetSidebarTab,
      userProfile: { nostrPubkey: 'userPubkey' },
      // Ensure other relevant parts of the state are initialized if NotificationBar uses them
      // For this component, directMessages, matches, setSidebarTab, userProfile are primary.
    });
    vi.useFakeTimers(); // Use fake timers for auto-dismiss
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers(); // Restore real timers
  });

  it('should not render if there are no notifications', () => {
    render(<NotificationBar />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should render a notification for a new direct message', () => {
    const newDm: DirectMessage = {
      id: 'dm1',
      from: 'senderPubkey',
      to: 'userPubkey',
      content: 'Hello there!',
      timestamp: new Date(),
      encrypted: true,
    };

    // Initial render with no messages
    const { rerender } = render(<NotificationBar />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // Update store state as if a new DM arrived
    act(() => {
      useAppStore.setState({ directMessages: [newDm], matches: [] });
    });
    rerender(<NotificationBar />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(`New Message from ${newDm.from.substring(0, 8)}...`)).toBeInTheDocument();
    expect(screen.getByText(newDm.content)).toBeInTheDocument();
  });

  it('should render a notification for a new match', () => {
    const newMatch: Match = {
      id: 'match1',
      targetNoteId: 'noteX',
      targetAuthor: 'authorPubkey',
      similarity: 0.8,
      sharedTags: ['#test', '#nostr'],
      sharedValues: {},
      timestamp: new Date(),
    };

    const { rerender } = render(<NotificationBar />);
     expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    act(() => {
      useAppStore.setState({ directMessages: [], matches: [newMatch] });
    });
    rerender(<NotificationBar />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('New Network Match!')).toBeInTheDocument();
    expect(screen.getByText(`Found a match for tags: ${newMatch.sharedTags.join(', ')}`)).toBeInTheDocument();
  });

  it('should dismiss notification on click', () => {
    const newDm: DirectMessage = { id: 'dm1', from: 's', to: 'u', content: 'Hi', timestamp: new Date(), encrypted: true };
    act(() => {
      useAppStore.setState({ directMessages: [newDm] });
    });
    render(<NotificationBar />);

    const notificationAlert = screen.getByRole('alert');
    expect(notificationAlert).toBeInTheDocument();

    fireEvent.click(notificationAlert);
    expect(mockSetSidebarTab).toHaveBeenCalledWith('network'); // Assuming DM click navigates to network
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should dismiss notification on close button click', () => {
     const newMatch: Match = { id: 'm1', targetNoteId: 'tn', targetAuthor: 'ta', similarity: 0.1, sharedTags: ['#t'], sharedValues: {}, timestamp: new Date() };
    act(() => {
      useAppStore.setState({ matches: [newMatch] });
    });
    render(<NotificationBar />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    const closeButton = screen.getByRole('button', { name: /dismiss notification/i }); // Assuming an accessible name for the close button
    fireEvent.click(closeButton);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should auto-dismiss notification after timeout', () => {
    const newDm: DirectMessage = { id: 'dm1', from: 's', to: 'u', content: 'Auto dismiss test', timestamp: new Date(), encrypted: true };
    act(() => {
      useAppStore.setState({ directMessages: [newDm] });
    });
    render(<NotificationBar />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(7000); // As per 7 seconds timeout in component
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should not show notification for own DMs', () => {
    const ownDm: DirectMessage = {
      id: 'dm_own',
      from: 'userPubkey', // Message from self
      to: 'anotherUser',
      content: 'This is a test message to myself.',
      timestamp: new Date(),
      encrypted: true,
    };
     act(() => {
      useAppStore.setState({ directMessages: [ownDm], userProfile: { nostrPubkey: 'userPubkey' } });
    });
    render(<NotificationBar />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

});
