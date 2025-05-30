// components/MiniPlayer.js
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../context/PlayerContext';
import Slider from '@react-native-community/slider';

// Цвета из вашего CSS и для консистентности
// Используйте ваши HEX-эквиваленты custom-цветов из Tailwind для иконок
const ICON_COLOR_TEXT_PRIMARY = '#FAFAFA';    // custom-quaternary
const ICON_COLOR_ACCENT = '#8DEEED';      // custom-primary
const PROGRESS_BAR_BACKGROUND = '#27272a'; // Пример: zinc-800 (темнее, чем фон плеера)

const MINI_PLAYER_BACKGROUND_COLOR = '#0F0F2B';
const MINI_PLAYER_SHADOW_COLOR_IOS = 'rgba(15, 15, 18, 0.4)';

const MiniPlayer = () => {
    const navigation = useNavigation();
    const {
        currentTrack,
        isPlaying,
        playbackPosition,
        playbackDuration,
        actions
    } = usePlayer();

    if (!currentTrack) {
        return null;
    }

    const progress = playbackDuration > 0 ? playbackPosition / playbackDuration : 0;

    const handlePlayPause = () => {
        if (isPlaying) {
            actions.pause();
        } else {
            actions.play(currentTrack);
        }
    };

    const openFullScreenPlayer = () => {
        navigation.navigate('Player', {
            track: currentTrack,
            playlist: usePlayer().playlist,
            currentIndex: usePlayer().currentIndex,
        });
    };

    return (
        // Внешний View для фона и тени (используем StyleSheet)
        <View style={styles.miniPlayerContainer}>
            {/* Прогресс-бар (тонкая полоска) */}
            <Slider
                style={styles.progressBar}
                value={progress}
                minimumValue={0}
                maximumValue={1}
                minimumTrackTintColor={ICON_COLOR_ACCENT}
                maximumTrackTintColor={PROGRESS_BAR_BACKGROUND}
                thumbTintColor="transparent"
                disabled
            />

            {/* Основной контент мини-плеера с Tailwind */}
            <TouchableOpacity
                onPress={openFullScreenPlayer}
                activeOpacity={0.8} // Небольшой эффект при нажатии на всю область
                className="flex-row items-center h-[60px] px-3"
            >
                <Image
                    source={{ uri: currentTrack.artwork || 'https://via.placeholder.com/40?text=Art' }}
                    className="w-10 h-10 rounded-md bg-zinc-700" // Tailwind
                />
                <View className="flex-1 mx-3">
                    <Text className="text-sm font-semibold text-custom-quaternary" numberOfLines={1}>
                        {/* Tailwind: text-custom-quaternary */}
                        {currentTrack.title}
                    </Text>
                    <Text className="text-xs text-custom-quaternary/70" numberOfLines={1}>
                        {/* Tailwind: text-custom-quaternary/70 */}
                        {currentTrack.artist}
                    </Text>
                </View>

                <TouchableOpacity onPress={handlePlayPause} className="p-2">
                    <Ionicons
                        name={isPlaying ? "pause-circle" : "play-circle"}
                        size={32}
                        color={ICON_COLOR_TEXT_PRIMARY} // Используем константу
                    />
                </TouchableOpacity>

                <TouchableOpacity onPress={actions.playNextTrack} className="p-2 ml-1">
                    <Ionicons
                        name="play-skip-forward-outline"
                        size={26}
                        color={ICON_COLOR_TEXT_PRIMARY} // Используем константу
                    />
                </TouchableOpacity>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    miniPlayerContainer: {
        backgroundColor: MINI_PLAYER_BACKGROUND_COLOR, // background: #ffffff0f;
        // Тень: box-shadow: 0 -10px 30px 0 #0f0f1266;
        ...(Platform.OS === 'ios' ? {
            shadowColor: MINI_PLAYER_SHADOW_COLOR_IOS,
            shadowOffset: { width: 0, height: -10 },
            shadowRadius: 30,
            shadowOpacity: 1, // Прозрачность уже в shadowColor
        } : {
            // Для Android, elevation - основной способ тени.
            // Цвет тени на Android обычно не настраивается так гибко.
            // Тень будет отбрасываться от backgroundColor.
            elevation: 20, // Подберите значение
        }),
        // bottom: 0; - это будет управляться позиционированием в App.js
    },
    progressBar: {
        width: '100%',
        height: Platform.OS === 'ios' ? 1.5 : 3,
        position: 'absolute',
        top: -1, // Чтобы был над основным фоном, но под контентом
        left: 0,
        zIndex: 1, // Не обязательно, если фон miniPlayerContainer уже есть
    },
});

export default MiniPlayer;
