import { View } from 'react-native';
import { Canvas, Path } from '@shopify/react-native-skia';
import GlobalStyles from '../styles/GlobalStyles';

export default function StrokePreview({ strokes = [] }) {
  return (
    <View style={GlobalStyles.strokePreviewContainer}>
      <Canvas style={{ flex: 1 }}>
        {strokes.map((stroke, idx) => (
          <Path
            key={idx}
            path={stroke.path}
            color={stroke.color || 'black'}
            style="stroke"
            strokeWidth={stroke.width || 2}
          />
        ))}
      </Canvas>
    </View>
  );
}
