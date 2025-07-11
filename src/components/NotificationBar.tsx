import React, { useState, useEffect } from 'react';
import { X, Bell, MessageCircle, Zap, AlertTriangle } from 'lucide-react'; // Added AlertTriangle for errors
import { Button } from './ui/button';
import { useAppStore } from '../store';
import { DirectMessage, Match } from '../../shared/types';

// Helper to get a short representation of a pubkey
const shortenPubkey = (pubkey: string, length = 8) => `${pubkey.substring(0, length)}...${pubkey.substring(pubkey.length - length)}`;


interface AppNotification {
  id: string;
  type: 'dm' | 'match' | 'error'; // Added 'error' type
  title: string;
  message: string;
  timestamp: Date;
  relatedId?: string; // e.g., DM sender pubkey or Match ID
}

export function NotificationBar() {
  const { directMessages, matches, errors, setSidebarTab, userProfile } = useAppStore(state => ({
    directMessages: state.directMessages,
    matches: state.matches,
    errors: state.errors, // Subscribe to errors
    setSidebarTab: state.setSidebarTab,
    userProfile: state.userProfile,
  }));

  const [activeNotifications, setActiveNotifications] = useState<AppNotification[]>([]);
  const [lastSeenDmCount, setLastSeenDmCount] = useState(0);
  const [lastSeenMatchCount, setLastSeenMatchCount] = useState(0);
  const [lastDismissedErrorIds, setLastDismissedErrorIds] = useState<Set<string>>(new Set());


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

  // Effect for handling store errors
  useEffect(() => {
    const errorKeys = Object.keys(errors) as Array<keyof typeof errors>;
    errorKeys.forEach(key => {
      const errorMessage = errors[key];
      const errorId = `error-${key}-${errorMessage}`; // Create a somewhat unique ID based on key and message content

      if (errorMessage && !activeNotifications.find(n => n.id === errorId) && !lastDismissedErrorIds.has(errorId)) {
        const newErrorNotif: AppNotification = {
          id: errorId,
          type: 'error',
          title: `Error: ${key.charAt(0).toUpperCase() + key.slice(1)}`, // Capitalize key for title
          message: errorMessage,
          timestamp: new Date(),
          relatedId: key, // Store the error key
        };
        // Add to start, but ensure only one error of this exact type/message is shown at a time
        setActiveNotifications(prev => [newErrorNotif, ...prev.filter(n => n.id !== errorId)].slice(0, 3)); // Show up to 3 notifs
      } else if (!errorMessage && activeNotifications.find(n => n.relatedId === key && n.type === 'error')) {
        // Error was cleared in store, remove it from active notifications
        setActiveNotifications(prev => prev.filter(n => !(n.relatedId === key && n.type === 'error')));
      }
    });
  }, [errors, activeNotifications, lastDismissedErrorIds]);


  const dismissNotification = (id: string, isErrorClick: boolean = false) => {
    const notificationToRemove = activeNotifications.find(n => n.id === id);
    setActiveNotifications(prev => prev.filter(n => n.id !== id));
    if (notificationToRemove && notificationToRemove.type === 'error') {
      // If an error notification is dismissed by clicking (implying acknowledgement),
      // add its ID to a temporary "seen" list to prevent it from re-appearing immediately
      // if the error state in the store persists for a bit.
      // A more robust solution would involve the store clearing errors after they are "handled" or timed out.
      if (isErrorClick) {
        setLastDismissedErrorIds(prev => new Set(prev).add(id));
      }
    }
  };

  const handleNotificationClick = (notification: AppNotification) => {
    if (notification.type === 'dm') {
      setSidebarTab('network');
      // TODO: Navigate to specific DM chat
    } else if (notification.type === 'match') {
      setSidebarTab('network');
      // TODO: Highlight specific match
    } else if (notification.type === 'error') {
      // Clicking an error notification dismisses it and marks it as seen for this instance
      dismissNotification(notification.id, true);
      return; // Don't auto-dismiss error on click, manual dismiss is fine
    }
    // For non-error types, dismiss it after click
    dismissNotification(notification.id);
  };
  
  // Auto-dismiss non-error notifications after some time
  useEffect(() => {
    if (activeNotifications.length > 0) {
      const nonErrorNotification = activeNotifications.find(n => n.type !== 'error');
      if (nonErrorNotification) {
        const timer = setTimeout(() => {
          dismissNotification(nonErrorNotification.id);
        }, 7000); // 7 seconds for non-errors
        return () => clearTimeout(timer);
      }
    }
  }, [activeNotifications]);


  if (activeNotifications.length === 0) {
    return null;
  }

  // Render all active notifications, stacked
  return (
    <div className="fixed top-4 right-4 z-[100] w-auto max-w-sm space-y-2">
      {activeNotifications.map((notification) => (
        <div
          key={notification.id}
          className={`p-3 rounded-md shadow-lg cursor-pointer
                     bg-background border text-foreground
                     ${notification.type === 'error' ? 'border-destructive' : 'border-border'}
                     animate-in slide-in-from-top`}
          onClick={() => handleNotificationClick(notification)}
        >
          <div className="flex items-start gap-3">
            <div className="mt-1">
              {notification.type === 'dm' && <MessageCircle className="h-5 w-5 text-primary" />}
              {notification.type === 'match' && <Zap className="h-5 w-5 text-accent-foreground" />}
              {notification.type === 'error' && <AlertTriangle className="h-5 w-5 text-destructive" />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{notification.title}</p>
              <p className="text-xs text-muted-foreground">{notification.message}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mr-1 -mt-1 text-muted-foreground hover:bg-accent"
              onClick={(e) => {
                e.stopPropagation();
                dismissNotification(notification.id, notification.type === 'error');
              }}
            >
              <X size={14} />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}