import { Settings, User, Key, Palette, Zap, Download, Upload, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { ScrollArea } from "./ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { useAppStore } from "../store";
import { DBService } from "../services/db";

export function SettingsPanel() {
  const { userProfile, updateUserProfile } = useAppStore();

  const handleExportData = async () => {
    const data = await DBService.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notention-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        await DBService.importData(data);
        alert('Data imported successfully! Please refresh the page.');
      } catch (error) {
        alert('Failed to import data. Please check the file format.');
      }
    };
    reader.readAsText(file);
  };

  const handleClearData = async () => {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      await DBService.clearAllData();
      alert('All data cleared! Please refresh the page.');
    }
  };

  const generateKeypair = () => {
    // Placeholder for keypair generation
    // In Phase 5, this will use nostr-tools to generate a real keypair
    const mockKeypair = {
      pubkey: 'npub1' + Math.random().toString(36).substring(2, 50),
      privkey: 'nsec1' + Math.random().toString(36).substring(2, 50),
    };
    
    if (userProfile) {
      updateUserProfile({
        ...userProfile,
        nostrPubkey: mockKeypair.pubkey,
        nostrPrivkey: mockKeypair.privkey,
      });
    } else {
      updateUserProfile({
        nostrPubkey: mockKeypair.pubkey,
        nostrPrivkey: mockKeypair.privkey,
        sharedTags: [],
        preferences: {
          theme: 'system',
          aiEnabled: false,
          defaultNoteStatus: 'draft',
        },
      });
    }
  };

  const toggleTheme = () => {
    if (userProfile) {
      const newTheme = userProfile.preferences.theme === 'light' ? 'dark' : 'light';
      updateUserProfile({
        ...userProfile,
        preferences: {
          ...userProfile.preferences,
          theme: newTheme,
        },
      });
      
      // Apply theme to document
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* User Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <User size={16} />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {userProfile ? (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Public Key</Label>
                  <Input
                    value={userProfile.nostrPubkey}
                    readOnly
                    className="text-xs font-mono"
                  />
                </div>
                
                <div>
                  <Label className="text-xs">Shared Tags</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {userProfile.sharedTags.length > 0 ? (
                      userProfile.sharedTags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No tags shared publicly
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-2">
                  No profile set up
                </p>
                <Button size="sm" onClick={generateKeypair}>
                  Create Profile
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Identity & Keys */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Key size={16} />
              Identity & Keys
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start"
                onClick={generateKeypair}
              >
                <Key size={16} className="mr-2" />
                Generate New Keypair
              </Button>
              
              <p className="text-xs text-muted-foreground">
                Warning: Generating a new keypair will change your identity on the network.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <User size={16} /> {/* Replace with a better icon e.g. ShieldCheck */}
              Privacy Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="sharePublicNotesGlobally" className="text-sm">Share Notes Publicly</Label>
                <p className="text-xs text-muted-foreground">
                  Allow publishing non-encrypted notes to the Nostr network.
                </p>
              </div>
              <Switch
                id="sharePublicNotesGlobally"
                checked={userProfile?.privacySettings?.sharePublicNotesGlobally || false}
                onCheckedChange={(checked) => {
                  if (userProfile) {
                    updateUserProfile({
                      ...userProfile,
                      privacySettings: {
                        ...(userProfile.privacySettings || { shareTagsWithPublicNotes: true, shareValuesWithPublicNotes: true }), // keep other settings if they exist
                        sharePublicNotesGlobally: checked,
                      },
                    });
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="shareTagsWithPublicNotes" className="text-sm">Share Tags with Public Notes</Label>
                <p className="text-xs text-muted-foreground">
                  Include tags when sharing notes publicly.
                </p>
              </div>
              <Switch
                id="shareTagsWithPublicNotes"
                checked={userProfile?.privacySettings?.shareTagsWithPublicNotes || false}
                disabled={!userProfile?.privacySettings?.sharePublicNotesGlobally} // Disable if global public sharing is off
                onCheckedChange={(checked) => {
                  if (userProfile && userProfile.privacySettings) {
                    updateUserProfile({
                      ...userProfile,
                      privacySettings: {
                        ...userProfile.privacySettings,
                        shareTagsWithPublicNotes: checked,
                      },
                    });
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="shareValuesWithPublicNotes" className="text-sm">Share Values with Public Notes</Label>
                <p className="text-xs text-muted-foreground">
                  Include key-value pairs when sharing notes publicly.
                </p>
              </div>
              <Switch
                id="shareValuesWithPublicNotes"
                checked={userProfile?.privacySettings?.shareValuesWithPublicNotes || false}
                disabled={!userProfile?.privacySettings?.sharePublicNotesGlobally} // Disable if global public sharing is off
                onCheckedChange={(checked) => {
                  if (userProfile && userProfile.privacySettings) {
                    updateUserProfile({
                      ...userProfile,
                      privacySettings: {
                        ...userProfile.privacySettings,
                        shareValuesWithPublicNotes: checked,
                      },
                    });
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Palette size={16} />
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Dark Mode</Label>
              <Switch
                checked={userProfile?.preferences.theme === 'dark'}
                onCheckedChange={toggleTheme}
              />
            </div>
          </CardContent>
        </Card>

        {/* AI Features */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap size={16} />
              AI Features
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Enable AI</Label>
                <p className="text-xs text-muted-foreground">
                  Requires local Ollama installation
                </p>
              </div>
              <Switch
                checked={userProfile?.preferences.aiEnabled || false}
                onCheckedChange={(checked) => {
                  if (userProfile) {
                    updateUserProfile({
                      ...userProfile,
                      preferences: {
                        ...userProfile.preferences,
                        aiEnabled: checked,
                      },
                    });
                  }
                }}
              />
            </div>
            
            <p className="text-xs text-muted-foreground">
              AI features will be available in Phase 7 with auto-tagging, 
              ontology suggestions, and summarization.
            </p>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Data Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full justify-start"
              onClick={handleExportData}
            >
              <Download size={16} className="mr-2" />
              Export Data
            </Button>
            
            <div>
              <input
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="hidden"
                id="import-file"
              />
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full justify-start"
                onClick={() => document.getElementById('import-file')?.click()}
              >
                <Upload size={16} className="mr-2" />
                Import Data
              </Button>
            </div>
            
            <Button 
              variant="destructive" 
              size="sm" 
              className="w-full justify-start"
              onClick={handleClearData}
            >
              <Trash2 size={16} className="mr-2" />
              Clear All Data
            </Button>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">About Notention</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>
              Notention is a decentralized note-taking app with semantic 
              structure and Nostr integration.
            </p>
            <p>
              Version 1.0.0 (Phase 1) - Core functionality and infrastructure
            </p>
            <p>
              Your data is stored locally and optionally shared via the 
              decentralized Nostr network.
            </p>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}