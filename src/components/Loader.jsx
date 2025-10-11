import { View, ActivityIndicator, Text } from 'react-native';
import GlobalStyles from '../styles/GlobalStyles';

export default function Loader({ message = 'Loading...' }) {
  return (
    <View style={GlobalStyles.flexCenter}>
      <ActivityIndicator size="large" color="#4B7BE5" />
      <Text style={{ marginTop: 10 }}>{message}</Text>
    </View>
  );
}
