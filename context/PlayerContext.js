// context/PlayerContext.js
import React, { createContext, useState, useContext, useRef, useEffect, useCallback } from 'react';
import { Audio } from 'expo-av';
import { isTrackLiked, likeTrack, unlikeTrack } from '../utils/storage';

const PlayerContext = createContext(undefined);

export const PlayerProvider = ({ children }) => {
    const [currentTrack, setCurrentTrack] = useState(null);
    const [playlist, setPlaylist] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [queue, setQueue] = useState([]);

    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackPosition, setPlaybackPosition] = useState(0);
    const [playbackDuration, setPlaybackDuration] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isSoundLoaded, setIsSoundLoaded] = useState(false);

    const [isLiked, setIsLiked] = useState(false);
    const [repeatMode, setRepeatMode] = useState('off');
    const [isShuffleActive, setIsShuffleActive] = useState(false);

    const soundObjectRef = useRef(null);
    const isSeekingRef = useRef(false);
    const actionsRef = useRef({});

    // --- Вспомогательные функции (стабильные) ---
    const _updateLikeStatus = useCallback(async (trackId) => {
        setIsLiked(trackId ? await isTrackLiked(trackId) : false);
    }, []);

    const unloadCurrentSound = useCallback(async (stopPlayback = true) => {
        if (soundObjectRef.current) {
            console.log('[PlayerContext] Unloading sound. Stop:', stopPlayback);
            try {
                const status = await soundObjectRef.current.getStatusAsync();
                if (status.isLoaded) {
                    if (stopPlayback) await soundObjectRef.current.stopAsync();
                    await soundObjectRef.current.unloadAsync();
                }
            } catch (error) {
                if (!error.message.includes("sound is not loaded") && !error.message.includes("PLAYER_ERR_NO_SRC_SET")) {
                    console.error('[PlayerContext] Error unloading sound:', error);
                }
            }
            soundObjectRef.current.setOnPlaybackStatusUpdate(null); // Всегда отписываемся
            setIsSoundLoaded(false);
            if (stopPlayback) setIsPlaying(false);
        }
    }, []);


    const _internalLoadAndPlayTrack = useCallback(async (trackToLoad, playWhenReady) => {
        if (!trackToLoad || !trackToLoad.url) {
            console.warn("[PlayerContext] _internalLoadAudio: No track or URL.", trackToLoad);
            await unloadCurrentSound(true); // Останавливаем и выгружаем
            setCurrentTrack(null);
            setPlaybackDuration(0); setPlaybackPosition(0); setIsPlaying(false); setIsLoading(false);
            _updateLikeStatus(null);
            return false;
        }

        console.log(`[PlayerContext] _internalLoadAudio: Loading "${trackToLoad.title}". Play: ${playWhenReady}`);
        setIsLoading(true);

        await unloadCurrentSound(currentTrack?.id !== trackToLoad.id);

        setCurrentTrack(trackToLoad);
        await _updateLikeStatus(trackToLoad.id);

        try {
            if (!soundObjectRef.current) soundObjectRef.current = new Audio.Sound();

            soundObjectRef.current.setOnPlaybackStatusUpdate((status) => {
                if (!status) return;
                if (!status.isLoaded) {
                    setIsPlaying(false);
                    if (status.error) console.error(`[PlayerContext] StatusUpdate Error (isLoaded=false): ${status.error}`);
                    if (status.didJustFinish && !status.isLooping) {
                        actionsRef.current.handleTrackActuallyFinished();
                    }
                    return;
                }
                setIsSoundLoaded(true);
                if (!isSeekingRef.current) setPlaybackPosition(status.positionMillis || 0);

                const trackExpectedDuration = currentTrack?.duration ? currentTrack.duration * 1000 : 0;
                setPlaybackDuration(status.durationMillis || playbackDuration || trackExpectedDuration);
                setIsPlaying(status.isPlaying);

                if (status.didJustFinish && !status.isLooping) {
                    actionsRef.current.handleTrackActuallyFinished();
                }
            });

            // AudioMode настраивается один раз в useEffect
            console.log(`[PlayerContext] Loading source: ${trackToLoad.url}`);
            await soundObjectRef.current.loadAsync({ uri: trackToLoad.url }, { shouldPlay: playWhenReady, progressUpdateIntervalMillis: 500 });
            setIsLoading(false);
            return true;
        } catch (error) {
            console.error(`[PlayerContext] Error in _internalLoadAudio for "${trackToLoad.title}":`, error);
            setCurrentTrack(null); setIsSoundLoaded(false); setIsPlaying(false); setIsLoading(false);
            return false;
        }
    }, [unloadCurrentSound, _updateLikeStatus, currentTrack, playbackDuration]); // playbackDuration для setPlaybackDuration

    // --- Логика перехода по трекам ---
    const playNextTrackFromPlaylist = useCallback(() => {
        if (!playlist || playlist.length === 0) return false;
        let nextIdx;
        if (isShuffleActive) {
            if (playlist.length <= 1 && repeatMode !== 'one') return false;
            let randomIdx;
            do { randomIdx = Math.floor(Math.random() * playlist.length); }
            while (randomIdx === currentIndex && playlist.length > 1);
            nextIdx = randomIdx;
        } else {
            nextIdx = currentIndex + 1;
        }

        if (nextIdx >= playlist.length) {
            if (repeatMode === 'all') nextIdx = 0;
            else return false;
        }
        const nextTrackToPlay = playlist[nextIdx];
        if (nextTrackToPlay) {
            setCurrentIndex(nextIdx);
            _internalLoadAndPlayTrack(nextTrackToPlay, true);
            return true;
        }
        return false;
    }, [playlist, isShuffleActive, currentIndex, repeatMode, _internalLoadAndPlayTrack]);

    const playNextTrackFromQueue = useCallback(() => {
        if (queue.length > 0) {
            const nextTrackInQueue = queue[0];
            setQueue(prevQueue => prevQueue.slice(1));

            _internalLoadAndPlayTrack(nextTrackInQueue, true);
            return true;
        }
        return false;
    }, [queue, _internalLoadAndPlayTrack]);

    const handleTrackActuallyFinished = useCallback(() => {
        console.log("[PlayerContext] Track finished. Repeat:", repeatMode, "Current:", currentTrack?.title);
        if (repeatMode === 'one' && currentTrack) {
            if (soundObjectRef.current && isSoundLoaded) {
                soundObjectRef.current.replayAsync().catch(e => console.error("[PlayerContext] Replay error", e));
            } else {
                _internalLoadAndPlayTrack(currentTrack, true);
            }
            return;
        }
        if (!playNextTrackFromPlaylist()) {
            if (!playNextTrackFromQueue()) {
                console.log("[PlayerContext] Playlist and queue finished. Stopping.");
                if (soundObjectRef.current && isSoundLoaded) {
                    soundObjectRef.current.stopAsync().then(() => setIsPlaying(false));
                } else {
                    setIsPlaying(false);
                }

                setPlaybackPosition(0);
            }
        }
    }, [repeatMode, currentTrack, isSoundLoaded, playNextTrackFromPlaylist, playNextTrackFromQueue, _internalLoadAndPlayTrack]);



    const loadAudio = useCallback(async (track, playOnLoad, newPList, newIdx) => {
        console.log("[PlayerContext] Action: loadAudio for", track?.title);
        setQueue([]);
        setPlaylist(newPList || []);
        setCurrentIndex(newIdx !== undefined ? newIdx : 0);
        return await _internalLoadAndPlayTrack(track, playOnLoad);
    }, [_internalLoadAndPlayTrack]);

    const play = useCallback(async (trackToPlay) => {
        const targetTrack = trackToPlay || currentTrack;
        if (!targetTrack || !targetTrack.url) { console.warn("[PlayerContext] Play: No track or URL."); return; }

        if (soundObjectRef.current && isSoundLoaded && currentTrack?.id === targetTrack.id) {
            if (!isPlaying) {
                try { await soundObjectRef.current.playAsync(); }
                catch (e) { console.error("[PlayerContext] Error resuming:", e); }
            }
        } else {
            await loadAudio(targetTrack, true, [targetTrack], 0);
        }
    }, [isSoundLoaded, currentTrack, isPlaying, loadAudio]);

    const pause = useCallback(async () => {
        if (soundObjectRef.current && isPlaying && isSoundLoaded) {
            try { await soundObjectRef.current.pauseAsync(); }
            catch (e) { console.error("[PlayerContext] Error pausing:", e); }
        }
    }, [isPlaying, isSoundLoaded]);

    const seek = useCallback(async (positionMillis) => {
        if (soundObjectRef.current && isSoundLoaded) {
            try {
                isSeekingRef.current = true;
                setPlaybackPosition(positionMillis);
                await soundObjectRef.current.setStatusAsync({ positionMillis, shouldPlay: isPlaying });
            } catch (e) { console.error("[PlayerContext] Error seeking:", e); }
            finally { setTimeout(() => { isSeekingRef.current = false; }, 250); }
        }
    }, [isSoundLoaded, isPlaying]);

    const skipToNext = useCallback(() => {
        console.log("[PlayerContext] Action: skipToNext by user");
        if (playNextTrackFromPlaylist()) return;
        if (playNextTrackFromQueue()) return;
        console.log("[PlayerContext] skipToNext: No next track available.");
        if(soundObjectRef.current && isSoundLoaded && isPlaying) {
            soundObjectRef.current.stopAsync().then(() => { setIsPlaying(false); setPlaybackPosition(0); });
        }
    }, [playNextTrackFromPlaylist, playNextTrackFromQueue, isSoundLoaded, isPlaying]);

    const skipToPrevious = useCallback(async () => {
        if (!playlist && queue.length === 0) return; // Если нет ни плейлиста ни очереди
        const status = await soundObjectRef.current?.getStatusAsync();
        if (status && status.isLoaded && status.positionMillis > 3000) {
            seek(0); return;
        }


        if (playlist && playlist.length > 0 && (currentIndex > 0 || repeatMode === 'all')) {
            let prevIdx;
            if (isShuffleActive) {

                if (playlist.length <= 1) { prevIdx = 0; }
                else { let randomIdx; do { randomIdx = Math.floor(Math.random() * playlist.length); } while (randomIdx === currentIndex); prevIdx = randomIdx; }
            } else {
                prevIdx = currentIndex - 1;
                if (prevIdx < 0) prevIdx = playlist.length - 1;
            }
            setCurrentIndex(prevIdx);
            _internalLoadAndPlayTrack(playlist[prevIdx], true);
        } else {
            seek(0);
        }
    }, [playlist, queue, isShuffleActive, currentIndex, repeatMode, seek, _internalLoadAndPlayTrack]);

    const addToQueue = useCallback((track) => {
        if (track && track.url) {
            setQueue(prevQueue => {
                const newQueue = [...prevQueue, track];
                console.log(`[PlayerContext] Added to queue: "${track.title}". New queue length: ${newQueue.length}`);
                return newQueue;
            });
        }
    }, []);

    const playNextInQueue = useCallback((track) => {
        if (track && track.url) {
            setQueue(prevQueue => {
                const newQueue = [track, ...prevQueue];
                console.log(`[PlayerContext] Added to START of queue: "${track.title}". New queue length: ${newQueue.length}`);
                return newQueue;
            });
            if (!currentTrack && !isPlaying) {

            }
        }
    }, [currentTrack, isPlaying ]);

    const clearQueue = useCallback(() => { setQueue([]); console.log("[PlayerContext] Queue cleared."); }, []);
    const toggleLikeCurrentTrack = useCallback(async () => { if (!currentTrack || !currentTrack.id) return; const newLikedState = !isLiked; setIsLiked(newLikedState); if (newLikedState) await likeTrack(currentTrack.id); else await unlikeTrack(currentTrack.id); }, [currentTrack, isLiked, _updateLikeStatus]);
    const toggleShuffle = useCallback(() => { setIsShuffleActive(prev => !prev); }, []);
    const cycleRepeat = useCallback(() => { setRepeatMode(prev => { const modes = ['off', 'all', 'one']; const idx = modes.indexOf(prev); const nextMode = modes[(idx + 1) % modes.length]; if (soundObjectRef.current && isSoundLoaded) soundObjectRef.current.setIsLoopingAsync(nextMode === 'one'); return nextMode; }); }, [isSoundLoaded]);


    useEffect(() => {
        Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, shouldDuckAndroid: true, playThroughEarpieceAndroid: false, staysActiveInBackground: true,}).catch(e=>console.error("Failed to set audio mode", e));
        if (!soundObjectRef.current) soundObjectRef.current = new Audio.Sound();
        return () => { if (soundObjectRef.current) unloadCurrentSound(); };
    }, [unloadCurrentSound]);


    const memoizedActions = React.useMemo(() => ({
        loadAudio, play, pause, seek,
        playNextTrack: skipToNext,
        playPreviousTrack: skipToPrevious,
        handleTrackActuallyFinished,
        toggleLikeCurrentTrack, toggleShuffle, cycleRepeat, unloadCurrentSound,
        addToQueue, playNextInQueue, clearQueue,
    }), [
        loadAudio, play, pause, seek, skipToNext, skipToPrevious, handleTrackActuallyFinished,
        toggleLikeCurrentTrack, toggleShuffle, cycleRepeat, unloadCurrentSound,
        addToQueue, playNextInQueue, clearQueue
    ]);

    useEffect(() => { actionsRef.current = memoizedActions; }, [memoizedActions]);

    return (
        <PlayerContext.Provider value={{
            currentTrack, playlist, currentIndex, queue,
            isPlaying, playbackPosition, playbackDuration, isLoading, isSoundLoaded,
            isLiked, repeatMode, isShuffleActive, isSeekingRef,
            actions: memoizedActions
        }}>
            {children}
        </PlayerContext.Provider>
    );
};

export const usePlayer = () => {
    const context = useContext(PlayerContext);
    if (context === undefined) throw new Error('usePlayer must be used within a PlayerProvider');
    return context;
};
