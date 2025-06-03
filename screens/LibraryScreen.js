import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, FlatList, ScrollView, ActivityIndicator, Platform, StatusBar,
    Modal, TextInput, TouchableOpacity, Alert, StyleSheet, Image
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import * as MediaLibrary from 'expo-media-library';
import {
    getLikedTracksIds,
    getUserPlaylists,
    createPlaylist,
    addLikedTrack,
    removeLikedTrack,
    removeTrackFromPlaylist
} from '../utils/storage';
import TrackListItem from '../components/TrackListItem';
import AddToPlaylistModal from '../components/AddToPlaylistModal';

// Константы
const ICON_COLOR_PRIMARY = '#FAFAFA';
const ICON_COLOR_SECONDARY = '#A0A0A0';
const ICON_COLOR_ACCENT = '#8DEEED';
const TEXT_COLOR_ON_ACCENT = '#030318';
const BG_COLOR_SCREEN = '#030318';
const DEFAULT_PLAYLIST_ARTWORK = 'https://images.unsplash.com/photo-1587329304169-f7cdf09ac800?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8cGxheWxpc3QlMjBhcnR3b3JrfGVufDB8fDB8fHww&auto=format&fit=crop&w=100&q=60';
const DEFAULT_TRACK_ARTWORK = 'https://via.placeholder.com/50?text=🎶';

// Компонент FilterChip для фильтров
const FilterChip = ({ label, selected, onPress }) => (
    <TouchableOpacity
        onPress={onPress}
        style={{
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 9999,
            marginRight: 10,
            borderWidth: 2,
            backgroundColor: selected ? '#8DEEED' : '#1E1E1E',
            borderColor: selected ? '#8DEEED' : '#3F3F46',
            shadowColor: selected ? '#000' : 'transparent',
            shadowOffset: selected ? { width: 0, height: 2 } : { width: 0, height: 0 },
            shadowOpacity: selected ? 0.2 : 0,
            shadowRadius: selected ? 4 : 0,
        }}
    >
        <Text style={{
            fontSize: 14,
            fontWeight: '600',
            color: selected ? '#030318' : '#FAFAFA80',
        }}>
            {label}
        </Text>
    </TouchableOpacity>
);

// Получение локальных аудиофайлов
const getFormattedLocalAudioFiles = async (currentPermission) => {
    if (currentPermission !== 'granted') return [];
    try {
        const media = await MediaLibrary.getAssetsAsync({
            mediaType: MediaLibrary.MediaType.audio,
            sortBy: [[MediaLibrary.SortBy.modificationTime, false]],
            first: 1000,
        });
        return media.assets.map(asset => ({
            id: `local-${asset.id}`,
            title: asset.filename.replace(/\.[^/.]+$/, '') || 'Unknown Title',
            artist: asset.artist || 'Unknown Artist',
            album: asset.album || 'On this device',
            artwork: asset.uri || null,
            duration: Math.round(asset.duration),
            url: asset.uri,
            isLocal: true,
            type: 'track',
            downloadStatus: asset.downloadStatus || 'not_downloaded',
            assetId: asset.id,
        }));
    } catch (error) {
        console.error('Error fetching local audio files:', error);
        Alert.alert('Ошибка', 'Не удалось загрузить локальные аудиофайлы.');
        return [];
    }
};

// Удаление локального трека
const deleteLocalTrack = async (track) => {
    if (!track.isLocal || !track.assetId) return false;
    try {
        const result = await MediaLibrary.deleteAssetsAsync([track.assetId]);
        if (result) {
            Alert.alert('Успех', `Трек "${track.title}" удален с устройства.`);
            return true;
        } else {
            Alert.alert('Ошибка', 'Не удалось удалить трек.');
            return false;
        }
    } catch (error) {
        console.error('Error deleting track:', error);
        Alert.alert('Ошибка', 'Не удалось удалить трек.');
        return false;
    }
};

