// components/AddToPlaylistModal.js
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Modal, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getUserPlaylists, addTrackToPlaylist } from '../utils/storage'; // Убедитесь, что путь верный

// Цвета (используйте ваши HEX-эквиваленты custom-цветов из Tailwind)
const ICON_COLOR_PRIMARY_MODAL = '#FAFAFA';      // custom-quaternary
const ICON_COLOR_SECONDARY_MODAL = '#A0A0A0';   // custom-text-secondary
const BG_MODAL_OVERLAY = 'rgba(0,0,0,0.7)';    // Фон оверлея
// Для Tailwind: bg-custom-surface, border-custom-border/30, text-custom-quaternary

const AddToPlaylistModal = ({ visible, onClose, trackToAdd, onTrackAdded, onCreateNewPlaylist }) => {
    const [playlists, setPlaylists] = useState([]);
    const [loadingPlaylists, setLoadingPlaylists] = useState(false);
    const [addingTrackToPlaylistId, setAddingTrackToPlaylistId] = useState(null);

    useEffect(() => {
        if (visible) {
            const fetchPlaylists = async () => {
                setLoadingPlaylists(true);
                const userPlaylists = await getUserPlaylists();
                // Сортируем: сначала более новые
                setPlaylists(userPlaylists.sort((a, b) => b.createdAt - a.createdAt));
                setLoadingPlaylists(false);
            };
            fetchPlaylists();
        } else {
            // Сбрасываем состояние при закрытии модалки
            setPlaylists([]);
            setAddingTrackToPlaylistId(null);
        }
    }, [visible]);

    const handleAddTrackToExistingPlaylist = async (playlist) => {
        if (!trackToAdd || !trackToAdd.id || !playlist || !playlist.id || addingTrackToPlaylistId) return;

        setAddingTrackToPlaylistId(playlist.id);
        const success = await addTrackToPlaylist(playlist.id, trackToAdd.id);
        setAddingTrackToPlaylistId(null);

        if (success) {
            onTrackAdded(playlist, trackToAdd); // Сообщаем об успехе
            onClose();
        } else {
            // Можно показать Alert об ошибке или если трек уже есть
            alert(`Failed to add "${trackToAdd.title}" to "${playlist.name}". It might already be there.`);
            onClose(); // Все равно закрываем
        }
    };

    const renderPlaylistItem = ({ item }) => (
        <TouchableOpacity
            onPress={() => handleAddTrackToExistingPlaylist(item)}
            disabled={addingTrackToPlaylistId === item.id}
            className="flex-row items-center py-3.5 px-4 border-b border-custom-border/20 active:bg-custom-surface/20"
            // Замените custom-border, custom-surface на ваши Tailwind классы
        >
            <Ionicons name="musical-notes-outline" size={22} color={ICON_COLOR_SECONDARY_MODAL} className="mr-4" />
            <Text className="flex-1 text-base text-custom-quaternary" numberOfLines={1}>
                {item.name}
            </Text>
            <Text className="text-xs text-custom-quaternary/60 mr-2">
                {item.trackIds?.length || 0}
            </Text>
            {addingTrackToPlaylistId === item.id && <ActivityIndicator size="small" color={ICON_COLOR_PRIMARY_MODAL} />}
        </TouchableOpacity>
    );

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
                {/* Предотвращаем закрытие по клику на сам контент модалки */}
                <View onStartShouldSetResponder={() => true} style={styles.modalContentContainer}>
                    <View className="bg-custom-surface rounded-t-2xl shadow-xl overflow-hidden">
                        {/* Заголовок модалки */}
                        <View className="flex-row justify-between items-center pt-4 pb-3 px-4 border-b border-custom-border/30">
                            <Text className="text-lg font-semibold text-custom-quaternary">
                                Add to a Playlist
                            </Text>
                            <TouchableOpacity onPress={onClose} className="p-1 rounded-full active:bg-custom-border/20">
                                <Ionicons name="close-circle-outline" size={28} color={ICON_COLOR_PRIMARY_MODAL} />
                            </TouchableOpacity>
                        </View>

                        {/* Список плейлистов или индикатор загрузки */}
                        {loadingPlaylists ? (
                            <View className="h-48 justify-center items-center">
                                <ActivityIndicator size="large" color={ICON_COLOR_PRIMARY_MODAL} />
                            </View>
                        ) : playlists.length === 0 ? (
                            <View className="py-10 justify-center items-center px-5">
                                <Ionicons name="list-circle-outline" size={48} color={ICON_COLOR_SECONDARY_MODAL} />
                                <Text className="text-custom-quaternary/70 text-center mt-3">
                                    No playlists found.
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={playlists}
                                renderItem={renderPlaylistItem}
                                keyExtractor={(item) => item.id.toString()}
                                style={styles.playlistList} // Ограничиваем высоту списка
                            />
                        )}

                        {/* Кнопка "Создать новый плейлист" */}
                        {onCreateNewPlaylist && ( // Показываем только если передан колбэк
                            <TouchableOpacity
                                onPress={() => {
                                    onClose(); // Закрываем эту модалку
                                    onCreateNewPlaylist(); // Открываем модалку создания плейлиста
                                }}
                                className="py-4 px-4 border-t border-custom-border/30 flex-row items-center active:bg-custom-surface/20"
                            >
                                <Ionicons name="add-circle-outline" size={26} color={ICON_COLOR_PRIMARY_MODAL} className="mr-3" />
                                <Text className="text-base text-custom-quaternary font-medium">Create New Playlist</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: BG_MODAL_OVERLAY,
    },
    modalContentContainer: { // Этот контейнер нужен чтобы тень от modalContent не обрезалась
        marginHorizontal: Platform.OS === 'ios' ? 8 : 0, // Небольшой отступ по бокам для iOS для тени
        marginBottom: Platform.OS === 'ios' ? 8 : 0, // и снизу
        borderRadius: 16, // Для контейнера, чтобы тень была скруглённой
        // Тень для контейнера, а не для BlurView
        ...(Platform.OS === 'ios' ? {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -5 },
            shadowOpacity: 0.15,
            shadowRadius: 10,
        } : {
            elevation: 10, // На Android тень будет от bg-custom-surface
        }),
    },
    playlistList: {
        maxHeight: Platform.OS === 'ios' ? 300 : 280, // Ограничиваем высоту списка
    },
});

export default AddToPlaylistModal;
