import WatchlistPage from "@/views/WatchlistPage";

// No Providers wrapper here any more: the (app) layout mounts the react-query
// client for the whole signed-in app, so nesting a second one would give this
// page its own cache and re-fetch `/api/stocks` the dashboard already holds.
export default function Page() {
  return <WatchlistPage />;
}
