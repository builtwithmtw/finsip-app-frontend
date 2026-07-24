import { Providers } from "@/app/providers";
import WatchlistPage from "@/views/WatchlistPage";

// Wrapped in Providers for the react-query client useStocks needs: the (app)
// route group doesn't mount one (only the public screener did), and the
// watchlist is the first signed-in page to read the live feed via react-query.
export default function Page() {
  return (
    <Providers>
      <WatchlistPage />
    </Providers>
  );
}
