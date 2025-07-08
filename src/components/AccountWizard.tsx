import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Terminal, Copy, Check } from 'lucide-react';
import { nostrService } from '../services/NostrService'; // For direct private key generation display

interface AccountWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccountWizard({ isOpen, onClose }: AccountWizardProps) {
  const { userProfile, generateAndStoreNostrKeys, updateUserProfile } = useAppStore();
  const [step, setStep] = useState(1);
  const [generatedKeys, setGeneratedKeys] = useState<{ publicKey: string; privateKey: string } | null>(null);
  const [privateKeyBackedUp, setPrivateKeyBackedUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedPub, setCopiedPub] = useState(false);
  const [copiedPriv, setCopiedPriv] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset state when dialog opens
      setStep(1);
      setGeneratedKeys(null);
      setPrivateKeyBackedUp(false);
      setError(null);
      setCopiedPub(false);
      setCopiedPriv(false);
    }
  }, [isOpen]);

  const handleGenerateKeys = async () => {
    setError(null);
    // We need the private key for display, which generateAndStoreNostrKeys doesn't return directly.
    // So, we generate them here, display, then tell the store to save them.
    const { privateKey: sk, publicKey: pk } = nostrService.generateNewKeyPair();
    setGeneratedKeys({ publicKey: pk, privateKey: sk });
  };

  const handleConfirmAndSaveKeys = async () => {
    if (!generatedKeys) {
      setError("Keys not generated yet.");
      return;
    }
    try {
      await generateAndStoreNostrKeys(generatedKeys.privateKey, generatedKeys.publicKey); // Pass keys to store
      setStep(3);
    } catch (e: any) {
      setError(`Failed to save keys: ${e.message}`);
      console.error("Failed to save keys during wizard:", e);
    }
  };

  const copyToClipboard = async (text: string, type: 'pub' | 'priv') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'pub') setCopiedPub(true);
      if (type === 'priv') setCopiedPriv(true);
      setTimeout(() => {
        if (type === 'pub') setCopiedPub(false);
        if (type === 'priv') setCopiedPriv(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard.');
    }
  };


  const renderStepContent = () => {
    switch (step) {
      case 1: // Welcome
        return (
          <>
            <DialogDescription className="my-4 text-sm text-muted-foreground">
              Welcome to Notention! To get started with decentralized features,
              you'll need a Nostr identity. This wizard will help you generate one.
              Your identity is secured by a pair of cryptographic keys.
            </DialogDescription>
            <DialogFooter>
              <Button onClick={() => setStep(2)}>Create My Identity</Button>
            </DialogFooter>
          </>
        );
      case 2: // Key Generation & Backup
        return (
          <>
            <DialogDescription className="my-2 text-sm text-muted-foreground">
              Your Nostr identity consists of a public key (shareable) and a private key (secret).
            </DialogDescription>

            {!generatedKeys && (
              <Button onClick={handleGenerateKeys} className="w-full my-4">
                Generate New Keys
              </Button>
            )}

            {generatedKeys && (
              <div className="space-y-4 my-4">
                <Alert variant="default">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>Keys Generated!</AlertTitle>
                  <AlertDescription>
                    Your new identity keys are shown below.
                  </AlertDescription>
                </Alert>
                <div>
                  <Label htmlFor="publicKey">Public Key (npub)</Label>
                  <div className="flex items-center gap-2">
                    <Input id="publicKey" value={generatedKeys.publicKey} readOnly className="font-mono text-xs"/>
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(generatedKeys.publicKey, 'pub')}>
                      {copiedPub ? <Check size={16} /> : <Copy size={16} />}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="privateKey">Private Key (nsec)</Label>
                   <div className="flex items-center gap-2">
                    <Input id="privateKey" value={generatedKeys.privateKey} readOnly className="font-mono text-xs"/>
                     <Button variant="outline" size="icon" onClick={() => copyToClipboard(generatedKeys.privateKey, 'priv')}>
                      {copiedPriv ? <Check size={16} /> : <Copy size={16} />}
                    </Button>
                  </div>
                </div>
                <Alert variant="destructive">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>CRITICAL: Back Up Your Private Key!</AlertTitle>
                  <AlertDescription>
                    Your private key is your password. <strong>It cannot be recovered if lost.</strong>
                    Save it somewhere extremely safe and secret (e.g., password manager, offline storage).
                    Do not share it with anyone. This is the ONLY time it will be shown to you.
                  </AlertDescription>
                </Alert>
                <div className="flex items-center space-x-2 mt-4">
                  <Checkbox
                    id="privateKeyBackedUp"
                    checked={privateKeyBackedUp}
                    onCheckedChange={(checked) => setPrivateKeyBackedUp(checked as boolean)}
                  />
                  <label
                    htmlFor="privateKeyBackedUp"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I have securely backed up my private key.
                  </label>
                </div>
              </div>
            )}
            {error && <p className="text-sm text-destructive mt-2">{error}</p>}
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setStep(1)} disabled={!!generatedKeys}>Back</Button>
              <Button
                onClick={handleConfirmAndSaveKeys}
                disabled={!generatedKeys || !privateKeyBackedUp}
              >
                Confirm & Save Keys
              </Button>
            </DialogFooter>
          </>
        );
        case 3: // Finish
        return (
          <>
            <DialogDescription className="my-4 text-sm text-muted-foreground">
              Your Nostr identity has been set up and saved locally! You can manage your profile,
              relays, and privacy settings in the main Settings panel.
            </DialogDescription>
            <DialogFooter>
              <Button onClick={onClose}>Start Using Notention</Button>
            </DialogFooter>
          </>
        );
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[525px]" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {step === 1 && "Welcome to Notention"}
            {step === 2 && "Generate Your Nostr Identity"}
            {step === 3 && "Setup Complete!"}
          </DialogTitle>
        </DialogHeader>
        {renderStepContent()}
      </DialogContent>
    </Dialog>
  );
}
