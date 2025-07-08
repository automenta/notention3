import { Wifi, WifiOff, Users, MessageCircle, Share2, Globe, KeyRound, LogOut, Copy, Hash, Rss, XCircle, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input"; // Added Input
import { useAppStore } from "../store";
import { useEffect, useState } from "react"; // Added useState
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { LoadingSpinner } from "./ui/loading-spinner";
import { NostrEvent } from "../../shared/types"; // For topic notes


export function NetworkPanel() {
  const {
    nostrConnected,
    matches,
    directMessages,
    nostrRelays,
    userProfile,
    errors,
    loading,
    generateAndStoreNostrKeys,
    logoutFromNostr,
    publishCurrentNoteToNostr,
    subscribeToPublicNotes,
    unsubscribeFromNostr,
    initializeNostr,
    subscribeToTopic, // New action from store
    topicNotes,      // New state from store
    addTopicSubscription, // New action
    removeTopicSubscription, // New action
    activeTopicSubscriptions, // New state
  } = useAppStore();

  const [newTopic, setNewTopic] = useState('');

  useEffect(() => {
    if (!userProfile?.nostrPubkey && !loading.network) { // Check loading.network to avoid race condition
        initializeNostr();
    }
  }, [initializeNostr, userProfile?.nostrPubkey, loading.network]);

  const handleToggleConnection = async () => {
    if (nostrConnected && userProfile?.nostrPubkey) {
      // User wants to logout
      await logoutFromNostr();
      toast.info("Logged out from Nostr.");
    } else {
      // User wants to login/generate keys
      const newPublicKey = await generateAndStoreNostrKeys();
      if (newPublicKey) {
        toast.success("Nostr keys generated and logged in!", {
          description: "Make sure to backup your private key if prompted (not implemented yet).",
        });
      } else {
        toast.error("Failed to generate Nostr keys.", {
          description: errors.network || "An unknown error occurred."
        });
      }
    }
  };

  const handlePublishCurrentNote = async () => {
    if (!userProfile?.nostrPubkey) {
      toast.error("Please connect to Nostr first (generate keys).");
      return;
    }
    toast.info("Publishing current note...", { id: "publish-note-toast" });
    try {
      await publishCurrentNoteToNostr({}); // Default public publish
      toast.success("Note published to Nostr!", { id: "publish-note-toast" });
    } catch (e: any) {
      toast.error("Failed to publish note.", { id: "publish-note-toast", description: e.message || errors.network });
    }
  };

  let publicNotesSubId: string | null = null;
  const handleBrowsePublicNotes = () => {
    if (publicNotesSubId) {
        unsubscribeFromNostr(publicNotesSubId);
        publicNotesSubId = null;
        toast.info("Stopped browsing public notes.");
        // TODO: Clear displayed public notes if any
        return;
    }
    // For now, this just logs to console via handleIncomingNostrEvent in store
    const subId = subscribeToPublicNotes();
    if (subId) {
        publicNotesSubId = subId;
        toast.success("Subscribed to public notes feed.", { description: "Check console for incoming events."});
    } else {
        toast.error("Failed to subscribe to public notes.", { description: errors.network });
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
      .then(() => toast.success(`${type} copied to clipboard!`))
      .catch(() => toast.error(`Failed to copy ${type}.`));
  };

  const handleSubscribeToNewTopic = () => {
    if (!newTopic.trim()) {
      toast.error("Please enter a topic to subscribe.");
      return;
    }
    if (!userProfile?.nostrPubkey) {
      toast.error("Connect to Nostr to subscribe to topics.");
      return;
    }
    const topicToSubscribe = newTopic.startsWith('#') ? newTopic : `#${newTopic}`;

    // Check if already subscribed via the specific topic subscription mechanism
    if (activeTopicSubscriptions[topicToSubscribe]) {
        toast.info(`Already subscribed to ${topicToSubscribe}.`);
        setNewTopic('');
        return;
    }

    const subId = subscribeToTopic(topicToSubscribe); // This function is from the store
    if (subId) {
      addTopicSubscription(topicToSubscribe, subId); // Store the specific topic subscription
      toast.success(`Subscribed to topic: ${topicToSubscribe}`);
      setNewTopic('');
    } else {
      toast.error(`Failed to subscribe to topic: ${topicToSubscribe}`, { description: errors.network });
    }
  };

  const handleUnsubscribeFromTopic = (topic: string) => {
    const subId = activeTopicSubscriptions[topic];
    if (subId) {
      unsubscribeFromNostr(subId); // Use the general unsubscribe action
      removeTopicSubscription(topic); // Remove from our specific tracking
      toast.info(`Unsubscribed from topic: ${topic}`);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };


  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {errors.network && (
          <Alert variant="destructive">
            <AlertTitle>Network Error</AlertTitle>
            <AlertDescription>{errors.network}</AlertDescription>
          </Alert>
        )}

        {/* Connection Status & Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              Nostr Identity
              {loading.network && <LoadingSpinner className="w-5 h-5" />}
            </CardTitle>
            <CardDescription>
              Manage your Nostr keys and connection status.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {userProfile?.nostrPubkey ? (
              <>
                <div className="flex items-center gap-2">
                  <Wifi size={20} className="text-green-500" />
                  <span className="font-medium">Connected</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="flex items-center">
                    Public Key: {userProfile.nostrPubkey.substring(0, 16)}...{userProfile.nostrPubkey.substring(userProfile.nostrPubkey.length - 8)}
                    <Button variant="ghost" size="icon" className="ml-2 h-5 w-5" onClick={() => copyToClipboard(userProfile.nostrPubkey!, 'Public Key')}>
                      <Copy size={12} />
                    </Button>
                  </p>
                  <p>Relays: {nostrRelays.length} configured</p>
                </div>
                <Button size="sm" variant="outline" onClick={handleToggleConnection} disabled={loading.network}>
                  <LogOut size={16} className="mr-2" /> Logout from Nostr
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <WifiOff size={20} className="text-red-500" />
                  <span className="font-medium">Disconnected</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Generate Nostr keys to connect to the network.
                </p>
                <Button size="sm" onClick={handleToggleConnection} disabled={loading.network}>
                  <KeyRound size={16} className="mr-2" /> Generate Keys & Connect
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Matches */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users size={20} />
              Network Matches
            </CardTitle>
            <CardDescription>
              Notes from others that share similar tags or topics.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {matches.length === 0 ? (
              <div className="text-center text-muted-foreground py-6">
                <Users size={40} className="mx-auto mb-3 opacity-50" />
                <p className="text-base font-medium">No matches found yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Publish notes with tags to discover connections.
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[200px] pr-3">
                <div className="space-y-3">
                  {matches.slice().reverse().map((match) => ( // Show newest first
                    <div key={match.id} className="p-3 border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold text-primary truncate">
                          Note by: {match.targetAuthor.slice(0, 10)}...{match.targetAuthor.slice(-6)}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {/* Similarity: {Math.round(match.similarity * 100)}% */}
                          {new Date(match.timestamp).toLocaleDateString()}
                        </Badge>
                      </div>
                      {match.sharedTags.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Shared Tags:</p>
                          <div className="flex flex-wrap gap-1">
                            {match.sharedTags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Placeholder for viewing the note - requires fetching the note content via Nostr */}
                      <Button variant="link" size="sm" className="p-0 h-auto text-xs" disabled>
                        View Note (Coming Soon)
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            {/* Button to refresh or fetch matches - Future enhancement */}
            {userProfile?.nostrPubkey && (
                 <Button variant="outline" size="sm" className="mt-4 w-full" disabled>
                    Find New Matches (Coming Soon)
                </Button>
            )}
          </CardContent>
        </Card>

        {/* Direct Messages */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageCircle size={20} />
              Direct Messages
            </CardTitle>
            <CardDescription>
              Encrypted messages received via Nostr.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {directMessages.length === 0 ? (
              <div className="text-center text-muted-foreground py-6">
                <MessageCircle size={40} className="mx-auto mb-3 opacity-50" />
                <p className="text-base font-medium">No messages yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Encrypted messages from other users will appear here.
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[200px] pr-3"> {/* Added ScrollArea for longer lists */}
                <div className="space-y-3">
                  {directMessages.slice().reverse().map((message) => ( // Show newest first, slice to avoid mutating store directMessages
                    <div key={message.id} className="p-3 border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold text-primary">
                          From: {message.from.slice(0, 10)}...{message.from.slice(-6)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(message.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
             {/* Placeholder for sending a new DM - Future enhancement */}
            {userProfile?.nostrPubkey && (
                 <Button variant="outline" size="sm" className="mt-4 w-full" disabled>
                    <Plus size={16} className="mr-2" /> Send New Message (Coming Soon)
                </Button>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full justify-start"
              onClick={handlePublishNote}
            >
              <Share2 size={16} className="mr-2" />
              Publish Current Note
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full justify-start"
            >
              <Globe size={16} className="mr-2" />
              Browse Public Notes
            </Button>
          </CardContent>
        </Card>

        {/* Topic Feeds / Discussions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Rss size={20} />
              Topic Feeds
            </CardTitle>
            <CardDescription>
              Subscribe to real-time notes from topics/hashtags on Nostr.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Enter topic (e.g., #AI, nostr)"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubscribeToNewTopic()}
              />
              <Button onClick={handleSubscribeToNewTopic} disabled={!userProfile?.nostrPubkey || loading.network}>
                <Plus size={16} className="mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Subscribe</span>
              </Button>
            </div>

            {Object.keys(activeTopicSubscriptions).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Not subscribed to any topics yet.
              </p>
            )}

            <div className="space-y-4">
              {Object.entries(activeTopicSubscriptions).map(([topic, subId]) => (
                <div key={topic}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-md font-semibold flex items-center">
                      <Hash size={18} className="mr-1 text-primary" /> {topic}
                    </h3>
                    <Button variant="ghost" size="sm" onClick={() => handleUnsubscribeFromTopic(topic)}>
                      <XCircle size={16} className="mr-1" /> Unsubscribe
                    </Button>
                  </div>
                  <ScrollArea className="h-[250px] border rounded-md p-2 bg-muted/30">
                    {(topicNotes[topic] && topicNotes[topic].length > 0) ? (
                      topicNotes[topic].slice().reverse().map((note: NostrEvent) => ( // Show newest first
                        <Card key={note.id} className="mb-2 p-3 shadow-sm bg-card">
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>By: {note.pubkey.substring(0,10)}...</span>
                            <span>{formatDate(note.created_at)}</span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap break-words line-clamp-3">
                            {note.content || <span className="italic">No content</span>}
                          </p>
                          {/* TODO: Add button to view full note, potentially in a modal or new view */}
                        </Card>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No notes received for this topic yet, or subscription just started.
                      </p>
                    )}
                  </ScrollArea>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>


        {/* Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">About Network</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>
              The network tab connects you to the decentralized Nostr protocol 
              for sharing notes and finding matches based on semantic tags.
            </p>
            <p>
              Your identity is cryptographically secured, and you control 
              what data to share publicly or privately.
            </p>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}