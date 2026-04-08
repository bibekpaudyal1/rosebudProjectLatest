import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Search, ShoppingCart, Package, User } from 'lucide-react-native';
import { useCartStore } from '@/store/cart.store';
import { COLORS } from '@/theme';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const cartCount = useCartStore((s) => s.itemCount);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth:  0.5,
          borderTopColor:  '#E5E7EB',
          height:          56 + insets.bottom,
          paddingBottom:   insets.bottom,
          elevation:       8,
          shadowColor:     '#000',
          shadowOffset:    { width: 0, height: -2 },
          shadowOpacity:   0.06,
          shadowRadius:    8,
        },
        tabBarActiveTintColor:   COLORS.green,
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarLabelStyle: {
          fontSize:   10,
          fontFamily: 'PlusJakartaSans_600SemiBold',
          marginTop:  -2,
        },
        tabBarIconStyle: { marginTop: 4 },
      }}
    >
      <Tabs.Screen name="index"   options={{ title: 'Home',   tabBarIcon: ({ color }) => <Home   size={22} color={color} /> }} />
      <Tabs.Screen name="search"  options={{ title: 'Search', tabBarIcon: ({ color }) => <Search size={22} color={color} /> }} />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color }) => (
            <View>
              <ShoppingCart size={22} color={color} />
              {cartCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen name="orders"  options={{ title: 'Orders',  tabBarIcon: ({ color }) => <Package size={22} color={color} /> }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: ({ color }) => <User    size={22} color={color} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position:        'absolute',
    top:             -5,
    right:           -8,
    backgroundColor: '#F57C00',
    borderRadius:    9,
    minWidth:        18,
    height:          18,
    paddingHorizontal: 4,
    alignItems:      'center',
    justifyContent:  'center',
  },
  badgeText: {
    color:      '#FFF',
    fontSize:   9,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});
