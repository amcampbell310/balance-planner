// The service worker's navigation fallback (public/sw.js) — shown only
// when a real page request fails with no network and nothing cached for
// it. Deliberately outside (app)/ and PageShell: this must render with
// zero data dependencies (no session, no DB) since it's what's left when
// nothing else is reachable.
export default function OfflinePage() {
  return (
    <main className="login-page">
      <div className="login-card">
        <h1>You&apos;re offline</h1>
        <p className="login-tagline">
          Balance Planner needs a connection to load your week. Reconnect and try again.
        </p>
      </div>
    </main>
  );
}
