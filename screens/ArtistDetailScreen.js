import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
    View, Text, TouchableOpacity, Image, FlatList, Alert, ActivityIndicator, StyleSheet
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import TrackListItem from '../components/TrackListItem';
import { allTracksData as globalAllTracks } from './LibraryScreen';

const ICON_COLOR_PRIMARY = '#FAFAFA';
const ICON_COLOR_ACCENT = '#8DEEED';
const TEXT_COLOR_ON_ACCENT = '#030318';
const BG_COLOR = '#030318';
const ICON_COLOR_SECONDARY = '#A0A0A0';
const DEFAULT_ALBUM_ARTWORK = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=200&q=60';

const MemoizedTrackListItem = React.memo(TrackListItem);

const AlbumDetailScreen = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const albumId = route.params?.albumId?.toString();
    const [albumTracks, setAlbumTracks] = useState([]);
    const [albumDetails, setAlbumDetails] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchAlbumDetails = useCallback(() => {
        if (!albumId) {
            Alert.alert("Ошибка", "ID альбома не предоставлен.", [{ text: "OK", onPress: () => navigation.goBack() }]);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const tracks = globalAllTracks.filter(t => t.albumId === albumId);
            if (tracks.length > 0) {
                setAlbumTracks(tracks);
                setAlbumDetails({
                    id: albumId,
                    name: tracks[0].album || 'Unknown Album',
                    artist: tracks[0].artist || 'Unknown Artist',
                    artwork: tracks[0].artwork || DEFAULT_ALBUM_ARTWORK,
                });
            } else {
                Alert.alert("Ошибка", "Альбом не найден.", [{ text: "OK", onPress: () => navigation.goBack() }]);
                setAlbumDetails(null);
            }
        } catch (error) {
            Alert.alert("Ошибка", "Не удалось загрузить альбом.");
        }
        setIsLoading(false);
    }, [albumId, navigation]);

    useEffect(() => {
        fetchAlbumDetails();
        return () => {
            setAlbumTracks([]);
            setAlbumDetails(null);
        };
    }, [fetchAlbumDetails]);

    const computedTracks = useMemo(() => albumTracks, [albumTracks]);

    const handlePlayTrack = useCallback((track, index) => {
        if (!track?.url || !track.id) {
            Alert.alert("Ошибка", "Трек не может быть воспроизведен.");
            return;
        }
        navigation.navigate('Player', { track, playlist: computedTracks.filter(t => t.url && t.id), currentIndex: index });
    }, [computedTracks, navigation]);

    const handlePlayAll = useCallback(() => {
        const playableTracks = computedTracks.filter(t => t.url && t.id);
        if (playableTracks.length > 0) {
            handlePlayTrack(playableTracks[0], 0);
        } else {
            Alert.alert("Ошибка", "В альбоме нет доступных треков.");
        }
    }, [computedTracks, handlePlayTrack]);

    const handleShuffle = useCallback(() => {
        const playableTracks = computedTracks.filter(t => t.url && t.id);
        if (playableTracks.length > 0) {
            const shuffled = [...playableTracks].sort(() => Math.random() - 0.5);
            navigation.navigate('Player', { track: shuffled[0], playlist: shuffled, currentIndex: 0 });
        } else {
            Alert.alert("Ошибка", "В альбоме нет треков для перемешивания.");
        }
    }, [computedTracks, navigation]);

    const renderTrackItem = useCallback(({ item, index }) => (
        <MemoizedTrackListItem
            item={item}
            index={index}
            onPress={() => handlePlayTrack(item, index)}
            onMoreOptions={() => Alert.alert("Опции", "Функции трека в разработке.")} // Placeholder
            showTrackNumber={true}
            showArtwork={false}
        />
    ), [handlePlayTrack]);

    if (isLoading) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <StatusBar style="light" />
                <ActivityIndicator size="large" color={ICON_COLOR_ACCENT} />
            </View>
        );
    }

    if (!albumDetails) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <StatusBar style="light" />
                <Text style={styles.errorText}>Альбом не найден.</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar style="light" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="chevron-back-outline" size={28} color={ICON_COLOR_PRIMARY} />
                </TouchableOpacity>
            </View>
            <View style={styles.coverContainer}>
                <Image source={{ uri: albumDetails.artwork }} style={styles.coverImage} />
                <View style={styles.infoContainer}>
                    <Text style={styles.titleText}>{albumDetails.name}</Text>
                    <Text style={styles.artistText}>{albumDetails.artist}</Text>
                    <Text style={styles.statsText}>{albumTracks.length} треков</Text>
                </View>
            </View>
            <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.playButton} onPress={handlePlayAll}>
                    <Ionicons name="play-outline" size={24} color={TEXT_COLOR_ON_ACCENT} />
                    <Text style={styles.playButtonText}>Play</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shuffleButton} onPress={handleShuffle}>
                    <Ionicons name="shuffle-outline" size={24} color={ICON_COLOR_ACCENT} />
                </TouchableOpacity>
            </View>
            <FlatList
                data={computedTracks}
                renderItem={renderTrackItem}
                keyExtractor={(item, index) => `track-${item.id}-${index}`}
                ListEmptyComponent={() => (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateText}>Нет треков в альбоме.</Text>
                    </View>
                )}
                contentContainerStyle={{ paddingBottom: 90 }}
                initialNumToRender={10}
                windowSize={5}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: BG_COLOR },
    header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 },
    coverContainer: { alignItems: 'center', marginVertical: 20 },
    coverImage: { width: 150, height: 150, borderRadius: 12 },
    infoContainer: { alignItems: 'center', marginTop: 10 },
    titleText: { fontSize: 24, fontWeight: 'bold', color: ICON_COLOR_PRIMARY },
    artistText: { fontSize: 16, color: ICON_COLOR_SECONDARY, marginTop: 5 },
    statsText: { fontSize: 14, color: ICON_COLOR_SECONDARY, marginTop: 5 },
    buttonContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20 },
    playButton: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: ICON_COLOR_ACCENT,
        paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginRight: 10,
    },
    playButtonText: { color: TEXT_COLOR_ON_ACCENT, fontSize: 16, marginLeft: 5 },
    shuffleButton: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: ICON_COLOR_ACCENT },
    emptyState: { alignItems: 'center', marginTop: 20 },
    emptyStateText: { fontSize: 16, color: ICON_COLOR_SECONDARY },
    errorText: { fontSize: 18, color: ICON_COLOR_SECONDARY, textAlign: 'center', marginTop: 20 },
});

export default React.memo(AlbumDetailScreen);
