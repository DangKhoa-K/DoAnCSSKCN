import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from '../src/lib/supabase';

export default function Index() {
  const [session, setSession] = useState(undefined); // undefined = đang check

  useEffect(() => {
    let cleanup;
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const sub = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    cleanup = () => sub?.data?.subscription?.unsubscribe?.();
    return () => cleanup?.();
  }, []);

  if (session === undefined) {
    return <View style={{flex:1,alignItems:'center',justifyContent:'center'}}><ActivityIndicator size="large" /></View>;
  }
  return session ? <Redirect href='/(tabs)/home'/> : <Redirect href='/(auth)/sign-in'/>;
}
