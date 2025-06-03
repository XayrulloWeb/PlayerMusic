import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
    View, Text, TouchableOpacity, Platform, Image, FlatList, Alert,
    StyleSheet, Modal, TextInput, ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation, useIsFocused } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { debounce } from 'lodash';

import TrackListItem from '../components/TrackListItem';
import AddToPlaylistModal from '../components/AddToPlaylistModal';
import {
    removeTrackFromPlaylist,
    getUserPlaylists,
    updatePlaylistDetails,
    deletePlaylist,
    isTrackLiked,
    likeTrack,
    unlikeTrack
} from '../utils/storage';
import { usePlayer } from '../context/PlayerContext';
import { allTracksData as globalAllTracks } from './LibraryScreen';

const ICON_COLOR_PRIMARY = '#FAFAFA';
const ICON_COLOR_ACCENT = '#8DEEED';
const TEXT_COLOR_ON_ACCENT = '#030318';
const BG_COLOR = '#030318';
const ICON_COLOR_SECONDARY = '#A0A0A0';
const DEFAULT_PLAYLIST_ARTWORK = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=200&q=60';
const MENU_BORDER_COLOR = '#374151';

const MemoizedTrackListItem = React.memo(TrackListItem);

const PlaylistDetailScreen = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    const insets = useSafeAreaInsets();
    const { currentTrack: currentPlayerTrack, isLiked: isCurrentTrackLikedByContext, actions: playerActions } = usePlayer();

    const playlistIdParam = route.params?.playlistId?.toString();

    const [playlistDetails, setPlaylistDetails] = useState(null);
    const [tracks, setTracks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessingAction, setIsProcessingAction] = useState(false);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingPlaylistName, setEditingPlaylistName] = useState('');
    const [editingPlaylistDescription, setEditingPlaylistDescription] = useState('');
    const [isTrackOptionsModalVisible, setIsTrackOptionsModalVisible] = useState(false);
    const [selectedTrackForOptions, setSelectedTrackForOptions] = useState(null);
    const [selectedTrackIsLikedLocal, setSelectedTrackIsLikedLocal] = useState(false);
    const [isAddToOtherPlaylistModalVisible, setIsAddToOtherPlaylistModalVisible] = useState(false);

    // Debounced input handlers
    const debouncedSetEditingPlaylistName = useCallback(debounce(setEditingPlaylistName, 300), []);
    const debouncedSetEditingDescription = useCallback(debounce(setEditingPlaylistDescription, 300), []);

    const fetchPlaylistDetails = useCallback(async (showLoading = true) => {
        if (!playlistIdParam) {
            Alert.alert("Ошибка", "ID плейлиста не предоставлен.", [{ text: "OK", onPress: () => navigation.goBack() }]);
            setIsLoading(false);
            return;
        }
        if (showLoading) setIsLoading(true);
        try {
            const allPlaylists = await getUserPlaylists();
            const currentPlaylist = allPlaylists.find(p => p.id === playlistIdParam);
            if (currentPlaylist) {
                const hydratedTracks = currentPlaylist.trackIds
                    ?.map(id => globalAllTracks.find(t => t.id === id)) // ИСПРАВЛЕНО ЗДЕСЬ
                    ?.filter(t => t && t.id) || [];
                setTracks(hydratedTracks);
                setPlaylistDetails({
                    ...currentPlaylist,
                    artwork: currentPlaylist.artwork || DEFAULT_PLAYLIST_ARTWORK,
                });
            } else {
                Alert.alert("Ошибка", "Плейлист не найден.", [{ text: "OK", onPress: () => navigation.goBack() }]);
                setPlaylistDetails(null);
            }
        } catch (error) {
            console.error("Failed to fetch playlist details:", error); // Добавил console.error для отладки
            Alert.alert("Ошибка", "Не удалось загрузить данные плейлиста.");
        }
        setIsLoading(false);
    }, [playlistIdParam, navigation]);
    useEffect(() => {
        if (isFocused) {
            fetchPlaylistDetails();
        }
        return () => {
            // Очистка состояния при размонтировании
            setTracks([]);
            setPlaylistDetails(null);
        };
    }, [isFocused, fetchPlaylistDetails]);

    useEffect(() => {
        const checkIfTrackIsLiked = async () => {
            if (selectedTrackForOptions?.id) {
                if (currentPlayerTrack?.id === selectedTrackForOptions.id) {
                    setSelectedTrackIsLikedLocal(isCurrentTrackLikedByContext);
                } else {
                    setSelectedTrackIsLikedLocal(await isTrackLiked(selectedTrackForOptions.id));
                }
            }
        };
        if (isTrackOptionsModalVisible && selectedTrackForOptions) {
            checkIfTrackIsLiked();
        }
    }, [isTrackOptionsModalVisible, selectedTrackForOptions, currentPlayerTrack, isCurrentTrackLikedByContext]);

    const computedTracks = useMemo(() => tracks, [tracks]);

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
            Alert.alert("Ошибка", "В плейлисте нет доступных треков.");
        }
    }, [computedTracks, handlePlayTrack]);

    const handleShuffle = useCallback(() => {
        const playableTracks = computedTracks.filter(t => t.url && t.id);
        if (playableTracks.length > 0) {
            const shuffled = [...playableTracks].sort(() => Math.random() - 0.5);
            navigation.navigate('Player', { track: shuffled[0], playlist: shuffled, currentIndex: 0 });
        } else {
            Alert.alert("Ошибка", "В плейлисте нет треков для перемешивания.");
        }
    }, [computedTracks, navigation]);

    const handleRemoveTrackFromPlaylist = async () => {
        if (!playlistDetails?.id || !selectedTrackForOptions?.id) {
            return;
        }
        setIsProcessingAction(true);
        try {
            const updatedPlaylist = await removeTrackFromPlaylist(playlistDetails.id, selectedTrackForOptions.id);
            if (updatedPlaylist) {
                setTracks(computedTracks.filter(t => t.id !== selectedTrackForOptions.id));
                setPlaylistDetails(prev => ({
                    ...prev,
                    trackIds: prev.trackIds.filter(id => id !== selectedTrackForOptions.id),
                }));
                Alert.alert("Успех", "Трек удален из плейлиста.");
            } else {
                Alert.alert("Ошибка", "Не удалось удалить трек.");
            }
        } catch (error) {
            Alert.alert("Ошибка", "Произошла ошибка при удалении трека.");
        }
        setIsProcessingAction(false);
        setIsTrackOptionsModalVisible(false);
    };

    const handleTrackOptions = (track) => {
        setSelectedTrackForOptions(track);
        setIsTrackOptionsModalVisible(true);
    };

    const handleEditPlaylist = () => {
        if (!playlistDetails) return;
        setEditingPlaylistName(playlistDetails.name);
        setEditingPlaylistDescription(playlistDetails.description || '');
        setIsEditModalVisible(true);
    };

    const handleSavePlaylistDetails = async () => {
        if (!editingPlaylistName.trim()) {
            Alert.alert("Ошибка", "Название плейлиста не может быть пустым.");
            return;
        }
        setIsProcessingAction(true);
        try {
            const updated = await updatePlaylistDetails(playlistDetails.id, {
                name: editingPlaylistName,
                description: editingPlaylistDescription,
            });
            if (updated) {
                setPlaylistDetails(prev => ({ ...prev, ...updated }));
                Alert.alert("Успех", "Плейлист обновлен.");
            } else {
                Alert.alert("Ошибка", "Не удалось обновить плейлист.");
            }
        } catch (error) {
            Alert.alert("Ошибка", "Произошла ошибка при обновлении плейлиста.");
        }
        setIsEditModalVisible(false);
        setIsProcessingAction(false);
    };

    const handleDeletePlaylist = () => {
        if (!playlistDetails) return;
        Alert.alert(
            "Удалить плейлист",
            `Вы уверены, что хотите удалить "${playlistDetails.name}"? Это действие необратимо.`,
            [
                { text: "Отмена", style: "cancel" },
                {
                    text: "Удалить",
                    style: "destructive",
                    onPress: async () => {
                        setIsProcessingAction(true);
                        try {
                            const success = await deletePlaylist(playlistDetails.id);
                            if (success) {
                                Alert.alert("Успех", `"${playlistDetails.name}" удален.`);
                                navigation.navigate('MainFlow', {
                                    screen: 'LibraryTab',
                                    params: { refreshTimestamp: Date.now() },
                                });
                            } else {
                                Alert.alert("Ошибка", "Не удалось удалить плейлист.");
                            }
                        } catch (error) {
                            Alert.alert("Ошибка", "Произошла ошибка при удалении плейлиста.");
                        }
                        setIsProcessingAction(false);
                    },
                },
            ]
        );
    };

    const handleToggleLikeTrack = async () => {
        if (!selectedTrackForOptions?.id) return;
        setIsProcessingAction(true);
        try {
            const isCurrentlyLiked = selectedTrackIsLikedLocal;
            if (isCurrentlyLiked) {
                await unlikeTrack(selectedTrackForOptions.id);
                setSelectedTrackIsLikedLocal(false);
                if (currentPlayerTrack?.id === selectedTrackForOptions.id) {
                    playerActions.setIsLiked(false);
                }
                Alert.alert("Успех", `"${selectedTrackForOptions.title}" удален из избранного.`);
            } else {
                await likeTrack(selectedTrackForOptions.id);
                setSelectedTrackIsLikedLocal(true);
                if (currentPlayerTrack?.id === selectedTrackForOptions.id) {
                    playerActions.setIsLiked(true);
                }
                Alert.alert("Успех", `"${selectedTrackForOptions.title}" добавлен в избранное.`);
            }
        } catch (error) {
            Alert.alert("Ошибка", "Не удалось обновить статус лайка.");
        }
        setIsProcessingAction(false);
    };

    const renderTrackItem = useCallback(({ item, index }) => (
        <MemoizedTrackListItem
            item={item}
            index={index}
            onPress={() => handlePlayTrack(item, index)}
            onMoreOptions={() => handleTrackOptions(item)}
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

    if (!playlistDetails) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <StatusBar style="light" />
                <Text style={styles.errorText}>Плейлист не найден.</Text>
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
                <TouchableOpacity onPress={handleEditPlaylist}>
                    <Ionicons name="ellipsis-horizontal-outline" size={28} color={ICON_COLOR_PRIMARY} />
                </TouchableOpacity>
            </View>
            <View style={styles.coverContainer}>
                <Image source={{ uri: playlistDetails.artwork }} style={styles.coverImage} />
                <View style={styles.infoContainer}>
                    <Text style={styles.titleText}>{playlistDetails.name}</Text>
                    <Text style={styles.descriptionText}>{playlistDetails.description || 'Без описания'}</Text>
                    <Text style={styles.statsText}>{tracks.length} треков</Text>
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
                        <MaterialCommunityIcons name="music-box-multiple-outline" size={56} color={ICON_COLOR_SECONDARY} />
                        <Text style={styles.emptyStateText}>Нет треков в плейлисте.</Text>
                    </View>
                )}
                contentContainerStyle={{ paddingBottom: 90 }}
                initialNumToRender={10}
                windowSize={5}
            />
            <Modal
                visible={isEditModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsEditModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Редактировать плейлист</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={editingPlaylistName}
                            onChangeText={debouncedSetEditingPlaylistName}
                            placeholder="Название плейлиста"
                            placeholderTextColor={ICON_COLOR_SECONDARY}
                        />
                        <TextInput
                            style={styles.modalInput}
                            value={editingPlaylistDescription}
                            onChangeText={debouncedSetEditingDescription}
                            placeholder="Описание"
                            placeholderTextColor={ICON_COLOR_SECONDARY}
                            multiline
                        />
                        <View style={styles.modalButtonContainer}>
                            <TouchableOpacity
                                style={styles.modalCancelButton}
                                onPress={() => setIsEditModalVisible(false)}
                                disabled={isProcessingAction}
                            >
                                <Text style={styles.modalButtonText}>Отмена</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalSaveButton}
                                onPress={handleSavePlaylistDetails}
                                disabled={isProcessingAction}
                            >
                                <Text style={[styles.modalButtonText, { color: TEXT_COLOR_ON_ACCENT }]}>
                                    {isProcessingAction ? 'Сохранение...' : 'Сохранить'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.deleteButton} onPress={handleDeletePlaylist} disabled={isProcessingAction}>
                            <Text style={styles.deleteButtonText}>Удалить плейлист</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            <Modal
                visible={isTrackOptionsModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsTrackOptionsModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{selectedTrackForOptions?.title}</Text>
                        <TouchableOpacity style={styles.modalOption} onPress={handleToggleLikeTrack}>
                            <Text style={styles.modalOptionText}>
                                {selectedTrackIsLikedLocal ? 'Удалить из избранного' : 'Добавить в избранное'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.modalOption}
                            onPress={() => {
                                setIsTrackOptionsModalVisible(false);
                                setIsAddToOtherPlaylistModalVisible(true);
                            }}
                        >
                            <Text style={styles.modalOptionText}>Добавить в другой плейлист</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalOption} onPress={handleRemoveTrackFromPlaylist}>
                            <Text style={[styles.modalOptionText, { color: '#ef4444' }]}>Удалить из этого плейлиста</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.modalCancelButton}
                            onPress={() => setIsTrackOptionsModalVisible(false)}
                        >
                            <Text style={styles.modalButtonText}>Отмена</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            <AddToPlaylistModal
                isVisible={isAddToOtherPlaylistModalVisible}
                onClose={() => setIsAddToOtherPlaylistModalVisible(false)}
                trackId={selectedTrackForOptions?.id}
                currentPlaylistId={playlistDetails?.id}
                onPlaylistUpdated={fetchPlaylistDetails}
            />
        </View>
    );
};

