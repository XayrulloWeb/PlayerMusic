import React, { useEffect, useState, useCallback, useMemo, useRef, memo } from 'react';
import {
    View, Text, Image, TouchableOpacity, ActivityIndicator,
    StyleSheet, Platform, StatusBar as RNStatusBar, Alert, Dimensions
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    runOnJS,
    // useDerivedValue, // We might not need this if the simpler state update works well
    // useAnimatedReaction // Alternative for syncing
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { usePlayer } from '../context/PlayerContext'; // Adjust path

// Цвета и константы (keeping them as they were)
const COLOR_BACKGROUND = '#030318';
const COLOR_TEXT_PRIMARY = '#FAFAFA';
const COLOR_TEXT_SECONDARY = '#A0A0B0';
const COLOR_ACCENT_PRIMARY = '#8DEEED';
const COLOR_ACCENT_SECONDARY = '#7037E4';
const COLOR_ICON_INACTIVE = '#6b7280';
const COLOR_PROGRESS_BAR_BG = '#2D2D4A';
const COLOR_SUBTLE_HIGHLIGHT = 'rgba(255, 255, 255, 0.05)';

const fallbackArtwork = 'https://via.placeholder.com/400/030318/FAFAFA?text=No+Artwork';
const { width: screenWidth } = Dimensions.get('window');

// PlayerHeader, ArtworkDisplay, TrackInfo remain the same
const PlayerHeader = memo(({ albumName, onGoBack, onToggleLike, isLiked, isLoading, trackId }) => {
    return (
        <View style={styles.header}>
            <TouchableOpacity onPress={onGoBack} style={styles.headerButton}>
                <Ionicons name="chevron-down-outline" size={28} color={COLOR_TEXT_PRIMARY} />
            </TouchableOpacity>
            <Text style={styles.albumTitleText} numberOfLines={1}>{albumName || 'Now Playing'}</Text>
            <TouchableOpacity
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onToggleLike();
                }}
                style={styles.headerButton}
                disabled={isLoading || !trackId}
            >
                <Ionicons
                    name={isLiked ? "heart" : "heart-outline"}
                    size={26}
                    color={isLiked ? COLOR_ACCENT_PRIMARY : COLOR_TEXT_PRIMARY}
                />
            </TouchableOpacity>
        </View>
    );
});

const ArtworkDisplay = memo(({ artworkUrl }) => {
    return (
        <View style={styles.artworkContainer}>
            <Image source={{ uri: artworkUrl || fallbackArtwork }} style={styles.artworkImage} />
        </View>
    );
});

const TrackInfo = memo(({ title, artist }) => {
    return (
        <View style={styles.trackInfoContainer}>
            <Text style={styles.trackTitleText} numberOfLines={2}>{title || 'Track Title'}</Text>
            <Text style={styles.artistNameText}>{artist || 'Artist Name'}</Text>
        </View>
    );
});


