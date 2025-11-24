import { useEffect, useState } from 'react';
import { View, Text, Button, Alert } from 'react-native';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';

export default function Home() {
  const [msg, setMsg] = useState('Đang kiểm tra kết nối backend...');

  useEffect(() => {
    api('/api/ping')
      .then(r => setMsg(`Ping OK: ${r.from} @ ${r.time}`))
      .catch(e => setMsg('Lỗi gọi backend: ' + e.message));
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    Alert.alert('Đã đăng xuất');
  }

  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center', gap: 12 }}>
      <Text style={{ fontSize:16 }}>{msg}</Text>
      <Button title="Đăng xuất" onPress={signOut} />
    </View>
  );
}