export default React.memo(PlaylistDetailScreen);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: BG_COLOR },
    header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10 },
    coverContainer: { alignItems: 'center', marginVertical: 20 },
    coverImage: { width: 150, height: 150, borderRadius: 12 },
    infoContainer: { alignItems: 'center', marginTop: 10 },
    titleText: { fontSize: 24, fontWeight: 'bold', color: ICON_COLOR_PRIMARY },
    descriptionText: { fontSize: 16, color: ICON_COLOR_SECONDARY, marginTop: 5 },
    statsText: { fontSize: 14, color: ICON_COLOR_SECONDARY, marginTop: 5 },
    buttonContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20 },
    playButton: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: ICON_COLOR_ACCENT,
        paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginRight: 10,
    },
    playButtonText: { color: TEXT_COLOR_ON_ACCENT, fontSize: 16, marginLeft: 5 },
    shuffleButton: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: ICON_COLOR_ACCENT },
    emptyState: { alignItems: 'center', marginTop: 20 },
    emptyStateText: { fontSize: 16, color: ICON_COLOR_SECONDARY, marginTop: 10 },
    errorText: { fontSize: 18, color: ICON_COLOR_SECONDARY, textAlign: 'center', marginTop: 20 },
    modalContainer: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 20 },
    modalContent: { backgroundColor: '#1E1E1E', padding: 20, borderRadius: 12 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: ICON_COLOR_PRIMARY, marginBottom: 20 },
    modalInput: {
        backgroundColor: '#374151', color: ICON_COLOR_PRIMARY, padding: 10,
        borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: MENU_BORDER_COLOR,
    },
    modalButtonContainer: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
    modalCancelButton: { padding: 10, backgroundColor: '#4b5563', borderRadius: 8, marginRight: 10 },
    modalSaveButton: { padding: 10, backgroundColor: ICON_COLOR_ACCENT, borderRadius: 8 },
    modalButtonText: { fontSize: 16, color: ICON_COLOR_PRIMARY },
    modalOption: { padding: 15, borderBottomWidth: 1, borderBottomColor: MENU_BORDER_COLOR },
    modalOptionText: { fontSize: 16, color: ICON_COLOR_PRIMARY },
    deleteButton: { marginTop: 20, padding: 10, alignItems: 'center' },
    deleteButtonText: { fontSize: 16, color: '#ef4444' },
});
