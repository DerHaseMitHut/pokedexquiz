import { useRoom } from '../../hooks/useRoom';
import { Loading } from '../Loading';
import { ShowLayout } from '../layout/ShowLayout';

export function ObsPage({ code }: { code: string }) {
  const [room] = useRoom(code);
  if (!room) return <Loading />;
  return <ShowLayout room={room} mode="obs" />;
}
