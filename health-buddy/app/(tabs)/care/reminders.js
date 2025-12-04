import { Link, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

const C = { bg:'#F6F7FB', card:'#fff', b:'#e5e7eb', text:'#0f172a', sub:'#64748b', primary:'#2563eb' };

export default function CareReminders() {
  const router = useRouter();
  return (
    <ScrollView style={{ flex:1, backgroundColor:C.bg, padding:16 }}>
      <Pressable onPress={()=>router.back()}><Text style={{ color:C.primary, marginBottom:8 }}>‹ Quay lại</Text></Pressable>
      <Text style={{ fontSize:22, fontWeight:'800', color:C.text }}>Nhắc nhở sức khỏe</Text>
      <Text style={{ color:C.sub, marginTop:4 }}>Quản lý nhắc đi ngủ/ thức dậy, uống nước, uống thuốc.</Text>

      <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.b, borderRadius:12, padding:12, marginTop:12 }}>
        <Link href='/(tabs)/care/sleep' asChild>
          <Pressable style={{ paddingVertical:12, borderBottomWidth:1, borderBottomColor:'#F1F5F9' }}>
            <Text style={{ color:C.text, fontWeight:'700' }}>Nhắc giờ đi ngủ/ thức dậy</Text>
            <Text style={{ color:C.sub, marginTop:4 }}>Đặt giờ cố định hằng ngày</Text>
          </Pressable>
        </Link>
        <Link href='/(tabs)/care/hydration' asChild>
          <Pressable style={{ paddingVertical:12, borderBottomWidth:1, borderBottomColor:'#F1F5F9' }}>
            <Text style={{ color:C.text, fontWeight:'700' }}>Nhắc uống nước</Text>
            <Text style={{ color:C.sub, marginTop:4 }}>Đặt giờ nhắc uống nước hằng ngày</Text>
          </Pressable>
        </Link>
        <Link href='/(tabs)/care/meds' asChild>
          <Pressable style={{ paddingVertical:12 }}>
            <Text style={{ color:C.text, fontWeight:'700' }}>Nhắc uống thuốc/vitamin</Text>
            <Text style={{ color:C.sub, marginTop:4 }}>Chọn giờ và lặp theo ngày</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}