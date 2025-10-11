import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import GlobalStyles from '../styles/GlobalStyles';

// A modern floating toolbar. Uses emoji icons to avoid adding icon deps.
export default function Toolbar({ actions = {} }) {
  return (
    <View style={GlobalStyles.toolbarFloating} pointerEvents="box-none">
      <View style={GlobalStyles.toolbarInner}>
        {actions.undo && (
          <TouchableOpacity
            style={[GlobalStyles.toolbarButton, GlobalStyles.toolbarButtonSecondary]}
            onPress={actions.undo}
          >
            <Text style={GlobalStyles.toolbarButtonIcon}>↺</Text>
            <Text style={GlobalStyles.toolbarLabel}>Undo</Text>
          </TouchableOpacity>
        )}

        {actions.redo && (
          <TouchableOpacity
            style={[GlobalStyles.toolbarButton, GlobalStyles.toolbarButtonSecondary]}
            onPress={actions.redo}
          >
            <Text style={GlobalStyles.toolbarButtonIcon}>↻</Text>
            <Text style={GlobalStyles.toolbarLabel}>Redo</Text>
          </TouchableOpacity>
        )}

        {actions.clear && (
          <TouchableOpacity
            style={[GlobalStyles.toolbarButton, GlobalStyles.toolbarButtonDanger]}
            onPress={actions.clear}
          >
            <Text style={GlobalStyles.toolbarButtonIcon}>🗑️</Text>
            <Text style={GlobalStyles.toolbarLabel}>Clear</Text>
          </TouchableOpacity>
        )}

        {actions.save && (
          <TouchableOpacity
            style={[GlobalStyles.toolbarButton, GlobalStyles.toolbarButtonPrimary]}
            onPress={actions.save}
          >
            <Text style={GlobalStyles.toolbarButtonIcon}>💾</Text>
            <Text style={GlobalStyles.toolbarLabel}>Save</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
