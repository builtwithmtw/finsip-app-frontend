import PeersPage from "@/views/PeersPage";

// Admin-only, but the gate is not this route's: the view renders a notice for a
// non-admin and the RPCs behind it refuse one outright, so there is nothing here
// to protect beyond what ProtectedRoute already does.
export default function Page() {
  return <PeersPage />;
}