const AnimatedSlider = memo(({
                                 playbackPosition, // current position in ms
                                 playbackDuration, // total duration in ms
                                 onSeek,           // function to call when user seeks: onSeek(newPositionMs)
                                 isLoading,        // audio loading state
                                 isSoundLoaded,    // is sound ready
                                 formatTime        // function to format ms to string
                             }) => {
    const trackWidthSV = useSharedValue(0); // SV for track width
    const progressSV = useSharedValue(0);   // SV for current progress (0-1)

    // React state to manage if the user is actively dragging the slider.
    // This is controlled from the JS thread via runOnJS.
    const [isUserDraggingReactState, setIsUserDraggingReactState] = useState(false);

    // React state for the time displayed by the Text component.
    const [displayedTime, setDisplayedTime] = useState(0);

    // Effect to update the visual progress of the slider (progressSV)
    // when playbackPosition changes, but only if the user is NOT dragging.
    useEffect(() => {
        if (!isUserDraggingReactState && playbackDuration > 0 && isSoundLoaded) {
            const newProgress = playbackPosition / playbackDuration;
            if (isFinite(newProgress)) {
                progressSV.value = withTiming(newProgress, { duration: 100 });
            } else {
                progressSV.value = withTiming(0, { duration: 100 });
            }
        }
    }, [playbackPosition, playbackDuration, isSoundLoaded, isUserDraggingReactState, progressSV]);

    // Effect to update the displayed time text when playbackPosition changes,
    // but only if the user is NOT dragging.
    useEffect(() => {
        if (!isUserDraggingReactState) {
            setDisplayedTime(playbackPosition);
        }
    }, [playbackPosition, isUserDraggingReactState]);

    const panGesture = Gesture.Pan()
        .onBegin(() => {
            runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
            runOnJS(setIsUserDraggingReactState)(true);
        })
        .onUpdate((event) => {
            if (!isSoundLoaded || isLoading || trackWidthSV.value === 0) return;

            const newProgress = Math.max(0, Math.min(1, event.x / trackWidthSV.value));
            progressSV.value = newProgress; // Update shared value for immediate visual feedback of thumb/progress bar

            // Update React state for displayed time during drag
            if (playbackDuration > 0) {
                runOnJS(setDisplayedTime)(newProgress * playbackDuration);
            }
        })
        .onEnd((event) => {
            if (trackWidthSV.value > 0 && playbackDuration > 0) {
                const finalProgress = Math.max(0, Math.min(1, event.x / trackWidthSV.value));
                // It's good practice to set progressSV.value one last time onEnd if precision matters,
                // though onUpdate usually handles it.
                progressSV.value = finalProgress;
                runOnJS(onSeek)(finalProgress * playbackDuration);
            }
            runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
            runOnJS(setIsUserDraggingReactState)(false);
            // After dragging, the displayedTime will be updated by the useEffect listening to playbackPosition
            // once the audio engine catches up to the new seek position.
        });

    const animatedProgressStyle = useAnimatedStyle(() => {
        return {
            width: `${progressSV.value * 100}%`,
        };
    });

    const animatedThumbStyle = useAnimatedStyle(() => {
        const currentTrackWidth = trackWidthSV.value || 0; // Fallback if layout not yet measured
        const thumbVisualWidth = styles.sliderThumb.width || 14; // Get from styles or fallback
        const thumbHalfWidth = thumbVisualWidth / 2;

        let thumbTranslateX = progressSV.value * currentTrackWidth - thumbHalfWidth;
        // Clamp thumb position to stay within the track bounds
        thumbTranslateX = Math.max(0, thumbTranslateX);
        thumbTranslateX = Math.min(thumbTranslateX, currentTrackWidth - thumbVisualWidth);

        return {
            transform: [{ translateX: thumbTranslateX }],
        };
    });

    return (
        <View style={styles.sliderUiContainer}>
            <GestureDetector gesture={panGesture}>
                <View
                    style={styles.sliderGestureArea}
                    onLayout={(e) => {
                        trackWidthSV.value = e.nativeEvent.layout.width;
                    }}
                >
                    <View style={styles.sliderTrack}>
                        <Animated.View style={[styles.sliderProgress, animatedProgressStyle]} />
                        {/* The thumb container helps manage the thumb's absolute positioning logic */}
                        <Animated.View style={[styles.sliderThumbContainer, animatedThumbStyle]}>
                            <View style={styles.sliderThumb} />
                        </Animated.View>
                    </View>
                </View>
            </GestureDetector>
            <View style={styles.timeContainer}>
                <Text style={styles.timeText}>{formatTime(displayedTime)}</Text>
                <Text style={styles.timeText}>{formatTime(playbackDuration)}</Text>
            </View>
        </View>
    );
});

