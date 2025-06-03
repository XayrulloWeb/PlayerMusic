import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, Image, TextInput, StyleSheet,
    Platform, ActivityIndicator, Alert, Button
} from 'react-native';
// import { Ionicons } from '@expo/vector-icons'; // Not used in this file directly, but good to keep if other parts of app use it
import { useNavigation } from '@react-navigation/native';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { debounce } from 'lodash';

const ICON_COLOR_PRIMARY = '#FAFAFA';
const ICON_COLOR_SECONDARY = '#A0A0A0';
const ICON_COLOR_ACCENT = '#8DEEED';
const BG_COLOR = '#030318';
const PAGE_SIZE = 50;
const CACHE_KEY = '@MyApp:LocalTracksFirstPage'; // Cache now stores the first page for quick initial load

// IMPORTANT: Create this image file in your project
// Adjust the path based on your project structure.
// For example, if HomeScreen.js is in 'src/screens/' and assets is at root:
// const DEFAULT_ARTWORK = require('../../assets/img/default-artwork.png');
// Using a placeholder string for now, replace with actual require:
const DEFAULT_ARTWORK_PLACEHOLDER_URI = 'https://cdn.pixabay.com/photo/2022/08/31/20/47/concert-7424190_1280.jpg'; // Replace with actual require statement

const HorizontalSection = React.memo(({ title, data, onCardPress }) => {
    const renderItem = useCallback(({ item }) => (
        <TouchableOpacity onPress={() => onCardPress(item)} style={styles.card}>
            <Image
                // Use item.artwork if available, otherwise use default.
                // Replace DEFAULT_ARTWORK_PLACEHOLDER_URI with:
                // source={item.artwork ? { uri: item.artwork } : require('../../assets/img/default-artwork.png')}
                source={item.artwork ? { uri: item.artwork } : { uri: DEFAULT_ARTWORK_PLACEHOLDER_URI }}
                style={styles.cardImage}
            />
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.cardSubtitle} numberOfLines={1}>{item.artist}</Text>
        </TouchableOpacity>
    ), [onCardPress]);

    if (!data || data.length === 0) {
        return null; // Don't render section if no data
    }

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <FlatList
                data={data}
                renderItem={renderItem}
                keyExtractor={(item) => item.id.toString()} // Ensure ID is a string
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sectionList}
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                windowSize={3}
            />
        </View>
    );
});

const getFormattedLocalAudioFiles = async (permission, { afterCursor } = {}) => {
    if (permission !== 'granted') {
        return { newTracks: [], endCursor: null, hasNextPage: false };
    }
    try {
        const mediaQueryOptions = {
            mediaType: MediaLibrary.MediaType.audio,
            sortBy: [[MediaLibrary.SortBy.modificationTime, false]], // Newest files first
            first: PAGE_SIZE,
        };
        if (afterCursor) {
            mediaQueryOptions.after = afterCursor;
        }

        const media = await MediaLibrary.getAssetsAsync(mediaQueryOptions);

        const tracks = media.assets.map(asset => ({
            id: `local-${asset.id}`,
            title: asset.filename.replace(/\.[^/.]+$/, "") || 'Unknown Title',
            artist: 'Unknown Artist', // MediaLibrary.Asset doesn't reliably provide this
            album: 'On this device',   // MediaLibrary.Asset doesn't reliably provide this
            artwork: null, // Set to null, default artwork will be used by component
            duration: Math.round(asset.duration),
            url: asset.uri,
            isLocal: true,
            type: 'track',
            assetId: asset.id,
        }));
        return { newTracks: tracks, endCursor: media.endCursor, hasNextPage: media.hasNextPage };
    } catch (error) {
        console.error("MediaLibrary.getAssetsAsync error:", error);
        Alert.alert("Ошибка", "Не удалось загрузить локальные аудиофайлы из медиатеки.");
        return { newTracks: [], endCursor: null, hasNextPage: false };
    }
};

