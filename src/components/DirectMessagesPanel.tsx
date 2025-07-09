import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAppStore } from '../store';
import { DirectMessage, UserProfile } from '../../shared/types';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Send, UserPlus, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import { nostrService } from '../services/NostrService'; // For validating pubkeys, etc.

// Helper to get a short representation of a pubkey
const shortenPubkey = (pubkey: string, length = 8) => `${pubkey.substring(0, length)}...${pubkey.substring(pubkey.length - length)}`;

// Helper to get a placeholder for avatar
const getAvatarFallback = (pubkey: string) => pubkey.substring(0, 2).toUpperCase();

export function DirectMessagesPanel() {
  const {
    userProfile,
    directMessages,
    sendDirectMessage, // This action needs to be created in the store
    subscribeToDirectMessages, // This action needs to be created for receiving DMs
    unsubscribeFromNostr, // To manage DM subscriptions
  } = useAppStore();

  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const [newMessageContent, setNewMessageContent] = useState('');
  const [newPeerPubkey, setNewPeerPubkey] = useState('');

  // Ref for the scrollable container of messages
  const messagesScrollParentRef = useRef<HTMLDivElement>(null);


  // Subscription management
  const dmSubscriptionId = useRef<string | null>(null);

  useEffect(() => {
    if (userProfile?.nostrPubkey && subscribeToDirectMessages) {
      const subId = subscribeToDirectMessages();
      if (subId) {
        dmSubscriptionId.current = subId;
      }
    }
    return () => {
      if (dmSubscriptionId.current && unsubscribeFromNostr) {
        unsubscribeFromNostr(dmSubscriptionId.current);
        dmSubscriptionId.current = null;
      }
    };
  }, [userProfile?.nostrPubkey, subscribeToDirectMessages, unsubscribeFromNostr]);

  const conversations = useMemo(() => {
    if (!userProfile) return {};
    const convos: { [peerPubkey: string]: { messages: DirectMessage[], lastMessageTimestamp: Date, unreadCount: number } } = {};

    directMessages.forEach(dm => {
      const peer = dm.from === userProfile.nostrPubkey ? dm.to : dm.from;
      if (!convos[peer]) {
        convos[peer] = { messages: [], lastMessageTimestamp: dm.timestamp, unreadCount: 0 }; // Placeholder for unread
      }
      convos[peer].messages.push(dm);
      if (dm.timestamp > convos[peer].lastMessageTimestamp) {
        convos[peer].lastMessageTimestamp = dm.timestamp;
      }
      // TODO: Implement unread count logic
    });

    // Sort messages within each conversation
    for (const peer in convos) {
      convos[peer].messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }
    return convos;
  }, [directMessages, userProfile]);

  const sortedPeers = useMemo(() => {
    return Object.keys(conversations).sort((a, b) =>
      conversations[b].lastMessageTimestamp.getTime() - conversations[a].lastMessageTimestamp.getTime()
    );
  }, [conversations]);

  const currentChatMessages = useMemo(() => {
    return selectedPeer ? conversations[selectedPeer]?.messages || [] : [];
  }, [selectedPeer, conversations]);

  // Virtualizer for messages
  const rowVirtualizer = useVirtualizer({
    count: currentChatMessages.length,
    getScrollElement: () => messagesScrollParentRef.current,
    estimateSize: useCallback(() => 70, []), // Estimate 70px per message row, adjust as needed
    overscan: 10,
  });

  useEffect(() => {
    // Scroll to bottom when new messages arrive or chat is selected
    if (currentChatMessages.length > 0) {
      rowVirtualizer.scrollToIndex(currentChatMessages.length - 1, { align: 'end', behavior: 'smooth' });
    }
  }, [currentChatMessages, rowVirtualizer]);

  const handleSendMessage = async () => {
    if (!selectedPeer || !newMessageContent.trim() || !userProfile?.nostrPubkey || !sendDirectMessage) return;

    try {
      await sendDirectMessage(selectedPeer, newMessageContent.trim());
      setNewMessageContent('');
    } catch (error) {
      console.error("Failed to send DM:", error);
      alert(`Failed to send message: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleStartNewConversation = () => {
    if (!newPeerPubkey.trim()) {
      alert("Please enter a Nostr public key.");
      return;
    }
    // Basic validation (could be more robust, e.g., using nostr-tools to parse/validate)
    if (!newPeerPubkey.match(/^[a-f0-9]{64}$/) && !newPeerPubkey.startsWith('npub1')) {
        alert("Invalid Nostr public key format.");
        return;
    }
    // If it's an npub, it should be converted to hex by the service/store later.
    // For now, we'll use it as is.

    const actualPubkey = newPeerPubkey.startsWith('npub1')
      ? nostrService.decodeNpub(newPeerPubkey) // Assuming a method like this exists or is added
      : newPeerPubkey;

    if (!actualPubkey) {
        alert("Invalid npub key.");
        return;
    }

    if (actualPubkey === userProfile?.nostrPubkey) {
      alert("You cannot start a conversation with yourself.");
      return;
    }

    setSelectedPeer(actualPubkey);
    setNewPeerPubkey('');
  };

  const handleSelectPeer = (peer: string) => {
    setSelectedPeer(peer);
    // TODO: Mark messages as read
  };

  if (!userProfile?.nostrPubkey) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Please set up your Nostr identity in Settings to use Direct Messages.
      </div>
    );
  }

  // Add a decodeNpub method to NostrService for the UI to use if npubs are entered.
  // This is a bit of a hack for now, ideally the input field is smarter or validation is more robust.
  if (!nostrService.decodeNpub) {
    (nostrService as any).decodeNpub = (npub: string) => {
      try {
        // This is a simplified conceptual placeholder.
        // `nostr-tools` does not export `nip19.decode` directly in all versions or contexts easily.
        // A real implementation would use a robust NIP-19 decoding library or function.
        // For now, assume if it starts with npub1 and is 63 chars long, it's "valid enough" for this UI example.
        if (npub.startsWith('npub1') && npub.length === 63) {
          // This is NOT a real decoding. Placeholder.
          // A proper solution would involve bech32 decoding.
          // For the sake of UI flow, we'll return a hex-like string.
          // This part MUST be replaced with actual NIP-19 decoding.
          console.warn("NIP-19 npub decoding is a placeholder. Replace with actual implementation.");
          return `decoded_${npub.substring(5)}`; // Placeholder
        }
        return npub; // If not npub, assume hex
      } catch (e) {
        console.error("Failed to decode npub (placeholder error):", e);
        return null;
      }
    };
  }


  return (
    <div className="flex h-full border-t">
      {/* Sidebar for conversations list */}
      <div className="w-1/3 min-w-[250px] max-w-[350px] border-r flex flex-col bg-card">
        <CardHeader className="p-3">
          <CardTitle className="text-base flex items-center justify-between">
            Conversations
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <UserPlus size={16} />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Start New Chat</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-3">
                  <Label htmlFor="newPeerPubkey">Recipient's Nostr Public Key (hex or npub)</Label>
                  <Input
                    id="newPeerPubkey"
                    value={newPeerPubkey}
                    onChange={(e) => setNewPeerPubkey(e.target.value)}
                    placeholder="Enter public key..."
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                  <Button onClick={handleStartNewConversation}>Start Chat</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <ScrollArea className="flex-1">
          {sortedPeers.length === 0 && (
            <p className="p-3 text-xs text-muted-foreground text-center">No conversations yet. Start a new chat!</p>
          )}
          {sortedPeers.map(peer => (
            <div
              key={peer}
              className={`p-3 cursor-pointer hover:bg-accent ${selectedPeer === peer ? 'bg-accent' : ''}`}
              onClick={() => handleSelectPeer(peer)}
            >
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  {/* <AvatarImage src={conversations[peer].avatarUrl} /> Placeholder for actual avatar */}
                  <AvatarFallback>{getAvatarFallback(peer)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 truncate">
                  <p className="text-sm font-medium truncate">{shortenPubkey(peer)}</p>
                  {conversations[peer].messages.length > 0 && (
                     <p className="text-xs text-muted-foreground truncate">
                        {conversations[peer].messages[conversations[peer].messages.length - 1].content}
                     </p>
                  )}
                </div>
                {/* Unread count badge placeholder */}
                {/* {conversations[peer].unreadCount > 0 && <Badge variant="destructive">{conversations[peer].unreadCount}</Badge>} */}
              </div>
            </div>
          ))}
        </ScrollArea>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {selectedPeer ? (
          <>
            <CardHeader className="p-3 border-b">
              <div className="flex items-center gap-2">
                 <Avatar className="h-8 w-8">
                    <AvatarFallback>{getAvatarFallback(selectedPeer)}</AvatarFallback>
                 </Avatar>
                <CardTitle className="text-base font-medium">{shortenPubkey(selectedPeer)}</CardTitle>
              </div>
            </CardHeader>
            {/* Scrollable area for messages, now using the ref for virtualizer */}
            <ScrollArea className="flex-1 bg-muted/20" ref={messagesScrollParentRef}>
              <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map(virtualItem => {
                  const dm = currentChatMessages[virtualItem.index];
                  if (!dm) return null;
                  return (
                    <div
                      key={dm.id}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                        padding: '0.375rem 0.75rem', // Equivalent to p-3 on individual items, adjusted for container
                      }}
                      className={`flex ${dm.from === userProfile.nostrPubkey ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] p-2 rounded-lg text-sm ${
                          dm.from === userProfile.nostrPubkey
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-card border'
                        }`}
                      >
                        <p>{dm.content}</p>
                        <p className={`text-xs mt-1 ${dm.from === userProfile.nostrPubkey ? 'text-primary-foreground/70' : 'text-muted-foreground/70'}`}>
                          {new Date(dm.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <div className="p-3 border-t bg-background">
              <div className="flex items-center gap-2">
                <Textarea
                  value={newMessageContent}
                  onChange={(e) => setNewMessageContent(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 resize-none min-h-[40px] max-h-[120px]"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button onClick={handleSendMessage} disabled={!newMessageContent.trim()}>
                  <Send size={16} />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/20">
            <MessageSquare size={48} className="mb-4 opacity-50" />
            <p>Select a conversation or start a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
