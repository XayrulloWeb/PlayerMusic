// screens/PlayerScreen.js
import React, { useEffect, useState, useCallback, useRef, memo } from 'react'; // Добавили memo
import {
    View, Text, Image, TouchableOpacity, ActivityIndicator,
    StyleSheet, Platform, StatusBar as RNStatusBar // Переименовали, чтобы не конфликтовать с expo-status-bar
} from 'react-native';
import { StatusBar } from 'expo-status-bar'; // expo-status-bar
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Slider from '@react-native-community/slider';
import { usePlayer } from '../context/PlayerContext';

// Цвета (адаптируйте под ваши Tailwind custom-*)
const COLOR_BACKGROUND = '#030318';
const COLOR_TEXT_PRIMARY = '#FAFAFA';
const COLOR_TEXT_SECONDARY = '#A0A0A0';
const COLOR_ACCENT_PRIMARY = '#8DEEED';
const COLOR_ACCENT_SECONDARY = '#7037E4';
const COLOR_ICON_INACTIVE = '#6b7280'; // Пример: gray-500 из Tailwind
const COLOR_PROGRESS_BAR_BG = '#374151'; // Пример: gray-700 из Tailwind
const fallbackArtwork = 'https://via.placeholder.com/300/030318/FAFAFA?text=No+Artwork';