export default function LibraryScreen() {
    const navigation = useNavigation();
    const isFocused = useIsFocused();

    const [selectedFilter, setSelectedFilter] = useState('All Songs');
    const filters = ['All Songs', 'Playlists', 'Albums', 'Liked Songs', 'Artists', 'Downloaded'];

    const [localTracks, setLocalTracks] = useState([]);
    const [userPlaylists, setUserPlaylists] = useState([]);
    const [mediaLibraryPermission, setMediaLibraryPermission] = useState(null);

    const [displayedItems, setDisplayedItems] = useState([]);
    const [itemTypeForList, setItemTypeForList] = useState('track');

    const [isLoadingTracks, setIsLoadingTracks] = useState(true);
    const [isProcessingData, setIsProcessingData] = useState(false);

    const [isCreatePlaylistModalVisible, setIsCreatePlaylistModalVisible] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [isAddToPlaylistModalVisible, setIsAddToPlaylistModalVisible] = useState(false);
    const [trackToAddToPlaylist, setTrackToAddToPlaylist] = useState(null);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingTrack, setEditingTrack] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [editAlbum, setEditAlbum] = useState('');

    useEffect(() => {
        (async () => {
            if (Platform.OS !== 'web') {
                const { status } = await MediaLibrary.requestPermissionsAsync();
                setMediaLibraryPermission(status);
            } else {
                setMediaLibraryPermission('granted');
            }
        })();
    }, []);

    useEffect(() => {
        const fetchTracks = async () => {
            if (mediaLibraryPermission === 'granted' && Platform.OS !== 'web') {
                setIsLoadingTracks(true);
                const tracks = await getFormattedLocalAudioFiles(mediaLibraryPermission);
                const lIds = await getLikedTracksIds();
                const tracksWithLikes = tracks.map(t => ({
                    ...t,
                    isLiked: t.id && lIds.includes(t.id.toString()),
                }));
                setLocalTracks(tracksWithLikes);
                setIsLoadingTracks(false);
            } else {
                setLocalTracks([]);
                setIsLoadingTracks(false);
            }
        };
        fetchTracks();
    }, [mediaLibraryPermission]);

    useEffect(() => {
        const loadAndFilterData = async () => {
            if (!isFocused) return;
            if (isLoadingTracks && !['Playlists'].includes(selectedFilter)) {
                setIsProcessingData(true);
                return;
            }
            setIsProcessingData(true);
            let newItems = [];
            let newType = 'track';
            try {
                switch (selectedFilter) {
                    case 'Playlists':
                        newType = 'playlist';
                        const playlistsFromDb = await getUserPlaylists();
                        newItems = playlistsFromDb
                            .map(p => ({
                                ...p,
                                type: 'playlist',
                                artwork: p.artwork || DEFAULT_PLAYLIST_ARTWORK,
                                trackCount: p?.trackIds?.length || 0,
                            }))
                            .sort((a, b) => b.createdAt - a.createdAt);
                        setUserPlaylists(newItems);
                        break;
                    case 'All Songs':
                        newType = 'track';
                        newItems = localTracks.map(t => ({ ...t, type: 'track' }));
                        break;
                    case 'Liked Songs':
                        newType = 'track';
                        const lIds = await getLikedTracksIds();
                        newItems = localTracks.filter(t => t.id && lIds.includes(t.id.toString())).map(t => ({ ...t, type: 'track' }));
                        break;
                    case 'Albums':
                        newType = 'album';
                        const alb = {};
                        localTracks.forEach(t => {
                            if (!t.album || t.album === '—') return;
                            if (!alb[t.album]) alb[t.album] = { id: t.album, name: t.album, artwork: t.artwork, artist: t.artist, tracks: [] };
                            alb[t.album].tracks.push(t);
                        });
                        newItems = Object.values(alb).map(a => ({ ...a, type: 'album' }));
                        break;
                    case 'Artists':
                        newType = 'artist';
                        const art = {};
                        localTracks.forEach(t => {
                            if (!t.artist) return;
                            if (!art[t.artist]) art[t.artist] = { id: t.artist, name: t.artist, artwork: t.artwork, trackCount: 0, tracks: [] };
                            art[t.artist].trackCount++;
                            art[t.artist].tracks.push(t);
                        });
                        newItems = Object.values(art).map(a => ({ ...a, type: 'artist' }));
                        break;
                    case 'Downloaded':
                        newType = 'track';
                        newItems = localTracks.filter(t => t.downloadStatus === 'downloaded').map(t => ({ ...t, type: 'track' }));
                        break;
                    default:
                        newItems = [];
                        break;
                }
            } catch (error) {
                console.error(`Error processing ${selectedFilter}:`, error);
                newItems = [];
            }
            setDisplayedItems(newItems);
            setItemTypeForList(newType);
            setIsProcessingData(false);
        };
        loadAndFilterData();
    }, [selectedFilter, isFocused, localTracks, isLoadingTracks, mediaLibraryPermission]);

    const triggerDataReloadForPlaylists = useCallback(async (switchToPlaylists = false) => {
        if (!isProcessingData) {
            setIsProcessingData(true);
            const playlistsFromDb = await getUserPlaylists();
            const formatted = playlistsFromDb
                .map(p => ({
                    ...p,
                    type: 'playlist',
                    artwork: p.artwork || DEFAULT_PLAYLIST_ARTWORK,
                    trackCount: p?.trackIds?.length || 0,
                }))
                .sort((a, b) => b.createdAt - a.createdAt);
            setUserPlaylists(formatted);
            if (selectedFilter === 'Playlists' || switchToPlaylists) {
                setDisplayedItems(formatted);
                setItemTypeForList('playlist');
                if (switchToPlaylists && selectedFilter !== 'Playlists') setSelectedFilter('Playlists');
            }
            setIsProcessingData(false);
        }
    }, [isProcessingData, selectedFilter]);

    const handleCreatePlaylistSubmit = async () => {
        if (newPlaylistName.trim() === '') {
            Alert.alert('Ошибка', 'Название плейлиста обязательно.');
            return;
        }
        setIsProcessingData(true);
        const created = await createPlaylist(newPlaylistName);
        setNewPlaylistName('');
        setIsCreatePlaylistModalVisible(false);
        if (created) await triggerDataReloadForPlaylists(true);
        else Alert.alert('Ошибка', 'Не удалось создать плейлист.');
        setIsProcessingData(false);
    };

    const handleTrackAddedToPlaylist = async (playlist, track) => {
        Alert.alert('Успех', `Трек "${track.title}" добавлен в "${playlist.name}".`);
        await triggerDataReloadForPlaylists();
    };

    const handleDeleteTrack = async (track) => {
        if (selectedFilter === 'Playlists') {
            const playlist = displayedItems.find(p => p.id === track.id);
            if (playlist) {
                await removeTrackFromPlaylist(playlist.id, track.id);
                await triggerDataReloadForPlaylists();
            }
        } else if (track.isLocal && mediaLibraryPermission === 'granted') {
            const confirm = await new Promise(resolve => {
                Alert.alert(
                    'Удалить трек',
                    `Вы уверены, что хотите удалить "${track.title}" с устройства?`,
                    [
                        { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
                        { text: 'Удалить', style: 'destructive', onPress: () => resolve(true) },
                    ]
                );
            });
            if (confirm) {
                const deleted = await deleteLocalTrack(track);
                if (deleted) {
                    setLocalTracks(prev => prev.filter(t => t.id !== track.id));
                }
            }
        } else {
            Alert.alert('Ошибка', 'Удаление не поддерживается для этого трека.');
        }
    };

    const handleEditTrack = (track) => {
        setEditingTrack(track);
        setEditTitle(track.title);
        setEditAlbum(track.album === 'On this device' ? '' : track.album);
        setIsEditModalVisible(true);
    };

    const handleSaveEdit = async () => {
        if (editTitle.trim() === '') {
            Alert.alert('Ошибка', 'Название трека обязательно.');
            return;
        }
        setLocalTracks(prev =>
            prev.map(t =>
                t.id === editingTrack.id
                    ? { ...t, title: editTitle, album: editAlbum || 'On this device' }
                    : t
            )
        );
        setIsEditModalVisible(false);
        setEditingTrack(null);
        setEditTitle('');
        setEditAlbum('');
        Alert.alert('Успех', 'Данные трека обновлены.');
    };

    const handleToggleLike = async (track) => {
        const lIds = await getLikedTracksIds();
        const isLiked = lIds.includes(track.id.toString());
        if (isLiked) {
            await removeLikedTrack(track.id);
            Alert.alert('Удалено из избранного', `"${track.title}" удален из избранных треков.`);
        } else {
            await addLikedTrack(track.id);
            Alert.alert('Добавлено в избранное', `"${track.title}" добавлен в избранные треки.`);
        }
        setLocalTracks(prev =>
            prev.map(t => (t.id === track.id ? { ...t, isLiked: !isLiked } : t))
        );
        if (selectedFilter === 'Liked Songs') {
            setDisplayedItems(prev => prev.filter(t => t.id !== track.id || !isLiked));
        }
    };

    const handleToggleDownload = (track) => {
        setLocalTracks(prev =>
            prev.map(t =>
                t.id === track.id
                    ? { ...t, downloadStatus: t.downloadStatus === 'downloaded' ? 'not_downloaded' : 'downloaded' }
                    : t
            )
        );
        Alert.alert(
            track.downloadStatus === 'downloaded' ? 'Удалено из загрузок' : 'Загружено',
            `"${track.title}" ${track.downloadStatus === 'downloaded' ? 'удален из' : 'помечен как'} загруженный.`
        );
        if (selectedFilter === 'Downloaded') {
            setDisplayedItems(prev => prev.filter(t => t.id !== track.id || track.downloadStatus !== 'downloaded'));
        }
    };

    const handleItemPress = useCallback((item) => {
        let playlistForPlayer = [];
        let trackIndex = -1;
        let trackToPlay = item;

        if (itemTypeForList === 'track') {
            playlistForPlayer = displayedItems.filter(i => i.type === 'track' && i.url);
            trackIndex = playlistForPlayer.findIndex(t => t.id === item.id);
        } else if (['album', 'artist'].includes(itemTypeForList)) {
            playlistForPlayer = (item.tracks || []).filter(t => t && t.url);
            if (playlistForPlayer.length > 0) {
                trackToPlay = playlistForPlayer[0];
                trackIndex = 0;
            } else {
                trackToPlay = null;
            }
        } else if (itemTypeForList === 'playlist') {
            const hydratedTracks = item.trackIds?.map(id => localTracks.find(t => t.id === id)).filter(t => !!t && t.url);
            playlistForPlayer = hydratedTracks || [];
            if (playlistForPlayer.length > 0) {
                trackToPlay = playlistForPlayer[0];
                trackIndex = 0;
            } else {
                trackToPlay = null;
            }
        }

        if (trackToPlay && trackToPlay.url) {
            if (trackIndex === -1 && playlistForPlayer.length > 0 && playlistForPlayer[0].id === trackToPlay.id) trackIndex = 0;
            else if (trackIndex === -1) {
                playlistForPlayer = [trackToPlay];
                trackIndex = 0;
            }
            navigation.navigate('Player', { track: trackToPlay, playlist: playlistForPlayer, currentIndex: trackIndex });
        } else if (itemTypeForList !== 'track' && !trackToPlay) {
            if (itemTypeForList === 'album') navigation.navigate('AlbumDetail', { albumId: item.id, albumName: item.name, tracks: item.tracks, artwork: item.artwork });
            else if (itemTypeForList === 'artist') navigation.navigate('ArtistDetail', { artistId: item.id, artistName: item.name, tracks: item.tracks, artwork: item.artwork });
            else if (itemTypeForList === 'playlist') navigation.navigate('PlaylistDetail', { playlistId: item.id, playlistName: item.name, tracks: [], artwork: item.artwork || DEFAULT_PLAYLIST_ARTWORK });
        } else {
            Alert.alert('Ошибка', 'Этот трек не может быть воспроизведен или не имеет воспроизводимых треков.');
        }
    }, [navigation, itemTypeForList, displayedItems, localTracks]);

    const openCreatePlaylistModal = () => {
        setNewPlaylistName('');
        setIsCreatePlaylistModalVisible(true);
    };

    const renderListItem = ({ item, index }) => {
        if (itemTypeForList === 'track') {
            return (
                <TrackListItem
                    item={item}
                    index={index}
                    onPress={() => handleItemPress(item)}
                    onDeletePress={handleDeleteTrack}
                    onMoreOptionsPress={item => {
                        setTrackToAddToPlaylist(item);
                        setIsAddToPlaylistModalVisible(true);
                    }}
                    onToggleLike={handleToggleLike}
                    onToggleDownload={handleToggleDownload}
                    showTrackNumber={true}
                    showArtwork={true}
                />
            );
        } else {
            return (
                <TouchableOpacity
                    onPress={() => handleItemPress(item)}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20, backgroundColor: 'transparent' }}
                >
                    <Image
                        source={{ uri: item.artwork || (itemTypeForList === 'playlist' ? DEFAULT_PLAYLIST_ARTWORK : DEFAULT_TRACK_ARTWORK) }}
                        style={{ width: 48, height: 48, borderRadius: 6, marginRight: 16, backgroundColor: '#3F3F46' }}
                        defaultSource={{ uri: DEFAULT_TRACK_ARTWORK }}
                    />
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#FAFAFA', marginBottom: 2 }} numberOfLines={1}>
                            {item.title || item.name || 'Unknown'}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#FAFAFA70' }} numberOfLines={1}>
                            {itemTypeForList === 'album' ? (item.artist || `${item.tracks?.length || 0} треков`) :
                                itemTypeForList === 'artist' ? `Артист • ${item.trackCount || item.tracks?.length || 0} треков` :
                                    itemTypeForList === 'playlist' ? `${item.trackIds?.length || item.trackCount || 0} треков` :
                                        'Детали недоступны'}
                        </Text>
                    </View>
                </TouchableOpacity>
            );
        }
    };

    const ListHeaderContent = () => (
        <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8, paddingTop: Platform.OS === 'android' ? 40 : 20 }}>
                <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#FAFAFA' }}>Библиотека</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Search')} style={{ padding: 8, borderRadius: 9999 }}>
                    <Ionicons name="search" size={26} color={ICON_COLOR_PRIMARY} />
                </TouchableOpacity>
            </View>
            <View style={{ paddingBottom: 6 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScrollContentContainer}>
                    {filters.map((filterName) => (
                        <FilterChip
                            key={filterName}
                            label={filterName}
                            selected={selectedFilter === filterName}
                            onPress={() => setSelectedFilter(filterName)}
                        />
                    ))}
                </ScrollView>
            </View>
            {selectedFilter === 'Playlists' && (
                <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, marginHorizontal: 20, marginBottom: 12, backgroundColor: '#1E1E1E', borderRadius: 8 }}
                    onPress={openCreatePlaylistModal}
                >
                    <Ionicons name="add-circle-outline" size={24} color={ICON_COLOR_PRIMARY} style={{ marginRight: 12 }} />
                    <Text style={{ color: '#FAFAFA', fontSize: 16, fontWeight: '500' }}>Создать новый плейлист</Text>
                </TouchableOpacity>
            )}
            {displayedItems.length > 0 && !['track', 'playlist'].includes(itemTypeForList) && (
                <View style={{ paddingHorizontal: 20, paddingBottom: 8, paddingTop: 4 }}>
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#FAFAFA' }}>{selectedFilter}</Text>
                </View>
            )}
        </View>
    );

    if (isLoadingTracks && selectedFilter !== 'Playlists') {
        return (
            <View style={styles.fullScreenLoader}>
                <ActivityIndicator size="large" color={ICON_COLOR_ACCENT} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
            <FlatList
                data={displayedItems}
                renderItem={renderListItem}
                keyExtractor={(item, index) => `${itemTypeForList}-${item.isLocal ? 'local' : ''}-${item.id?.toString() || index.toString()}`}
                ListHeaderComponent={ListHeaderContent}
                ListEmptyComponent={() => (
                    !isProcessingData && (
                        <View style={styles.emptyStateContainer}>
                            <MaterialCommunityIcons name="music-box-multiple-outline" size={56} color={ICON_COLOR_SECONDARY} />
                            <Text style={styles.emptyStateText}>
                                {selectedFilter === 'All Songs' && Platform.OS !== 'web' && mediaLibraryPermission !== 'granted' && mediaLibraryPermission !== null
                                    ? 'Требуется разрешение на доступ к локальным аудиофайлам.'
                                    : `Ничего не найдено для ${selectedFilter.toLowerCase()}.`}
                            </Text>
                            {selectedFilter === 'Playlists' && displayedItems.length === 0 && (
                                <Text style={styles.emptyStateSubText}>Нажмите "Создать новый плейлист" для начала.</Text>
                            )}
                            {selectedFilter === 'All Songs' && Platform.OS !== 'web' && mediaLibraryPermission !== 'granted' && mediaLibraryPermission !== null && (
                                <TouchableOpacity
                                    onPress={async () => {
                                        const { status } = await MediaLibrary.requestPermissionsAsync();
                                        setMediaLibraryPermission(status);
                                    }}
                                    style={{ marginTop: 16, backgroundColor: '#8DEEED', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 }}
                                >
                                    <Text style={{ color: '#030318', fontWeight: '600' }}>Запросить разрешение</Text>
                                </TouchableOpacity>
                            )}
                            {selectedFilter === 'All Songs' && Platform.OS !== 'web' && mediaLibraryPermission === 'granted' && displayedItems.length === 0 && (
                                <Text style={styles.emptyStateSubText}>Аудиофайлы на устройстве не найдены.</Text>
                            )}
                        </View>
                    )
                )}
                contentContainerStyle={{ paddingBottom: 90 }}
                showsVerticalScrollIndicator={false}
                extraData={isProcessingData || selectedFilter || mediaLibraryPermission || displayedItems.length}
            />
            {isProcessingData && !isLoadingTracks && (
                <View style={styles.processingOverlay}>
                    <ActivityIndicator size="large" color={ICON_COLOR_ACCENT} />
                </View>
            )}
            <Modal
                animationType="fade"
                transparent={true}
                visible={isCreatePlaylistModalVisible}
                onRequestClose={() => { setIsCreatePlaylistModalVisible(false); setNewPlaylistName(''); }}
            >
                <View style={styles.modalOuterContainer}>
                    <View style={styles.modalInnerContainer}>
                        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#000', marginBottom: 24, textAlign: 'center' }}>
                            Новый плейлист
                        </Text>
                        <TextInput
                            placeholder="Название плейлиста"
                            placeholderTextColor={ICON_COLOR_SECONDARY}
                            value={newPlaylistName}
                            onChangeText={setNewPlaylistName}
                            style={{
                                backgroundColor: '#F3F4F6',
                                color: '#000',
                                padding: 12,
                                borderRadius: 8,
                                marginBottom: 24,
                                borderWidth: 1,
                                borderColor: '#D1D5DB',
                                fontSize: 16,
                            }}
                            autoFocus={true}
                            onSubmitEditing={handleCreatePlaylistSubmit}
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                            <TouchableOpacity
                                onPress={() => { setIsCreatePlaylistModalVisible(false); setNewPlaylistName(''); }}
                                style={{ paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#6B7280' }}
                            >
                                <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 16 }}>Отмена</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleCreatePlaylistSubmit}
                                style={{ paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#8DEEED' }}
                            >
                                <Text style={{ color: '#030318', fontWeight: '600', fontSize: 16 }}>Создать</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            <Modal
                animationType="fade"
                transparent={true}
                visible={isEditModalVisible}
                onRequestClose={() => {
                    setIsEditModalVisible(false);
                    setEditingTrack(null);
                    setEditTitle('');
                    setEditAlbum('');
                }}
            >
                <View style={styles.modalOuterContainer}>
                    <View style={styles.modalInnerContainer}>
                        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#000', marginBottom: 20, textAlign: 'center' }}>
                            Редактировать трек
                        </Text>
                        <TextInput
                            placeholder="Название трека"
                            placeholderTextColor={ICON_COLOR_SECONDARY}
                            value={editTitle}
                            onChangeText={setEditTitle}
                            style={{
                                backgroundColor: '#F3F4F6',
                                color: '#000',
                                padding: 12,
                                borderRadius: 8,
                                marginBottom: 16,
                                borderWidth: 1,
                                borderColor: '#D1D5DB',
                                fontSize: 16,
                            }}
                            autoFocus={true}
                        />
                        <TextInput
                            placeholder="Альбом"
                            placeholderTextColor={ICON_COLOR_SECONDARY}
                            value={editAlbum}
                            onChangeText={setEditAlbum}
                            style={{
                                backgroundColor: '#F3F4F6',
                                color: '#000',
                                padding: 12,
                                borderRadius: 8,
                                marginBottom: 24,
                                borderWidth: 1,
                                borderColor: '#D1D5DB',
                                fontSize: 16,
                            }}
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                            <TouchableOpacity
                                onPress={() => {
                                    setIsEditModalVisible(false);
                                    setEditingTrack(null);
                                    setEditTitle('');
                                    setEditAlbum('');
                                }}
                                style={{ paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#6B7280' }}
                            >
                                <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 16 }}>Отмена</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleSaveEdit}
                                style={{ paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#8DEEED' }}
                            >
                                <Text style={{ color: '#030318', fontWeight: '600', fontSize: 16 }}>Сохранить</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            {trackToAddToPlaylist && (
                <AddToPlaylistModal
                    visible={isAddToPlaylistModalVisible}
                    onClose={() => { setIsAddToPlaylistModalVisible(false); setTrackToAddToPlaylist(null); }}
                    trackToAdd={trackToAddToPlaylist}
                    onTrackAdded={handleTrackAddedToPlaylist}
                    onCreateNewPlaylist={openCreatePlaylistModal}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: BG_COLOR_SCREEN },
    fullScreenLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG_COLOR_SCREEN },
    chipsScrollContentContainer: { paddingHorizontal: 20, paddingVertical: 10 },
    processingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
    emptyStateContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, marginTop: 20 },
    emptyStateText: { fontSize: 17, fontWeight: '600', color: ICON_COLOR_SECONDARY, textAlign: 'center', marginTop: 16 },
    emptyStateSubText: { fontSize: 14, color: ICON_COLOR_SECONDARY, opacity: 0.8, textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },
    modalOuterContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 20 },
    modalInnerContainer: { backgroundColor: '#FFF', width: '100%', padding: 24, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 5 },
});
