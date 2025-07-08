import React, { useState, useEffect } from 'react';
import { X, Bell, MessageCircle, Zap } from 'lucide-react';
import { Button } from './ui/button';
import { useAppStore } from '../store';
import { DirectMessage, Match } from '../../shared/types';

// Helper to get a short representation of a pubkey
const shortenPubkey = (pubkey: string, length = 8) => `${pubkey.substring(0, length)}...${pubkey.substring(pubkey.length - length)}`;


interface AppNotification {
  id: string;
  type: 'dm' | 'match';
  title: string;
  message: string;
  timestamp: Date;
  relatedId?: string; // e.g., DM sender pubkey or Match ID
}

export function NotificationBar() {
  const { directMessages, matches, setSidebarTab, userProfile } = useAppStore(state => ({
    directMessages: state.directMessages,
    matches: state.matches,
    setSidebarTab: state.setSidebarTab,
    userProfile: state.userProfile,
  }));

  const [activeNotifications, setActiveNotifications] = useState<AppNotification[]>([]);
  const [lastSeenDmCount, setLastSeenDmCount] = useState(0);
  const [lastSeenMatchCount, setLastSeenMatchCount] = useState(0);

  // Initialize last seen counts on mount
  useEffect(() => {
    setLastSeenDmCount(directMessages.length);
    setLastSeenMatchCount(matches.length);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount


  useEffect(() => {
    if (directMessages.length > lastSeenDmCount) {
      const newDms = directMessages.slice(lastSeenDmCount);
      newDms.forEach(dm => {
        // Avoid showing notifications for own messages if they somehow appear in the feed immediately
        if (dm.from !== userProfile?.nostrPubkey) {
          const newNotif: AppNotification = {
            id: `dm-${dm.id}-${Date.now()}`,
            type: 'dm',
            title: `New Message from ${shortenPubkey(dm.from)}`,
            message: dm.content.substring(0, 50) + (dm.content.length > 50 ? '...' : ''),
            timestamp: dm.timestamp,
            relatedId: dm.from, // Store sender's pubkey to navigate to conversation
          };
          // Add to start of array to show newest first, limit to 1 active notification for simplicity
          setActiveNotifications(_prev => [newNotif]);
        }
      });
      setLastSeenDmCount(directMessages.length);
    }
  }, [directMessages, lastSeenDmCount, userProfile?.nostrPubkey]);

  useEffect(() => {
    if (matches.length > lastSeenMatchCount) {
      const newMatches = matches.slice(lastSeenMatchCount);
      newMatches.forEach(match => {
        const newNotif: AppNotification = {
          id: `match-${match.id}-${Date.now()}`,
          type: 'match',
          title: 'New Network Match!',
          message: `Found a match for tags: ${match.sharedTags.join(', ')}`,
          timestamp: match.timestamp,
          relatedId: match.id,
        };
        setActiveNotifications(_prev => [newNotif]);
      });
      setLastSeenMatchCount(matches.length);
    }
  }, [matches, lastSeenMatchCount]);

  const dismissNotification = (id: string) => {
    setActiveNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleNotificationClick = (notification: AppNotification) => {
    if (notification.type === 'dm') {
      // For DMs, we want to switch to the 'network' tab AND select the peer.
      // DirectMessagesPanel is assumed to be part of the 'network' tab or a new 'messages' tab.
      // For now, let's assume 'network' tab houses DMs.
      // Selecting the specific peer within DirectMessagesPanel from here is complex without more state/props drilling.
      // A simpler approach: just go to the panel. The panel itself might highlight the new message.
      setSidebarTab('network');
      // TODO: Add a mechanism to tell DirectMessagesPanel to select `notification.relatedId` (sender pubkey)
    } else if (notification.type === 'match') {
      setSidebarTab('network');
      // TODO: Add a mechanism to tell NetworkPanel to highlight `notification.relatedId` (match ID)
    }
    dismissNotification(notification.id);
  };
  
  // Auto-dismiss notification after some time
  useEffect(() => {
    if (activeNotifications.length > 0) {
      const timer = setTimeout(() => {
        // Dismiss the oldest notification (which is always the first one in this simple setup)
        dismissNotification(activeNotifications[0].id);
      }, 7000); // 7 seconds
      return () => clearTimeout(timer);
    }
  }, [activeNotifications]);


  if (activeNotifications.length === 0) {
    return null; // Don't render anything if no active notifications
  }

  const currentNotification = activeNotifications[0]; // Show one at a time for simplicity

  return (
    <div
      className="fixed top-4 right-4 z-[100] w-auto max-w-sm p-3 rounded-md shadow-lg cursor-pointer
                 bg-background border border-border text-foreground
                 animate-in slide-in-from-top"
      onClick={() => handleNotificationClick(currentNotification)}
    >
      <div className="flex items-start gap-3">
        <div className="mt-1">
        {currentNotification.type === 'dm' && <MessageCircle className="h-5 w-5 text-primary" />}
        {currentNotification.type === 'match' && <Zap className="h-5 w-5 text-accent-foreground" />} {/* Or a different icon for matches */}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{currentNotification.title}</p>
          <p className="text-xs text-muted-foreground">{currentNotification.message}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 -mr-1 -mt-1 text-muted-foreground hover:bg-accent"
          onClick={(e) => {
            e.stopPropagation(); // Prevent click on main notification body
            dismissNotification(currentNotification.id);
          }}
        >
          <X size={14} />
        </Button>
      </div>
    </div>
  );
}