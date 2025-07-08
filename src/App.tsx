import { useEffect, useState } from "react";
import { useAppStore } from "./store";
import { Sidebar } from "./components/Sidebar";
import { NoteEditor } from "./components/NoteEditor";
import { LoadingSpinner } from "./components/ui/loading-spinner";
import { NotificationBar } from "./components/NotificationBar";
import { AccountWizard } from "./components/AccountWizard"; // Import the wizard

export default function App() {
  const { initializeApp, loading, userProfile, nostrConnected } = useAppStore(
    (state) => ({
      initializeApp: state.initializeApp,
      loading: state.loading,
      userProfile: state.userProfile,
      nostrConnected: state.nostrConnected, // Or use userProfile.nostrPubkey directly
    })
  );

  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    const init = async () => {
      await initializeApp();
      // After initialization, check if we need to show the wizard.
      // This check will be re-evaluated if userProfile changes.
    };
    init();
  }, [initializeApp]);

  useEffect(() => {
    // This effect runs after initializeApp has populated userProfile and nostrConnected status
    // Only show wizard if app is not loading, profile exists, but no pubkey AND nostr init is done (nostrConnected reflects this)
    if (!loading.notes && !loading.ontology && !loading.network) { // Ensure nostr init has also attempted
      if (userProfile && !userProfile.nostrPubkey) {
        setShowWizard(true);
      } else {
        setShowWizard(false); // Hide if pubkey exists or profile is missing (should be created by init)
      }
    }
  }, [userProfile, userProfile?.nostrPubkey, loading.notes, loading.ontology, loading.network, nostrConnected]);


  if (loading.notes || loading.ontology || (loading.network && !userProfile?.nostrPubkey) ) {
    // Show loading spinner if core data is loading, OR if network is loading AND we don't have a pubkey yet (implies initial nostr setup)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Notification Bar */}
      <NotificationBar />
      
      {/* Main Layout */}
      <div className="flex flex-1">
        {/* Mobile: Single column, Desktop: Two column */}
        <div className="flex-1 flex flex-col md:flex-row">
          {/* Sidebar */}
          <div className="w-full md:w-80 border-r border-border">
            <Sidebar />
          </div>
          
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col">
            <NoteEditor />
          </div>
        </div>
      </div>

      {/* Account Wizard Modal */}
      <AccountWizard
        isOpen={showWizard}
        onClose={() => {
          setShowWizard(false);
          // Optionally, re-check profile status or trigger a refresh if needed,
          // though store updates should ideally propagate.
        }}
      />
    </div>
  );
}
