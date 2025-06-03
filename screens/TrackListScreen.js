import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, FlatList, ActivityIndicator, Platform, StatusBar,
    Modal, TextInput, TouchableOpacity, Alert, StyleSheet
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons'; // Ionicons was not used
import { useNavigation } from '@react-navigation/native';
import * as MediaLibrary from 'expo-media-library';
import { getLikedTracksIds, addLikedTrack, removeLikedTrack } from '../utils/storage';
import TrackListItem from '../components/TrackListItem';
import { debounce } from 'lodash';

// Константы
const ICON_COLOR_SECONDARY = '#A0A0A0';
const ICON_COLOR_ACCENT = '#8DEEED';
const TEXT_COLOR_ON_ACCENT = '#030318';
const BG_COLOR_SCREEN = '#030318';
const PAGE_SIZE = 50;

const getFormattedLocalAudioFiles = async (currentPermission, startOffset = 0) => {
    if (currentPermission !== 'granted') return [];
    try {
        let afterAssetRef;
        if (startOffset > 0) {
            // MediaLibrary.getAssetAfter(offset) returns an AssetRef for the asset *after* the offset-th asset.
            // This is suitable for the 'after' parameter in getAssetsAsync.
            afterAssetRef = await MediaLibrary.getAssetAfter(startOffset);
            if (!afterAssetRef) { // No more assets after this offset
                return [];
            }
        }

        const media = await MediaLibrary.getAssetsAsync({
            mediaType: MediaLibrary.MediaType.audio,
            sortBy: [[MediaLibrary.SortBy.modificationTime, false]],
            first: PAGE_SIZE,
            after: afterAssetRef,
        });

        return media.assets.map(asset => ({
            id: `local-${asset.id}`,
            title: asset.filename.replace(/\.[^/.]+$/, "") || 'Unknown Title',
            artist: asset.artist || 'Unknown Artist',
            album: asset.album || 'On this device',
            artwork: null,
            duration: Math.round(asset.duration),
            url: asset.uri,
            isLocal: true,
            type: 'track',
            downloadStatus: 'downloaded', // Local files are considered downloaded
            assetId: asset.id,
        }));
    } catch (error) {
        console.error("Error fetching local audio files:", error);
        Alert.alert("Ошибка", "Не удалось загрузить локальные аудиофайлы.");
        return [];
    }
};

const deleteLocalTrack = async (track) => {
    if (!track.isLocal || !track.assetId) return false;
    try {
        const result = await MediaLibrary.deleteAssetsAsync([track.assetId]);
        if (result) {
            Alert.alert("Успех", `Трек "${track.title}" удален с устройства.`);
            return true;
        } else {
            Alert.alert("Ошибка", "Не удалось удалить трек (возможно, он уже был удален).");
            return false;
        }
    } catch (error) {
        console.error("Error deleting local track:", error);
        Alert.alert("Ошибка", "Произошла ошибка при удалении трека.");
        return false;
    }
};

const MemoizedTrackListItem = React.memo(TrackListItem);

