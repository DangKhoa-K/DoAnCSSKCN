// app/(auth)/sign-in.js
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';

const colors = {
  bg: '#F6F7FB',
  card: '#fff',
  border: '#e5e7eb',
  text: '#111827',
  sub: '#6b7280',
  primary: '#2563eb',
};

function Field({ label, ...props }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ marginBottom: 6, color: colors.text, fontWeight: '600' }}>{label}</Text>
      <TextInput
        {...props}
        style={[
          {
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: '#fff',
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 10,
          },
          props.style,
        ]}
        placeholderTextColor="#9ca3af"
      />
    </View>
  );
}

export default function SignIn() {
  const router = useRouter();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [loading, setLoading] = useState(false);

  // shared
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // signup only
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [repass, setRepass] = useState('');

  const goHome = useCallback(() => {
    router.replace('/(tabs)/home');
  }, [router]);

  const onLogin = useCallback(async () => {
    try {
      if (!email || !password) return Alert.alert('Thiếu thông tin', 'Hãy nhập email và mật khẩu.');
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      goHome();
    } catch (e) {
      Alert.alert('Đăng nhập thất bại', e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [email, password, goHome]);

  const onSignup = useCallback(async () => {
    try {
      if (!name.trim()) return Alert.alert('Thiếu tên', 'Hãy nhập tên hiển thị.');
      if (!email || !password) return Alert.alert('Thiếu thông tin', 'Nhập email và mật khẩu.');
      if (password.length < 6) return Alert.alert('Mật khẩu yếu', 'Ít nhất 6 ký tự.');
      if (password !== repass) return Alert.alert('Mật khẩu', 'Xác nhận mật khẩu không khớp.');
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      const uid = data.user?.id;
      // Lưu hồ sơ cơ bản (Nếu bảng profiles CHƯA có cột phone thì Supabase sẽ báo lỗi — bỏ qua)
      try {
        await supabase.from('profiles').upsert({ uid, display_name: name.trim(), phone: phone || null });
      } catch { /* ignore if 'phone' column doesn’t exist */ }

      Alert.alert('Đã tạo tài khoản', 'Bạn có thể đăng nhập ngay.');
      // Đăng nhập ngay
      const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
      if (e2) throw e2;
      goHome();
    } catch (e) {
      Alert.alert('Đăng ký thất bại', e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [name, email, password, repass, phone, goHome]);

  const onReset = useCallback(async () => {
    if (!email) return Alert.alert('Nhập email', 'Nhập email để nhận link đặt lại mật khẩu.');
    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://example.com/reset' // đặt URL phù hợp nếu có
      });
      if (error) throw error;
      Alert.alert('Đã gửi', 'Hãy kiểm tra email của bạn.');
    } catch (e) {
      Alert.alert('Không gửi được', e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [email]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 20, gap: 14 }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text }}>
          {mode === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản mới'}
        </Text>
        <Text style={{ color: colors.sub }}>
          {mode === 'login'
            ? 'Đăng nhập để tiếp tục hành trình chăm sóc sức khỏe.'
            : 'Đăng ký để theo dõi tập luyện, dinh dưỡng và chăm sóc cá nhân.'}
        </Text>

        {/* Card */}
        <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
          {/* Switcher */}
          <View style={{ flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 10, marginBottom: 16 }}>
            <Pressable
              onPress={() => setMode('login')}
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: 'center',
                borderRadius: 10,
                backgroundColor: mode === 'login' ? '#fff' : 'transparent',
              }}
            >
              <Text style={{ fontWeight: '700', color: mode === 'login' ? colors.text : colors.sub }}>Đăng nhập</Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('signup')}
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: 'center',
                borderRadius: 10,
                backgroundColor: mode === 'signup' ? '#fff' : 'transparent',
              }}
            >
              <Text style={{ fontWeight: '700', color: mode === 'signup' ? colors.text : colors.sub }}>Đăng ký</Text>
            </Pressable>
          </View>

          {mode === 'signup' && (
            <>
              <Field label="Tên hiển thị" placeholder="Ví dụ: Minh Anh" value={name} onChangeText={setName} />
              <Field label="Số điện thoại (tuỳ chọn)" placeholder="VD: 090..." value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            </>
          )}

          <Field label="Email" placeholder="you@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" />
          <Field label="Mật khẩu" placeholder="••••••" secureTextEntry value={password} onChangeText={setPassword} />
          {mode === 'signup' && (
            <Field label="Xác nhận mật khẩu" placeholder="••••••" secureTextEntry value={repass} onChangeText={setRepass} />
          )}

          {/* Action */}
          <Pressable
            onPress={mode === 'login' ? onLogin : onSignup}
            disabled={loading}
            style={{
              marginTop: 6,
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '800' }}>
              {loading ? 'Vui lòng đợi…' : (mode === 'login' ? 'Đăng nhập' : 'Đăng ký')}
            </Text>
          </Pressable>

          {mode === 'login' && (
            <Pressable onPress={onReset} style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={{ color: colors.sub }}>Quên mật khẩu?</Text>
            </Pressable>
          )}
        </View>

        {/* Toggle tip */}
        <Pressable onPress={() => setMode(mode === 'login' ? 'signup' : 'login')} style={{ alignItems: 'center', marginTop: 6 }}>
          <Text style={{ color: colors.sub }}>
            {mode === 'login' ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
            <Text style={{ color: colors.primary, fontWeight: '700' }}>
              {mode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập'}
            </Text>
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
