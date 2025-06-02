// components/TrackOptionsMenuModal.js
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // MaterialCommunityIcons можно добавить, если нужны другие иконки
import { usePlayer } from '../context/PlayerContext';
import { isTrackLiked as checkIsTrackLikedGlobally } from '../utils/storage';

// Цвета (адаптируйте или используйте Tailwind классы через config/props)
const ICON_COLOR_PRIMARY_MENU = '#FAFAFA';      // custom-quaternary
const ICON_COLOR_SECONDARY_MENU = '#A0A0A0';   // custom-text-secondary
const ICON_COLOR_ACCENT_MENU = '#8DEEED';     // custom-primary
const MENU_BG_COLOR = '#1A1A38';       // Темнее, чем основной surface, например custom-surface-deep или zinc-800
const MENU_BORDER_COLOR = '#2C2C54';   // Чуть светлее фона меню, ваш custom-border или zinc-700
const MENU_TEXT_COLOR = '#FAFAFA';     // custom-quaternary
const MENU_CANCEL_TEXT_COLOR = '#8DEEED'; // custom-primary
const MENU_ITEM_ACTIVE_BG = '#2C2C54'; // Для active:bg-custom-surface-hover или zinc-700

const TrackOptionsMenuModal = ({
                                   visible,
                                   onClose,
                                   track,
                                   // Колбэки для действий
                                   onPlayNext,         // (track) => void
                                   onAddToQueue,       // (track) => void
                                   onAddToPlaylist,    // (track) => void (эта функция откроет AddToPlaylistModal)
                                   onToggleLike,       // async (track, currentLikeStatus) => void (возвращает новое состояние лайка для UI)
                                   onGoToAlbum,        // (track) => void
                                   onGoToArtist,       // (track) => void
                                   onRemoveFromPlaylist, // (track) => void (только для PlaylistDetailScreen)
                                   // Дополнительная информация
                                   isAlbumScreen = false, // Флаг, если мы на экране альбома (чтобы не показывать "Go to Album")
                                   isArtistScreen = false, // Флаг, если мы на экране артиста
                                   isPlaylistScreen = false, // Флаг, если мы на экране плейлиста (чтобы показать "Remove from this playlist")
                               }) => {
    const { currentTrack: currentPlayerTrack, isLiked: isCurrentTrackLikedInContext } = usePlayer();
    const [isThisTrackLiked, setIsThisTrackLiked] = useState(false);

    useEffect(() => {
        const determineLikeStatus = async () => {
            if (track?.id) {
                if (currentPlayerTrack?.id === track.id) {
                    setIsThisTrackLiked(isCurrentTrackLikedInContext);
                } else {
                    setIsThisTrackLiked(await checkIsTrackLikedGlobally(track.id));
                }
            } else {
                setIsThisTrackLiked(false);
            }
        };
        if (visible && track) {
            determineLikeStatus();
        }
    }, [visible, track, currentPlayerTrack, isCurrentTrackLikedInContext]);

    if (!track) return null;

    const handleLikeTogglePress = async () => {
        if (onToggleLike) {
            const newLikeStatus = await onToggleLike(track, isThisTrackLiked);
            if (newLikeStatus !== undefined) { // Если колбэк вернул новое состояние
                setIsThisTrackLiked(newLikeStatus);
            } else { // Если колбэк не вернул, оптимистично инвертируем
                setIsThisTrackLiked(prev => !prev);
            }
        }
    };

    return (
        <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onClose}>
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
                <View style={styles.modalContentContainer}>
                    <View
                        onStartShouldSetResponder={() => true} // Предотвращает закрытие по клику на контент
                        style={styles.menuView} // Используем StyleSheet для основного фона и скругления
                        className="w-full shadow-xl"
                    >
                        <View className="py-3 px-4 items-center border-b border-custom-border/30 mb-1">
                            <Text className="text-lg font-bold text-custom-quaternary text-center" numberOfLines={1}>{track.title}</Text>
                            <Text className="text-sm text-custom-quaternary/70 text-center" numberOfLines={1}>{track.artist}</Text>
                        </View>

                        {onPlayNext && <OptionItem icon="play-forward-outline" text="Play Next" onPress={() => { onPlayNext(track); onClose(); }} />}
                        {onAddToQueue && <OptionItem icon="list-circle-outline" text="Add to Queue" onPress={() => { onAddToQueue(track); onClose(); }} />}
                        {onAddToPlaylist && <OptionItem icon="add-circle-outline" text="Add to Playlist..." onPress={() => { onAddToPlaylist(track); onClose(); }} />}

                        {onToggleLike && (
                            <OptionItem
                                icon={isThisTrackLiked ? "heart" : "heart-outline"}
                                text={isThisTrackLiked ? "Unlike" : "Like"}
                                iconColor={isThisTrackLiked ? ICON_COLOR_ACCENT_MENU : ICON_COLOR_PRIMARY_MENU}
                                onPress={handleLikeTogglePress}
                            />
                        )}

                        {isPlaylistScreen && onRemoveFromPlaylist && (
                            <OptionItem icon="trash-outline" text="Remove from this Playlist" textStyle={{ color: ICON_COLOR_SECONDARY_MENU }} iconColor={ICON_COLOR_SECONDARY_MENU} onPress={() => { onRemoveFromPlaylist(track); onClose(); }} />
                        )}

                        {!isAlbumScreen && onGoToAlbum && track.album && track.album !== "—" && (
                            <OptionItem icon="albums-outline" text="Go to Album" onPress={() => { onGoToAlbum(track); onClose(); }} />
                        )}
                        {!isArtistScreen && onGoToArtist && track.artist && (
                            <OptionItem icon="person-outline" text="Go to Artist" onPress={() => { onGoToArtist(track); onClose(); }} />
                        )}

                        <TouchableOpacity onPress={onClose} style={[styles.optionItem, styles.cancelOptionItem]} className="active:bg-custom-surface-hover">
                            <Text style={[styles.optionText, styles.cancelOptionText]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

const OptionItem = ({ icon, text, onPress, iconColor = ICON_COLOR_PRIMARY_MENU, textStyle = {} }) => (
    <TouchableOpacity onPress={onPress} style={styles.optionItem} className="active:bg-custom-surface-hover">
        {icon && <Ionicons name={icon} size={24} color={iconColor} style={styles.optionIcon} />}
        <Text style={[styles.optionText, textStyle]}>{text}</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    modalContentContainer: { width: '100%', paddingHorizontal: 8, paddingBottom: Platform.OS === 'ios' ? 20 : 8 }, // Отступы для тени и безопасной зоны
    menuView: { backgroundColor: MENU_BG_COLOR, borderRadius: 16, },
    optionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, borderTopWidth: StyleSheet.hairlineWidth, borderColor: MENU_BORDER_COLOR, },
    optionIcon: { marginRight: 20, width: 24, textAlign: 'center' },
    optionText: { fontSize: 16, color: MENU_TEXT_COLOR },
    cancelOptionItem: { marginTop: 8, borderTopWidth: 1, borderColor: MENU_BORDER_COLOR, }, // Более заметный разделитель
    cancelOptionText: { color: MENU_CANCEL_TEXT_COLOR, textAlign: 'center', fontWeight: '600' },
});

export default TrackOptionsMenuModal;