// Обертываем основной функционал в PlayerScreenFunc для использования с React.memo
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

    // useEffect для загрузки трека при изменении параметров маршрута или текущего трека в контексте
    useEffect(() => {
        const paramsTrack = route.params?.track;
        const paramsPlaylist = route.params?.playlist;
        const paramsCurrentIndex = route.params?.currentIndex;

        if (paramsTrack && paramsTrack.url) {
            // Условие для загрузки:
            // 1. Не идет уже загрузка в контексте.
            // 2. Либо ID трека из параметров отличается от ID последнего обработанного из параметров.
            // 3. Либо в контексте вообще нет текущего трека, а в параметрах есть.
            // 4. Либо трек в контексте есть, но его ID отличается от трека в параметрах.
            if (!isLoadingAudioContext &&
                (lastProcessedRouteTrackIdRef.current !== paramsTrack.id ||
                    (!currentTrack && paramsTrack) ||
                    (currentTrack && currentTrack.id !== paramsTrack.id))
            ) {
                console.log(`[PlayerScreen] Effect: Loading track from params: ${paramsTrack.title} (ID: ${paramsTrack.id}). Context track ID: ${currentTrack?.id}`);
                actions.loadAudio(paramsTrack, true, paramsPlaylist, paramsCurrentIndex);
                lastProcessedRouteTrackIdRef.current = paramsTrack.id;
            } else if (isLoadingAudioContext) {
                console.log(`[PlayerScreen] Effect: Skipped load. Audio is currently loading in context. Param track: ${paramsTrack.title}`);
            } else if (currentTrack && currentTrack.id === paramsTrack.id) {
                console.log(`[PlayerScreen] Effect: Skipped load. Param track ${paramsTrack.title} is already current track in context.`);
                // Можно добавить автоплей, если трек тот же, но не играет:
                // if (!isPlaying && isSoundLoaded) actions.play(currentTrack);
            }
        } else if (!paramsTrack && !currentTrack) {
            console.log("[PlayerScreen] Effect: No track in params or context to load.");
        }
        // actions мемоизирован в контексте, поэтому его можно безопасно добавлять в зависимости
    }, [route.params, currentTrack, isLoadingAudioContext, actions]);


    // useEffect для обновления значения слайдера
    useEffect(() => {
        if (isSoundLoaded && playbackDuration > 0 && !isSeekingRef.current) {
            const newSliderValue = playbackPosition / playbackDuration;
            if (isFinite(newSliderValue) && sliderValue !== newSliderValue) {
                setSliderValue(newSliderValue);
            }
        } else if ((!isSoundLoaded || playbackDuration === 0) && sliderValue !== 0) {
            setSliderValue(0);
        }
    }, [playbackPosition, playbackDuration, isSeekingRef, isSoundLoaded, sliderValue]);


    // Мемоизированные обработчики событий UI
    const handlePlayPause = useCallback(() => {
        if (isLoadingAudioContext || !currentTrack?.url) return;
        if (isPlaying) {
            actions.pause();
        } else {
            actions.play(currentTrack);
        }
    }, [isLoadingAudioContext, currentTrack, isPlaying, actions]);

    const onSliderValueChange = useCallback((value) => {
        setSliderValue(value);
    }, []);

    const onSlidingStart = useCallback(() => {
        isSeekingRef.current = true;
    }, [isSeekingRef]); // isSeekingRef.current не меняется, но сам ref стабилен

    const onSlidingComplete = useCallback(async (value) => {
        if (isSoundLoaded && playbackDuration > 0) {
            const newPosition = value * playbackDuration;
            await actions.seek(newPosition);
        }
        // isSeekingRef.current сбрасывается в actions.seek или здесь, если seek не был вызван
        if (!(isSoundLoaded && playbackDuration > 0)) {
            isSeekingRef.current = false;
        }
    }, [isSoundLoaded, playbackDuration, actions, isSeekingRef]);

    // Мемоизированные функции форматирования и получения имени иконки
    const formatTime = useCallback((millis = 0) => {
        if (isNaN(millis) || millis < 0) millis = 0;
        const totalSeconds = Math.floor(millis / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }, []);

    const getRepeatIconName = useCallback(() => {
        if (repeatMode === 'one') return 'repeat-one-outline';
        return 'repeat-outline'; // Для 'all' и 'off' одна иконка, цвет разный
    }, [repeatMode]);

    // Определяем, какой трек отображать (из контекста или из параметров, если контекст еще не обновился)
    const displayTrack = currentTrack || route.params?.track;

    // Если нет трека для отображения и не идет загрузка
    if (!displayTrack && !isLoadingAudioContext) {
        return (
            <View style={styles.containerNoTrack} className="justify-center items-center p-5">
                <StatusBar style="light" />
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButtonAbsolute}>
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
            {/* Верхняя панель */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 rounded-full active:bg-custom-surface/30">
                    <Ionicons name="chevron-down-outline" size={28} color={COLOR_TEXT_PRIMARY} />
                </TouchableOpacity>
                <Text style={styles.albumTitleText} numberOfLines={1}>
                    {displayTrack?.album || 'Now Playing'}
                </Text>
                <TouchableOpacity
                    onPress={actions.toggleLikeCurrentTrack}
                    className="p-2 rounded-full active:bg-custom-surface/30"
                    disabled={isLoadingAudioContext || !displayTrack?.id}
                >
                    <Ionicons name={isLiked ? "heart" : "heart-outline"} size={26} color={isLiked ? COLOR_ACCENT_PRIMARY : COLOR_TEXT_PRIMARY} />
                </TouchableOpacity>
            </View>

            {/* Обложка */}
            <View style={styles.artworkContainer}>
                <Image
                    source={{ uri: displayTrack?.artwork || fallbackArtwork }}
                    style={styles.artworkImage}
                />
            </View>

            {/* Информация о треке */}
            <View style={styles.trackInfoContainer}>
                <Text style={styles.trackTitleText} numberOfLines={2}>
                    {displayTrack?.title || 'Track Title'}
                </Text>
                <Text style={styles.artistNameText}>
                    {displayTrack?.artist || 'Artist Name'}
                </Text>
            </View>

            {/* Слайдер прогресса */}
            <View style={styles.sliderUiContainer}>
                <Slider
                    style={styles.slider}
                    value={sliderValue}
                    minimumValue={0}
                    maximumValue={1}
                    minimumTrackTintColor={COLOR_ACCENT_PRIMARY}
                    maximumTrackTintColor={COLOR_PROGRESS_BAR_BG}
                    thumbTintColor={COLOR_ACCENT_PRIMARY}
                    onValueChange={onSliderValueChange}
                    onSlidingStart={onSlidingStart}
                    onSlidingComplete={onSlidingComplete}
                    disabled={isLoadingAudioContext || !isSoundLoaded || playbackDuration === 0}
                />
                <View style={styles.timeContainer}>
                    <Text style={styles.timeText}>
                        {formatTime(isSeekingRef.current && isSoundLoaded ? sliderValue * playbackDuration : playbackPosition)}
                    </Text>
                    <Text style={styles.timeText}>
                        {formatTime(playbackDuration)}
                    </Text>
                </View>
            </View>

            {/* Кнопки управления */}
            <View style={styles.controlsContainer}>
                <TouchableOpacity onPress={actions.toggleShuffle} className="p-3" disabled={isLoadingAudioContext}>
                    <Ionicons name={isShuffleActive ? "shuffle" : "shuffle-outline"} size={26} color={isShuffleActive ? COLOR_ACCENT_PRIMARY : COLOR_ICON_INACTIVE} />
                </TouchableOpacity>
                <TouchableOpacity onPress={actions.playPreviousTrack} className="p-3" disabled={isLoadingAudioContext || !isSoundLoaded}>
                    <Ionicons name="play-skip-back-outline" size={32} color={(!isSoundLoaded || isLoadingAudioContext) ? COLOR_ICON_INACTIVE : COLOR_TEXT_PRIMARY} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={handlePlayPause}
                    style={styles.playPauseButton}
                    disabled={isLoadingAudioContext || !displayTrack?.url}
                    activeOpacity={0.7}
                >
                    {isLoadingAudioContext ? (
                        <ActivityIndicator size="large" color={COLOR_TEXT_PRIMARY} />
                    ) : (
                        <Ionicons name={isPlaying ? "pause-outline" : "play-outline"} size={40} color={COLOR_TEXT_PRIMARY} />
                    )}
                </TouchableOpacity>
                <TouchableOpacity onPress={actions.playNextTrack} className="p-3" disabled={isLoadingAudioContext || !isSoundLoaded}>
                    <Ionicons name="play-skip-forward-outline" size={32} color={(!isSoundLoaded || isLoadingAudioContext) ? COLOR_ICON_INACTIVE : COLOR_TEXT_PRIMARY} />
                </TouchableOpacity>
                <TouchableOpacity onPress={actions.cycleRepeat} className="p-3" disabled={isLoadingAudioContext}>
                    <Ionicons name={getRepeatIconName()} size={26} color={repeatMode !== 'off' ? COLOR_ACCENT_PRIMARY : COLOR_ICON_INACTIVE} />
                </TouchableOpacity>
            </View>
            {/* Отступ снизу для SafeArea на iOS или просто для воздуха */}
            <View style={{ height: Platform.OS === 'ios' ? 34 : 20 }} />
        </View>
    );
};

// Экспортируем мемоизированный компонент
export default memo(PlayerScreenFunc);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // RNStatusBar.currentHeight для Android, 50 для iOS (примерно)
        paddingTop: Platform.OS === 'ios' ? 50 : (RNStatusBar.currentHeight || 0) + 10,
        backgroundColor: COLOR_BACKGROUND,
    },
    containerNoTrack: {
        flex: 1,
        backgroundColor: COLOR_BACKGROUND,
        // justifyContent и alignItems будут применены через className
    },
    closeButtonAbsolute: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : (RNStatusBar.currentHeight || 0) + 10,
        left: 15,
        zIndex: 10, // Чтобы кнопка была поверх
    },
    messageText: { color: COLOR_TEXT_SECONDARY, fontSize: 18, marginTop: 16 },
    subMessageText: { color: COLOR_TEXT_SECONDARY, fontSize: 14, marginTop: 8, textAlign: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20, // Tailwind: px-5
        marginBottom: 24,      // Tailwind: mb-6
    },
    albumTitleText: {
        fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5,
        flex: 1, textAlign: 'center', paddingHorizontal: 8, // Tailwind: px-2
        color: COLOR_TEXT_SECONDARY,
    },
    artworkContainer: {
        marginBottom: 32,      // Tailwind: mb-8
        alignItems: 'center',
        paddingHorizontal: 32, // Tailwind: px-8
    },
    artworkImage: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 12,      // Tailwind: rounded-xl
        backgroundColor: '#1f2937', // Tailwind: bg-gray-800 (или ваш custom-surface-darker)
    },
    trackInfoContainer: {
        marginBottom: 32,      // Tailwind: mb-8
        paddingHorizontal: 24, // Tailwind: px-6
        alignItems: 'center',
    },
    trackTitleText: {
        fontSize: 24,          // Tailwind: text-2xl
        fontWeight: 'bold',    // Tailwind: font-bold
        textAlign: 'center',
        color: COLOR_TEXT_PRIMARY,
    },
    artistNameText: {
        textAlign: 'center',
        fontSize: 18,          // Tailwind: text-lg
        marginTop: 6,          // Tailwind: mt-1.5
        color: COLOR_TEXT_SECONDARY,
    },
    sliderUiContainer: {
        width: '100%',
        marginBottom: 4,       // Tailwind: mb-1
        paddingHorizontal: 16, // Tailwind: px-4
    },
    slider: {
        width: '100%',
        height: 40,
    },
    timeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 0,
        paddingHorizontal: 8, // Tailwind: px-2
    },
    timeText: {
        fontSize: 12,          // Tailwind: text-xs
        color: COLOR_TEXT_SECONDARY,
        fontVariant: ['tabular-nums'], // Для моноширинных цифр (Tailwind не имеет прямого аналога)
    },
    controlsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-evenly',
        width: '100%',
        paddingHorizontal: 20, // Tailwind: px-5
        marginTop: 16,         // Tailwind: mt-4
        marginBottom: 16,      // Tailwind: mb-4
    },
    playPauseButton: {
        width: 72,             // Tailwind: w-18 (если 1_unit = 4px)
        height: 72,            // Tailwind: h-18
        borderRadius: 36,      // Tailwind: rounded-full
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLOR_ACCENT_SECONDARY, // Tailwind: bg-custom-secondary
        // Тени для iOS и Android
        ...(Platform.OS === 'ios' ? {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
        } : {
            elevation: 8,
        }),
    },
});
