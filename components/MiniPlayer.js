// components/MiniPlayer.js
import React, { memo, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../context/PlayerContext';
import Slider from '@react-native-community/slider';


const ICON_COLOR_TEXT_PRIMARY = '#FAFAFA';
const ICON_COLOR_ACCENT = '#8DEEED';
const PROGRESS_BAR_BACKGROUND = '#27272a';
const MINI_PLAYER_BACKGROUND_COLOR = 'rgba(1,28,57,0.85)';
const MINI_PLAYER_SHADOW_COLOR_IOS = 'rgba(15, 15, 18, 0.4)';

const MiniPlayerFunc = () => {

    const navigation = useNavigation();
    const {
        currentTrack, isPlaying, playbackPosition, playbackDuration, actions
    } = usePlayer();

    if (!currentTrack) {
        return null;
    }

    const progress = playbackDuration > 0 && isFinite(playbackPosition) && isFinite(playbackDuration)
        ? playbackPosition / playbackDuration
        : 0;

    const handlePlayPause = useCallback(() => {
        if (isPlaying) actions.pause();
        else actions.play(currentTrack);
    }, [isPlaying, currentTrack, actions]);

    const openFullScreenPlayer = useCallback(() => {
        navigation.navigate('Player');
    }, [navigation]);


    return (
        <View style={styles.shadowContainer}>
            <View style={styles.miniPlayerItself}>
                <Slider
                    style={styles.progressBar}
                    value={isFinite(progress) ? progress : 0}
                    minimumValue={0}
                    maximumValue={1}
                    minimumTrackTintColor={ICON_COLOR_ACCENT}
                    maximumTrackTintColor={PROGRESS_BAR_BACKGROUND}
                    thumbTintColor="transparent"
                    disabled
                />
                <TouchableOpacity
                    onPress={openFullScreenPlayer}
                    activeOpacity={0.8}
                    className="flex-row items-center h-[60px] px-3"
                >
                    <Image
                        source={{ uri: currentTrack.artwork || 'https://via.placeholder.com/40?text=Art' }}
                        className="w-10 h-10 rounded-md bg-zinc-700"
                    />
                    <View className="flex-1 mx-3">
                        <Text className="text-sm font-semibold text-custom-quaternary" numberOfLines={1}>
                            {currentTrack.title}
                        </Text>
                        <Text className="text-xs text-custom-quaternary/70" numberOfLines={1}>
                            {currentTrack.artist}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={handlePlayPause} className="p-2">
                        <Ionicons name={isPlaying ? "pause-circle" : "play-circle"} size={32} color={ICON_COLOR_TEXT_PRIMARY} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={actions.playNextTrack} className="p-2 ml-1">
                        <Ionicons name="play-skip-forward-outline" size={26} color={ICON_COLOR_TEXT_PRIMARY} />
                    </TouchableOpacity>
                </TouchableOpacity>
            </View>
        </View>
    );
};
export default memo(MiniPlayerFunc);

const styles = StyleSheet.create({
    shadowContainer: {
        ...(Platform.OS === 'ios' ? { shadowColor: MINI_PLAYER_SHADOW_COLOR_IOS, shadowOffset: { width: 0, height: -8 }, shadowRadius: 20, shadowOpacity: 0.9, } // Уменьшил радиус и смещение для более тонкой тени
            : { elevation: 12,}),
    },
    miniPlayerItself: {
        backgroundColor: MINI_PLAYER_BACKGROUND_COLOR,

    },
    progressBar: {
        width: '100%',
        height: Platform.OS === 'ios' ? 2 : 3,
        position: 'absolute',
        top: Platform.OS === 'ios' ? -1 : -1.5,
        left: 0,
        zIndex: 1,
    },
});
