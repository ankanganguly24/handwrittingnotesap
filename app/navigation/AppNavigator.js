import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CanvasScreen from '../../src/screens/CanvasScreen';
import RecognitionScreen from '../../src/screens/RecognitionScreen';
import CollaborationScreen from '../../src/screens/CollaborationScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Canvas">
        <Stack.Screen name="Canvas" component={CanvasScreen} />
        <Stack.Screen name="Recognition" component={RecognitionScreen} />
        <Stack.Screen name="Collaboration" component={CollaborationScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