export default function TrackListScreen() {
    const navigation = useNavigation();
    const [localTracks, setLocalTracks] = useState([]);
    const [mediaLibraryPermission, setMediaLibraryPermission] = useState(null);
    const [isLoadingTracks, setIsLoadingTracks] = useState(false); // Start false until permission is checked
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingTrack, setEditingTrack] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [editAlbum, setEditAlbum] = useState('');
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    // Debounced setters are generally not needed for controlled inputs if saving happens on a separate action.
    // Using direct setters for inputs, debouncing can be used for the save function if needed.
    // For this case, direct setters for inputs are fine.

    useEffect(() => {
        (async () => {
            if (Platform.OS !== 'web') {
                setIsLoadingTracks(true);
                const { status } = await MediaLibrary.requestPermissionsAsync();
                setMediaLibraryPermission(status);
                if (status !== 'granted') {
                    Alert.alert('Требуется разрешение', 'Необходимо разрешение на доступ к медиабиблиотеке для отображения локальных треков.');
                    setIsLoadingTracks(false);
                }
            } else {
                setMediaLibraryPermission('granted'); // For web, assume permission, but local files won't load
                setIsLoadingTracks(false); // No tracks to load from MediaLibrary on web
            }
        })();
    }, []);

    useEffect(() => {
        const fetchTracks = async () => {
            if (mediaLibraryPermission === 'granted' && Platform.OS !== 'web') {
                setIsLoadingTracks(true);
                const currentOffset = page * PAGE_SIZE;
                const newTracks = await getFormattedLocalAudioFiles(mediaLibraryPermission, currentOffset);

                if (newTracks.length > 0) {
                    const likedTrackIdArray = await getLikedTracksIds();
                    const lIds = new Set(likedTrackIdArray.map(id => id.toString()));

                    const tracksWithLikes = newTracks.map(t => ({
                        ...t,
                        isLiked: t.id ? lIds.has(t.id.toString()) : false
                    }));

                    setLocalTracks(prev => page === 0 ? tracksWithLikes : [...prev, ...tracksWithLikes]);
                    setHasMore(newTracks.length === PAGE_SIZE);
                } else {
                    if (page === 0) setLocalTracks([]);
                    setHasMore(false);
                }
                setIsLoadingTracks(false);
            } else if (mediaLibraryPermission !== null) { // If permission is determined (not granted or web)
                setLocalTracks([]);
                setHasMore(false);
                setIsLoadingTracks(false);
            }
        };

        if (mediaLibraryPermission !== null) { // Only fetch if permission status is determined
            fetchTracks();
        }
    }, [mediaLibraryPermission, page]);

    const handleDeleteTrack = async (track) => {
        const confirm = await new Promise(resolve => {
            Alert.alert(
                "Удалить трек",
                `Вы уверены, что хотите удалить "${track.title}" с устройства? Это действие необратимо.`,
                [
                    { text: "Отмена", style: "cancel", onPress: () => resolve(false) },
                    { text: "Удалить", style: "destructive", onPress: () => resolve(true) },
                ]
            );
        });
        if (confirm) {
            const deleted = await deleteLocalTrack(track);
            if (deleted) {
                setLocalTracks(prev => prev.filter(t => t.id !== track.id));
                try {
                    await removeLikedTrack(track.id);
                } catch (error) {
                    console.warn("Could not remove track from likes after deletion:", error);
                }
            }
        }
    };

    const openEditModal = (track) => {
        setEditingTrack(track);
        setEditTitle(track.title);
        setEditAlbum(track.album === 'On this device' ? '' : track.album);
        setIsEditModalVisible(true);
    };

    const closeEditModal = () => {
        setIsEditModalVisible(false);
        setEditingTrack(null);
        setEditTitle('');
        setEditAlbum('');
    };

    const handleSaveEdit = async () => {
        if (!editingTrack) return;
        if (editTitle.trim() === '') {
            Alert.alert("Ошибка", "Название трека не может быть пустым.");
            return;
        }
        // Note: MediaLibrary API does not provide a direct way to edit metadata of audio files.
        // This change is only local to the app's state.
        setLocalTracks(prev =>
            prev.map(t =>
                t.id === editingTrack.id
                    ? { ...t, title: editTitle.trim(), album: editAlbum.trim() || 'On this device' }
                    : t
            )
        );
        closeEditModal();
        Alert.alert("Успех", "Данные трека обновлены (локально в приложении).");
    };

    const handleToggleLike = async (track) => {
        if (!track || !track.id) return;
        try {
            const lIdsArray = await getLikedTracksIds();
            const isLiked = lIdsArray.includes(track.id.toString());
            if (isLiked) {
                await removeLikedTrack(track.id.toString());
                Alert.alert("Удалено из избранного", `"${track.title}" удален из избранного.`);
            } else {
                await addLikedTrack(track.id.toString());
                Alert.alert("Добавлено в избранное", `"${track.title}" добавлен в избранное.`);
            }
            setLocalTracks(prev =>
                prev.map(t => t.id === track.id ? { ...t, isLiked: !isLiked } : t))
        } catch (error) {
            console.error("Error toggling like:", error);
            Alert.alert("Ошибка", "Не удалось обновить статус лайка.");
        }
    };

    const handleToggleDownload = (track) => {
        // For local files, "download status" is always downloaded. This function is a placeholder.
        Alert.alert(
            "Информация",
            `Трек "${track.title}" уже находится на устройстве.`
        );
    };

    const handleTrackPress = (track) => {
        const playlist = localTracks.filter(t => t.url);
        const trackIndex = playlist.findIndex(t => t.id === track.id);
        if (track.url && trackIndex !== -1) {
            navigation.navigate('Player', {
                track,
                playlist,
                currentIndex: trackIndex,
            });
        } else {
            Alert.alert("Ошибка воспроизведения", "Этот трек не может быть воспроизведен.");
        }
    };

    const handleLoadMore = () => {
        if (!isLoadingTracks && hasMore) {
            setPage(prev => prev + 1);
        }
    };

    const renderTrackItem = ({ item, index }) => (
        <MemoizedTrackListItem
            item={item}
            index={index}
            onPress={() => handleTrackPress(item)}
            onDelete={() => handleDeleteTrack(item)}
            onMoreOptions={() => openEditModal(item)}
            onToggleLike={() => handleToggleLike(item)}
            onToggleDownload={() => handleToggleDownload(item)}
            showTrackNumber={true}
            showArtwork={false}
        />
    );

    if (isLoadingTracks && page === 0 && mediaLibraryPermission === null) {
        return (
            <View style={styles.fullScreenLoader}>
                <ActivityIndicator size="large" color={ICON_COLOR_ACCENT} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={BG_COLOR_SCREEN} translucent={false} />
            <FlatList
                data={localTracks}
                renderItem={renderTrackItem}
                keyExtractor={(item) => item.id.toString()}
                ListHeaderComponent={() => (
                    <View style={styles.listHeaderContainer}>
                        <Text style={styles.listHeaderTitle}>
                            Список треков
                        </Text>
                    </View>
                )}
                ListEmptyComponent={() => (
                    <View style={styles.emptyStateContainer}>
                        <MaterialCommunityIcons name="music-off" size={56} color={ICON_COLOR_SECONDARY} />
                        <Text style={styles.emptyStateText}>
                            {mediaLibraryPermission !== 'granted' && Platform.OS !== 'web'
                                ? "Требуется разрешение на доступ к локальным аудиофайлам."
                                : "Треки не найдены."}
                        </Text>
                        {mediaLibraryPermission !== 'granted' && Platform.OS !== 'web' && (
                            <TouchableOpacity
                                onPress={async () => {
                                    setIsLoadingTracks(true); // Show loader while re-requesting
                                    const { status } = await MediaLibrary.requestPermissionsAsync();
                                    setMediaLibraryPermission(status);
                                    if (status === 'granted') {
                                        setPage(0); // Reset page to fetch from beginning
                                        setHasMore(true); // Assume there might be tracks now
                                    } else {
                                        setIsLoadingTracks(false);
                                    }
                                }}
                                style={styles.requestPermissionButton}
                            >
                                <Text style={styles.requestPermissionButtonText}>Запросить разрешение</Text>
                            </TouchableOpacity>
                        )}
                        {mediaLibraryPermission === 'granted' && localTracks.length === 0 && !isLoadingTracks && Platform.OS !== 'web' && (
                            <Text style={styles.emptyStateSubText}>
                                Аудиофайлы на устройстве не найдены. Добавьте аудиофайлы в музыкальные папки устройства.
                            </Text>
                        )}
                    </View>
                )}
                ListFooterComponent={isLoadingTracks && page > 0 ? <ActivityIndicator style={{ marginVertical: 20 }} size="small" color={ICON_COLOR_ACCENT} /> : null}
                contentContainerStyle={{ paddingBottom: 90 }}
                showsVerticalScrollIndicator={false}
                initialNumToRender={15}
                maxToRenderPerBatch={10}
                windowSize={10}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.7}
            />
            <Modal
                animationType="fade"
                transparent={true}
                visible={isEditModalVisible}
                onRequestClose={closeEditModal}
            >
                <View style={styles.modalOuterContainer}>
                    <View style={styles.modalInnerContainer}>
                        <Text style={styles.modalTitle}>
                            Редактировать трек
                        </Text>
                        <TextInput
                            placeholder="Название трека"
                            placeholderTextColor={ICON_COLOR_SECONDARY}
                            value={editTitle}
                            onChangeText={setEditTitle}
                            style={styles.modalTextInput}
                            autoFocus={true}
                        />
                        <TextInput
                            placeholder="Альбом"
                            placeholderTextColor={ICON_COLOR_SECONDARY}
                            value={editAlbum}
                            onChangeText={setEditAlbum}
                            style={styles.modalTextInput}
                        />
                        <View style={styles.modalButtonRow}>
                            <TouchableOpacity
                                onPress={closeEditModal}
                                style={[styles.modalButton, styles.modalCancelButton]}
                            >
                                <Text style={styles.modalButtonText}>Отмена</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleSaveEdit}
                                style={[styles.modalButton, styles.modalSaveButton]}
                            >
                                <Text style={[styles.modalButtonText, { color: TEXT_COLOR_ON_ACCENT }]}>
                                    Сохранить
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: BG_COLOR_SCREEN },
    fullScreenLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG_COLOR_SCREEN },
    listHeaderContainer: {
        paddingHorizontal: 20, // px-5
        paddingBottom: 8,    // pb-2
        paddingTop: 16,      // pt-4
    },
    listHeaderTitle: {
        fontSize: 24, // text-titulos-xl (example size, adjust as needed)
        fontWeight: 'bold',
        color: '#FAFAFA', // text-custom-quaternary
    },
    emptyStateContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, marginTop: 20 },
    emptyStateText: { fontSize: 17, fontWeight: '600', color: ICON_COLOR_SECONDARY, textAlign: 'center', marginTop: 16 },
    emptyStateSubText: { fontSize: 14, color: ICON_COLOR_SECONDARY, opacity: 0.8, textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },
    requestPermissionButton: {
        marginTop: 16, // mt-4
        backgroundColor: ICON_COLOR_ACCENT, // bg-custom-primary (assuming primary is accent)
        paddingVertical: 8, // py-2
        paddingHorizontal: 16, // px-4
        borderRadius: 6, // rounded-md
    },
    requestPermissionButtonText: {
        color: TEXT_COLOR_ON_ACCENT, // text-custom-tertiary (assuming tertiary is text on accent)
        fontWeight: '600', // font-semibold
    },
    modalOuterContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 20 },
    modalInnerContainer: { backgroundColor: '#1E1E1E', width: '100%', padding: 24, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 5 },
    modalTitle: {
        fontSize: 20, // text-xl
        fontWeight: 'bold',
        color: '#FAFAFA', // text-custom-quaternary
        marginBottom: 24, // mb-6
        textAlign: 'center',
    },
    modalTextInput: {
        backgroundColor: '#2C2C2E', // bg-custom-tertiary (example color)
        color: '#FAFAFA', // text-custom-quaternary
        padding: 16, // p-4
        borderRadius: 8, // rounded-lg
        marginBottom: 16, // mb-4 (for first), mb-6 (for second before buttons)
        borderWidth: 1,
        borderColor: '#4A4A4A', // border-custom-border (example color)
        fontSize: 16, // text-base
    },
    modalButtonRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 8, // Adjusted from mb-6 on last input
    },
    modalButton: {
        paddingVertical: 12, // py-3
        paddingHorizontal: 20, // px-5
        borderRadius: 8, // rounded-lg
        marginLeft: 12, // space-x-3
    },
    modalCancelButton: {
        backgroundColor: '#555555', // bg-zinc-600
    },
    modalSaveButton: {
        backgroundColor: ICON_COLOR_ACCENT, // bg-custom-primary
    },
    modalButtonText: {
        color: '#FAFAFA', // text-custom-quaternary
        fontWeight: '600', // font-semibold
    },
});
