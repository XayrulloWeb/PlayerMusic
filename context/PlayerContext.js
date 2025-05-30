// context/PlayerContext.js
import React, { createContext, useState, useContext, useRef, useEffect, useCallback } from 'react';
import { Audio } from 'expo-av';
import { isTrackLiked, likeTrack, unlikeTrack } from '../utils/storage'; // Убедитесь, что путь правильный

const PlayerContext = createContext(undefined);

export const PlayerProvider = ({ children }) => {
    // Основное состояние плеера
    const [currentTrack, setCurrentTrack] = useState(null);        // Текущий играющий/загруженный трек
    const [playlist, setPlaylist] = useState([]);                  // Основной плейлист (альбом, плейлист пользователя)
    const [currentIndex, setCurrentIndex] = useState(0);           // Индекс текущего трека в `playlist`
    const [queue, setQueue] = useState([]);                        // Дополнительная очередь воспроизведения

    // Состояние воспроизведения
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackPosition, setPlaybackPosition] = useState(0);
    const [playbackDuration, setPlaybackDuration] = useState(0);
    const [isLoading, setIsLoading] = useState(false);             // Флаг загрузки аудиофайла
    const [isSoundLoaded, setIsSoundLoaded] = useState(false);     // Флаг, что звук загружен в `soundObjectRef`

    // Дополнительные состояния
    const [isLiked, setIsLiked] = useState(false);
    const [repeatMode, setRepeatMode] = useState('off');           // 'off', 'all' (для плейлиста/очереди), 'one' (для трека)
    const [isShuffleActive, setIsShuffleActive] = useState(false); // Для основного плейлиста

    // Refs
    const soundObjectRef = useRef(null);    // Инстанс Audio.Sound
    const isSeekingRef = useRef(false);     // Флаг, что пользователь сейчас перематывает слайдер
    const actionsRef = useRef({});      // Для доступа к последней версии actions из замыканий

    // --- Вспомогательные функции ---
    const _updateLikeStatus = useCallback(async (trackId) => {
        if (trackId) {
            setIsLiked(await isTrackLiked(trackId));
        } else {
            setIsLiked(false);
        }
    }, []); // Зависимостей нет, isTrackLiked - внешняя

    const unloadCurrentSound = useCallback(async (stopPlayback = true) => {
        console.log('[PlayerContext] Attempting to unload current sound. Stop playback:', stopPlayback);
        if (soundObjectRef.current) {
            try {
                const status = await soundObjectRef.current.getStatusAsync();
                if (status.isLoaded) {
                    if (stopPlayback) {
                        console.log('[PlayerContext] Stopping playback before unload.');
                        await soundObjectRef.current.stopAsync();
                    }
                    console.log('[PlayerContext] Unloading sound object.');
                    await soundObjectRef.current.unloadAsync();
                    console.log('[PlayerContext] Sound unloaded.');
                }
            } catch (error) {
                if (!error.message.includes("sound is not loaded") && !error.message.includes("PLAYER_ERR_NO_SRC_SET")) { // Игнорируем ожидаемые ошибки
                    console.error('[PlayerContext] Error during unloadCurrentSound:', error);
                }
            }
            // Важно всегда отписываться и сбрасывать флаг
            soundObjectRef.current.setOnPlaybackStatusUpdate(null);
            setIsSoundLoaded(false);
            if (stopPlayback) {
                setIsPlaying(false); // Сбрасываем isPlaying, если остановили
            }
        }
    }, []);


    // --- Основная логика загрузки и воспроизведения ---
    const _internalLoadAudio = useCallback(async (
        trackToLoad,
        playWhenReady,
        isFromQueue = false // Флаг, указывающий, из очереди ли трек
    ) => {
        if (!trackToLoad || !trackToLoad.url) {
            console.warn("[PlayerContext] _internalLoadAudio: No track or URL.", trackToLoad);
            await unloadCurrentSound();
            setCurrentTrack(null); // Сбрасываем трек, если он невалидный
            setPlaybackDuration(0); setPlaybackPosition(0); setIsPlaying(false); setIsLoading(false);
            _updateLikeStatus(null);
            return false;
        }

        console.log(`[PlayerContext] _internalLoadAudio: Preparing to load "${trackToLoad.title}". Play when ready: ${playWhenReady}. From queue: ${isFromQueue}`);
        setIsLoading(true);
        // Выгружаем предыдущий звук, не останавливая его, если это тот же трек (например, при смене аудиофокуса)
        await unloadCurrentSound(currentTrack?.id !== trackToLoad.id);

        setCurrentTrack(trackToLoad); // Устанавливаем трек ДО загрузки для UI
        await _updateLikeStatus(trackToLoad.id);

        try {
            if (!soundObjectRef.current) {
                soundObjectRef.current = new Audio.Sound();
                console.log("[PlayerContext] New Audio.Sound() instance created.");
            }

            // Установка обработчика статуса. Важно, чтобы он имел доступ к актуальным actions
            soundObjectRef.current.setOnPlaybackStatusUpdate((status) => {
                if (!status) return;
                if (!status.isLoaded) {
                    // Эта ветка также срабатывает при unloadAsync
                    setIsPlaying(false); // Если звук не загружен, он не может играть
                    if (status.error) console.error(`[PlayerContext] Playback Status Error (isLoaded=false): ${status.error}`);
                    // didJustFinish может прийти и при isLoaded=false, если это результат stopAsync + unloadAsync
                    if (status.didJustFinish && !status.isLooping) {
                        console.log("[PlayerContext] Track finished (onUpdate, isLoaded=false), calling actions.handleTrackActuallyFinished.");
                        actionsRef.current.handleTrackActuallyFinished();
                    }
                    return;
                }

                setIsSoundLoaded(true);
                if (!isSeekingRef.current) {
                    setPlaybackPosition(status.positionMillis || 0);
                }

                const trackExpectedDuration = currentTrack?.duration ? currentTrack.duration * 1000 : 0;
                setPlaybackDuration(status.durationMillis || playbackDuration || trackExpectedDuration);
                setIsPlaying(status.isPlaying);

                if (status.didJustFinish && !status.isLooping) {
                    console.log("[PlayerContext] Track finished (onUpdate, isLoaded=true), calling actions.handleTrackActuallyFinished.");
                    actionsRef.current.handleTrackActuallyFinished();
                }
            });

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false, playsInSilentModeIOS: true, shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false, staysActiveInBackground: true,
            });

            console.log(`[PlayerContext] Loading audio source: ${trackToLoad.url}`);
            await soundObjectRef.current.loadAsync({ uri: trackToLoad.url }, { shouldPlay: playWhenReady, progressUpdateIntervalMillis: 500 });
            console.log(`[PlayerContext] Audio loaded: "${trackToLoad.title}"`);
            // isPlaying и isSoundLoaded установятся через onPlaybackStatusUpdate
            setIsLoading(false);
            return true;
        } catch (error) {
            console.error(`[PlayerContext] Error in _internalLoadAudio for "${trackToLoad.title}":`, error);
            setCurrentTrack(null); setIsSoundLoaded(false); setIsPlaying(false); setIsLoading(false);
            return false;
        }
    }, [unloadCurrentSound, _updateLikeStatus, currentTrack, playbackDuration]); // currentTrack, playbackDuration для обновления setPlaybackDuration


    // --- Функции для управления очередью и основным плейлистом ---
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
            console.log("[PlayerContext] Playing next from MAIN playlist:", nextTrackToPlay.title);
            setCurrentIndex(nextIdx); // Обновляем индекс ДО загрузки
            _internalLoadAudio(nextTrackToPlay, true, false); // false - не из очереди
            return true;
        }
        return false;
    }, [playlist, isShuffleActive, currentIndex, repeatMode, _internalLoadAudio]);

    const playNextTrackFromQueue = useCallback(() => {
        if (queue.length > 0) {
            const nextTrackInQueue = queue[0];
            const newQueue = queue.slice(1);
            setQueue(newQueue);
            console.log("[PlayerContext] Playing next from QUEUE:", nextTrackInQueue.title);
            // Когда играем из очереди, основной плейлист и currentIndex не меняем явно здесь,
            // но _internalLoadAudio установит currentTrack.
            // Можно установить currentIndex в -1 или специальное значение, чтобы обозначить игру из очереди.
            // setCurrentIndex(-1); // Для индикации, что играем не из `playlist`
            _internalLoadAudio(nextTrackInQueue, true, true); // true - из очереди
            return true;
        }
        return false;
    }, [queue, _internalLoadAudio]);

    const handleTrackActuallyFinished = useCallback(() => {
        console.log("[PlayerContext] handleTrackActuallyFinished triggered.");
        if (repeatMode === 'one' && currentTrack) { // Добавил currentTrack, чтобы было что повторять
            if (soundObjectRef.current && isSoundLoaded) {
                console.log("[PlayerContext] Replaying current track (repeat one).");
                soundObjectRef.current.replayAsync().catch(e => console.error("[PlayerContext] Replay error", e));
            } else {
                // Если звук не загружен, но режим "repeat one", пытаемся загрузить его снова
                console.log("[PlayerContext] Sound not loaded for repeat one, reloading:", currentTrack.title);
                _internalLoadAudio(currentTrack, true, currentIndex < 0); // currentIndex < 0 означает, что это из очереди
            }
            return;
        }

        const playedFromPlaylist = playNextTrackFromPlaylist();
        if (!playedFromPlaylist) {
            const playedFromQueue = playNextTrackFromQueue();
            if (!playedFromQueue) {
                console.log("[PlayerContext] Main playlist and queue finished. Stopping playback.");
                if(soundObjectRef.current && isSoundLoaded) {
                    soundObjectRef.current.stopAsync().then(() => {
                        setIsPlaying(false);
                        setPlaybackPosition(0);
                        // Не сбрасываем currentTrack, чтобы мини-плеер мог его показать как последний игравший
                        // setCurrentTrack(null);
                    });
                } else {
                    setIsPlaying(false);
                    // setCurrentTrack(null); // Если звука нет, то и трека нет
                }
            }
        }
    }, [repeatMode, currentTrack, isSoundLoaded, playNextTrackFromPlaylist, playNextTrackFromQueue, _internalLoadAudio, currentIndex]);


    // --- Публичные ACTION функции ---
    const loadAudio = useCallback(async (track, playOnLoad, newPList, newIdx) => {
        console.log("[PlayerContext] Action: loadAudio called for", track?.title);
        setQueue([]); // При явной загрузке нового плейлиста/трека - очищаем очередь
        setPlaylist(newPList || []);
        setCurrentIndex(newIdx !== undefined ? newIdx : 0);
        return await _internalLoadAudio(track, playOnLoad, false); // false - не из очереди
    }, [_internalLoadAudio]);

    const play = useCallback(async (trackToPlay) => {
        const targetTrack = trackToPlay || currentTrack;
        console.log("[PlayerContext] Action: play called for", targetTrack?.title);
        if (!targetTrack || !targetTrack.url) { console.warn("[PlayerContext] Play: No track or URL."); return; }

        if (soundObjectRef.current && isSoundLoaded && currentTrack?.id === targetTrack.id) {
            if (!isPlaying) {
                console.log("[PlayerContext] Resuming current track:", targetTrack.title);
                try { await soundObjectRef.current.playAsync(); }
                catch (e) { console.error("[PlayerContext] Error resuming:", e); }
            } else { console.log("[PlayerContext] Already playing:", targetTrack.title); }
        } else {
            console.log("[PlayerContext] Play: Different track or sound not loaded. Calling _internalLoadAudio for:", targetTrack.title);
            // Определяем, из какого источника этот трек, если он не currentTrack
            let isFromQueue = false;
            let indexInSource = playlist.findIndex(t => t.id === targetTrack.id);
            if (indexInSource === -1) {
                indexInSource = queue.findIndex(t => t.id === targetTrack.id);
                if (indexInSource !== -1) isFromQueue = true;
                else indexInSource = 0; // Если трека нет нигде, играем как новый одиночный
            }
            // Если трек из основного плейлиста, используем его индекс.
            // Если из очереди, то isFromQueue = true.
            // Если это новый трек не из плейлиста/очереди, то _internalLoadAudio должен это обработать
            // и установить его как currentTrack, а playlist/currentIndex обновятся через loadAudio, если он был вызван.
            // Эта логика сложна, loadAudio должен быть основным входом для новых плейлистов.
            // Play должен в основном возобновлять или играть currentTrack.
            // Для простоты, если play вызван с треком, не являющимся currentTrack, считаем, что это новый контекст.
            // Это значит, что плейлист/очередь должны быть переданы через loadAudio.
            // Если просто play(newTrack), он будет играть как одиночный.
            if (currentTrack?.id !== targetTrack.id) {
                await loadAudio(targetTrack, true, [targetTrack], 0); // Играем как новый одиночный плейлист
            } else { // Это currentTrack, но звук не был загружен
                await _internalLoadAudio(targetTrack, true, currentIndex < 0);
            }
        }
    }, [isSoundLoaded, currentTrack, isPlaying, _internalLoadAudio, playlist, queue, loadAudio, currentIndex]);

    const pause = useCallback(async () => {
        console.log("[PlayerContext] Action: pause");
        if (soundObjectRef.current && isPlaying && isSoundLoaded) {
            try { await soundObjectRef.current.pauseAsync(); }
            catch (e) { console.error("[PlayerContext] Error pausing:", e); }
        }
    }, [isPlaying, isSoundLoaded]);

    const seek = useCallback(async (positionMillis) => {
        console.log("[PlayerContext] Action: seek to", positionMillis);
        if (soundObjectRef.current && isSoundLoaded) {
            try {
                isSeekingRef.current = true;
                setPlaybackPosition(positionMillis);
                await soundObjectRef.current.setStatusAsync({ positionMillis, shouldPlay: isPlaying });
            } catch (e) { console.error("[PlayerContext] Error seeking:", e); }
            finally { setTimeout(() => { isSeekingRef.current = false; }, 250); }
        }
    }, [isSoundLoaded, isPlaying]);

    // Кнопка "Next" - приоритет основному плейлисту, затем очереди
    const skipToNext = useCallback(() => {
        console.log("[PlayerContext] Action: skipToNext (User pressed Next)");
        if (playNextTrackFromPlaylist()) return; // Попытка сыграть следующий из основного плейлиста
        if (playNextTrackFromQueue()) return;   // Если не вышло, пытаемся из очереди
        // Если и там пусто, можно остановить или ничего не делать
        console.log("[PlayerContext] skipToNext: No next track in playlist or queue.");
        if(soundObjectRef.current && isSoundLoaded && isPlaying) {
            soundObjectRef.current.stopAsync().then(() => { setIsPlaying(false); setPlaybackPosition(0); });
        }
    }, [playNextTrackFromPlaylist, playNextTrackFromQueue, isSoundLoaded, isPlaying]);

    const skipToPrevious = useCallback(async () => {
        console.log("[PlayerContext] Action: skipToPrevious");
        if (!playlist || playlist.length === 0 && queue.length === 0) return;

        const status = await soundObjectRef.current?.getStatusAsync();
        if (status && status.isLoaded && status.positionMillis > 3000) {
            seek(0); return;
        }
        // Логика для "назад" сложнее с очередью.
        // Пока реализуем только для основного плейлиста.
        // TODO: Добавить логику для возврата к предыдущему треку из очереди или к концу основного плейлиста.
        if (currentIndex > 0 || (repeatMode === 'all' && playlist.length > 0)) {
            let prevIdx;
            if (isShuffleActive) { /* ... логика шаффла для предыдущего ... */
                if (playlist.length <= 1) { prevIdx = 0; } else { let randomIdx; do { randomIdx = Math.floor(Math.random() * playlist.length); } while (randomIdx === currentIndex && playlist.length > 1); prevIdx = randomIdx; }
            } else {
                prevIdx = currentIndex - 1;
                if (prevIdx < 0) prevIdx = playlist.length - 1; // Зацикливаем, если repeat all
            }
            setCurrentIndex(prevIdx); // Обновляем индекс ДО загрузки
            _internalLoadAudio(playlist[prevIdx], true, false);
        } else {
            seek(0); // Если это первый трек и нет репита, просто на начало
        }
    }, [playlist, isShuffleActive, currentIndex, repeatMode, seek, _internalLoadAudio]);


    const addToQueue = useCallback((track) => { /* ... как было ... */ }, [queue.length]);
    const playNextInQueue = useCallback((track) => { /* ... как было ... */ }, [isPlaying, currentTrack, queue, _internalLoadAudio]);
    const clearQueue = useCallback(() => { /* ... как было ... */ }, []);
    const toggleLikeCurrentTrack = useCallback(async () => { /* ... как было ... */ }, [currentTrack, isLiked, _updateLikeStatus]);
    const toggleShuffle = useCallback(() => { /* ... как было ... */ setIsShuffleActive(p => !p) }, []);
    const cycleRepeat = useCallback(() => { /* ... как было ... */ }, [isSoundLoaded]);


    useEffect(() => {
        Audio.setAudioModeAsync({ /* ... */ }).catch(e => console.error("Error setAudioModeAsync",e));
        if (!soundObjectRef.current) soundObjectRef.current = new Audio.Sound();
        return () => { if (soundObjectRef.current) unloadCurrentSound(); };
    }, [unloadCurrentSound]);


    const memoizedActions = React.useMemo(() => ({
        loadAudio, play, pause, seek,
        playNextTrack: skipToNext, // Пользовательская кнопка "Next"
        playPreviousTrack: skipToPrevious, // Пользовательская кнопка "Previous"
        handleTrackActuallyFinished, // Внутренняя, для onPlaybackStatusUpdate
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
