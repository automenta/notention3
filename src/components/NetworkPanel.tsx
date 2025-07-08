import { Wifi, WifiOff, Users, MessageCircle, Share2, Globe } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useAppStore } from "../store";

export function NetworkPanel() {
  const { connected, matches, directMessages, nostrRelays } = useAppStore();

  // Placeholder for now - will be implemented in Phase 5
  const handleConnect = () => {
    console.log("Connecting to Nostr network...");
  };

  const handlePublishNote = () => {
    console.log("Publishing note to Nostr...");
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              {connected ? (
                <><Wifi size={16} className="text-green-500" /> Connected</>
              ) : (
                <><WifiOff size={16} className="text-red-500" /> Disconnected</>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {connected ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Connected to {nostrRelays.length} relays
                </p>
                <div className="flex flex-wrap gap-1">
                  {nostrRelays.map((relay, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {relay.replace('wss://', '')}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Not connected to the Nostr network
                </p>
                <Button size="sm" onClick={handleConnect}>
                  Connect
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Matches */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users size={16} />
              Matches ({matches.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {matches.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">
                <Users size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No matches found</p>
                <p className="text-xs mt-1">
                  Share notes with semantic tags to find connections
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {matches.slice(0, 5).map((match) => (
                  <div key={match.id} className="p-2 border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate">
                        Note by {match.targetAuthor.slice(0, 8)}...
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {Math.round(match.similarity * 100)}%
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {match.sharedTags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Direct Messages */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageCircle size={16} />
              Messages ({directMessages.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {directMessages.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">
                <MessageCircle size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No messages</p>
                <p className="text-xs mt-1">
                  Start conversations with other users
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {directMessages.slice(0, 5).map((message) => (
                  <div key={message.id} className="p-2 border border-border rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">
                        {message.from.slice(0, 8)}...
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(message.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {message.content}
                    </p>
                  </div>
                ))}
              </div>
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