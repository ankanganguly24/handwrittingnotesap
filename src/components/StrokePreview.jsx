import { View, Dimensions } from 'react-native';
import { Canvas, Path } from '@shopify/react-native-skia';
import GlobalStyles from '../styles/GlobalStyles';

const { width: screenWidth } = Dimensions.get('window');

export default function StrokePreview({ 
  allStrokes = [], 
  currentStroke = [], 
  canvasLayout = null 
}) {
  const pointsToSvgPath = points => {
    if (!points || points.length === 0) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  };

  const getScaledPath = (points) => {
    if (!points || points.length === 0 || !canvasLayout) return '';
    
    // Calculate scale factor based on canvas vs preview size
    const previewWidth = screenWidth * 0.3; // Assuming preview is 30% of screen width
    const previewHeight = 80; // Assuming preview height from styles
    
    const scaleX = previewWidth / canvasLayout.width;
    const scaleY = previewHeight / canvasLayout.height;
    const scale = Math.min(scaleX, scaleY);
    
    const scaledPoints = points.map(point => ({
      x: point.x * scale,
      y: point.y * scale
    }));
    
    return pointsToSvgPath(scaledPoints);
  };

  return (
    <View style={GlobalStyles.strokePreviewContainer}>
      <Canvas style={{ flex: 1 }}>
        {/* Render all completed strokes */}
        {allStrokes.map((stroke, idx) => {
          const scaledPath = getScaledPath(stroke);
          return scaledPath ? (
            <Path
              key={`completed-${idx}`}
              path={scaledPath}
              color="black"
              style="stroke"
              strokeWidth={1.5}
            />
          ) : null;
        })}
        
        {/* Render current stroke being drawn */}
        {currentStroke.length > 0 && (
          <Path
            key="current-stroke"
            path={getScaledPath(currentStroke)}
            color="red"
            style="stroke"
            strokeWidth={1.5}
          />
        )}
      </Canvas>
    </View>
  );
}
