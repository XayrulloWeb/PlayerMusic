// screens/LibraryScreen.js
import React, { useState, useEffect, useCallback , memo } from 'react';
import {
    View, Text, Image, TouchableOpacity, FlatList,
    ScrollView, ActivityIndicator, Platform, StatusBar,
    Modal, TextInput, Alert, StyleSheet
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useIsFocused } from '@react-navigation/native';

// Импорт функций из хранилища
import {
    getLikedTracksIds,
    getUserPlaylists,
    createPlaylist
    // addTrackToPlaylist (используется внутри AddToPlaylistModal)
} from '../utils/storage';

// Импорт модального окна
import AddToPlaylistModal from '../components/AddToPlaylistModal';

// Импорт данных треков из JSON файла
import tracksFromJson from '../assets/tracks.json';
export const allTracksData = tracksFromJson; // Экспортируем для использования в других модулях

// Константы для цветов и плейсхолдеров (адаптируйте под вашу тему)
const ICON_COLOR_PRIMARY = '#FAFAFA';        // custom-quaternary
const ICON_COLOR_SECONDARY = '#A0A0A0';     // custom-text-secondary
const ICON_COLOR_ACCENT = '#8DEEED';       // custom-primary
const TEXT_COLOR_ON_ACCENT = '#030318';   // custom-tertiary
const DEFAULT_PLAYLIST_ARTWORK = 'https://images.unsplash.com/photo-1587329304169-f7cdf09ac800?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8N3x8cGxheWxpc3QlMjBhcnR3b3JrfGVufDB8fDB8fHww&auto=format&fit=crop&w=100&q=60';
const DEFAULT_TRACK_ARTWORK = 'https://via.placeholder.com/50?text=🎶'; // Для треков, если нет арта

// --- Компонент FilterChip ---
const FilterChip = ({ label, selected, onPress }) => (
    <TouchableOpacity
        onPress={onPress}
        className={`py-2 px-4 rounded-full mr-2.5 border-2 
                    ${selected ? 'bg-custom-primary border-custom-primary shadow-md'
            : 'bg-custom-surface border-custom-border'}`}
        activeOpacity={0.7}
    >
        <Text className={`text-sm font-semibold 
                         ${selected ? 'text-custom-tertiary'
            : 'text-custom-quaternary/80'}`}>
            {label}
        </Text>
    </TouchableOpacity>
);

