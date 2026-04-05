import { useState, useEffect, useCallback } from 'react';

/**
 * useMissions Hook — Manages the Daily Check-in and Task system via Sockets.
 */
export function useMissions(socket, walletAddress, addHeroes) {
  const [missionStatus, setMissionStatus] = useState({
    scrap: 0,
    streak: 0,
    mechTickets: 0,
    completedTasks: [],
    canCheckIn: false,
    loading: true
  });

  const fetchStatus = useCallback(() => {
    if (!socket || !walletAddress) return;
    socket.emit('mission:getStatus');
  }, [socket, walletAddress]);

  useEffect(() => {
    if (!socket || !walletAddress) return;

    const handleStatusSync = (status) => {
      setMissionStatus({ ...status, loading: false });
    };

    const handleBoxOpened = (data) => {
        if (data.success && addHeroes) {
            // Handled in App.jsx
        }
    };

    const handleError = (err) => {
      console.warn('[Mission Error]', err.message);
    };

    socket.on('mission:statusSync', handleStatusSync);
    socket.on('mission:boxOpened', handleBoxOpened);
    socket.on('mission:error', handleError);

    fetchStatus();

    return () => {
      socket.off('mission:statusSync', handleStatusSync);
      socket.off('mission:boxOpened', handleBoxOpened);
      socket.off('mission:error', handleError);
    };
  }, [socket, walletAddress, fetchStatus, addHeroes]);

  const checkIn = () => {
    if (!socket) return;
    socket.emit('mission:checkIn');
  };

  const completeTask = (taskId) => {
    if (!socket) return;
    socket.emit('mission:completeTask', { taskId });
  };

  const craft = () => {
    if (!socket) return;
    socket.emit('mission:craft');
  };

  const openBox = () => {
    if (!socket) return;
    socket.emit('mission:openBox');
  };

  return {
    ...missionStatus,
    checkIn,
    completeTask,
    craft,
    openBox,
    refresh: fetchStatus
  };
}
