// App.js
import './global.css';

import React, { useEffect, useState, useCallback } from 'react';
import { View, Platform, StyleSheet }
    from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// Контекст и Компоненты
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import MiniPlayer from './components/MiniPlayer';

// Экраны
import HomeScreen from './screens/HomeScreen';
import SearchScreen from './screens/SearchScreen';
import LibraryScreen from './screens/LibraryScreen';
import PlayerScreen from './screens/PlayerScreen';
import AlbumDetailScreen from './screens/AlbumDetailScreen';
import ArtistDetailScreen from './screens/ArtistDetailScreen';
import PlaylistDetailScreen from './screens/PlaylistDetailScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const APP_THEME = {
    accentPrimary: '#8DEEED',
    textSecondary: '#A0A0A0',
    tabBarBackground: '#0F0F2B',
    tabBarBorder: '#1A1A3D',
    appBackground: '#030318',
    textPrimary: '#FAFAFA'
};

SplashScreen.preventAutoHideAsync();

function MainTabs() {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName;
                    if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
                    else if (route.name === 'Search') iconName = focused ? 'search' : 'search-outline';
                    else if (route.name === 'LibraryTab') iconName = focused ? 'library' : 'library-outline';

                    if (!iconName) return <Ionicons name="help-circle-outline" size={size} color={color} />;
                    return <Ionicons name={iconName} size={size} color={color} />;
                },
                tabBarActiveTintColor: APP_THEME.accentPrimary,
                tabBarInactiveTintColor: APP_THEME.textSecondary,
                tabBarStyle: {
                    backgroundColor: APP_THEME.tabBarBackground,
                    borderTopColor: Platform.OS === 'ios' ? APP_THEME.tabBarBackground : APP_THEME.tabBarBorder,
                    borderTopWidth: Platform.OS === 'ios' ? 0 : 1,
                    height: Platform.OS === 'android' ? 65 : 85, // Таббар
                    paddingTop: Platform.OS === 'android' ? 5 : 10,
                    paddingBottom: Platform.OS === 'android' ? 5 : 30,
                },
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '600',
                    marginBottom: Platform.OS === 'android' ? 5 : -10,
                },
            })}
        >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Search" component={SearchScreen} />
            <Tab.Screen name="LibraryTab" component={LibraryScreen} options={{ tabBarLabel: 'Library' }} />
        </Tab.Navigator>
    );
}

// Новый компонент-обертка для навигатора, который включает MainTabs и MiniPlayer
function AppStack() {
    const { currentTrack } = usePlayer(); // Получаем currentTrack из контекста

    return (
        <View style={{ flex: 1 }}>
            {/* Основной Stack Navigator */}
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="MainFlow" options={{ headerShown: false }}>
                    {/* Этот экран содержит MainTabs и MiniPlayer */}
                    {() => (
                        <View style={{ flex: 1 }}>
                            <MainTabs />
                            {/* Условное отображение Мини-плеера */}
                            {currentTrack && (
                                <View style={styles.miniPlayerContainer}>
                                    <MiniPlayer />
                                </View>
                            )}
                        </View>
                    )}
                </Stack.Screen>
                {/* Модальные и детальные экраны остаются на том же уровне стека */}
                <Stack.Screen name="Player" component={PlayerScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="AlbumDetail" component={AlbumDetailScreen} options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="ArtistDetail" component={ArtistDetailScreen} options={{ animation: 'slide_from_right' }} />
                <Stack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} options={{ animation: 'slide_from_right' }} />
            </Stack.Navigator>
        </View>
    );
}


export default function App() {
    const [appIsReady, setAppIsReady] = useState(false);

    useEffect(() => {
        async function prepare() {
            try { console.log("App preparation: Done."); }
            catch (e) { console.warn("App preparation error:", e); }
            finally { setAppIsReady(true); }
        }
        prepare();
    }, []);

    const onLayoutRootView = useCallback(async () => {
        if (appIsReady) {
            await SplashScreen.hideAsync();
            console.log("Splash screen: Hidden.");
        }
    }, [appIsReady]);

    if (!appIsReady) {
        return <View style={styles.rootView} onLayout={onLayoutRootView} />;
    }

    return (
        <SafeAreaProvider>
            <PlayerProvider> {/* PlayerProvider оборачивает все */}
                <SafeAreaView style={styles.safeArea} onLayout={onLayoutRootView}>
                    <NavigationContainer>
                        <AppStack /> {/* Используем AppStack вместо прямого Stack.Navigator */}
                    </NavigationContainer>
                </SafeAreaView>
            </PlayerProvider>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    rootView: {
        flex: 1,
        backgroundColor: APP_THEME.appBackground,
    },
    safeArea: {
        flex: 1,
        backgroundColor: APP_THEME.appBackground,
    },
    miniPlayerContainer: {
        position: 'absolute',
        // Высота таб-бара (подберите точное значение для вашего tabBarStyle)
        bottom: Platform.OS === 'android' ? 65 : 85,
        left: 0,
        right: 0,
        zIndex: 100, // Чтобы был поверх контента табов
    },
});