// --- Компонент ListItem (универсальный) ---
const ListItem = ({ item, onPress, itemType, onMoreOptionsPress }) => {
    let title = item.title || item.name || "Unknown";
    let subtitle = "Details unavailable";
    let artwork = item.artwork;
    const showMoreOptionsButton = !!onMoreOptionsPress;

    switch (itemType) {
        case 'album':
            subtitle = item.artist || `${item.tracks?.length || 0} songs`;
            artwork = item.artwork || DEFAULT_TRACK_ARTWORK;
            break;
        case 'artist':
            subtitle = `Artist • ${item.trackCount || item.tracks?.length || 0} songs`;
            artwork = item.artwork || DEFAULT_TRACK_ARTWORK; // Можно заменить на иконку артиста
            break;
        case 'playlist':
            subtitle = `${item.trackIds?.length || item.trackCount || 0} songs`;
            artwork = item.artwork || DEFAULT_PLAYLIST_ARTWORK;
            break;
        case 'track':
            subtitle = item.artist || "Unknown Artist";
            if (item.album && item.album !== "—" && item.artist !== item.album) {
                subtitle += ` • ${item.album}`;
            }
            artwork = item.artwork || DEFAULT_TRACK_ARTWORK;
            break;
    }

    return (
        <TouchableOpacity onPress={onPress} className="flex-row items-center py-2.5 px-5 active:bg-custom-surface/50" activeOpacity={0.8}>
            <Image
                source={{ uri: artwork }}
                className="w-12 h-12 rounded-md mr-4 bg-zinc-700" // bg-zinc-700 как плейсхолдер
            />
            <View className="flex-1 justify-center">
                <Text className="text-base font-semibold text-custom-quaternary mb-0.5" numberOfLines={1}>{title}</Text>
                <Text className="text-xs text-custom-quaternary/70" numberOfLines={1}>{subtitle}</Text>
            </View>
            {showMoreOptionsButton && (
                <TouchableOpacity
                    onPress={() => onMoreOptionsPress(item, itemType)}
                    className="p-2 ml-2.5"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <MaterialCommunityIcons name="dots-horizontal" size={24} color={ICON_COLOR_SECONDARY} />
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );
};

// --- Основной компонент экрана LibraryScreen ---
export default function LibraryScreen() {
    const navigation = useNavigation();
    const isFocused = useIsFocused();

    const [selectedFilter, setSelectedFilter] = useState('All Songs');
    const filters = ['All Songs', 'Playlists', 'Albums', 'Liked Songs', 'Artists', 'Downloaded'];

    const [staticAllTracks, setStaticAllTracks] = useState([]); // Загруженные из JSON
    const [userPlaylists, setUserPlaylists] = useState([]);    // Загруженные из AsyncStorage
    const [displayedItems, setDisplayedItems] = useState([]);  // То, что показывается в FlatList
    const [itemTypeForList, setItemTypeForList] = useState('track'); // Тип элементов в displayedItems

    const [isLoadingAllTracks, setIsLoadingAllTracks] = useState(true); // Первичная загрузка allTracks
    const [isProcessingData, setIsProcessingData] = useState(false);   // Любая последующая обработка/фильтрация

    // Состояния для модальных окон
    const [isCreatePlaylistModalVisible, setIsCreatePlaylistModalVisible] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [isAddToPlaylistModalVisible, setIsAddToPlaylistModalVisible] = useState(false);
    const [trackToAddToPlaylist, setTrackToAddToPlaylist] = useState(null);

    // 1. Загрузка всех треков из JSON (один раз при монтировании компонента)
    useEffect(() => {
        console.log('LibraryScreen: Mounting and loading staticAllTracks...');
        setIsLoadingAllTracks(true);
        setStaticAllTracks(allTracksData); // allTracksData теперь импортированы из JSON
        setIsLoadingAllTracks(false);
        console.log('LibraryScreen: staticAllTracks loaded from JSON:', allTracksData.length);
    }, []); // Пустой массив зависимостей = запуск один раз

    // 2. Основной useEffect для загрузки данных и фильтрации
    useEffect(() => {
        const loadAndFilterData = async () => {
            if (!isFocused) {
                console.log('LibraryScreen: Screen not focused, skipping data load.');
                return; // Не делаем ничего, если экран не в фокусе
            }

            // Если isLoadingAllTracks еще true и выбран фильтр, который ЗАВИСИТ от allTracks
            if (isLoadingAllTracks && !['Playlists'].includes(selectedFilter)) {
                console.log(`LibraryScreen: Waiting for staticAllTracks for filter: ${selectedFilter}`);
                setIsProcessingData(true); // Показываем общий лоадер
                return;
            }

            console.log(`LibraryScreen: Processing filter: ${selectedFilter}`);
            setIsProcessingData(true);
            let newItems = [];
            let newType = 'track'; // По умолчанию, если что-то пойдет не так

            try {
                if (selectedFilter === 'Playlists') {
                    newType = 'playlist';
                    const playlistsFromDb = await getUserPlaylists();
                    newItems = playlistsFromDb.map(p => ({
                        ...p, type: 'playlist', artwork: p.artwork || DEFAULT_PLAYLIST_ARTWORK,
                        trackCount: p.trackIds?.length || 0,
                    })).sort((a, b) => b.createdAt - a.createdAt);
                    setUserPlaylists(newItems); // Сохраняем отформатированные плейлисты
                } else if (staticAllTracks.length > 0) { // Для остальных фильтров нужны staticAllTracks
                    switch (selectedFilter) {
                        case 'All Songs':
                            newType = 'track';
                            newItems = staticAllTracks.map(t => ({ ...t, type: 'track' }));
                            break;
                        case 'Liked Songs':
                            newType = 'track';
                            const likedIds = await getLikedTracksIds();
                            newItems = staticAllTracks.filter(track => track.id && likedIds.includes(track.id.toString()))
                                .map(t => ({ ...t, type: 'track' }));
                            break;
                        case 'Albums':
                            newType = 'album';
                            const albums = {};
                            staticAllTracks.forEach(track => {
                                if (!track.album || track.album === "—") return;
                                if (!albums[track.album]) albums[track.album] = { id: track.album, name: track.album, artwork: track.artwork, artist: track.artist, tracks: [] };
                                albums[track.album].tracks.push(track);
                            });
                            newItems = Object.values(albums).map(a => ({ ...a, type: 'album' }));
                            break;
                        case 'Artists':
                            newType = 'artist';
                            const artists = {};
                            staticAllTracks.forEach(track => {
                                if (!track.artist) return;
                                if (!artists[track.artist]) artists[track.artist] = { id: track.artist, name: track.artist, artwork: track.artwork, trackCount: 0, tracks: [] };
                                artists[track.artist].trackCount++;
                                artists[track.artist].tracks.push(track);
                            });
                            newItems = Object.values(artists).map(a => ({ ...a, type: 'artist' }));
                            break;
                        case 'Downloaded': // Mock
                            newType = 'track';
                            newItems = staticAllTracks.slice(0, 3).map(t => ({ ...t, type: 'track', downloadStatus: 'downloaded' }));
                            break;
                        default:
                            console.warn(`LibraryScreen: Unknown filter "${selectedFilter}".`);
                            newItems = []; // Или показать все треки как fallback
                            break;
                    }
                } else if (selectedFilter !== 'Playlists') {
                    console.warn(`LibraryScreen: staticAllTracks is empty for filter: ${selectedFilter}, cannot process.`);
                }
            } catch (error) {
                console.error(`LibraryScreen: Error processing filter ${selectedFilter}:`, error);
                newItems = []; // В случае ошибки показываем пустой список
            }

            setDisplayedItems(newItems);
            setItemTypeForList(newType);
            setIsProcessingData(false);
            console.log(`LibraryScreen: Displayed ${newItems.length} items for ${selectedFilter}. Type: ${newType}`);
        };

        loadAndFilterData();
    }, [selectedFilter, isFocused, staticAllTracks, isLoadingAllTracks]);


    // --- Обработчики действий ---
    const triggerDataReloadForPlaylists = useCallback(async () => {
        // Вызывается для обновления вкладки плейлистов после создания/изменения
        if (selectedFilter === 'Playlists' && !isProcessingData) { // Проверяем, чтобы не было двойной загрузки
            console.log('LibraryScreen: Forcing reload of playlists tab.');
            setIsProcessingData(true);
            const playlistsFromDb = await getUserPlaylists();
            const formattedPlaylists = playlistsFromDb.map(p => ({
                ...p, type: 'playlist', artwork: p.artwork || DEFAULT_PLAYLIST_ARTWORK,
                trackCount: p.trackIds?.length || 0,
            })).sort((a,b) => b.createdAt - a.createdAt);
            setUserPlaylists(formattedPlaylists);
            setDisplayedItems(formattedPlaylists);
            setItemTypeForList('playlist'); // Убедимся, что тип установлен
            setIsProcessingData(false);
        } else if (selectedFilter !== 'Playlists') {
            // Если мы не на вкладке плейлистов, просто переключимся на нее,
            // useEffect сам загрузит данные.
            setSelectedFilter('Playlists');
        }
    }, [selectedFilter, isProcessingData]); // isProcessingData для предотвращения рекурсии


    const handleCreatePlaylistSubmit = async () => {
        if (newPlaylistName.trim() === '') { Alert.alert("Invalid Name", "Playlist name cannot be empty."); return; }
        setIsProcessingData(true); // Используем общий флаг
        const created = await createPlaylist(newPlaylistName);
        setNewPlaylistName('');
        setIsCreatePlaylistModalVisible(false);
        if (created) {
            await triggerDataReloadForPlaylists();
        } else {
            Alert.alert("Creation Failed", "Could not create the playlist.");
        }
        setIsProcessingData(false);
    };

    const handleTrackAddedToPlaylist = async (playlist, track) => {
        Alert.alert("Success!", `"${track.title}" was added to "${playlist.name}".`);
        await triggerDataReloadForPlaylists(); // Обновляем, если текущий фильтр - плейлисты
    };

    const handleItemPress = useCallback((item) => {
        console.log(`LibraryScreen: Item pressed - Type: ${itemTypeForList}, Name: ${item.name || item.title}`);
        switch (itemTypeForList) {
            case 'track':
                const playlistForPlayer = displayedItems.filter(i => i.type === 'track' && i.url);
                const trackIndex = playlistForPlayer.findIndex(t => t.id === item.id);
                if (item.url && trackIndex !== -1) {
                    navigation.navigate('Player', { track: item, playlist: playlistForPlayer, currentIndex: trackIndex });
                } else if (item.url) { // Если трек не в displayedItems, но есть URL (например, из поиска в будущем)
                    navigation.navigate('Player', { track: item, playlist: [item], currentIndex: 0 });
                } else { Alert.alert("Cannot Play", "Track has no valid URL or not found in current list."); }
                break;
            case 'album':
                navigation.navigate('AlbumDetail', { albumId: item.id, albumName: item.name, tracks: item.tracks || [], artist: item.artist, artwork: item.artwork });
                break;
            case 'artist':
                navigation.navigate('ArtistDetail', { artistId: item.id, artistName: item.name, tracks: item.tracks || [], artwork: item.artwork });
                break;
            case 'playlist':
                const playlistTracks = item.trackIds?.map(trackId => staticAllTracks.find(t => t.id === trackId)).filter(track => !!track);
                navigation.navigate('PlaylistDetail', { playlistId: item.id, playlistName: item.name, tracks: playlistTracks || [], artwork: item.artwork || DEFAULT_PLAYLIST_ARTWORK, description: item.description });
                break;
            default:
                console.warn("LibraryScreen: Unknown item type for press:", itemTypeForList);
        }
    }, [navigation, itemTypeForList, displayedItems, staticAllTracks]);

    const handleMoreOptionsPress = (item, type) => {
        console.log(`LibraryScreen: More options for type: ${type}, item: ${item.title || item.name}`);
        if (type === 'track') {
            setTrackToAddToPlaylist(item);
            setIsAddToPlaylistModalVisible(true);
        } else {
            Alert.alert("More Options", `Options for ${item.name || item.title} (${type}) not implemented yet.`);
        }
    };

    const openCreatePlaylistModal = () => {
        setNewPlaylistName('');
        setIsCreatePlaylistModalVisible(true);
    };

    const renderListItem = ({ item }) => (<ListItem item={item} onPress={() => handleItemPress(item)} itemType={itemTypeForList} onMoreOptionsPress={handleMoreOptionsPress} />);

    const ListHeaderContent = () => (
        <>
            <View className={`flex-row justify-between items-center px-5 pb-2 pt-4 ${Platform.OS === 'android' ? 'android:pt-10' : 'ios:pt-5'}`}>
                <Text className="text-3xl font-bold text-custom-quaternary">Library</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Search')} className="p-2 rounded-full active:bg-custom-surface/50">
                    <Ionicons name="search" size={26} color={ICON_COLOR_PRIMARY} />
                </TouchableOpacity>
            </View>
            <View className="pb-1.5">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScrollContentContainer}>
                    {filters.map((filterName) => (<FilterChip key={filterName} label={filterName} selected={selectedFilter === filterName} onPress={() => setSelectedFilter(filterName)} />))}
                </ScrollView>
            </View>
            {selectedFilter === 'Playlists' && (
                <TouchableOpacity className="flex-row items-center py-3 px-5 mx-5 mb-3 bg-custom-surface rounded-lg active:bg-custom-surface/80 shadow-sm" onPress={openCreatePlaylistModal} activeOpacity={0.8}>
                    <Ionicons name="add-circle-outline" size={24} color={ICON_COLOR_PRIMARY} className="mr-3" />
                    <Text className="text-custom-quaternary text-base font-medium">Create New Playlist</Text>
                </TouchableOpacity>
            )}
            {/* Заголовок секции (например, "Albums", "Artists") */}
            {displayedItems.length > 0 && !['track', 'playlist'].includes(itemTypeForList) && (
                <View className="px-5 pb-2 pt-1"><Text className="text-xl font-bold text-custom-quaternary">{selectedFilter}</Text></View>
            )}
        </>
    );

    // Первичный лоадер, если данные еще не загружены (кроме плейлистов, которые грузятся независимо)
    if (isLoadingAllTracks && selectedFilter !== 'Playlists') {
        return (<View className="flex-1 justify-center items-center bg-custom-tertiary"><ActivityIndicator size="large" color={ICON_COLOR_ACCENT} /></View>);
    }

    return (
        <View className="flex-1 bg-custom-tertiary">
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
            <FlatList
                data={displayedItems}
                renderItem={renderListItem}
                keyExtractor={(item, index) => `${itemTypeForList}-${item.id?.toString() || item.name || index.toString()}`}
                ListHeaderComponent={ListHeaderContent}
                ListEmptyComponent={() => (
                    !isProcessingData && ( // Показываем, только если не идет активная обработка/загрузка
                        <View className="flex-1 justify-center items-center px-5 mt-10">
                            <MaterialCommunityIcons name="music-box-multiple-outline" size={56} color={ICON_COLOR_SECONDARY} />
                            <Text className="text-lg font-semibold text-custom-quaternary/70 mt-4 text-center">
                                {selectedFilter === 'Playlists' && userPlaylists.length === 0 ? "No playlists yet." : `No ${selectedFilter.toLowerCase()} found.`}
                            </Text>
                            {selectedFilter === 'Playlists' && userPlaylists.length === 0 && (
                                <Text className="text-sm text-custom-quaternary/50 mt-2 text-center">Tap "Create New Playlist" to start.</Text>
                            )}
                        </View>
                    )
                )}
                contentContainerStyle={{ paddingBottom: 90 }}
                showsVerticalScrollIndicator={false}
                extraData={isProcessingData || selectedFilter} // Для ререндера ListEmptyComponent
            />

            {isProcessingData && !isLoadingAllTracks && ( // Показываем только если это не первичная загрузка AllTracks
                <View style={styles.processingOverlay}><ActivityIndicator size="large" color={ICON_COLOR_ACCENT} /></View>
            )}

            <Modal animationType="fade" transparent={true} visible={isCreatePlaylistModalVisible} onRequestClose={() => { setIsCreatePlaylistModalVisible(false); setNewPlaylistName(''); }}>
                <View className="flex-1 justify-center items-center bg-black/80 px-5">
                    <View className="bg-custom-surface w-full p-6 rounded-xl shadow-xl">
                        <Text className="text-xl font-bold text-custom-quaternary mb-6 text-center">New Playlist</Text>
                        <TextInput
                            placeholder="Enter playlist name" placeholderTextColor={ICON_COLOR_SECONDARY}
                            value={newPlaylistName} onChangeText={setNewPlaylistName}
                            className="bg-custom-tertiary text-custom-quaternary p-4 rounded-lg mb-6 border border-custom-border text-base"
                            autoFocus={true} onSubmitEditing={handleCreatePlaylistSubmit}
                        />
                        <View className="flex-row justify-end space-x-3">
                            <TouchableOpacity onPress={() => { setIsCreatePlaylistModalVisible(false); setNewPlaylistName(''); }} className="py-3 px-5 rounded-lg bg-zinc-600 active:bg-zinc-500"><Text className="text-custom-quaternary font-semibold">Cancel</Text></TouchableOpacity>
                            <TouchableOpacity onPress={handleCreatePlaylistSubmit} className="py-3 px-5 rounded-lg bg-custom-primary active:opacity-80"><Text className="font-semibold" style={{ color: TEXT_COLOR_ON_ACCENT }}>Create</Text></TouchableOpacity>
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
    chipsScrollContentContainer: { paddingHorizontal: 20, paddingVertical: 10 },
    processingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
});
