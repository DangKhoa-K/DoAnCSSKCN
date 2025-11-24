import { useState } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';
import { supabase } from '../lib/supabase';

export default function SignIn({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function onSignIn() {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return Alert.alert('Lỗi đăng nhập', error.message);
    navigation.replace('Home');
  }

  async function onSignUp() {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return Alert.alert('Lỗi đăng ký', error.message);
    Alert.alert('Đăng ký thành công', 'Giờ bấm Đăng nhập.');
  }

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontWeight:'bold', fontSize:18 }}>Đăng nhập</Text>

      <Text>Email</Text>
      <TextInput
        style={{ borderWidth:1, borderRadius:8, padding:10 }}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <Text>Mật khẩu</Text>
      <TextInput
        style={{ borderWidth:1, borderRadius:8, padding:10 }}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Button title="Đăng nhập" onPress={onSignIn} />
      <Button title="Đăng ký" onPress={onSignUp} />
    </View>
  );
}