// PlayerControls remains the same
const PlayerControls = memo(({
                                 isPlaying, isLoading, isSoundLoaded, isShuffleActive, repeatMode, trackUrl,
                                 onPlayPause, onShuffle, onPrev, onNext, onRepeat, getRepeatIconName
                             }) => {
    return (
        <View style={styles.controlsContainer}>
            <View style={styles.secondaryControls}>
                <TouchableOpacity
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onShuffle(); }}
                    style={styles.secondaryButton}
                    disabled={isLoading}
                >
                    <Ionicons
                        name={isShuffleActive ? "shuffle" : "shuffle-outline"}
                        size={24}
                        color={isShuffleActive ? COLOR_ACCENT_PRIMARY : COLOR_ICON_INACTIVE}
                    />
                </TouchableOpacity>
                <View style={{width: 24}} />
                <TouchableOpacity
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onRepeat(); }}
                    style={styles.secondaryButton}
                    disabled={isLoading}
                >
                    <Ionicons
                        name={getRepeatIconName()}
                        size={24}
                        color={repeatMode !== 'off' ? COLOR_ACCENT_PRIMARY : COLOR_ICON_INACTIVE}
                    />
                </TouchableOpacity>
            </View>
            <View style={styles.primaryControls}>
                <TouchableOpacity
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onPrev(); }}
                    style={styles.controlButton}
                    disabled={isLoading || !isSoundLoaded}
                >
                    <Ionicons
                        name="play-skip-back-sharp"
                        size={32}
                        color={(!isSoundLoaded || isLoading) ? COLOR_ICON_INACTIVE : COLOR_TEXT_PRIMARY}
                    />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); onPlayPause(); }}
                    style={styles.playPauseButton}
                    disabled={isLoading || !trackUrl}
                >
                    {isLoading ? (
                        <ActivityIndicator size="large" color={COLOR_TEXT_PRIMARY} />
                    ) : (
                        <Ionicons
                            name={isPlaying ? "pause-sharp" : "play-sharp"}
                            size={40}
                            color={COLOR_TEXT_PRIMARY}
                        />
                    )}
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onNext(); }}
                    style={styles.controlButton}
                    disabled={isLoading || !isSoundLoaded}
                >
                    <Ionicons
                        name="play-skip-forward-sharp"
                        size={32}
                        color={(!isSoundLoaded || isLoading) ? COLOR_ICON_INACTIVE : COLOR_TEXT_PRIMARY}
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
});


const PlayerScreenFunc = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const {
        currentTrack, isPlaying, playbackPosition, playbackDuration,
        isLoading: isLoadingAudioContext, isSoundLoaded, isLiked,
        repeatMode, isShuffleActive, actions
    } = usePlayer();

    const lastProcessedRouteTrackIdRef = useRef(null);

    useEffect(() => {
        const paramsTrack = route.params?.track;
        if (paramsTrack && paramsTrack.url && paramsTrack.id) {
            if (!isLoadingAudioContext && lastProcessedRouteTrackIdRef.current !== paramsTrack.id) {
                actions.loadAudio(paramsTrack, true, route.params?.playlist, route.params?.currentIndex);
                lastProcessedRouteTrackIdRef.current = paramsTrack.id;
            }
        } else if (!currentTrack && !isLoadingAudioContext) {
            console.log("PlayerScreen: No valid track in params or context.");
        }
    }, [route.params?.track, isLoadingAudioContext, actions, currentTrack]);


    const handleGoBack = useCallback(() => navigation.goBack(), [navigation]);

    const handlePlayPause = useCallback(() => {
        if (isLoadingAudioContext || !currentTrack?.url) return;
        if (isPlaying) actions.pause();
        else actions.play(currentTrack);
    }, [isLoadingAudioContext, currentTrack, isPlaying, actions]);

    const handleSeek = useCallback((newPositionMillis) => {
        if (isSoundLoaded && playbackDuration > 0) {
            actions.seek(newPositionMillis);
        }
    }, [isSoundLoaded, playbackDuration, actions]);

    const formatTime = useCallback((millis = 0) => {
        if (isNaN(millis) || millis < 0) return '0:00';
        const totalSeconds = Math.floor(millis / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }, []);

    const getRepeatIconName = useCallback(() => {
        switch (repeatMode) {
            case 'one': return 'repeat-one-outline';
            case 'all': return 'repeat-outline';
            default: return 'repeat-outline';
        }
    }, [repeatMode]);

    const displayTrack = currentTrack || route.params?.track;

    if (!displayTrack && !isLoadingAudioContext) {
        return (
            <View style={styles.containerNoTrack}>
                <StatusBar style="light" />
                <TouchableOpacity onPress={handleGoBack} style={styles.closeButtonAbsolute}>
                    <Ionicons name="chevron-down-outline" size={28} color={COLOR_TEXT_PRIMARY} />
                </TouchableOpacity>
                <Ionicons name="musical-notes-outline" size={80} color={COLOR_TEXT_SECONDARY} />
                <Text style={styles.messageText}>No track selected</Text>
                <Text style={styles.subMessageText}>Go back and select a song to play.</Text>
            </View>
        );
    }

    const showLoadingOverlay = isLoadingAudioContext || (!displayTrack && isLoadingAudioContext);

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            {showLoadingOverlay && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={COLOR_ACCENT_PRIMARY} />
                </View>
            )}
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
            <AnimatedSlider
                playbackPosition={playbackPosition}
                playbackDuration={playbackDuration}
                onSeek={handleSeek}
                isLoading={isLoadingAudioContext}
                isSoundLoaded={isSoundLoaded}
                formatTime={formatTime}
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

