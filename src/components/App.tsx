import { Home } from './pages/Home';
import { HostPage } from './pages/HostPage';
import { PlayerPage } from './pages/PlayerPage';
import { PlayerObsPage } from './pages/PlayerObsPage';
import { ObsPage } from './pages/ObsPage';

export function App() {
  const path = window.location.pathname.split('/').filter(Boolean);
  if (path[0] === 'host' && path[1]) return <HostPage code={path[1].toUpperCase()} />;
  if (path[0] === 'player' && path[1]) return <PlayerPage code={path[1].toUpperCase()} />;
  if (path[0] === 'player-obs' && path[1] && path[2])
    return <PlayerObsPage code={path[1].toUpperCase()} playerId={path[2]} />;
  if (path[0] === 'obs' && path[1]) return <ObsPage code={path[1].toUpperCase()} />;
  return <Home />;
}
