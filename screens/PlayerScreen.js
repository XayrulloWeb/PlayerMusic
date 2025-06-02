// screens/PlayerScreen.js
import React, { useEffect, useState, useCallback, useRef, memo } from 'react';
import {
    View, Text, Image, TouchableOpacity, ActivityIndicator,
    StyleSheet, Platform, StatusBar as RNStatusBar
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Slider from '@react-native-community/slider';
import { usePlayer } from '../context/PlayerContext';

// Цвета и константы
const COLOR_BACKGROUND = '#030318';
const COLOR_TEXT_PRIMARY = '#FAFAFA';
const COLOR_TEXT_SECONDARY = '#A0A0A0';
const COLOR_ACCENT_PRIMARY = '#8DEEED';
const COLOR_ACCENT_SECONDARY = '#7037E4';
const COLOR_ICON_INACTIVE = '#6b7280';
const COLOR_PROGRESS_BAR_BG = '#374151';
const fallbackArtwork = 'https://via.placeholder.com/300/030318/FAFAFA?text=No+Artwork';


const PlayerHeader = memo(({ albumName, onGoBack, onToggleLike, isLiked, isLoading, trackId }) => {
    return (
        <View style={styles.header}>
            <TouchableOpacity onPress={onGoBack} className="p-2 rounded-full active:bg-custom-surface/30">
                <Ionicons name="chevron-down-outline" size={28} color={COLOR_TEXT_PRIMARY} />
            </TouchableOpacity>
            <Text style={styles.albumTitleText} numberOfLines={1}>{albumName || 'Now Playing'}</Text>
            <TouchableOpacity onPress={onToggleLike} className="p-2 rounded-full active:bg-custom-surface/30" disabled={isLoading || !trackId}>
                <Ionicons name={isLiked ? "heart" : "heart-outline"} size={26} color={isLiked ? COLOR_ACCENT_PRIMARY : COLOR_TEXT_PRIMARY} />
            </TouchableOpacity>
        </View>
    );
});

const ArtworkDisplay = memo(({ artworkUrl }) => {
    // console.log("ArtworkDisplay RENDER");
    return (
        <View style={styles.artworkContainer}>
            <Image source={{ uri: artworkUrl || fallbackArtwork }} style={styles.artworkImage} />
        </View>
    );
});

const TrackInfo = memo(({ title, artist }) => {
    // console.log("TrackInfo RENDER");
    return (
        <View style={styles.trackInfoContainer}>
            <Text style={styles.trackTitleText} numberOfLines={2}>{title || 'Track Title'}</Text>
            <Text style={styles.artistNameText}>{artist || 'Artist Name'}</Text>
        </View>
    );
});

const PlayerProgressBar = memo(({
                                    sliderValue, playbackPosition, playbackDuration, onSliderValueChange,
                                    onSlidingStart, onSlidingComplete, isLoading, isSoundLoaded, formatTime, isSeekingRef
                                }) => {
    return (
        <View style={styles.sliderUiContainer}>
            <Slider
                style={styles.slider} value={sliderValue} minimumValue={0} maximumValue={1}
                minimumTrackTintColor={COLOR_ACCENT_PRIMARY} maximumTrackTintColor={COLOR_PROGRESS_BAR_BG}
                thumbTintColor={COLOR_ACCENT_PRIMARY} onValueChange={onSliderValueChange}
                onSlidingStart={onSlidingStart} onSlidingComplete={onSlidingComplete}
                disabled={isLoading || !isSoundLoaded || playbackDuration === 0}
            />
            <View style={styles.timeContainer}>
                <Text style={styles.timeText}>{formatTime(isSeekingRef.current && isSoundLoaded ? sliderValue * playbackDuration : playbackPosition)}</Text>
                <Text style={styles.timeText}>{formatTime(playbackDuration)}</Text>
            </View>
        </View>
    );
});

const PlayerControls = memo(({
                                 isPlaying, isLoading, isSoundLoaded, isShuffleActive, repeatMode, trackUrl,
                                 onPlayPause, onShuffle, onPrev, onNext, onRepeat, getRepeatIconName
                             }) => {
    return (
        <View style={styles.controlsContainer}>
            <TouchableOpacity onPress={onShuffle} className="p-3" disabled={isLoading}><Ionicons name={isShuffleActive ? "shuffle" : "shuffle-outline"} size={26} color={isShuffleActive ? COLOR_ACCENT_PRIMARY : COLOR_ICON_INACTIVE} /></TouchableOpacity>
            <TouchableOpacity onPress={onPrev} className="p-3" disabled={isLoading || !isSoundLoaded}><Ionicons name="play-skip-back-outline" size={32} color={(!isSoundLoaded || isLoading) ? COLOR_ICON_INACTIVE : COLOR_TEXT_PRIMARY} /></TouchableOpacity>
            <TouchableOpacity onPress={onPlayPause} style={styles.playPauseButton} disabled={isLoading || !trackUrl} activeOpacity={0.7}>
                {isLoading ? <ActivityIndicator size="large" color={COLOR_TEXT_PRIMARY} /> : <Ionicons name={isPlaying ? "pause-outline" : "play-outline"} size={40} color={COLOR_TEXT_PRIMARY} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={onNext} className="p-3" disabled={isLoading || !isSoundLoaded}><Ionicons name="play-skip-forward-outline" size={32} color={(!isSoundLoaded || isLoading) ? COLOR_ICON_INACTIVE : COLOR_TEXT_PRIMARY} /></TouchableOpacity>
            <TouchableOpacity onPress={onRepeat} className="p-3" disabled={isLoading}><Ionicons name={getRepeatIconName()} size={26} color={repeatMode !== 'off' ? COLOR_ACCENT_PRIMARY : COLOR_ICON_INACTIVE} /></TouchableOpacity>
        </View>
    );
});

// Основной компонент PlayerScreen
const PlayerScreenFunc = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const {
        currentTrack, isPlaying, playbackPosition, playbackDuration,
        isLoading: isLoadingAudioContext, isSoundLoaded, isLiked,
        repeatMode, isShuffleActive, isSeekingRef, actions
    } = usePlayer();

    const [sliderValue, setSliderValue] = useState(0);
    const lastProcessedRouteTrackIdRef = useRef(null);

    useEffect(() => {
        const paramsTrack = route.params?.track;
        const paramsPlaylist = route.params?.playlist;
        const paramsCurrentIndex = route.params?.currentIndex;

        if (paramsTrack && paramsTrack.url) {
            if (!isLoadingAudioContext && (lastProcessedRouteTrackIdRef.current !== paramsTrack.id || (!currentTrack && paramsTrack) || (currentTrack && currentTrack.id !== paramsTrack.id))) {
                // console.log(`[PlayerScreen] Effect: Loading track from params: ${paramsTrack.title}`);
                actions.loadAudio(paramsTrack, true, paramsPlaylist, paramsCurrentIndex);
                lastProcessedRouteTrackIdRef.current = paramsTrack.id;
            }
        }
    }, [route.params, currentTrack, isLoadingAudioContext, actions]);

    useEffect(() => {
        if (isSoundLoaded && playbackDuration > 0 && !isSeekingRef.current) {
            const newSliderValue = playbackPosition / playbackDuration;
            if (isFinite(newSliderValue) && Math.abs(sliderValue - newSliderValue) > 0.001) {
                setSliderValue(newSliderValue);
            }
        } else if ((!isSoundLoaded || playbackDuration === 0) && sliderValue !== 0) {
            setSliderValue(0);
        }
    }, [playbackPosition, playbackDuration, isSeekingRef, isSoundLoaded, sliderValue]);

    const handleGoBack = useCallback(() => navigation.goBack(), [navigation]);

    const handlePlayPause = useCallback(() => {
        if (isLoadingAudioContext || !currentTrack?.url) return;
        if (isPlaying) actions.pause();
        else actions.play(currentTrack);
    }, [isLoadingAudioContext, currentTrack, isPlaying, actions]);

    const onSliderValueChange = useCallback((value) => setSliderValue(value), []);
    const onSlidingStart = useCallback(() => { isSeekingRef.current = true; }, [isSeekingRef]);
    const onSlidingComplete = useCallback(async (value) => {
        if (isSoundLoaded && playbackDuration > 0) {
            await actions.seek(value * playbackDuration);
        }
        if (!(isSoundLoaded && playbackDuration > 0)) isSeekingRef.current = false;
    }, [isSoundLoaded, playbackDuration, actions, isSeekingRef]);

    const formatTime = useCallback((millis = 0) => {
        if (isNaN(millis) || millis < 0) millis = 0;
        const secs = Math.floor(millis / 1000); const mins = Math.floor(secs / 60);
        return `${mins}:${(secs % 60) < 10 ? '0' : ''}${secs % 60}`;
    }, []);

    const getRepeatIconName = useCallback(() => (repeatMode === 'one' ? 'repeat-one-outline' : 'repeat-outline'), [repeatMode]);

    const displayTrack = currentTrack || route.params?.track;

    if (!displayTrack && !isLoadingAudioContext) {
        return (
            <View style={styles.containerNoTrack} className="justify-center items-center p-5">
                <StatusBar style="light" />
                <TouchableOpacity onPress={handleGoBack} style={styles.closeButtonAbsolute}>
                    <Ionicons name="chevron-down-outline" size={28} color={COLOR_TEXT_PRIMARY} />
                </TouchableOpacity>
                <Ionicons name="musical-notes-outline" size={64} color={COLOR_TEXT_SECONDARY} />
                <Text style={styles.messageText}>No track selected</Text>
                <Text style={styles.subMessageText}>Go back and select a song to play.</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <PlayerHeader
                albumName={displayTrack?.album}
                onGoBack={handleGoBack}
                onToggleLike={actions.toggleLikeCurrentTrack}
                isLiked={isLiked}
                isLoading={isLoadingAudioContext}
                trackId={displayTrack?.id}
            />
            <ArtworkDisplay artworkUrl={displayTrack?.artwork} />
            <TrackInfo title={displayTrack?.title} artist={displayTrack?.artist} />
            <PlayerProgressBar
                sliderValue={sliderValue}
                playbackPosition={playbackPosition}
                playbackDuration={playbackDuration}
                onSliderValueChange={onSliderValueChange}
                onSlidingStart={onSlidingStart}
                onSlidingComplete={onSlidingComplete}
                isLoading={isLoadingAudioContext}
                isSoundLoaded={isSoundLoaded}
                formatTime={formatTime}
                isSeekingRef={isSeekingRef}
            />
            <PlayerControls
                isPlaying={isPlaying}
                isLoading={isLoadingAudioContext}
                isSoundLoaded={isSoundLoaded}
                isShuffleActive={isShuffleActive}
                repeatMode={repeatMode}
                trackUrl={displayTrack?.url}
                onPlayPause={handlePlayPause}
                onShuffle={actions.toggleShuffle}
                onPrev={actions.playPreviousTrack}
                onNext={actions.playNextTrack}
                onRepeat={actions.cycleRepeat}
                getRepeatIconName={getRepeatIconName}
            />
            <View style={{ height: Platform.OS === 'ios' ? 34 : 20 }} />
        </View>
    );
};
export default memo(PlayerScreenFunc);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: Platform.OS === 'ios' ? 50 : (RNStatusBar.currentHeight || 0) + 10,
        backgroundColor: COLOR_BACKGROUND,
    },
    containerNoTrack: {
        flex: 1,
        backgroundColor: COLOR_BACKGROUND,
    },
    closeButtonAbsolute: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : (RNStatusBar.currentHeight || 0) + 10,
        left: 15,
        zIndex: 10,
    },
    messageText: { color: COLOR_TEXT_SECONDARY, fontSize: 18, marginTop: 16 },
    subMessageText: { color: COLOR_TEXT_SECONDARY, fontSize: 14, marginTop: 8, textAlign: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, marginBottom: 24,
    },
    albumTitleText: {
        fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5,
        flex: 1, textAlign: 'center', paddingHorizontal: 8,
        color: COLOR_TEXT_SECONDARY,
    },
    artworkContainer: { marginBottom: 32, alignItems: 'center', paddingHorizontal: 32, },
    artworkImage: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: '#1f2937', },
    trackInfoContainer: { marginBottom: 32, paddingHorizontal: 24, alignItems: 'center', },
    trackTitleText: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: COLOR_TEXT_PRIMARY, },
    artistNameText: { textAlign: 'center', fontSize: 18, marginTop: 6, color: COLOR_TEXT_SECONDARY, },
    sliderUiContainer: { width: '100%', marginBottom: 4, paddingHorizontal: 16, },
    slider: { width: '100%', height: 40, },
    timeContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 0, paddingHorizontal: 8, },
    timeText: { fontSize: 12, color: COLOR_TEXT_SECONDARY, fontVariant: ['tabular-nums'], },
    controlsContainer: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly',
        width: '100%', paddingHorizontal: 20, marginTop: 16, marginBottom: 16,
    },
    playPauseButton: {
        width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center',
        backgroundColor: COLOR_ACCENT_SECONDARY,
        ...(Platform.OS === 'ios' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, }
            : { elevation: 8, }),
    },
});