// Styles remain the same
const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : (Platform.OS === 'ios' ? 50 : 20),
        backgroundColor: COLOR_BACKGROUND,
        paddingHorizontal: 16,
    },
    containerNoTrack: {
        flex: 1,
        backgroundColor: COLOR_BACKGROUND,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(3, 3, 24, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    closeButtonAbsolute: {
        position: 'absolute',
        top: Platform.OS === 'android' ? RNStatusBar.currentHeight + 10 : 50,
        left: 15,
        zIndex: 1,
    },
    messageText: {
        color: COLOR_TEXT_PRIMARY,
        fontSize: 20,
        fontWeight: '600',
        marginTop: 24,
        textAlign: 'center',
    },
    subMessageText: {
        color: COLOR_TEXT_SECONDARY,
        fontSize: 15,
        marginTop: 10,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: screenWidth * 0.05,
        marginTop: 10,
    },
    headerButton: {
        padding: 10,
        borderRadius: 25,
    },
    albumTitleText: {
        fontSize: 13,
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        flex: 1,
        textAlign: 'center',
        marginHorizontal: 8,
        color: COLOR_TEXT_SECONDARY,
    },
    artworkContainer: {
        alignItems: 'center',
        marginHorizontal: screenWidth * 0.08,
        marginBottom: screenWidth * 0.08,
    },
    artworkImage: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 16,
        backgroundColor: '#1f2937',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 10,
    },
    trackInfoContainer: {
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: screenWidth * 0.08,
    },
    trackTitleText: {
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'center',
        color: COLOR_TEXT_PRIMARY,
        marginBottom: 6,
    },
    artistNameText: {
        textAlign: 'center',
        fontSize: 16,
        color: COLOR_TEXT_SECONDARY,
    },
    sliderUiContainer: {
        marginBottom: 10,
    },
    sliderGestureArea: {
        height: 40,
        justifyContent: 'center',
        width: '100%',
    },
    sliderTrack: {
        height: 6,
        backgroundColor: COLOR_PROGRESS_BAR_BG,
        borderRadius: 3,
        width: '100%',
        justifyContent: 'center',
    },
    sliderProgress: {
        height: '100%',
        backgroundColor: COLOR_ACCENT_PRIMARY,
        borderRadius: 3,
    },
    sliderThumbContainer: {
        position: 'absolute',
        left: 0,
        height: 20,
        width: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sliderThumb: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: COLOR_TEXT_PRIMARY,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
    },
    timeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    timeText: {
        fontSize: 12,
        color: COLOR_TEXT_SECONDARY,
        fontVariant: ['tabular-nums'],
    },
    controlsContainer: {
        marginTop: screenWidth * 0.05,
        marginBottom: 10,
    },
    primaryControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 20,
    },
    secondaryControls: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: screenWidth * 0.1,
        marginBottom: screenWidth * 0.06,
    },
    controlButton: {
        padding: 12,
    },
    playPauseButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLOR_ACCENT_SECONDARY,
        marginHorizontal: 10,
        shadowColor: COLOR_ACCENT_SECONDARY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 10,
    },
    secondaryButton: {
        padding: 10,
    },
});
