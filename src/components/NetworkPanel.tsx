import { Wifi, WifiOff, Users, MessageCircle, Share2, Globe, KeyRound, LogOut, Copy } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { useAppStore } from "../store";
import { useEffect } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { LoadingSpinner } from "./ui/loading-spinner";


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
    unsubscribeFromNostr, // For potential cleanup
    initializeApp, // To re-init if needed or call initializeNostr specifically
    initializeNostr,
  } = useAppStore();

  // Attempt to initialize Nostr service on mount if not already handled by main app init
  useEffect(() => {
    // initializeApp in main.tsx should call initializeNostr.
    // This is a fallback or explicit re-check if panel is mounted/focused.
    // Consider if this is needed if initializeApp is robust.
    if (!userProfile?.nostrPubkey) {
        initializeNostr();
    }
  }, [initializeNostr, userProfile?.nostrPubkey]);

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