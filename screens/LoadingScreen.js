// screens/LoadingScreen.js
import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';

export default function LoadingScreen() {
    return (
        <View className="flex-1 justify-center items-center bg-custom-tertiary">
            <ActivityIndicator size="large" color="#8DEEED" /> {/* custom-primary */}
            <Text className="text-custom-quaternary mt-4">Loading App...</Text>
        </View>
    );
}
