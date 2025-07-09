import { Wifi, WifiOff, Users, MessageCircle, Share2, Globe, KeyRound, LogOut, Copy, Hash, Rss, XCircle, Plus, Eye } from "lucide-react"; // Added Eye
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
// Added Dialog components for viewing full topic note
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "./ui/dialog";
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
    embeddingMatches, // New state for embedding matches
    findAndSetEmbeddingMatches, // New action for embedding matches
    currentNoteId, // To know which note to find matches for
    setCurrentNote, // To navigate to a local matched note
    setSidebarTab, // To switch to notes tab when viewing a local match
  } = useAppStore();

  const [newTopic, setNewTopic] = useState('');
  const [selectedTopicNote, setSelectedTopicNote] = useState<NostrEvent | null>(null);
  const [isViewNoteModalOpen, setIsViewNoteModalOpen] = useState(false);
  const [selectedMatchedNoteEvent, setSelectedMatchedNoteEvent] = useState<NostrEvent | null>(null);
  const [isViewMatchedNoteModalOpen, setIsViewMatchedNoteModalOpen] = useState(false);
  const [dmRecipient, setDmRecipient] = useState<string | null>(null);
  const [dmContent, setDmContent] = useState<string>("");
  const [isDmModalOpen, setIsDmModalOpen] = useState(false);
  const [isFetchingMatchedNote, setIsFetchingMatchedNote] = useState(false);
  const [isFindingEmbeddingMatches, setIsFindingEmbeddingMatches] = useState(false);


  useEffect(() => {
    if (!userProfile?.nostrPubkey && !loading.network) { // Check loading.network to avoid race condition
        initializeNostr();
    }
    // Attempt to re-subscribe to topics if user logs in or relays change, etc.
    // This is a basic re-subscribe, might need more robust logic if subs are persisted.
    if (userProfile?.nostrPubkey && nostrConnected && Object.keys(activeTopicSubscriptions).length > 0) {
        Object.keys(activeTopicSubscriptions).forEach(topic => {
            // This logic is a bit simplistic as it doesn't check if subId is still valid
            // or if it's already subscribed in the current session.
            // A more robust system would manage subscriptions more carefully on init/login.
            // For now, this is a placeholder for potential re-subscription needs.
        });
    }

  }, [initializeNostr, userProfile?.nostrPubkey, loading.network, nostrConnected, activeTopicSubscriptions]);

  const handleViewTopicNote = (note: NostrEvent) => {
    setSelectedTopicNote(note);
    setIsViewNoteModalOpen(true);
  };

  const handleViewMatchedNote = async (noteId: string, authorPubkey: string) => {
    if (!noteId) {
      toast.error("Note ID is missing for the match.");
      return;
    }
    setIsFetchingMatchedNote(true);
    setSelectedMatchedNoteEvent(null); // Clear previous
    try {
      const event = await nostrService.getEventById(noteId, nostrRelays);
      if (event) {
        setSelectedMatchedNoteEvent(event);
        setIsViewMatchedNoteModalOpen(true);
      } else {
        toast.error("Could not fetch the matched note from relays.", { description: "It might have been deleted or is not available on your current relays."});
      }
    } catch (e: any) {
      toast.error("Error fetching matched note.", { description: e.message });
    } finally {
      setIsFetchingMatchedNote(false);
    }
  };

  const handleOpenDmModal = (recipientPubkey: string) => {
    if (!userProfile?.nostrPubkey) {
      toast.error("Please connect to Nostr to send DMs.");
      return;
    }
    setDmRecipient(recipientPubkey);
    setDmContent(""); // Clear previous content
    setIsDmModalOpen(true);
  };

  const handleSendDm = async () => {
    if (!dmRecipient || !dmContent.trim()) {
      toast.error("Recipient and message content are required.");
      return;
    }
    try {
      await useAppStore.getState().sendDirectMessage(dmRecipient, dmContent.trim());
      toast.success("Direct Message sent!");
      setIsDmModalOpen(false);
      setDmContent("");
      setDmRecipient(null);
    } catch (e: any) {
      toast.error("Failed to send DM.", { description: e.message });
    }
  };


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
          // description: "Make sure to backup your private key if prompted (not implemented yet).", // Backup prompt is UI concern
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

  const formatDate = (timestamp: number | Date) => {
    return new Date(timestamp).toLocaleString();
  };

  const handleFindEmbeddingMatches = async () => {
    if (!currentNoteId) {
      toast.info("Please select or open a note first to find similar notes based on its content.");
      return;
    }
    if (!userProfile?.preferences.aiEnabled) {
      toast.error("AI Features Disabled", { description: "Please enable AI features in settings to find semantic matches."});
      return;
    }
    setIsFindingEmbeddingMatches(true);
    try {
      await findAndSetEmbeddingMatches(currentNoteId);
      // Toast for success/no matches is handled within the store action if desired, or can be added here based on embeddingMatches length
      const updatedMatches = useAppStore.getState().embeddingMatches;
      if (updatedMatches.length > 0) {
        toast.success(`${updatedMatches.length} similar local notes found.`);
      } else {
        toast.info("No similar local notes found based on content embeddings.");
      }
    } catch (e: any) {
      toast.error("Error finding embedding matches.", { description: e.message });
    } finally {
      setIsFindingEmbeddingMatches(false);
    }
  };

  const handleViewLocalMatchedNote = (noteId: string) => {
    setCurrentNote(noteId);
    setSidebarTab('notes'); // Switch to notes tab/editor
    // Potentially close the network panel or scroll to the top of the editor
    toast.info("Navigated to local note.");
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
              Content Matches (Local)
            </CardTitle>
            <CardDescription>
              Local notes with similar content to your currently selected note, based on AI embeddings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {embeddingMatches.length === 0 ? (
              <div className="text-center text-muted-foreground py-6">
                <Users size={40} className="mx-auto mb-3 opacity-50" />
                <p className="text-base font-medium">No content matches found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Select a note and click "Find Similar by Content" to populate this section.
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[200px] pr-3">
                <div className="space-y-3">
                  {embeddingMatches.map((match) => ( // Already sorted by similarity in store
                    <div key={match.id} className="p-3 border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold text-primary truncate">
                          {useAppStore.getState().notes[match.localNoteId!]?.title || "Untitled Note"}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          Similarity: {Math.round(match.similarity * 100)}%
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Updated: {formatDate(match.timestamp)}
                      </p>
                      {match.sharedTags.length > 0 && (
                        <div className="mb-1">
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">Common Tags:</p>
                          <div className="flex flex-wrap gap-1">
                            {match.sharedTags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0.5">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          variant="link"
                          size="xs"
                          className="p-0 h-auto text-xs"
                          onClick={() => handleViewLocalMatchedNote(match.localNoteId!)}
                        >
                          <Eye size={12} className="mr-1" /> View Local Note
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-4 w-full"
              onClick={handleFindEmbeddingMatches}
              disabled={isFindingEmbeddingMatches || !currentNoteId || !userProfile?.preferences.aiEnabled}
            >
              {isFindingEmbeddingMatches && <LoadingSpinner size="sm" className="mr-2" />}
              Find Similar by Content (Current Note)
            </Button>
            {!userProfile?.preferences.aiEnabled && <p className="text-xs text-destructive mt-1 text-center">Enable AI features in settings.</p>}
            {!currentNoteId && userProfile?.preferences.aiEnabled && <p className="text-xs text-muted-foreground mt-1 text-center">Select a note to find similar content.</p>}
          </CardContent>
        </Card>

        {/* Nostr Network Matches */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Share2 size={20} /> {/* Changed Icon */}
              Network Matches
            </CardTitle>
            <CardDescription>
              Notes from others on Nostr that match your local notes based on tags or content embeddings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {matches.length === 0 ? (
              <div className="text-center text-muted-foreground py-6">
                <Share2 size={40} className="mx-auto mb-3 opacity-50" />
                <p className="text-base font-medium">No Nostr matches found yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Publish notes with tags to discover connections on the Nostr network.
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[200px] pr-3">
                <div className="space-y-3">
                  {matches.slice().reverse().map((match) => (
                    <div key={match.id} className="p-3 border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold text-primary truncate">
                          {match.matchType === 'embedding' && match.localNoteId ?
                           `Local: "${useAppStore.getState().notes[match.localNoteId]?.title?.substring(0,20) || 'Note'}" matches Remote by Content` :
                           `Remote Note by: ${match.targetAuthor.slice(0, 10)}...`}
                        </span>
                        <Badge variant={match.matchType === 'embedding' ? "default" : "outline"} className="text-xs capitalize">
                          {match.matchType || 'Tag'} Match ({Math.round(match.similarity * 100)}%)
                        </Badge>
                      </div>
                       <p className="text-xs text-muted-foreground mb-1">
                        {match.matchType === 'embedding' && match.localNoteId ?
                         `Remote Author: ${match.targetAuthor.slice(0,10)}...` :
                         `Timestamp: ${formatDate(match.timestamp)}`}
                      </p>
                      {match.sharedTags && match.sharedTags.length > 0 && (
                        <div className="mb-1">
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">Shared Tags:</p>
                          <div className="flex flex-wrap gap-1">
                            {match.sharedTags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0.5">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          variant="link"
                          size="xs"
                          className="p-0 h-auto text-xs"
                          onClick={() => handleViewMatchedNote(match.targetNoteId, match.targetAuthor)}
                          disabled={isFetchingMatchedNote && selectedMatchedNoteEvent?.id !== match.targetNoteId}
                        >
                          {isFetchingMatchedNote && selectedMatchedNoteEvent?.id !== match.targetNoteId && <LoadingSpinner size="xs" className="mr-1" />}
                          <Eye size={12} className="mr-1" /> View Nostr Note
                        </Button>
                        <Button
                          variant="link"
                          size="xs"
                          className="p-0 h-auto text-xs text-blue-500 hover:text-blue-600"
                          onClick={() => handleOpenDmModal(match.targetAuthor)}
                        >
                          <MessageCircle size={12} className="mr-1" /> DM Author
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            {/* Button to refresh or fetch matches - Future enhancement */}
            {userProfile?.nostrPubkey && (
                 <Button variant="outline" size="sm" className="mt-4 w-full" disabled>
                    Refresh Nostr Matches (Coming Soon)
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
                          <Button
                            variant="link"
                            size="xs"
                            className="p-0 h-auto text-xs mt-1"
                            onClick={() => handleViewTopicNote(note)}
                          >
                            <Eye size={12} className="mr-1" /> View Full Note
                          </Button>
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

        {/* Modal to View Full Topic Note */}
        {selectedTopicNote && (
          <Dialog open={isViewNoteModalOpen} onOpenChange={setIsViewNoteModalOpen}>
            <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Nostr Event Details</DialogTitle>
                <DialogDescription>
                  Full content of the note from topic: {Object.entries(activeTopicSubscriptions).find(([, subId]) => subId === (topicNotes[selectedTopicNote.tags.find(t=>t[0]==='t')?.[1] || ''] ? activeTopicSubscriptions[selectedTopicNote.tags.find(t=>t[0]==='t')?.[1] || ''] : ''))?.[0] || 'Unknown Topic'}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-grow p-1 -mx-1">
                <div className="text-xs text-muted-foreground mb-2 space-y-0.5">
                  <p><strong>Author:</strong> {selectedTopicNote.pubkey}</p>
                  <p><strong>Event ID:</strong> {selectedTopicNote.id}</p>
                  <p><strong>Timestamp:</strong> {formatDate(selectedTopicNote.created_at)}</p>
                  <p><strong>Kind:</strong> {selectedTopicNote.kind}</p>
                  {selectedTopicNote.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                        <strong>Tags:</strong>
                        {selectedTopicNote.tags.map((tag, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">{tag[0]}: {tag.slice(1).join(', ')}</Badge>
                        ))}
                    </div>
                  )}
                </div>
                <pre className="text-sm whitespace-pre-wrap break-all bg-muted p-3 rounded-md text-foreground">
                  {selectedTopicNote.content || <span className="italic">No content</span>}
                </pre>
              </ScrollArea>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Close</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Modal to View Full Matched Note Event */}
        {selectedMatchedNoteEvent && (
          <Dialog open={isViewMatchedNoteModalOpen} onOpenChange={setIsViewMatchedNoteModalOpen}>
            <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Matched Note Details</DialogTitle>
                 <DialogDescription>
                  Full content of the matched Nostr event.
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-grow p-1 -mx-1">
                <div className="text-xs text-muted-foreground mb-2 space-y-0.5">
                  <p><strong>Author:</strong> {selectedMatchedNoteEvent.pubkey}</p>
                  <p><strong>Event ID:</strong> {selectedMatchedNoteEvent.id}</p>
                  <p><strong>Timestamp:</strong> {formatDate(selectedMatchedNoteEvent.created_at)}</p>
                  <p><strong>Kind:</strong> {selectedMatchedNoteEvent.kind}</p>
                  {selectedMatchedNoteEvent.tags.length > 0 && (
                     <div className="flex flex-wrap gap-1 pt-1">
                        <strong>Tags:</strong>
                        {selectedMatchedNoteEvent.tags.map((tag, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">{tag[0]}: {tag.slice(1).join(', ')}</Badge>
                        ))}
                    </div>
                  )}
                </div>
                <pre className="text-sm whitespace-pre-wrap break-all bg-muted p-3 rounded-md text-foreground">
                  {selectedMatchedNoteEvent.content || <span className="italic">No content</span>}
                </pre>
              </ScrollArea>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Close</Button>
                </DialogClose>
                 <Button type="button" variant="default" onClick={() => handleOpenDmModal(selectedMatchedNoteEvent.pubkey)}>
                    <MessageCircle size={14} className="mr-2"/> DM Author
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* DM Modal */}
        {isDmModalOpen && dmRecipient && (
          <Dialog open={isDmModalOpen} onOpenChange={setIsDmModalOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Direct Message</DialogTitle>
                <DialogDescription>To: {dmRecipient.substring(0,10)}...</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Input
                  type="textarea"
                  value={dmContent}
                  onChange={(e) => setDmContent(e.target.value)}
                  placeholder="Your encrypted message..."
                  className="min-h-[100px]"
                />
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={handleSendDm} disabled={!dmContent.trim() || loading.network}>
                  {loading.network && <LoadingSpinner size="xs" className="mr-2" />} Send Encrypted DM
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

      </div>
    </ScrollArea>
  );
}