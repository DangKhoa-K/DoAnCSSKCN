import 'react-native-gesture-handler';
import { View, Text } from 'react-native';

export default function App() {
  console.log('LOADED App.js from D:\\projects\\health-buddy'); // để thấy log
  return (
    <View style={{
      flex: 1,
      backgroundColor: '#ffdddd',           // MÀN ĐỎ DỄ NHẬN BIẾT
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <Text style={{ fontSize: 26, fontWeight: '700' }}>
        App đã chạy ✅ (App.js)
      </Text>
    </View>
  );
}