const HomeScreen = () => {
    const navigation = useNavigation();
    const [searchQuery, setSearchQuery] = useState('');
    const [localTracks, setLocalTracks] = useState([]);
    const [mediaLibraryPermission, setMediaLibraryPermission] = useState(null);

    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);

    const [nextPageCursor, setNextPageCursor] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [initialLoadAttempted, setInitialLoadAttempted] = useState(false);


    const debouncedSetSearchQuery = useCallback(debounce(setSearchQuery, 300), []);

    const requestPermissions = useCallback(async () => {
        if (Platform.OS === 'web') {
            setMediaLibraryPermission('granted'); // MediaLibrary not typically used on web this way
            return;
        }
        const { status } = await MediaLibrary.requestPermissionsAsync();
        setMediaLibraryPermission(status);
        if (status !== 'granted') {
            Alert.alert(
                'Требуется разрешение',
                'Для доступа к локальным аудиофайлам необходимо предоставить разрешение на медиабиблиотеку.',
                [{ text: 'OK' }]
            );
        }
    }, []);

    useEffect(() => {
        requestPermissions();
    }, [requestPermissions]);

    useEffect(() => {
        const loadInitialTracks = async () => {
            if (mediaLibraryPermission !== 'granted' || initialLoadAttempted) {
                if(mediaLibraryPermission !== 'granted') setIsInitialLoading(false);
                return;
            }

            setIsInitialLoading(true);
            setInitialLoadAttempted(true);

            try {
                // Attempt to load the first page from cache
                const cachedTracksString = await AsyncStorage.getItem(CACHE_KEY);
                if (cachedTracksString) {
                    const tracksFromCache = JSON.parse(cachedTracksString);
                    if (tracksFromCache && tracksFromCache.length > 0) {
                        setLocalTracks(tracksFromCache);
                        // We don't know cursor/hasMore from cache, so we'll fetch fresh page 1 anyway
                    }
                }
            } catch (e) {
                console.warn("Failed to load initial tracks from cache", e);
            }

            // Fetch the absolute first page from MediaLibrary
            try {
                const { newTracks, endCursor, hasNextPage: newHasMore } = await getFormattedLocalAudioFiles(mediaLibraryPermission, { afterCursor: null });
                setLocalTracks(newTracks); // Replace potentially cached tracks with fresh ones
                setNextPageCursor(endCursor);
                setHasMore(newHasMore);
                if (newTracks.length > 0) {
                    try {
                        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(newTracks));
                    } catch (cacheError) {
                        console.warn("Failed to save first page to cache", cacheError);
                    }
                } else if (localTracks.length === 0) { // If no new tracks and no cached tracks
                    // Handled by ListEmptyComponent
                }
            } catch (error) {
                console.error('Error fetching initial tracks:', error);
                // Alert handled in getFormattedLocalAudioFiles
            } finally {
                setIsInitialLoading(false);
            }
        };

        loadInitialTracks();
    }, [mediaLibraryPermission, initialLoadAttempted]);


    const handleLoadMore = useCallback(async () => {
        if (isFetchingMore || !hasMore || mediaLibraryPermission !== 'granted' || !nextPageCursor) {
            return;
        }

        setIsFetchingMore(true);
        try {
            const { newTracks, endCursor, hasNextPage: newHasMore } = await getFormattedLocalAudioFiles(mediaLibraryPermission, { afterCursor: nextPageCursor });
            if (newTracks.length > 0) {
                setLocalTracks(prev => [...prev, ...newTracks]);
            }
            setNextPageCursor(endCursor);
            setHasMore(newHasMore);
        } catch (error) {
            console.error('Error fetching more tracks:', error);
            // Alert handled in getFormattedLocalAudioFiles
        } finally {
            setIsFetchingMore(false);
        }
    }, [isFetchingMore, hasMore, mediaLibraryPermission, nextPageCursor]);

    const filteredTracks = useMemo(() => {
        if (!searchQuery.trim()) return localTracks;
        const query = searchQuery.toLowerCase();
        return localTracks.filter(t =>
            t.title.toLowerCase().includes(query) ||
            t.artist.toLowerCase().includes(query) ||
            t.album.toLowerCase().includes(query)
        );
    }, [searchQuery, localTracks]);

    const sections = useMemo(() => {
        if (filteredTracks.length === 0 && !isInitialLoading) return []; // Return empty if no tracks and not loading
        return [
            // These sections are just slices of localTracks, sorted by modification time.
            // Consider if "Popular" and "Recommended" should have different data sources or logic.
            { id: 'recent', title: 'Недавно добавленные', data: filteredTracks.slice(0, 10) }, // "Recent" is by modification time
            { id: 'next_up', title: 'Следующие треки', data: filteredTracks.slice(10, 20) },
            { id: 'more_tracks', title: 'Больше треков', data: filteredTracks.slice(20, 30) },
        ].filter(section => section.data && section.data.length > 0); // Filter out empty sections
    }, [filteredTracks, isInitialLoading]);

    const handleCardPress = useCallback((item) => {
        // Ensure playlist for player is based on currently filtered and visible tracks
        const playlistForPlayer = filteredTracks.filter(t => t.url && t.id);
        const currentIndex = playlistForPlayer.findIndex(t => t.id === item.id);

        if (currentIndex !== -1 && item.url) {
            navigation.navigate('Player', { track: item, playlist: playlistForPlayer, currentIndex });
        } else {
            Alert.alert("Ошибка воспроизведения", "Выбранный трек не может быть воспроизведен. URL отсутствует или трек не найден в текущем списке.");
        }
    }, [filteredTracks, navigation]);

    const renderSection = useCallback(({ item }) => (
        <HorizontalSection
            title={item.title}
            data={item.data}
            onCardPress={handleCardPress}
        />
    ), [handleCardPress]);

    const renderListFooter = () => {
        if (!isFetchingMore) return null;
        return <ActivityIndicator style={{ marginVertical: 20 }} size="small" color={ICON_COLOR_ACCENT} />;
    };

    if (isInitialLoading && localTracks.length === 0) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color={ICON_COLOR_ACCENT} />
            </View>
        );
    }

    if (mediaLibraryPermission === null && Platform.OS !== 'web') { // Still waiting for permission result
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color={ICON_COLOR_ACCENT} />
                <Text style={styles.emptyText}>Запрос разрешений...</Text>
            </View>
        );
    }

    if (mediaLibraryPermission !== 'granted' && Platform.OS !== 'web') {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Главная</Text>
                </View>
                <View style={[styles.emptyContainer, styles.centered, {flex: 1}]}>
                    <Text style={styles.emptyText}>
                        Требуется разрешение на доступ к медиабиблиотеке для отображения локальных треков.
                    </Text>
                    <Button
                        title="Предоставить разрешение"
                        onPress={requestPermissions}
                        color={ICON_COLOR_ACCENT}
                    />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Главная</Text>
            </View>
            <TextInput
                style={styles.searchInput}
                placeholder="Поиск треков, артистов, альбомов..."
                placeholderTextColor={ICON_COLOR_SECONDARY}
                onChangeText={debouncedSetSearchQuery}
                value={searchQuery}
            />
            <FlatList
                data={sections}
                renderItem={renderSection}
                keyExtractor={item => `section-${item.id}`}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                initialNumToRender={3} // Number of sections
                windowSize={5}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={renderListFooter}
                ListEmptyComponent={() => (
                    !isInitialLoading && ( // Only show if not initial loading
                        <View style={[styles.emptyContainer, styles.centered, {flex: 1, marginTop: 50}]}>
                            <Text style={styles.emptyText}>
                                {searchQuery ? "По вашему запросу ничего не найдено." : "Локальные аудиофайлы не найдены."}
                            </Text>
                            { !searchQuery && Platform.OS !== 'web' &&
                                <Text style={styles.emptyTextSmall}>
                                    Убедитесь, что у вас есть аудиофайлы на устройстве.
                                </Text>
                            }
                        </View>
                    )
                )}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: BG_COLOR, paddingTop: Platform.OS === 'android' ? 25 : 50 }, // Adjust top padding for status bar
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: { paddingHorizontal: 20, marginBottom: 15, marginTop: 10 },
    headerTitle: { fontSize: 28, fontWeight: 'bold', color: ICON_COLOR_PRIMARY },
    searchInput: {
        backgroundColor: '#1E1E1E',
        color: ICON_COLOR_PRIMARY,
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderRadius: 8,
        marginHorizontal: 20,
        marginBottom: 20,
        fontSize: 16,
    },
    section: { marginBottom: 25 },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: ICON_COLOR_PRIMARY,
        marginLeft: 20,
        marginBottom: 12,
    },
    sectionList: { paddingHorizontal: 20 },
    card: { width: 130, marginRight: 15 }, // Slightly wider card
    cardImage: { width: 120, height: 120, borderRadius: 8, backgroundColor: '#2a2a3a' }, // Added bg color for image loading
    cardTitle: { fontSize: 14, color: ICON_COLOR_PRIMARY, marginTop: 8, fontWeight: '500' },
    cardSubtitle: { fontSize: 12, color: ICON_COLOR_SECONDARY, marginTop: 2 },
    contentContainer: { paddingBottom: 90 }, // For bottom tab navigator or player controls
    emptyContainer: { alignItems: 'center', paddingHorizontal: 20 },
    emptyText: { fontSize: 18, color: ICON_COLOR_SECONDARY, textAlign: 'center', marginBottom: 15 },
    emptyTextSmall: { fontSize: 14, color: ICON_COLOR_SECONDARY, textAlign: 'center', marginBottom: 20 },
});

export default React.memo(HomeScreen);
