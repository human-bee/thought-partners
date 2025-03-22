import {
  GridLayout,
  RoomAudioRenderer,
  usePagination,
  useParticipants,
  VideoRenderer,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Participant } from 'livekit-client';

export default function VideoConference() {
  const participants = useParticipants();
  const { currentPage, pageSize, totalPages, nextPage, prevPage, setPage } = usePagination(
    participants
  );

  return (
    <div className="flex flex-col h-full">
      <RoomAudioRenderer />
      <div className="flex-1 relative">
        <GridLayout tracks={currentPage}>
          {(participant) => (
            <VideoTile key={participant.identity} participant={participant} />
          )}
        </GridLayout>
      </div>
      {totalPages > 1 && (
        <div className="flex justify-center items-center p-2 gap-2">
          <button
            onClick={prevPage}
            disabled={currentPage.length === 0 || currentPage[0] === participants[0]}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span>
            Page {Math.floor(participants.indexOf(currentPage[0]) / pageSize) + 1} of {totalPages}
          </span>
          <button
            onClick={nextPage}
            disabled={
              currentPage.length === 0 ||
              currentPage[currentPage.length - 1] === participants[participants.length - 1]
            }
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

interface VideoTileProps {
  participant: Participant;
}

function VideoTile({ participant }: VideoTileProps) {
  return (
    <div className="relative bg-black w-full h-full rounded-lg overflow-hidden">
      <VideoRenderer
        participant={participant}
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 px-2 py-1 rounded text-white text-sm">
        {participant.identity}
      </div>
    </div>
  );
} 